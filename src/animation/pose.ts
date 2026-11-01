import type { BatPose, Delivery, Shot, Vec3 } from '../core/types';
import { CONFIG } from '../core/config';
import { clamp, lerp, smooth, vec } from '../core/math';

// These original authored curves are sampled by both contact simulation and renderer.
// The long axis runs from blade heel to toe. The handle continues from the heel.
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => vec(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const hermite = (a:number,b:number,va:number,vb:number,t:number,span:number) =>
  (2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*va*span+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*vb*span;
const idle = (time:number): BatPose => ({
  heel: vec(0.12,0.83+Math.sin(time*2)*0.013,-0.035),
  toe: vec(0.045,0.14+Math.sin(time*2)*0.013,0.035), face: vec(0,0,1),
});

export function sampleBatPose(shot:Shot|null, age:number, _delivery:Delivery|null, time=0): BatPose {
  const ready=idle(time);
  if(!shot || age<0) return ready;
  const lead=CONFIG.lead[shot.stroke];
  const t=age/lead;
  if(shot.stroke==='duck') {
    const d=Math.sin(Math.PI*clamp(age/0.75));
    return { heel:vec(ready.heel.x+0.25*d,ready.heel.y-0.35*d,-0.13),toe:vec(ready.toe.x+0.3*d,ready.toe.y,-0.08),face:vec(0,0,1) };
  }
  const horizontal=shot.stroke==='pull'||shot.stroke==='cut'||shot.stroke==='lateCut';
  const defense=shot.type==='defend';
  const loft=shot.type==='loft';
  const target={...shot.target};
  // A low ball meets the toe, keeping the wooden blade above the pitch surface.
  if(!horizontal) target.y=Math.max(0.34,target.y);
  const preparation=0.42;
  let center:Vec3;
  let axial:Vec3;
  const contactAxis=horizontal ? vec(-Math.sin(shot.angle)*0.94,0.20,-Math.cos(shot.angle)*0.27) : vec(-Math.sin(shot.angle)*0.12,0.99,-0.04);
  const contactAxisLength=Math.hypot(contactAxis.x,contactAxis.y,contactAxis.z);
  const back=vec(lerp(.14,target.x+contactAxis.x/contactAxisLength*.505,.65),1.44,.02);
  const backAxis=vec(.25,-.80,.58);
  const face=horizontal?vec(0,loft?0.45:0,1):vec(Math.sin(shot.angle)*0.6,loft?0.45:0,Math.max(0.3,Math.cos(shot.angle)));
  const swingSpeed=defense?2.6:horizontal?5.4:4.5;
  if(t<preparation) {
    const p=smooth(t/preparation);
    const r=vec((ready.heel.x+ready.toe.x)/2,(ready.heel.y+ready.toe.y)/2,(ready.heel.z+ready.toe.z)/2);
    center=mix(r,back,p);
    center.y+=Math.sin(Math.PI*p)*.25;
    axial=mix(vec(0.1,0.99,-0.1),backAxis,p);
  } else if(t<=1) {
    const p=clamp((t-preparation)/(1-preparation));
    const span=lead*(1-preparation);
    center=vec(
      hermite(back.x,target.x,0,horizontal?Math.sin(shot.angle)*2:0,p,span),
      hermite(back.y,target.y,0,defense?-0.4:-1,p,span),
      hermite(back.z,target.z,0,swingSpeed,p,span),
    );
    axial=mix(backAxis,contactAxis,smooth(p));
  } else {
    const a=age-lead;
    const duration=defense?0.25:0.38;
    const f=clamp(a/duration);
    const control=0.65+clamp(shot.raw)*0.35;
    const endAxis=horizontal?contactAxis:vec(-Math.sin(shot.angle)*0.25,defense?0.98:0.24,defense?-0.12:-0.94);
    const contactLength=Math.hypot(contactAxis.x,contactAxis.y,contactAxis.z);
    const endLength=Math.hypot(endAxis.x,endAxis.y,endAxis.z);
    // Author the followthrough from the hands, keeping the bat attached to an
    // anatomically reachable grip rather than extending the arms after contact.
    const contactGrip=vec(target.x+contactAxis.x/contactLength*.505,target.y+contactAxis.y/contactLength*.505,target.z+contactAxis.z/contactLength*.505);
    const endGrip=vec(contactGrip.x+Math.sin(shot.angle)*(defense?.04:.24)*control,Math.min(1.65,contactGrip.y+(defense?.02:loft?.45:.30)*control),defense?contactGrip.z+.08:target.z-(horizontal?.17:.10));
    const end=vec(endGrip.x-endAxis.x/endLength*.505,endGrip.y-endAxis.y/endLength*.505,endGrip.z-endAxis.z/endLength*.505);
    center=vec(
      hermite(target.x,end.x,horizontal?Math.sin(shot.angle)*2:0,0,f,duration),
      hermite(target.y,end.y,defense?-0.4:-1,0,f,duration),
      target.z+swingSpeed*a*Math.exp(-a/.035)+(end.z-target.z)*smooth(f),
    );
    axial=mix(contactAxis,endAxis,smooth(f));
    const recover=smooth((a-duration-0.1)/0.34);
    if(recover===1)return ready;
    if(recover>0) {
      const length=Math.hypot(axial.x,axial.y,axial.z)||1;
      const half=0.345;
      const heel=vec(center.x+axial.x/length*half,center.y+axial.y/length*half,center.z+axial.z/length*half);
      const toe=vec(center.x-axial.x/length*half,center.y-axial.y/length*half,center.z-axial.z/length*half);
      return {heel:mix(heel,ready.heel,recover),toe:mix(toe,ready.toe,recover),face};
    }
  }
  const len=Math.hypot(axial.x,axial.y,axial.z)||1;
  const half=0.345;
  return {
    heel:vec(center.x+axial.x/len*half,center.y+axial.y/len*half,center.z+axial.z/len*half),
    toe:vec(center.x-axial.x/len*half,center.y-axial.y/len*half,center.z-axial.z/len*half),
    face,
  };
}

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
  // Plant before the contact frame and hold the foot through the followthrough.
  const active=shot?smooth(age/(lead*.88))*(1-smooth((age-lead-.46)/.38)):0;
  const back=shot&&(shot.stroke==='backDefense'||shot.stroke==='backPunch'||shot.stroke==='cut'||shot.stroke==='pull'||shot.stroke==='lateCut');
  const duck=shot?.stroke==='duck'?Math.sin(Math.PI*clamp(age/0.75)):0;
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
  const head=vec(chest.x-0.06,chest.y+0.30,chest.z+0.08);
  const twist=shot?(Math.sin(shot.angle)*0.40+Math.sign(shot.timingError)*(1-shot.raw)*0.15)*active:0;
  const shoulderDx=Math.cos(twist)*0.205;
  const shoulderDz=Math.sin(twist)*0.205;
  return {
    hip,chest,head,
    leftShoulder:vec(chest.x-shoulderDx,chest.y+0.045,chest.z-shoulderDz),
    rightShoulder:vec(chest.x+shoulderDx,chest.y+0.045,chest.z+shoulderDz),
    leftHip:vec(hip.x-0.115,hip.y-0.035,hip.z),rightHip:vec(hip.x+0.115,hip.y-0.035,hip.z),
    leftFoot:vec(shot&&!ducking?lerp(.24,clamp(shot.target.x+.25,-.25,.75),active):.24,0.075,0.24+stride),rightFoot:vec(0.60+side*.25,0.075,-0.14+(back?stride*0.6:0)),
    duck,twist,
  };
}

/** A finish after verified contact. The original contact/pad curves above remain
 * authoritative; a miss never receives this follow-through. At and around impact
 * this is exactly the shared pose, so visible wood and collision stay aligned. */
export function sampleContactFollowThrough(shot:Shot|null,age:number,delivery:Delivery|null,time:number,contacted:boolean):{bat:BatPose;body:BodyPose} {
  const bat=sampleBatPose(shot,age,delivery,time);
  const body=sampleBatterBody(shot,age,delivery,time);
  if(!contacted||!shot||shot.type==='defend'||shot.stroke==='duck'||shot.raw<0.35)return {bat,body};
  const after=age-CONFIG.lead[shot.stroke];
  const finish=smooth((after-.12)/.17)*(1-smooth((after-.45)/.40));
  if(finish<=0)return {bat,body};
  const strength=finish*clamp(shot.raw);
  const loft=shot.type==='loft';
  const horizontal=shot.stroke==='cut'||shot.stroke==='pull'||shot.stroke==='lateCut';
  const topHand=sampleGripPoints(bat)[1];
  // Roll the blade over the lead shoulder about the top hand. Lofted drives
  // finish taller; cuts and pulls retain their horizontal, across-body finish.
  const axis=vec(bat.heel.x-bat.toe.x,bat.heel.y-bat.toe.y,bat.heel.z-bat.toe.z);
  const length=Math.hypot(axis.x,axis.y,axis.z)||1;
  axis.x/=length;axis.y/=length;axis.z/=length;
  const end=horizontal?vec(-Math.sin(shot.angle)*.92,-.10,-.36):vec(-Math.sin(shot.angle)*.38,loft?-.82:-.48,loft?-.52:-.80);
  const blended=mix(axis,end,strength);
  const magnitude=Math.hypot(blended.x,blended.y,blended.z)||1;
  blended.x/=magnitude;blended.y/=magnitude;blended.z/=magnitude;
  topHand.y+=(loft?.10:.035)*strength;
  const finished:BatPose={
    heel:vec(topHand.x-blended.x*.22,topHand.y-blended.y*.22,topHand.z-blended.z*.22),
    toe:vec(topHand.x-blended.x*(length+.22),topHand.y-blended.y*(length+.22),topHand.z-blended.z*(length+.22)),
    face:bat.face,
  };
  const hands=sampleGripPoints(finished);
  const midpoint=vec((hands[0].x+hands[1].x)/2,(hands[0].y+hands[1].y)/2,(hands[0].z+hands[1].z)/2);
  const dx=clamp(midpoint.x+.12-body.chest.x,-.10,.10)*strength;
  const dy=clamp(midpoint.y+.17-body.chest.y,-.08,.12)*strength;
  const dz=clamp(midpoint.z-.22-body.chest.z,-.10,.10)*strength;
  body.chest=vec(body.chest.x+dx,body.chest.y+dy,body.chest.z+dz);
  body.head=vec(body.head.x+dx,body.head.y+dy,body.head.z+dz);
  body.twist+=(.20+Math.sin(shot.angle)*.18)*strength;
  const shoulderDx=Math.cos(body.twist)*.205,shoulderDz=Math.sin(body.twist)*.205;
  body.leftShoulder=vec(body.chest.x-shoulderDx,body.chest.y+.045,body.chest.z-shoulderDz);
  body.rightShoulder=vec(body.chest.x+shoulderDx,body.chest.y+.045,body.chest.z+shoulderDz);
  return {bat:finished,body};
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
