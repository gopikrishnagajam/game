import { describe,expect,it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { ARM_LOWER,ARM_UPPER,sampleBatPose,sampleBatterBody,sampleBatterPose,sampleGripPoints,samplePadGeometry,strokeDuration } from '../src/animation/pose';
import type { Shot,Stroke } from '../src/core/types';

function shot(stroke:Stroke='straightDrive',type:Shot['type']='ground',y=.7):Shot {
  return {type,direction:'straight',stroke,committedAt:0,contactAt:CONFIG.lead[stroke],target:{x:0,y,z:CONFIG.contactZ},angle:0,suitability:1,timingError:0,quality:'perfect',raw:1,contribution:50};
}
const center=(pose:ReturnType<typeof sampleBatPose>)=>({x:(pose.heel.x+pose.toe.x)/2,y:(pose.heel.y+pose.toe.y)/2,z:(pose.heel.z+pose.toe.z)/2});

describe('authoritative authored animation geometry',()=>{
  it('puts the blade at the physical contact target with a forward contact sweep',()=>{
    const s=shot();const lead=CONFIG.lead[s.stroke];
    const at=center(sampleBatPose(s,lead,null));
    expect(at.x).toBeCloseTo(s.target.x,10);expect(at.y).toBeCloseTo(s.target.y,10);expect(at.z).toBeCloseTo(s.target.z,10);
    const before=center(sampleBatPose(s,lead-.001,null));const after=center(sampleBatPose(s,lead+.001,null));
    const forwardSpeed=(after.z-before.z)/.002;
    expect(forwardSpeed).toBeGreaterThan(0);expect(forwardSpeed).toBeLessThan(15);
  });
  it('allows low contact at the toe without putting the blade below the pitch',()=>{
    const s=shot('forwardDefense','defend',.09);const at=sampleBatPose(s,CONFIG.lead[s.stroke],null);
    expect(at.toe.y).toBeGreaterThanOrEqual(-.01);
    expect(s.target.y).toBeGreaterThan(at.toe.y);expect(s.target.y).toBeLessThan(at.heel.y);
  });
  it('samples deterministically and recovers continuously to the ready stance',()=>{
    const s=shot();
    expect(sampleBatPose(s,.192,null,3)).toEqual(sampleBatPose(s,.192,null,3));
    const recovered=sampleBatPose(s,2,null,3),ready=sampleBatPose(null,0,null,3);
    expect(recovered.heel).toEqual(ready.heel);expect(recovered.toe).toEqual(ready.toe);
  });
  it('authors distinct cut geometry and lofted followthrough',()=>{
    const drive=shot(),cut={...shot('cut'),angle:-Math.PI/2};
    const d=sampleBatPose(drive,CONFIG.lead.straightDrive,null),c=sampleBatPose(cut,CONFIG.lead.cut,null);
    expect(Math.abs(c.heel.x-c.toe.x)).toBeGreaterThan(.6);
    expect(Math.abs(d.heel.y-d.toe.y)).toBeGreaterThan(.6);
    const loft=shot('loftStraight','loft');
    expect(center(sampleBatPose(loft,CONFIG.lead.loftStraight+.35,null)).y).toBeGreaterThan(center(sampleBatPose(drive,CONFIG.lead.straightDrive+.35,null)).y);
  });
  it('moves the front foot forward and the back foot back for different deliveries',()=>{
    const forward=sampleBatterBody(shot(),.3,null,0),back=sampleBatterBody(shot('backPunch'),.3,null,0);
    expect(forward.leftFoot.z).toBeGreaterThan(.3);expect(back.leftFoot.z).toBeLessThan(.2);
    const duck=sampleBatterBody(shot('duck','defend'),CONFIG.lead.duck,null,0),ready=sampleBatterBody(null,0,null,0);
    expect(duck.head.y).toBeLessThan(ready.head.y-.3);
  });
  it('samples exactly two shin pads below the hips and moves them with footwork',()=>{
    const idle=samplePadGeometry(null,0,null),s=shot(),moving=samplePadGeometry(s,.3,null);
    expect(idle).toHaveLength(2);
    for(const pad of idle) {
      expect(pad.a.y).toBeLessThan(.7);expect(pad.b.y).toBeGreaterThan(0);
      expect(pad.a.y).toBeGreaterThan(pad.b.y);expect(pad.radius).toBe(.085);
      expect(Math.hypot(pad.a.x-pad.b.x,pad.a.y-pad.b.y,pad.a.z-pad.b.z)).toBeCloseTo(.39,8);
    }
    expect(moving[0].a.z).toBeGreaterThan(idle[0].a.z+.05);
    expect(samplePadGeometry(s,.3,null)).toEqual(moving);
  });
  it('plants the front foot before contact and keeps it on the leg side of the bat line',()=>{
    const s=shot('coverDrive');s.target.x=-.4;s.angle=-Math.PI/4;
    const lead=CONFIG.lead[s.stroke];
    const planted=sampleBatterBody(s,lead*.9,null,0),contact=sampleBatterBody(s,lead,null,0);
    expect(planted.leftFoot).toEqual(contact.leftFoot);
    expect(contact.leftFoot.x-s.target.x).toBeGreaterThanOrEqual(.24);
    expect(contact.leftFoot.z).toBeLessThan(CONFIG.contactZ-.15);
  });
  it('keeps ordinary contact and followthrough grips within the actual arm length',()=>{
    for(const stroke of ['straightDrive','coverDrive','forwardDefense','loftStraight','cut','pull'] as Stroke[]) {
      const horizontal=stroke==='cut'||stroke==='pull';
      for(const x of stroke==='pull'?[0,.35]:[-.4,0,.35])for(const y of horizontal?[.65,1,1.3]:[.15,.3,.7,1.3]) {
        const s=shot(stroke,stroke==='forwardDefense'?'defend':stroke==='loftStraight'?'loft':'ground',y);
        s.target.x=x;s.angle=stroke==='coverDrive'?-Math.PI/4:stroke==='cut'?-Math.PI/2:stroke==='pull'?Math.PI/2:0;
        const lead=CONFIG.lead[stroke];
        for(const age of [lead,lead+.03,lead+.08,lead+.16,lead+.35]) {
          const hands=sampleGripPoints(sampleBatPose(s,age,null)),body=sampleBatterBody(s,age,null,0);
          for(const [shoulder,hand] of [[body.leftShoulder,hands[0]],[body.rightShoulder,hands[1]]]) {
            expect(Math.hypot(shoulder.x-hand.x,shoulder.y-hand.y,shoulder.z-hand.z)).toBeLessThanOrEqual(ARM_UPPER+ARM_LOWER+.001);
          }
        }
      }
    }
  });

  it('uses one shared rigid pose for rendering throughout the stroke',()=>{
    for(const stroke of Object.keys(CONFIG.lead) as Stroke[]) {
      const s=shot(stroke,stroke.toLowerCase().includes('defense')||stroke==='duck'?'defend':stroke.startsWith('loft')?'loft':'ground');
      for(let age=0;age<strokeDuration(s)+.05;age+=.011){
        const pose=sampleBatterPose(s,age,null,2);
        expect(pose.bat).toEqual(sampleBatPose(s,age,null,2));
        expect(pose.body).toEqual(sampleBatterBody(s,age,null,2));
        expect(Math.hypot(pose.bat.heel.x-pose.bat.toe.x,pose.bat.heel.y-pose.bat.toe.y,pose.bat.heel.z-pose.bat.toe.z)).toBeCloseTo(.69,10);
      }
    }
  });
  it('starts from the ready grip without a snap and moves on the next simulation step',()=>{
    for(const stroke of ['straightDrive','coverDrive','loftStraight','cut','pull','forwardDefense'] as Stroke[]){
      const s=shot(stroke,stroke==='forwardDefense'?'defend':stroke==='loftStraight'?'loft':'ground');
      const ready=sampleBatPose(null,0,null,3),at=sampleBatPose(s,0,null,3),next=sampleBatPose(s,CONFIG.step,null,3+CONFIG.step);
      expect(at).toEqual(ready);
      expect(Math.hypot(next.toe.x-at.toe.x,next.toe.y-at.toe.y,next.toe.z-at.toe.z)).toBeGreaterThan(.004);
      for(const scale of [.55,.70,.85])expect(CONFIG.lead[stroke]/scale).toBeLessThanOrEqual(.25);
    }
  });
  it('avoids axis flips, blade shrinkage and unreachable hands across every complete stroke',()=>{
    for(const stroke of Object.keys(CONFIG.lead) as Stroke[])for(const x of [-.3,0,.35]){
      const horizontal=['cut','pull','lateCut'].includes(stroke);
      const s=shot(stroke,stroke.toLowerCase().includes('defense')||stroke==='duck'?'defend':stroke.startsWith('loft')?'loft':'ground',horizontal?1.1:.6);
      s.target.x=x;s.angle=stroke==='coverDrive'?-.75:stroke==='onDrive'?.75:stroke==='cut'?-Math.PI/2:stroke==='pull'?Math.PI/2:stroke==='lateCut'?-2.4:0;
      let previous=sampleBatPose(s,0,null),axisPrevious:number[]|null=null;
      for(let age=.002;age<strokeDuration(s)+.01;age+=.002){
        const bat=sampleBatPose(s,age,null),body=sampleBatterBody(s,age,null,0);
        const length=Math.hypot(bat.heel.x-bat.toe.x,bat.heel.y-bat.toe.y,bat.heel.z-bat.toe.z);
        expect(length).toBeCloseTo(.69,10);
        const speed=Math.hypot(bat.toe.x-previous.toe.x,bat.toe.y-previous.toe.y,bat.toe.z-previous.toe.z)/.002;
        expect(speed,stroke+' toe speed at '+age).toBeLessThan(35);
        const axis=[(bat.heel.x-bat.toe.x)/length,(bat.heel.y-bat.toe.y)/length,(bat.heel.z-bat.toe.z)/length];
        if(axisPrevious){const dot=axis.reduce((sum,n,i)=>sum+n*axisPrevious![i],0);expect(Math.acos(Math.max(-1,Math.min(1,dot)))/.002,stroke+' angular speed').toBeLessThan(45);}
        axisPrevious=axis;previous=bat;
        const hands=sampleGripPoints(bat);
        for(const [shoulder,hand]of[[body.leftShoulder,hands[0]],[body.rightShoulder,hands[1]]])expect(Math.hypot(shoulder.x-hand.x,shoulder.y-hand.y,shoulder.z-hand.z),stroke+' arm reach').toBeLessThanOrEqual(ARM_UPPER+ARM_LOWER+.001);
      }
    }
  });
  it('continues position and velocity through impact without a second hit animation',()=>{
    for(const stroke of ['straightDrive','coverDrive','loftStraight','cut','pull'] as Stroke[]){
      const s=shot(stroke,stroke==='loftStraight'?'loft':'ground'),lead=CONFIG.lead[stroke],h=.00001;
      const before=sampleBatPose(s,lead-h,null),at=sampleBatPose(s,lead,null),after=sampleBatPose(s,lead+h,null);
      for(const part of ['toe','heel'] as const)for(const axis of ['x','y','z'] as const){
        const incoming=(at[part][axis]-before[part][axis])/h,outgoing=(after[part][axis]-at[part][axis])/h;
        expect(Math.abs(incoming-outgoing),stroke+' impact velocity '+part+axis).toBeLessThan(.08);
      }
    }
  });
  it('lifts then plants the stepping foot before impact and returns to a rigid guard',()=>{
    const s=shot(),lead=CONFIG.lead.straightDrive;
    expect(sampleBatterBody(s,lead*.4,null,0).leftFoot.y).toBeGreaterThan(.10);
    expect(sampleBatterBody(s,lead*.9,null,0).leftFoot.y).toBe(.075);
    expect(sampleBatterBody(s,lead+.1,null,0).leftFoot).toEqual(sampleBatterBody(s,lead,null,0).leftFoot);
    const recovered=sampleBatPose(s,strokeDuration(s)+.01,null,3);
    expect(recovered).toEqual(sampleBatPose(null,0,null,3));
    const drive=sampleBatPose(s,lead+.18,null),loft=shot('loftStraight','loft');
    expect(sampleBatPose(loft,CONFIG.lead.loftStraight+.22,null).toe.y).toBeGreaterThan(drive.toe.y);
  });
  it('returns to guard more slowly than the active swing instead of snapping back',()=>{
    for(const stroke of ['straightDrive','loftStraight','cut','pull','forwardDefense'] as Stroke[]){
      const s=shot(stroke,stroke==='loftStraight'?'loft':stroke==='forwardDefense'?'defend':'ground',stroke==='cut'||stroke==='pull'?1.1:.6);
      s.angle=stroke==='cut'?-Math.PI/2:stroke==='pull'?Math.PI/2:0;
      const recoveryStart=strokeDuration(s)-CONFIG.strokeMotion.recovery;
      let previous=sampleBatPose(s,0,null),activePeak=0,recoveryPeak=0;
      for(let age=.002;age<strokeDuration(s);age+=.002){
        const bat=sampleBatPose(s,age,null),speed=Math.hypot(bat.toe.x-previous.toe.x,bat.toe.y-previous.toe.y,bat.toe.z-previous.toe.z)/.002;
        if(age<recoveryStart)activePeak=Math.max(activePeak,speed);else recoveryPeak=Math.max(recoveryPeak,speed);
        previous=bat;
      }
      expect(recoveryPeak,stroke+' recovery speed').toBeLessThan(activePeak*.95);
    }
  });
  it('crouches at the duck contact time with smooth start, hold and recovery boundaries',()=>{
    const s=shot('duck','defend'),h=.00001;
    for(const age of [0,CONFIG.lead.duck,CONFIG.lead.duck+.12,CONFIG.strokeMotion.duckDuration]){
      const before=sampleBatterBody(s,age-h,null,0).head,at=sampleBatterBody(s,age,null,0).head,after=sampleBatterBody(s,age+h,null,0).head;
      for(const axis of ['x','y','z'] as const)expect(Math.abs((at[axis]-before[axis])/h-(after[axis]-at[axis])/h)).toBeLessThan(.02);
    }
    expect(sampleBatterBody(s,CONFIG.lead.duck,null,0).duck).toBe(1);
    expect(sampleBatPose(s,CONFIG.strokeMotion.duckDuration+.01,null,3)).toEqual(sampleBatPose(null,0,null,3));
  });
});
