import { CONFIG } from './config';
import { RNG, clamp, copy, lerp } from './math';
import type { Ball, Delivery, Difficulty, Direction, Match, Outcome, Phase, RenderFrame, Shot, ShotType, Team, Vec3 } from './types';
import { createMatch, applyOutcome } from '../match/match';
import { generateDelivery } from '../bowling/bowling';
import { createBall, stepBall } from '../physics/ball';
import { groundEvent, groundRuns, loftOutcome } from '../fielding/fielding';
import { createShot, launchVelocity, sweptBatContact } from '../batting/batting';
import { sampleBatPose, samplePadGeometry } from '../animation/pose';
import { sweepCapsule, sweepStumps } from '../physics/collision';

export interface GameEvents {
  bounce?: (point: Vec3, time: number) => void;
  contact?: (outcome: Outcome) => void;
  result?: (outcome: Outcome) => void;
  next?: () => void;
}

/** The sole simulation owner. Rendering can run at any frequency. */
export class CricketGame {
  phase: Phase = 'menu';
  match: Match | null = null;
  delivery: Delivery | null = null;
  ball: Ball | null = null;
  shot: Shot | null = null;
  outcome: Outcome | null = null;
  paused = false;
  time = 0;
  phaseTime = 0;
  deliveryTime = 0;
  milestone = false;
  debug = false;
  contactDebug: Record<string, unknown> | null = null;
  inputLog: { time: number; type: ShotType; direction: Direction }[] = [];
  private rng = new RNG(1);
  private accumulator = 0;
  private aerial = false;
  private currentConfidence = 50;
  private hit = false;
  private resolved = false;
  private contactContribution = -50;
  private contactQuality: Outcome['quality'] = 'miss';
  private overChanged = false;

  constructor(private events: GameEvents = {}) {}

