import type { BatPose, Vec3 } from '../core/types';
import { clamp, lerp, vec } from '../core/math';

type Rotation = [number, number, number, number];
export const BLADE_LENGTH = 0.69;
const GRIP_FROM_HEEL = 0.16;
const GRIP_FROM_CENTER = BLADE_LENGTH / 2 + GRIP_FROM_HEEL;
const unit = (v: Vec3): Vec3 => { const d = Math.hypot(v.x,v.y,v.z) || 1; return vec(v.x/d,v.y/d,v.z/d); };
const cross = (a: Vec3,b: Vec3) => vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);

/** A whole bat orientation, including the face. Never blend opposing axes. */
export function orientation(axis: Vec3, face: Vec3): Rotation {
  const y=unit(axis), x=unit(cross(y,face)), z=cross(x,y);
  const m00=x.x,m01=y.x,m02=z.x,m10=x.y,m11=y.y,m12=z.y,m20=x.z,m21=y.z,m22=z.z;
  const trace=m00+m11+m22;
  if(trace>0){const s=2*Math.sqrt(trace+1);return [(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4];}
  if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);return [s/4,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s];}
  if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);return [(m01+m10)/s,s/4,(m12+m21)/s,(m02-m20)/s];}
  const s=2*Math.sqrt(1+m22-m00-m11);return [(m02+m20)/s,(m12+m21)/s,s/4,(m10-m01)/s];
}

export function turn(a: Rotation,b: Rotation,t: number): Rotation {
  let dot=a.reduce((sum,n,i)=>sum+n*b[i],0);
  const sign=dot<0?-1:1;dot=clamp(Math.abs(dot),-1,1);
  let wa=1-t,wb=t;
  if(dot<.9995){const angle=Math.acos(dot),s=Math.sin(angle);wa=Math.sin((1-t)*angle)/s;wb=Math.sin(t*angle)/s;}
  const q=a.map((n,i)=>n*wa+b[i]*wb*sign) as Rotation;
  const length=Math.hypot(...q)||1;
  return q.map(n=>n/length) as Rotation;
}

/** Spherical cubic with shared impact tangents gives one continuous swing. */
export function arc(a: Rotation,b: Rotation,c: Rotation,d: Rotation,t: number): Rotation {
  const ab=turn(a,b,t),bc=turn(b,c,t),cd=turn(c,d,t);
  return turn(turn(ab,bc,t),turn(bc,cd,t),t);
}

const rotate = (q: Rotation,v: Vec3): Vec3 => {
  const [x,y,z,w]=q;
  const tx=2*(y*v.z-z*v.y),ty=2*(z*v.x-x*v.z),tz=2*(x*v.y-y*v.x);
  return vec(v.x+w*tx+y*tz-z*ty,v.y+w*ty+z*tx-x*tz,v.z+w*tz+x*ty-y*tx);
};

export function rigidBat(grip: Vec3,rotation: Rotation): BatPose {
  const axis=rotate(rotation,vec(0,1,0));
  return {
    heel:vec(grip.x-axis.x*GRIP_FROM_HEEL,grip.y-axis.y*GRIP_FROM_HEEL,grip.z-axis.z*GRIP_FROM_HEEL),
    toe:vec(grip.x-axis.x*(GRIP_FROM_HEEL+BLADE_LENGTH),grip.y-axis.y*(GRIP_FROM_HEEL+BLADE_LENGTH),grip.z-axis.z*(GRIP_FROM_HEEL+BLADE_LENGTH)),
    face:rotate(rotation,vec(0,0,1)),
  };
}

export function batGrip(pose: BatPose): Vec3 {
  const axis=unit(vec(pose.heel.x-pose.toe.x,pose.heel.y-pose.toe.y,pose.heel.z-pose.toe.z));
  return vec(pose.heel.x+axis.x*GRIP_FROM_HEEL,pose.heel.y+axis.y*GRIP_FROM_HEEL,pose.heel.z+axis.z*GRIP_FROM_HEEL);
}

export function contactGrip(center: Vec3,axis: Vec3): Vec3 {
  const a=unit(axis);
  return vec(center.x+a.x*GRIP_FROM_CENTER,center.y+a.y*GRIP_FROM_CENTER,center.z+a.z*GRIP_FROM_CENTER);
}

export function blendBat(a: BatPose,b: BatPose,t: number): BatPose {
  const ga=batGrip(a),gb=batGrip(b);
  const qa=orientation(vec(a.heel.x-a.toe.x,a.heel.y-a.toe.y,a.heel.z-a.toe.z),a.face);
  const qb=orientation(vec(b.heel.x-b.toe.x,b.heel.y-b.toe.y,b.heel.z-b.toe.z),b.face);
  return rigidBat(vec(lerp(ga.x,gb.x,t),lerp(ga.y,gb.y,t),lerp(ga.z,gb.z,t)),turn(qa,qb,t));
}
