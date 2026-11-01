import * as THREE from 'three';
import type { BatPose, RenderFrame, Team, Vec3 } from '../core/types';
import { CONFIG } from '../core/config';
import { clamp, smooth, vec } from '../core/math';
import { ARM_LOWER, ARM_UPPER, LEG_LENGTH, sampleContactFollowThrough, sampleGripPoints, solveJoint } from '../animation/pose';

const Y=new THREE.Vector3(0,1,0);
const vector=(p:Vec3)=>new THREE.Vector3(p.x,p.y,p.z);
type Link={mesh:THREE.Mesh; radius:number};

/** Original articulated cricket character. Geometry is authored locally, not a downloaded likeness. */
export class CricketPlayer {
  group=new THREE.Group();
  private shirt=new THREE.MeshStandardMaterial({color:'#3274db',roughness:0.78});
  private trouser=new THREE.MeshStandardMaterial({color:'#2456a2',roughness:0.85});
  private skin=new THREE.MeshStandardMaterial({color:'#ae7854',roughness:0.9});
  private white=new THREE.MeshStandardMaterial({color:'#f3f0dc',roughness:0.64});
  private navy=new THREE.MeshStandardMaterial({color:'#172d43',roughness:0.65});
  private metallic=new THREE.MeshStandardMaterial({color:'#b9c5c4',metalness:0.65,roughness:0.4});
  private body:THREE.Mesh;
  private pelvis:THREE.Mesh;
  private neck:THREE.Mesh;
  private head=new THREE.Group();
  private helmet:THREE.Group;
  private arms:Link[]=[];
  private legs:Link[]=[];
  private sleeves:Link[]=[];
  private pads:THREE.Group[]=[];
  private gloves:THREE.Group[]=[];
  private shoes:THREE.Group[]=[];
  private bat=new THREE.Group();
  private batBlade:THREE.Mesh;
  private isBatter:boolean;
  private team:Team='blue';
  constructor(batter=true) {
    this.isBatter=batter;
    this.group.name=batter?'Original Fun Cricket batter':'Original Fun Cricket bowler';
    this.body=this.mesh(new THREE.CylinderGeometry(0.23,0.19,0.46,12),this.shirt);
    this.body.scale.z=0.65;
    this.pelvis=this.mesh(new THREE.SphereGeometry(0.19,12,8),this.trouser);
    this.pelvis.scale.set(1,0.67,0.64);
    this.neck=this.mesh(new THREE.CylinderGeometry(0.065,0.075,0.11,8),this.skin);
    this.group.add(this.head);
    const face=new THREE.Mesh(new THREE.SphereGeometry(0.125,14,12),this.skin);face.scale.set(0.84,1.12,0.9);this.head.add(face);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.026,8,6),this.skin);nose.position.set(0,-0.006,0.115);nose.scale.set(0.8,1.2,1.4);this.head.add(nose);
    for(const side of [-1,1]) {
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.025,7,6),this.skin);ear.position.set(side*0.103,-0.005,0);this.head.add(ear);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.007,6,4),this.navy);eye.position.set(side*0.042,0.026,0.103);this.head.add(eye);
    }
    const hair=new THREE.Mesh(new THREE.SphereGeometry(0.124,12,8,0,Math.PI*2,0,Math.PI*0.55),this.navy);hair.position.y=0.018;this.head.add(hair);
    this.helmet=new THREE.Group();this.head.add(this.helmet);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(0.148,18,12,0,Math.PI*2,0,Math.PI*0.62),this.navy);dome.position.y=0.026;this.helmet.add(dome);
    const brim=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.019,0.17),this.navy);brim.position.set(0,0.054,0.115);this.helmet.add(brim);
    for(const h of [-0.02,-0.068]) {
      const rail=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.005,4,14,Math.PI),this.metallic);rail.rotation.x=Math.PI/2;rail.position.set(0,h,0.026);this.helmet.add(rail);
    }
    for(const side of [-1,1]) {
      const support=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.005,0.15,4),this.metallic);support.position.set(side*0.13,-0.028,0.071);this.helmet.add(support);
    }
    this.helmet.visible=batter;
    for(let i=0;i<4;i++) this.arms.push({mesh:this.mesh(new THREE.CapsuleGeometry(i<2?0.057:0.049,1,4,8),this.skin),radius:i<2?0.057:0.049});
    for(let i=0;i<2;i++) this.sleeves.push({mesh:this.mesh(new THREE.CylinderGeometry(0.09,0.075,1,10),this.shirt),radius:0.08});
    for(let i=0;i<4;i++) this.legs.push({mesh:this.mesh(new THREE.CapsuleGeometry(i<2?0.092:0.072,1,4,10),this.trouser),radius:i<2?0.092:0.072});
    for(let i=0;i<2;i++) {
      const shoe=new THREE.Group();this.group.add(shoe);this.shoes.push(shoe);
      const sole=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.04,0.28),this.navy);sole.position.set(0,-0.026,0.04);shoe.add(sole);
      const upper=new THREE.Mesh(new THREE.CapsuleGeometry(0.067,0.13,4,8),this.white);upper.rotation.x=Math.PI/2;upper.position.z=0.04;upper.scale.y=0.7;shoe.add(upper);
      const accent=new THREE.Mesh(new THREE.BoxGeometry(0.134,0.018,0.08),this.shirt);accent.position.set(0,0.012,0.06);shoe.add(accent);
      const pad=new THREE.Group();this.group.add(pad);this.pads.push(pad);pad.visible=batter;
      const board=new THREE.Mesh(new THREE.BoxGeometry(0.165,0.39,0.07),this.white);pad.add(board);
      for(let j=-2;j<=2;j++) {
        const rib=new THREE.Mesh(new THREE.CapsuleGeometry(0.012,0.32,3,5),this.white);rib.position.set(j*0.031,0,0.04);pad.add(rib);
      }
      const kneeCup=new THREE.Mesh(new THREE.SphereGeometry(0.088,10,7),this.white);kneeCup.scale.set(1,0.7,0.5);kneeCup.position.set(0,0.21,0.01);pad.add(kneeCup);
      for(const dy of [-0.12,0.13]) {
        const band=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.025,0.08),this.navy);band.position.y=dy;pad.add(band);
      }
      const glove=new THREE.Group();this.group.add(glove);this.gloves.push(glove);
      const palm=new THREE.Mesh(new THREE.SphereGeometry(0.06,10,7),batter?this.white:this.skin);palm.scale.set(1,1.13,0.85);glove.add(palm);
      if(batter) for(let j=0;j<4;j++) {
        const finger=new THREE.Mesh(new THREE.CapsuleGeometry(0.011,0.045,3,5),this.white);finger.position.set((j-1.5)*0.022,0.036,0.022);glove.add(finger);
      }
    }
    this.group.add(this.bat);this.bat.visible=batter;
    const wood=new THREE.MeshStandardMaterial({color:'#d6b47b',roughness:0.6});
    this.batBlade=new THREE.Mesh(new THREE.BoxGeometry(0.108,0.69,0.052),wood);this.bat.add(this.batBlade);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.019,0.30,10),this.navy);grip.position.y=0.495;this.bat.add(grip);
    const splice=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.12,0.043),wood);splice.position.y=0.365;this.bat.add(splice);
    const sticker=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.22,0.001),this.shirt);sticker.position.set(0,0.10,-0.027);this.bat.add(sticker);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.083,0.025,0.001),this.white);stripe.position.set(0,0.14,-0.028);this.bat.add(stripe);
    this.group.traverse(obj=>{if(obj instanceof THREE.Mesh) {obj.castShadow=true;obj.receiveShadow=true;}});
  }
  private mesh(geo:THREE.BufferGeometry,mat:THREE.Material) {const m=new THREE.Mesh(geo,mat);this.group.add(m);return m;}
  setTeam(team:Team) {
    if(team===this.team)return;this.team=team;
    this.shirt.color.set(team==='blue'?'#367fdf':'#e8c644');
    this.trouser.color.set(team==='blue'?'#225aab':'#be9d2b');
  }
  private link(link:Link,a:Vec3,b:Vec3) {
    const av=vector(a),bv=vector(b),delta=bv.clone().sub(av);
    const length=delta.length();link.mesh.position.copy(av.add(bv).multiplyScalar(0.5));
    link.mesh.quaternion.setFromUnitVectors(Y,delta.normalize());
    link.mesh.scale.y=Math.max(0.01,length)/(1+2*link.radius);
  }
  private setLimb(mesh:THREE.Mesh,a:Vec3,b:Vec3) {
    const av=vector(a),bv=vector(b),delta=bv.clone().sub(av);
    mesh.position.copy(av.add(bv).multiplyScalar(0.5));mesh.quaternion.setFromUnitVectors(Y,delta.clone().normalize());mesh.scale.y=delta.length();
  }
  private poseBat(pose:BatPose) {
    const heel=vector(pose.heel),toe=vector(pose.toe);
    this.bat.position.copy(heel.clone().add(toe).multiplyScalar(0.5));
    const axis=heel.sub(toe).normalize();
    const z=vector(pose.face).normalize();
    const x=new THREE.Vector3().crossVectors(axis,z).normalize();
    const forward=new THREE.Vector3().crossVectors(x,axis).normalize();
    const basis=new THREE.Matrix4().makeBasis(x,axis,forward);
    this.bat.quaternion.setFromRotationMatrix(basis);
  }
  updateBatter(frame:RenderFrame) {
    this.setTeam(frame.match?.team??'blue');
    const shot=frame.shot;
    const age=frame.shotAge;
    const contacted=!!shot&&shot.stroke!=='duck'&&(frame.phase==='outgoing'||(frame.phase==='feedback'&&!!frame.outcome&&frame.outcome.quality!=='miss'));
    const pose=sampleContactFollowThrough(shot,age,frame.delivery,frame.time,contacted);
    const body=pose.body;
    let bat=pose.bat;
    if(frame.phase==='runup') {
      // A small anticipatory backlift settles completely before the ball leaves
      // the hand. It has no effect on the incoming bat or pad geometry.
      const prepare=Math.sin(Math.PI*clamp(frame.phaseTime/(CONFIG.runup*.90)))**2;
      bat={heel:vec(bat.heel.x,bat.heel.y+.11*prepare,bat.heel.z-.06*prepare),toe:vec(bat.toe.x,bat.toe.y+.11*prepare,bat.toe.z-.06*prepare),face:bat.face};
    }
    if(frame.milestone&&frame.phase==='feedback') {
      const t=Math.sin(Math.PI*clamp(frame.phaseTime/1.1));
      bat={heel:vec(0.1,1.22+0.3*t,0.08),toe:vec(-0.1*t,0.55+1.65*t,0.10),face:vec(0,0,-1)};
    }
    this.poseBat(bat);
    const [gripA,gripB]=sampleGripPoints(bat);
    const leftElbow=solveJoint(body.leftShoulder,gripA,ARM_UPPER,ARM_LOWER,vec(-1,-0.4,-0.4));
    const rightElbow=solveJoint(body.rightShoulder,gripB,ARM_UPPER,ARM_LOWER,vec(1,-0.5,-0.5));
    this.poseBody(body.hip,body.chest,body.head,body.leftShoulder,body.rightShoulder,body.leftHip,body.rightHip,body.leftFoot,body.rightFoot,leftElbow,rightElbow,gripA,gripB,body.twist);
    const watch=contacted&&frame.ball?smooth((age-(shot?CONFIG.lead[shot.stroke]:0))/.24):0;
    const ball=frame.ball?.position;
    const yaw=ball?clamp(Math.atan2(ball.x-body.head.x,ball.z-body.head.z),-.65,.65):-.15;
    const pitch=ball?clamp(-Math.atan2(ball.y-body.head.y,Math.hypot(ball.x-body.head.x,ball.z-body.head.z)),-.30,.35):.15;
    this.head.rotation.y=-.15+(yaw+.15)*watch;
    this.head.rotation.x=.15+body.duck*.3+(pitch-.15)*watch;
  }
  private poseBody(hip:Vec3,chest:Vec3,head:Vec3,leftShoulder:Vec3,rightShoulder:Vec3,leftHip:Vec3,rightHip:Vec3,leftFoot:Vec3,rightFoot:Vec3,leftElbow:Vec3,rightElbow:Vec3,leftHand:Vec3,rightHand:Vec3,twist:number) {
    const torso=vector(chest).sub(vector(hip));
    this.body.position.copy(vector(hip).add(vector(chest)).multiplyScalar(.5));
    this.body.quaternion.setFromUnitVectors(Y,torso.clone().normalize());this.body.rotateY(twist);
    this.body.scale.y=(torso.length()+.08)/.46;
    this.pelvis.position.copy(vector(hip));this.head.position.copy(vector(head));
    this.neck.position.copy(vector(head));this.neck.position.y-=0.18;
    this.link(this.arms[0],leftShoulder,leftElbow);this.link(this.arms[1],rightShoulder,rightElbow);
    this.link(this.arms[2],leftElbow,leftHand);this.link(this.arms[3],rightElbow,rightHand);
    for(const [i,s,e] of [[0,leftShoulder,leftElbow],[1,rightShoulder,rightElbow]] as const) {
      const end=vec(s.x+(e.x-s.x)*0.65,s.y+(e.y-s.y)*0.65,s.z+(e.z-s.z)*0.65);this.setLimb(this.sleeves[i].mesh,s,end);
    }
    this.gloves[0].position.copy(vector(leftHand));this.gloves[1].position.copy(vector(rightHand));
    const leftKnee=solveJoint(leftHip,leftFoot,LEG_LENGTH,LEG_LENGTH,vec(0,0,1));
    const rightKnee=solveJoint(rightHip,rightFoot,LEG_LENGTH,LEG_LENGTH,vec(0,0,1));
    this.link(this.legs[0],leftHip,leftKnee);this.link(this.legs[1],rightHip,rightKnee);
    this.link(this.legs[2],leftKnee,leftFoot);this.link(this.legs[3],rightKnee,rightFoot);
    for(const [i,knee,foot] of [[0,leftKnee,leftFoot],[1,rightKnee,rightFoot]] as const) {
      this.shoes[i].position.copy(vector(foot));
      const center=vector(knee).add(vector(foot)).multiplyScalar(0.5);center.z+=0.075;this.pads[i].position.copy(center);
      const delta=vector(knee).sub(vector(foot)).normalize();this.pads[i].quaternion.setFromUnitVectors(Y,delta);
    }
  }
  updateBowler(frame:RenderFrame) {
    this.setTeam(frame.match?.team==='blue'?'yellow':'blue');
    const release=frame.delivery?.release??vec(0.22,2.05,18.3);
    const run=frame.phase==='runup'?clamp(frame.phaseTime/CONFIG.runup):frame.phase==='menu'||frame.phase==='setup'?0:1;
    const post=frame.phase==='delivery'?Math.min(frame.phaseTime,0.65):frame.phase==='outgoing'?0.65:0;
    const z=release.z+3.8*(1-smooth(run))-post*1.4;
    const spin=frame.delivery?.style==='offSpin'||frame.delivery?.style==='legSpin';
    const gait=Math.sin(run*Math.PI*(spin?4:6));
    const action=smooth((run-0.60)/0.40);
    const celebrate=frame.phase==='feedback'&&!!frame.outcome?.wicket?Math.sin(Math.PI*clamp(frame.phaseTime/1.6)):0;
    const hip=vec(0.18,0.93+Math.abs(gait)*0.035,z);
    const chest=vec(0.18,1.36+Math.abs(gait)*0.045,z-0.05);
    const head=vec(0.18,1.69,z-0.10);
    const ls=vec(-0.025,1.42,z-0.05),rs=vec(0.385,1.42,z-0.05);
    const lh=vec(0.065,0.90,z),rh=vec(0.295,0.90,z);
    const lf=vec(0.055,0.075,z-0.28-gait*0.19),rf=vec(0.31,0.075,z+0.17+gait*0.19);
    const angle=(-0.2+action*Math.PI*1.1);
    let rightHand=vec(rs.x-0.12,rs.y+Math.sin(angle)*0.55,z-Math.cos(angle)*0.55);
    let leftHand=vec(-0.13,1.0+action*0.65,z-0.26);
    if(run>0.91) rightHand=vec(release.x,release.y,release.z);
    if(post>0) rightHand=vec(0.1,1.95-post*1.8,z-0.3);
    if(celebrate>0) {leftHand=vec(-0.13,1.25+celebrate*0.7,z-0.25);rightHand=vec(0.55,1.25+celebrate*0.7,z-0.20);}
    const le=solveJoint(ls,leftHand,0.31,0.31,vec(-1,0,-1));
    const re=solveJoint(rs,rightHand,0.31,0.31,vec(1,0,-1));
    this.poseBody(hip,chest,head,ls,rs,lh,rh,lf,rf,le,re,leftHand,rightHand,-action*0.25);
    this.head.rotation.y=Math.PI;this.head.rotation.x=0.10;
  }
}
