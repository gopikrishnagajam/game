import type { BatPose, Delivery, Shot, Vec3 } from '../core/types';
import { CONFIG } from '../core/config';
import { clamp, lerp, smooth, vec } from '../core/math';
import { sampleBatPose, followDuration, duckAmount } from './stroke';
export { sampleBatPose, strokeDuration } from './stroke';

export interface BodyPose {
  hip:Vec3; chest:Vec3; head:Vec3; leftShoulder:Vec3; rightShoulder:Vec3;
  leftHip:Vec3;rightHip:Vec3;leftFoot:Vec3;rightFoot:Vec3;
  duck:number; twist:number;
}

export function sampleGripPoints(pose:BatPose):[Vec3,Vec3] {
  const dx=pose.heel.x-pose.toe.x,dy=pose.heel.y-pose.toe.y,dz=pose.heel.z-pose.toe.z;
  const length=Math.hypot(dx,dy,dz)||1;
  return [0.10,0.22].map(offset=>vec(pose.heel.x+dx/length*offset,pose.heel.y+dy/length*offset,pose.heel.z+dz/length*offset)) as [Vec3,Vec3];
}

export const ARM_UPPER=0.32;
export const ARM_LOWER=0.34;

export function sampleBatterBody(shot:Shot|null,age:number,delivery:Delivery|null,time:number):BodyPose {
  const lead=shot?CONFIG.lead[shot.stroke]:0.24;
  const plant=shot?smooth(age/(lead*.80)):0;
  const recovery=shot?smooth((age-lead-followDuration(shot)-CONFIG.strokeMotion.finishHold)/CONFIG.strokeMotion.recovery):0;
  const active=plant*(1-recovery);
  const back=shot&&(shot.stroke==='backDefense'||shot.stroke==='backPunch'||shot.stroke==='cut'||shot.stroke==='pull'||shot.stroke==='lateCut');
  const duck=shot?.stroke==='duck'?duckAmount(age,lead):0;
  const ducking=shot?.stroke==='duck';
  const stride=(ducking?0:back?-0.18:0.28)*active;
  const observe=delivery?Math.sin(time*6)*0.006:0;
  let side=0,chestY=1.34,hipY=.90;
  if(shot&&!ducking) {
    const [gripA,gripB]=sampleGripPoints(sampleBatPose(shot,lead,delivery,time));
    // A bounded lateral step and torso lean bring the shoulders over the fixed
    // contact grips. The bat/ball target is never moved by this body adjustment.
    side=clamp((gripA.x+gripB.x)/2+.10-.33,-.65,.42)*active;
    chestY=lerp(1.34,clamp((gripA.y+gripB.y)/2+.23,1.06,1.39),active);
    hipY=lerp(.90,clamp(chestY-.44,.73,.92),active);
  }
  const hip=vec(0.43+side*.80,hipY-0.22*duck,(ducking?0:back?-.02:.20)*active+observe);
  const chest=vec(0.33+side+0.08*duck,chestY-0.40*duck,lerp(.15,ducking?.15:back?.40:.46,active));
  const finish=shot?smooth((age-lead)/followDuration(shot))*(1-recovery):0;
  const twist=shot?(Math.sin(shot.angle)*.28*active+(shot.type==='defend'?0:.30+Math.sin(shot.angle)*.15)*finish):0;
  const shoulderDx=Math.cos(twist)*0.205;
  const shoulderDz=Math.sin(twist)*0.205;
  // Keep hands on the rigid handle throughout the complete arc. Upper-body lean
  // resolves reach; legs/pads never stretch to follow a distant bat.
  const hands=sampleGripPoints(sampleBatPose(shot,age,delivery,time));
  for(let pass=0;pass<4;pass++)for(let i=0;i<2;i++) {
    const sign=i===0?-1:1;
    const dx=hands[i].x-(chest.x+sign*shoulderDx),dy=hands[i].y-(chest.y+.045),dz=hands[i].z-(chest.z+sign*shoulderDz);
    const distance=Math.hypot(dx,dy,dz),reach=ARM_UPPER+ARM_LOWER-.015;
    if(distance>reach){const move=1-reach/distance;chest.x+=dx*move;chest.y+=dy*move;chest.z+=dz*move;}
  }
  const head=vec(chest.x-0.06,chest.y+0.30,chest.z+0.08);
  const stepLift=shot&&!ducking?(age<lead*.8?.055*Math.sin(Math.PI*plant):.04*Math.sin(Math.PI*recovery)):0;
  return {
    hip,chest,head,
    leftShoulder:vec(chest.x-shoulderDx,chest.y+0.045,chest.z-shoulderDz),
    rightShoulder:vec(chest.x+shoulderDx,chest.y+0.045,chest.z+shoulderDz),
    leftHip:vec(hip.x-0.115,hip.y-0.035,hip.z),rightHip:vec(hip.x+0.115,hip.y-0.035,hip.z),
    leftFoot:vec(shot&&!ducking?lerp(.24,clamp(shot.target.x+.25,-.25,.75),active):.24,0.075+(back?stepLift*.45:stepLift),0.24+stride),rightFoot:vec(0.60+side*.25,0.075+(back?stepLift:0),-0.14+(back?stride*0.6:0)),
    duck,twist,
  };
}

/** Rendering uses the same continuous pose before and after a hit or a miss. */
export function sampleBatterPose(shot:Shot|null,age:number,delivery:Delivery|null,time:number):{bat:BatPose;body:BodyPose} {
  return {bat:sampleBatPose(shot,age,delivery,time),body:sampleBatterBody(shot,age,delivery,time)};
}

/** Bend a two-bone chain toward a stable pole without stretching. */
export function solveJoint(start:Vec3,end:Vec3,upper:number,lower:number,pole:Vec3):Vec3 {
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  const actual=Math.hypot(dx,dy,dz)||0.001;
  const d=Math.min(actual,upper+lower-0.001);
  const ux=dx/actual,uy=dy/actual,uz=dz/actual;
  const along=(upper*upper-lower*lower+d*d)/(2*d);
  const height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const dot=pole.x*ux+pole.y*uy+pole.z*uz;
  let px=pole.x-dot*ux,py=pole.y-dot*uy,pz=pole.z-dot*uz;
  const pl=Math.hypot(px,py,pz)||1;px/=pl;py/=pl;pz/=pl;
  return vec(start.x+ux*along+px*height,start.y+uy*along+py*height,start.z+uz*along+pz*height);
}

export const LEG_LENGTH=0.45;
export interface PadSegment { a:Vec3; b:Vec3; radius:number }

/** The same shin-mounted pad placement used by the rendered rig, not a wicket probability zone. */
export function samplePadGeometry(shot:Shot|null,age:number,delivery:Delivery|null,time=0):PadSegment[] {
  const body=sampleBatterBody(shot,age,delivery,time);
  return [[body.leftHip,body.leftFoot],[body.rightHip,body.rightFoot]].map(([hip,foot])=>{
    const knee=solveJoint(hip,foot,LEG_LENGTH,LEG_LENGTH,vec(0,0,1));
    const dx=knee.x-foot.x,dy=knee.y-foot.y,dz=knee.z-foot.z;
    const length=Math.hypot(dx,dy,dz)||1;
    const center=vec((knee.x+foot.x)/2,(knee.y+foot.y)/2,(knee.z+foot.z)/2+0.075);
    return {
      a:vec(center.x+dx/length*.22,center.y+dy/length*.22,center.z+dz/length*.22),
      b:vec(center.x-dx/length*.17,center.y-dy/length*.17,center.z-dz/length*.17),
      radius:0.085,
    };
  });
}