  start(team: Team, difficulty: Difficulty, seed: number = crypto.getRandomValues(new Uint32Array(1))[0]) {
    this.match = createMatch(team,difficulty,seed);
    this.rng = new RNG(seed ^ 0xA3C59AC3);
    this.time = 0; this.accumulator = 0; this.paused = false; this.inputLog = [];
    this.prepareDelivery();
  }
  menu() {
    this.phase='menu'; this.match=null; this.delivery=null; this.ball=null;
    this.shot=null; this.outcome=null; this.phaseTime=0; this.paused=false; this.accumulator=0;
  }
  setup() { this.phase='setup'; this.phaseTime=0; }
  private setPhase(phase: Phase) { this.phase=phase;this.phaseTime=0; }
  private prepareDelivery() {
    if(!this.match || this.match.complete) { this.setPhase('complete'); return; }
    this.delivery=generateDelivery(this.match,this.rng);
    this.currentConfidence=this.match.batters[this.match.striker].confidence;
    this.ball=null; this.shot=null; this.outcome=null;this.milestone=false;
    this.aerial=false;this.hit=false;this.resolved=false;this.contactDebug=null;
    this.contactContribution=-50;this.contactQuality='miss';this.deliveryTime=0;
    this.setPhase('runup');this.events.next?.();
  }
  commit(type: ShotType,direction: Direction): boolean {
    if(this.paused || this.phase!=='delivery' || this.shot || !this.delivery) return false;
    this.shot=createShot(this.delivery,type,direction,this.deliveryTime);
    this.inputLog.push({time:this.deliveryTime,type,direction});
    return true;
  }
  advancePresentation() {
    if(this.phase==='feedback')this.phaseTime=Math.max(this.phaseTime,this.feedbackDuration());
  }
  togglePause() {
    if(['runup','delivery','outgoing','feedback'].includes(this.phase)) {
      this.paused=!this.paused;this.accumulator=0;
    }
  }
  get timeScale(): number {
    return this.match ? CONFIG.difficulty[this.match.difficulty].timeScale : 1;
  }
  /** Browser wall time enters here once, for both frames and timestamped input.
   * advance() remains simulation time for deterministic scenarios and replay. */
  advanceRealTime(elapsed: number) {
    this.advance(elapsed * this.timeScale);
  }
  advance(elapsed: number) {
    if(this.paused || this.phase==='menu' || this.phase==='setup' || this.phase==='complete')return;
    this.accumulator+=Math.max(0,elapsed);
    let steps=0;
    // Preserve excess accumulated time; never skip a collision or scoring event.
    while(this.accumulator+1e-10>=CONFIG.step && steps++<120) {
      this.tick(CONFIG.step);this.accumulator-=CONFIG.step;
      if(this.phase==='complete' as Phase) {this.accumulator=0;break;}
    }
  }
  private tick(dt:number) {
    this.time+=dt;this.phaseTime+=dt;
    if(this.phase==='runup') {
      if(this.phaseTime>=CONFIG.runup && this.delivery) {
        this.ball=createBall(this.delivery);this.deliveryTime=0;this.setPhase('delivery');
      }
      return;
    }
    this.deliveryTime+=dt;
    if(this.phase==='feedback') {
      if(this.phaseTime>=this.feedbackDuration()) {
        if(this.match?.complete)this.setPhase('complete');else this.prepareDelivery();
      }
      return;
    }
    if(!this.ball || !this.delivery)return;
    const previous=copy(this.ball.position);
    const incoming=copy(this.ball.velocity);
    const physics=stepBall(this.ball,dt,this.phase==='delivery'?this.delivery:null,this.phase==='outgoing');
    if(physics.bounced && physics.landing)this.events.bounce?.(physics.landing,this.time);

    if(this.phase==='delivery') {
      const shot=this.shot;
      const blocker=this.blockingEvent(previous,this.ball.position,dt);
      if(shot && shot.stroke!=='duck') {
        const age=this.deliveryTime-shot.committedAt;
        const before=sampleBatPose(shot,age-dt,this.delivery,this.time-dt);
        const after=sampleBatPose(shot,age,this.delivery,this.time);
        const collision=sweptBatContact(previous,this.ball.position,before,after);
        if(collision && (!blocker || collision.t<blocker.t) && age>0.01 && age<CONFIG.lead[shot.stroke]+0.45) {
          this.ball.position=collision.point;
          const batSpeed=Math.hypot(after.toe.x-before.toe.x,after.toe.y-before.toe.y,after.toe.z-before.toe.z)/dt;
          const launch=launchVelocity(shot,incoming,this.currentConfidence,collision.offset,batSpeed,this.rng);
          this.ball.velocity=launch.velocity;this.ball.bounced=false;
          this.aerial=launch.aerial;this.hit=true;
          this.contactQuality=shot.quality==='miss'?'mistimed':shot.quality;
          const goodDefense=shot.type==='defend' && shot.raw>=0.6;
          this.contactContribution=clamp(goodDefense?10:shot.contribution-collision.offset*15,-50,50);
          if(shot.type!=='defend' && Math.abs(shot.timingError)<=1e-3 && collision.offset<0.1)this.contactContribution=50;
          this.contactDebug={point:copy(collision.point),time:this.deliveryTime,expected:this.delivery.arrival,timingError:shot.timingError,offset:collision.offset,batSpeed,raw:launch.raw,confidence:this.currentConfidence,aerial:this.aerial};
          this.setPhase('outgoing');
          this.events.contact?.(this.makeOutcome(0));
          return;
        }
      }
      if(blocker) {
        this.ball.position=blocker.point;this.ball.velocity={x:0,y:0,z:0};
        this.resolve({...this.makeOutcome(0),...(blocker.wicket?{wicket:blocker.wicket}:{})});return;
      }
      if(this.ball.position.z< -2.4 || this.deliveryTime>this.delivery.arrival+1) {
        if(shot?.stroke==='duck' && this.delivery.contact.y>CONFIG.batting.duckHeight && Math.abs(shot.timingError)<CONFIG.timing.defend.outer) {
          this.contactContribution=0;this.contactQuality='good';
        }
        this.resolve(this.makeOutcome(0));
      }
    } else if(this.phase==='outgoing') {
      // An inside edge or backward mishit can still hit the real wicket.
      // Bat contact excludes LBW, but never makes the stumps non-physical.
      const stumpHit=sweepStumps(previous,this.ball.position);
      if(stumpHit){
        this.ball.position=stumpHit.point;this.ball.velocity={x:0,y:0,z:0};
        this.resolve({...this.makeOutcome(0),wicket:'bowled'});return;
      }
      if(this.aerial) {
        if(physics.landing) {
          const result=loftOutcome(physics.landing,this.delivery.field,this.currentConfidence,this.rng);
          this.ball.position=copy(physics.landing);this.ball.velocity={x:0,y:0,z:0};
          this.resolve({...this.makeOutcome(result.runs),...result});
        }
      } else {
        const field=groundEvent(previous,this.ball.position,this.delivery.field);
        if(field) {
          this.ball.position={...field.position};
          this.ball.velocity={x:0,y:0,z:0};
          this.resolve(this.makeOutcome(field.kind==='boundary'?4:groundRuns(Math.hypot(field.position.x,field.position.z))));
        } else if(this.ball.position.y<=CONFIG.ballRadius+0.005 && Math.hypot(this.ball.velocity.x,this.ball.velocity.z)<CONFIG.physics.rollingStopSpeed) {
          this.ball.velocity={x:0,y:0,z:0};
          this.resolve(this.makeOutcome(groundRuns(Math.hypot(this.ball.position.x,this.ball.position.z))));
        }
      }
    }
  }
  private blockingEvent(a: Vec3,b: Vec3,dt:number):{t:number;point:Vec3;wicket?:'bowled'|'lbw'}|null {
    if(!this.delivery || !this.ball)return null;
    const age=this.shot?this.deliveryTime-this.shot.committedAt:0;
    const before=samplePadGeometry(this.shot,age-dt,this.delivery,this.time-dt);
    const after=samplePadGeometry(this.shot,age,this.delivery,this.time);
    let result:{t:number;point:Vec3;wicket?:'bowled'|'lbw'}|null=null;
    const stumps=sweepStumps(a,b);
    if(stumps)result={...stumps,wicket:'bowled'};
    for(let i=0;i<before.length;i++) {
      const hit=sweepCapsule(a,b,before[i],after[i],CONFIG.ballRadius);
      if(!hit || (result && result.t<=hit.t))continue;
      let lbw=false;
      // Simplified LBW: physically hit a visible pad, pitch not outside leg,
      // impact in the wicket corridor, and the unimpeded ball would hit stumps.
      if(this.delivery.bounce.x<=CONFIG.stump.halfWidth && Math.abs(hit.point.x)<=CONFIG.stump.halfWidth+CONFIG.ballRadius) {
        const probe:Ball={position:copy(hit.point),velocity:copy(this.ball.velocity),bounced:this.ball.bounced};
        for(let j=0;j<60 && probe.position.z>CONFIG.stump.z-0.1;j++) {
          const last=copy(probe.position);stepBall(probe,CONFIG.step,this.delivery);
          if(sweepStumps(last,probe.position)){lbw=true;break;}
        }
      }
      result={...hit,...(lbw?{wicket:'lbw' as const}:{})};
    }
    return result;
  }
  private makeOutcome(runs:number):Outcome {
    return {runs,quality:this.contactQuality,contribution:this.contactContribution,
      direction:this.shot?.direction,shotType:this.shot?.type,timingError:this.shot?.timingError};
  }
  private resolve(outcome:Outcome) {
    if(this.resolved || !this.match)return;
    this.resolved=true;this.outcome=outcome;
    const update=applyOutcome(this.match,outcome);
    this.match=update.match;this.milestone=update.milestone;this.overChanged=update.overChanged;
    this.setPhase('feedback');this.events.result?.(outcome);
  }
  private feedbackDuration() {
    return this.outcome?.wicket?CONFIG.wicketFeedback:this.milestone||this.overChanged?1.65:CONFIG.feedback;
  }
  frame(): RenderFrame {
    let marker=0;
    if(this.phase==='delivery' && this.delivery && this.ball && !this.ball.bounced && this.match) {
      const visible=this.delivery.arrival*CONFIG.difficulty[this.match.difficulty].marker;
      const dz=this.delivery.bounce.z-this.delivery.release.z;
      const bounceTime=-Math.log(1-CONFIG.airDrag*dz/this.delivery.velocity.z)/CONFIG.airDrag;
      if(this.deliveryTime>visible)marker=clamp((this.deliveryTime-visible)/0.06)*clamp((bounceTime-this.deliveryTime)/0.065)*0.4;
    }
    return {time:this.time,phase:this.phase,phaseTime:this.phaseTime,match:this.match,delivery:this.delivery,
      ball:this.ball,shot:this.shot,shotAge:this.shot?this.deliveryTime-this.shot.committedAt:0,
      contactAge:this.hit&&this.contactDebug?this.deliveryTime-(this.contactDebug.time as number):0,
      marker,outcome:this.outcome,milestone:this.milestone,debug:this.debug};
  }
}
