import { describe,expect,it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { ARM_LOWER,ARM_UPPER,sampleBatPose,sampleBatterBody,sampleContactFollowThrough,sampleGripPoints,samplePadGeometry } from '../src/animation/pose';
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
    expect(forwardSpeed).toBeGreaterThan(4);expect(forwardSpeed).toBeLessThan(5.1);
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
    const duck=sampleBatterBody(shot('duck','defend'),.375,null,0),ready=sampleBatterBody(null,0,null,0);
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
  it('preserves exact authoritative bat and body poses through the contact interval and every miss',()=>{
    for(const stroke of ['straightDrive','coverDrive','loftStraight','cut','pull'] as Stroke[]) {
      const s=shot(stroke,stroke==='loftStraight'?'loft':'ground');
      const lead=CONFIG.lead[stroke];
      for(const age of [0,lead-.12,lead,lead+.10]) {
        const posed=sampleContactFollowThrough(s,age,null,2,true);
        expect(posed.bat).toEqual(sampleBatPose(s,age,null,2));
        expect(posed.body).toEqual(sampleBatterBody(s,age,null,2));
      }
      for(const age of [lead+.16,lead+.35,lead+.65]) {
        const miss=sampleContactFollowThrough(s,age,null,2,false);
        expect(miss.bat).toEqual(sampleBatPose(s,age,null,2));
        expect(miss.body).toEqual(sampleBatterBody(s,age,null,2));
      }
    }
  });
  it('finishes a clean loft higher than a drive and recovers smoothly without changing blade length',()=>{
    const drive=shot(),loft=shot('loftStraight','loft');
    const d=sampleContactFollowThrough(drive,CONFIG.lead.straightDrive+.34,null,0,true);
    const l=sampleContactFollowThrough(loft,CONFIG.lead.loftStraight+.34,null,0,true);
    expect(l.bat.toe.y).toBeGreaterThan(d.bat.toe.y+.20);
    expect(d.body.twist).toBeGreaterThan(sampleBatterBody(drive,CONFIG.lead.straightDrive+.34,null,0).twist);
    for(const s of [drive,loft]) {
      const lead=CONFIG.lead[s.stroke];
      for(const after of [.119,.121,.29,.45,.65,.849,.851]) {
        const pose=sampleContactFollowThrough(s,lead+after,null,3,true).bat;
        const original=sampleBatPose(s,lead+after,null,3);
        expect(Math.hypot(pose.heel.x-pose.toe.x,pose.heel.y-pose.toe.y,pose.heel.z-pose.toe.z)).toBeCloseTo(Math.hypot(original.heel.x-original.toe.x,original.heel.y-original.toe.y,original.heel.z-original.toe.z),10);
        const next=sampleContactFollowThrough(s,lead+after+.00001,null,3,true).bat;
        expect(Math.hypot(next.toe.x-pose.toe.x,next.toe.y-pose.toe.y,next.toe.z-pose.toe.z)).toBeLessThan(.001);
      }
      const recovered=sampleContactFollowThrough(s,lead+.86,null,3,true);
      expect(recovered.bat).toEqual(sampleBatPose(null,0,null,3));
      expect(recovered.body).toEqual(sampleBatterBody(s,lead+.86,null,3));
    }
  });
  it('keeps the successful visual finish attached to reachable hands without moving pads',()=>{
    for(const stroke of ['straightDrive','coverDrive','loftStraight','cut','pull'] as Stroke[]) {
      for(const x of [-.3,0,.35])for(const y of stroke==='cut'||stroke==='pull'?[.65,1,1.3]:[.15,.7,1.3]) {
        const s=shot(stroke,stroke==='loftStraight'?'loft':'ground',y);
        s.target.x=x;s.angle=stroke==='coverDrive'?-Math.PI/4:stroke==='cut'?-Math.PI/2:stroke==='pull'?Math.PI/2:0;
        for(const after of [.13,.2,.3,.4,.5,.65,.8]) {
          const age=CONFIG.lead[stroke]+after;
          const {bat,body}=sampleContactFollowThrough(s,age,null,0,true);
          const hands=sampleGripPoints(bat),original=sampleBatterBody(s,age,null,0);
          expect(body.leftFoot).toEqual(original.leftFoot);expect(body.rightFoot).toEqual(original.rightFoot);
          expect(body.leftHip).toEqual(original.leftHip);expect(body.rightHip).toEqual(original.rightHip);
          for(const [shoulder,hand] of [[body.leftShoulder,hands[0]],[body.rightShoulder,hands[1]]]) {
            expect(Math.hypot(shoulder.x-hand.x,shoulder.y-hand.y,shoulder.z-hand.z)).toBeLessThanOrEqual(ARM_UPPER+ARM_LOWER+.001);
          }
        }
      }
    }
  });
});
