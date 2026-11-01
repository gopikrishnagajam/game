import type { BatPose, Delivery, Shot, Vec3 } from '../core/types';
import { CONFIG } from '../core/config';
import { clamp, smooth, vec } from '../core/math';
import { arc, batGrip, blendBat, contactGrip, orientation, rigidBat, turn } from './rigid';

const hermite=(a:number,b:number,va:number,vb:number,t:number,span:number)=>
  (2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*va*span+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*vb*span;

const guard=(time:number):BatPose=>rigidBat(vec(.19,1.05+Math.sin(time*2)*.006,.12),orientation(vec(.12,.55,.83),vec(0,-.83,.55)));

export function followDuration(shot:Shot):number {
  return shot.type==='defend'?CONFIG.strokeMotion.defenseFollow:shot.type==='loft'?CONFIG.strokeMotion.loftFollow:CONFIG.strokeMotion.driveFollow;
}
export function strokeDuration(shot:Shot):number {
  return shot.stroke==='duck'?CONFIG.strokeMotion.duckDuration:CONFIG.lead[shot.stroke]+followDuration(shot)+CONFIG.strokeMotion.finishHold+CONFIG.strokeMotion.recovery;
}
export function duckAmount(age:number,lead:number):number {
  const holdEnd=lead+.12;
  return smooth(age/lead)*(1-smooth((age-holdEnd)/(CONFIG.strokeMotion.duckDuration-holdEnd)));
}

/** Prepared backlift -> immediate downswing -> impact -> deceleration -> recovery.
 * One rigid hand-pivot motion is sampled by rendering and swept collision. */
export function sampleBatPose(shot:Shot|null,age:number,_delivery:Delivery|null,time=0):BatPose {
  if(!shot||age<0)return guard(time);
  const ready=guard(time-age),lead=CONFIG.lead[shot.stroke];
  if(age===0)return ready;
  if(shot.stroke==='duck') {
    if(age>=CONFIG.strokeMotion.duckDuration)return guard(time);
    const duck=duckAmount(age,lead);
    const current=guard(time),g=batGrip(current);g.x+=.14*duck;g.y-=.28*duck;g.z-=.05*duck;
    const q=orientation(vec(current.heel.x-current.toe.x,current.heel.y-current.toe.y,current.heel.z-current.toe.z),current.face);
    return rigidBat(g,q);
  }
  if(age>=strokeDuration(shot))return guard(time);
  const horizontal=shot.stroke==='pull'||shot.stroke==='cut'||shot.stroke==='lateCut';
  const defend=shot.type==='defend',loft=shot.type==='loft';
  const target={...shot.target,y:horizontal?shot.target.y:Math.max(.34,shot.target.y)};
  const axis=horizontal?vec(-Math.sin(shot.angle)*.94,.20,-Math.cos(shot.angle)*.27):vec(-Math.sin(shot.angle)*.12,.99,-.04);
  const face=horizontal?vec(0,loft?.45:0,1):vec(Math.sin(shot.angle)*.6,loft?.45:0,Math.max(.3,Math.cos(shot.angle)));
  const start=orientation(vec(ready.heel.x-ready.toe.x,ready.heel.y-ready.toe.y,ready.heel.z-ready.toe.z),ready.face);
  const impact=orientation(axis,face),before=turn(start,impact,.92);
  const startGrip=batGrip(ready),impactGrip=contactGrip(target,axis);
  const speed:Vec3=vec(horizontal?Math.sin(shot.angle)*1.2:0,defend?-.25:-.45,defend?1.6:3.2);
  if(age<=lead) {
    const t=clamp(age/lead);
    const grip=vec(hermite(startGrip.x,impactGrip.x,0,speed.x,t,lead),hermite(startGrip.y,impactGrip.y,0,speed.y,t,lead),hermite(startGrip.z,impactGrip.z,0,speed.z,t,lead));
    return rigidBat(grip,arc(start,start,before,impact,t));
  }
  const after=age-lead,duration=followDuration(shot);
  const control=.65+clamp(shot.raw)*.35;
  const finishAxis=defend?axis:horizontal?vec(-Math.sin(shot.angle)*.56,-.32,-.75):vec(-Math.sin(shot.angle)*.28,loft?-.65:-.25,-.85);
  // Transport the face with the blade; no world-fixed normal flips at rollover.
  const finish=orientation(finishAxis,vec(Math.sin(shot.angle)*.35,-.9,-.3));
  const end=defend?impact:finish;
  const endGrip=vec(impactGrip.x+Math.sin(shot.angle)*(defend?.025:horizontal?.14:.16)*control,
    Math.min(1.62,impactGrip.y+(defend?.015:loft?.40:.24)*control),impactGrip.z+(defend?.04:horizontal?.04:.07));
  const t=clamp(after/duration);
  const grip=vec(hermite(impactGrip.x,endGrip.x,speed.x,0,t,duration),hermite(impactGrip.y,endGrip.y,speed.y,0,t,duration),hermite(impactGrip.z,endGrip.z,speed.z,0,t,duration));
  const continued=turn(before,impact,1+duration/lead);
  const pose=rigidBat(grip,arc(impact,continued,end,end,t));
  const recover=smooth((after-duration-CONFIG.strokeMotion.finishHold)/CONFIG.strokeMotion.recovery);
  return recover>0?blendBat(pose,guard(time),recover):pose;
}
