import * as THREE from 'three';
import type { Quality, RenderFrame, Vec3 } from '../core/types';
import { CONFIG } from '../core/config';
import { RNG } from '../core/math';
import { CricketPlayer } from './player';
import { BallTrail, followCameraTarget, PRESENTATION, smoothApproach, visualBallScale } from './presentation';

const material=(color:string,roughness=0.9)=>new THREE.MeshStandardMaterial({color,roughness});

function canvasTexture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable.');
  paint(context);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export default class CricketScene {
  readonly scene=new THREE.Scene();
  readonly camera:THREE.PerspectiveCamera;
  readonly renderer:THREE.WebGLRenderer;
  private batter=new CricketPlayer(true);
  private bowler=new CricketPlayer(false);
  private ball=new THREE.Group();
  private heldBall:THREE.Group;
  private marker:THREE.Mesh;
  private shadow:THREE.Mesh;
  private trailData=new BallTrail();
  private trail:THREE.LineSegments;
  private bouncePulse:THREE.Mesh;
  private bounceTime=-Infinity;
  private contactPulse:THREE.Group;
  private contactTime=-Infinity;
  private contactQuality:Quality='mistimed';
  private cameraLook=new THREE.Vector3(0,CONFIG.camera.lookY,CONFIG.camera.lookZ);
  private cameraTarget=new THREE.Vector3();
  private lastTime=0;
  private presentationDelivery=-1;
  private followActive=false;
  private debugGroup=new THREE.Group();
  private stumpBails:THREE.Mesh[]=[];
  private lastDelivery=-1;
  private resizeObserver:ResizeObserver;
  private container:HTMLElement;
  private disposed=false;
  private testVector=new THREE.Vector3();
  constructor(container:HTMLElement) {
    this.container=container;
    this.scene.background=new THREE.Color('#b9d7df');
    this.scene.fog=new THREE.Fog('#b9d7df',100,220);
    const c=CONFIG.camera;
    this.camera=new THREE.PerspectiveCamera(c.fov,1,0.08,260);
    this.camera.position.set(c.x,c.y,c.z);this.camera.lookAt(0,c.lookY,c.lookZ);
    try {
      this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    } catch {
      throw new Error('Fun Cricket needs WebGL. Please enable hardware acceleration in your desktop browser and reload.');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.renderer.domElement.setAttribute('aria-label','Batting view of the Fun Cricket ground, following the ball after contact');
    this.renderer.domElement.style.cssText='width:100%;height:100%;display:block;';
    container.appendChild(this.renderer.domElement);
    const hemi=new THREE.HemisphereLight('#e7f2fc','#73835c',2.1);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight('#fff3d4',3.1);sun.position.set(-18,32,-12);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=0.5;sun.shadow.camera.far=80;sun.shadow.normalBias=0.022;sun.shadow.bias=-0.0001;sun.shadow.radius=3;
    sun.target.position.set(0,0,7);this.scene.add(sun,sun.target);
    this.buildGround();this.buildStadium();
    this.scene.add(this.batter.group,this.bowler.group);
    this.ball=this.createBallVisual();this.ball.name='live-cricket-ball';this.scene.add(this.ball);
    this.heldBall=this.createBallVisual();this.heldBall.name='bowler-held-ball';this.scene.add(this.heldBall);
    const trailGeometry=new THREE.BufferGeometry();
    trailGeometry.setAttribute('position',new THREE.BufferAttribute(this.trailData.positions,3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setAttribute('color',new THREE.BufferAttribute(this.trailData.colors,4).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setDrawRange(0,0);
    this.trail=new THREE.LineSegments(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:PRESENTATION.trail.opacity,depthWrite:false,toneMapped:false}));
    this.trail.name='observed-ball-trail';this.trail.frustumCulled=false;this.scene.add(this.trail);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(0.20,0.28,40),new THREE.MeshBasicMaterial({color:'#fff4ad',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    const markerEdge=new THREE.Mesh(new THREE.RingGeometry(0.28,0.33,40),new THREE.MeshBasicMaterial({color:'#17352f',transparent:true,opacity:0.75,depthWrite:false,side:THREE.DoubleSide}));
    markerEdge.position.z=-.001;this.marker.add(markerEdge);this.marker.name='delivery-bounce-marker';
    this.marker.rotation.x=-Math.PI/2;this.marker.position.y=0.012;this.scene.add(this.marker);
    this.bouncePulse=new THREE.Mesh(new THREE.RingGeometry(0.17,0.22,40),new THREE.MeshBasicMaterial({color:'#ffe6a1',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    this.bouncePulse.name='actual-bounce-pulse';this.bouncePulse.rotation.x=-Math.PI/2;this.bouncePulse.visible=false;this.scene.add(this.bouncePulse);
    this.contactPulse=new THREE.Group();this.contactPulse.name='actual-contact-pulse';
    const contactMat=new THREE.MeshBasicMaterial({color:'#fff2b2',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const contactRing=new THREE.Mesh(new THREE.RingGeometry(.72,1,24),contactMat);this.contactPulse.add(contactRing);
    const rayGeo=new THREE.PlaneGeometry(.08,.60);
    for(let i=0;i<6;i++){const ray=new THREE.Mesh(rayGeo,contactMat);const a=i*Math.PI/3;ray.position.set(Math.sin(a)*1.35,Math.cos(a)*1.35,0);ray.rotation.z=-a;this.contactPulse.add(ray);}
    this.contactPulse.visible=false;this.scene.add(this.contactPulse);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(0.10,20),new THREE.MeshBasicMaterial({color:'#172c22',transparent:true,opacity:0.18,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.scene.add(this.debugGroup);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  private createBallVisual() {
    const group=new THREE.Group();
    const sphere=new THREE.SphereGeometry(CONFIG.ballRadius,16,12);
    const outline=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:'#24352f',side:THREE.BackSide,toneMapped:false}));outline.scale.setScalar(1.16);group.add(outline);
    const core=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({color:'#fffdf2',emissive:'#fff3cf',emissiveIntensity:.36,roughness:.42}));core.castShadow=true;group.add(core);
    const seamMat=new THREE.MeshBasicMaterial({color:'#b54c38',toneMapped:false});
    const seamGeo=new THREE.TorusGeometry(CONFIG.ballRadius,0.0011,3,24);
    for(const offset of [-0.004,0.004]) {const seam=new THREE.Mesh(seamGeo,seamMat);seam.position.z=offset;group.add(seam);}
    return group;
  }
  /** Called from actual physics events; effects never infer or move the ball. */
  bounce(position:Vec3,time:number) {
    this.bounceTime=time;this.bouncePulse.position.set(position.x,.014,position.z);
  }
  contact(position:Vec3,time:number,quality:Quality) {
    this.contactTime=time;this.contactQuality=quality;this.contactPulse.position.set(position.x,position.y,position.z);
    this.trailData.reset();this.followActive=true;
  }
  /** The simulation announces this boundary, even if no intervening frame renders. */
  resetDelivery() {
    this.trailData.reset();this.bounceTime=-Infinity;this.contactTime=-Infinity;this.followActive=false;
    this.bouncePulse.visible=false;this.contactPulse.visible=false;
    this.cameraLook.set(0,CONFIG.camera.lookY,CONFIG.camera.lookZ);this.camera.lookAt(this.cameraLook);
  }
  private add(geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);this.scene.add(mesh);return mesh;
  }
  private line(x:number,z:number,w:number,d:number) {
    const m=this.add(new THREE.PlaneGeometry(w,d),material('#edead8'),x,0.009,z);m.rotation.x=-Math.PI/2;return m;
  }
  private buildGround() {
    const random=new RNG(71028);
    const grass=canvasTexture(512,512,ctx=>{
      ctx.fillStyle='#548b4b';ctx.fillRect(0,0,512,512);
      for(let i=0;i<26000;i++) {
        ctx.fillStyle=i%3===0?'rgba(205,211,135,.11)':'rgba(15,55,32,.12)';
        const x=random.range(0,512),y=random.range(0,512);ctx.fillRect(x,y,random.range(.5,1.5),random.range(1,3));
      }
    });
    grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(25,25);grass.anisotropy=8;
    const grassMat=new THREE.MeshStandardMaterial({map:grass,color:'#9caf72',roughness:1});
    const ground=this.add(new THREE.CircleGeometry(96,128),grassMat,0,-0.025,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
    const stripeMat=new THREE.MeshStandardMaterial({color:'#5f914f',transparent:true,opacity:0.18,roughness:1,depthWrite:false});
    for(let z=-60;z<=60;z+=12) {
      const half=Math.sqrt(Math.max(0,65*65-z*z));
      const stripe=this.add(new THREE.PlaneGeometry(half*2,6),stripeMat,0,-0.018,z);stripe.rotation.x=-Math.PI/2;stripe.receiveShadow=true;
    }
    const pitch=canvasTexture(256,1024,ctx=>{
      ctx.fillStyle='#bea773';ctx.fillRect(0,0,256,1024);
      for(let i=0;i<16000;i++) {
        ctx.fillStyle=i%3===0?'rgba(88,69,35,.10)':'rgba(229,213,161,.16)';
        ctx.fillRect(random.range(0,256),random.range(0,1024),random.range(0.5,2),random.range(1,5));
      }
      for(let i=0;i<90;i++) {
        ctx.strokeStyle='rgba(95,81,47,.08)';ctx.lineWidth=random.range(.5,1.4);ctx.beginPath();
        const x=random.range(0,256),y=random.range(0,1024);ctx.moveTo(x,y);ctx.lineTo(x+random.range(-7,7),y+random.range(3,18));ctx.stroke();
      }
      const wear=ctx.createLinearGradient(0,0,256,0);wear.addColorStop(0,'rgba(94,107,56,.25)');wear.addColorStop(.2,'rgba(220,207,162,.08)');wear.addColorStop(.8,'rgba(220,207,162,.08)');wear.addColorStop(1,'rgba(94,107,56,.25)');ctx.fillStyle=wear;ctx.fillRect(0,0,256,1024);
    });pitch.anisotropy=8;
    const strip=this.add(new THREE.PlaneGeometry(3.05,24.1),new THREE.MeshStandardMaterial({map:pitch,roughness:1}),0,-0.006,9.8);strip.rotation.x=-Math.PI/2;strip.receiveShadow=true;
    const apron=this.add(new THREE.PlaneGeometry(5.7,25.8),new THREE.MeshStandardMaterial({color:'#79955e',roughness:1}),0,-0.02,9.8);apron.rotation.x=-Math.PI/2;apron.receiveShadow=true;
    for(const z of [0,20.12]) {
      this.line(0,z,3.66,0.045);this.line(0,z+(z===0?-1.22:1.22),2.64,0.04);
      for(const x of [-1.32,1.32])this.line(x,z+(z===0?-.32:.32),0.04,1.85);
    }
    this.stumps(-0.72);this.stumps(20.12+0.72);
    const rope=this.add(new THREE.TorusGeometry(CONFIG.boundary,0.065,5,220),material('#f2e9ce'),0,0.055,0);rope.rotation.x=Math.PI/2;
    // Flat rope pennants make the actual boundary readable without internal scoring rings.
    const pennantGeo=new THREE.BoxGeometry(0.65,0.035,0.21);
    const pennants=new THREE.InstancedMesh(pennantGeo,material('#f0e4c2'),100);const dummy=new THREE.Object3D();
    for(let i=0;i<100;i++){const a=i*Math.PI*2/100;dummy.position.set(Math.sin(a)*65,0.055,Math.cos(a)*65);dummy.rotation.y=a;dummy.updateMatrix();pennants.setMatrixAt(i,dummy.matrix);}this.scene.add(pennants);
  }
  private stumps(z:number) {
    const stumpMat=material('#e7d7aa',0.65);
    for(const x of [-0.095,0,0.095]) {
      const post=this.add(new THREE.CylinderGeometry(0.015,0.017,0.714,8),stumpMat,x,0.357,z);post.castShadow=true;post.receiveShadow=true;
      const stripe=this.add(new THREE.CylinderGeometry(0.016,0.016,0.07,8),material('#0b5351'),x,0.57,z);stripe.castShadow=true;
    }
    for(const x of [-0.048,0.048]) {
      const bail=this.add(new THREE.CylinderGeometry(0.009,0.009,0.105,6),stumpMat,x,0.725,z);bail.rotation.z=Math.PI/2;this.stumpBails.push(bail);bail.castShadow=true;
    }
  }
  private buildStadium() {
    const concrete=material('#7c8f88');
    const dark=material('#263e44');
    const seats=material('#52777b');
    const concourse=this.add(new THREE.CylinderGeometry(83,83,2.5,96,1,true),concrete,0,1.25,0);concourse.material.side=THREE.DoubleSide;
    for(let tier=0;tier<4;tier++) {
      const radius=83+tier*2.4,height=3+tier*1.75;
      const ring=this.add(new THREE.CylinderGeometry(radius+2.3,radius,1.7,96,1,true),tier%2===0?seats:concrete,0,height,0);ring.material.side=THREE.DoubleSide;
      const front=this.add(new THREE.TorusGeometry(radius,0.12,4,150),dark,0,height-0.65,0);front.rotation.x=Math.PI/2;
    }
    const roof=this.add(new THREE.RingGeometry(91,100,96),material('#e4e4d4'),0,11.5,0);roof.rotation.x=-Math.PI/2;roof.material.side=THREE.DoubleSide;
    const roofEdge=this.add(new THREE.CylinderGeometry(100,100,0.48,96,1,true),dark,0,11.5,0);roofEdge.material.side=THREE.DoubleSide;
    const r=new RNG(731);
    const seatColors=['#527684','#3c5965','#c8d1c5','#e7d2a0','#52796f'];
    const seatGeo=new THREE.BoxGeometry(0.53,0.43,0.42);
    const seatMats=seatColors.map(color=>material(color));
    for(let materialIndex=0;materialIndex<seatMats.length;materialIndex++) {
      const inst=new THREE.InstancedMesh(seatGeo,seatMats[materialIndex],250);const item=new THREE.Object3D();
      for(let n=0;n<250;n++) {
        const angle=r.range(0,Math.PI*2);const row=Math.floor(r.range(0,8));const radius=84+row*1.1;
        item.position.set(Math.sin(angle)*radius,3.2+row*0.80,Math.cos(angle)*radius);item.rotation.y=angle;item.updateMatrix();inst.setMatrixAt(n,item.matrix);
      }this.scene.add(inst);
    }
    // Stadium advertising and a small pavilion use only original typography and geometry.
    const ad=canvasTexture(1024,128,ctx=>{
      ctx.fillStyle='#193f3c';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#dcf291';ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.fillText('FUN CRICKET',512,66);ctx.fillStyle='#f7f3df';ctx.font='17px Arial';ctx.fillText('PLAY THE MOMENT',512,100);
    });
    const adMat=new THREE.MeshStandardMaterial({map:ad,roughness:.8,side:THREE.DoubleSide});
    for(let i=0;i<28;i++) {
      const a=i/28*Math.PI*2;
      const board=this.add(new THREE.PlaneGeometry(13.8,1.7),adMat,Math.sin(a)*74,0.95,Math.cos(a)*74);
      board.lookAt(0,0.95,0);
    }
    const pavilion=this.add(new THREE.BoxGeometry(18,6,7),material('#e5dfc7'),-20,11,90);
    const glass=this.add(new THREE.BoxGeometry(16.6,2.3,0.08),new THREE.MeshStandardMaterial({color:'#384f54',metalness:0.35,roughness:.2}),-20,11.4,86.46);
    const canopy=this.add(new THREE.BoxGeometry(21,.5,9),dark,-20,14.2,89.5);
    pavilion.receiveShadow=true;glass.receiveShadow=true;canopy.castShadow=true;
    for(const a of [-.65,.65,2.4,-2.4]) {
      const x=Math.sin(a)*89,z=Math.cos(a)*89;
      const mast=this.add(new THREE.CylinderGeometry(.22,.45,29,8),material('#91a4a5'),x,14.5,z);
      const panel=this.add(new THREE.BoxGeometry(5.5,2.8,.65),dark,x,28,z);panel.lookAt(0,12,0);
      const lamps=new THREE.Mesh(new THREE.PlaneGeometry(4.8,2.2),new THREE.MeshBasicMaterial({color:'#e9eee4'}));lamps.position.z=.34;panel.add(lamps);mast.castShadow=false;
    }
    // Distant flags above the stands add scale without animated crowds.
    const flagColors=['#dedcae','#1f7367','#d2b348'];
    for(let i=0;i<18;i++) {
      const a=(i/18)*Math.PI*2;const x=Math.sin(a)*98,z=Math.cos(a)*98;
      this.add(new THREE.CylinderGeometry(.045,.045,5,5),material('#7b8d8a'),x,13.8,z);
      const flag=this.add(new THREE.PlaneGeometry(1.7,.85),new THREE.MeshStandardMaterial({color:flagColors[i%3],side:THREE.DoubleSide}),x+.8,15.6,z);flag.rotation.y=-a*.3;
    }
  }
  resize() {
    if(this.disposed)return;const width=Math.max(this.container.clientWidth,1),height=Math.max(this.container.clientHeight,1);
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }
  isBallVisible(position:Vec3) {
    this.testVector.set(position.x,position.y,position.z).project(this.camera);
    return this.testVector.z>-1&&this.testVector.z<1&&Math.abs(this.testVector.x)<0.96&&Math.abs(this.testVector.y)<0.96;
  }
  update(frame:RenderFrame) {
    if(this.disposed)return;
    const elapsed=Math.max(0,frame.time-this.lastTime);this.lastTime=frame.time;
    if(frame.delivery?.id!==this.presentationDelivery) {
      this.presentationDelivery=frame.delivery?.id??-1;this.trailData.reset();
      // Pulse lifetimes are reset by the simulation's next-delivery event. A
      // bounce/contact may already have happened before this first render.
    }
    // The incoming view is identical every delivery. Only a real struck ball can
    // start a small, bounded follow; the live tracker handles shots outside it.
    if(frame.phase==='outgoing')this.followActive=true;
    if(this.followActive&&frame.ball&&(frame.phase==='outgoing'||frame.phase==='feedback')) {
      followCameraTarget(frame.ball.position,this.cameraTarget);
      this.cameraLook.set(smoothApproach(this.cameraLook.x,this.cameraTarget.x,elapsed),smoothApproach(this.cameraLook.y,this.cameraTarget.y,elapsed),smoothApproach(this.cameraLook.z,this.cameraTarget.z,elapsed));
    } else {
      this.followActive=false;this.cameraLook.set(0,CONFIG.camera.lookY,CONFIG.camera.lookZ);
    }
    this.camera.lookAt(this.cameraLook);
    this.batter.updateBatter(frame);this.bowler.updateBowler(frame);
    this.ball.visible=!!frame.ball&&frame.phase!=='runup';
    if(frame.ball) {
      const p=frame.ball.position;this.ball.position.set(p.x,p.y,p.z);this.ball.rotation.set(frame.time*8,frame.time*2,frame.time*5);
      this.ball.scale.setScalar(visualBallScale(this.camera.position.distanceTo(this.ball.position),this.container.clientHeight,this.camera.fov));
      this.shadow.position.set(p.x,0.005,p.z);const s=1+Math.min(p.y,6)*0.15;this.shadow.scale.set(s,s,s);
      (this.shadow.material as THREE.MeshBasicMaterial).opacity=0.23/(1+p.y*0.2);
    }
    this.trail.visible=this.ball.visible&&(frame.phase==='delivery'||frame.phase==='outgoing'||frame.phase==='feedback');
    if(this.trail.visible&&frame.ball) {
      const count=this.trailData.update(frame.ball.position,frame.time);
      this.trail.geometry.setDrawRange(0,count);
      this.trail.geometry.attributes.position.needsUpdate=true;this.trail.geometry.attributes.color.needsUpdate=true;
    }
    this.shadow.visible=this.ball.visible;
    this.heldBall.visible=frame.phase==='runup';
    if(frame.delivery&&this.heldBall.visible) {
      const p=frame.delivery.release;this.heldBall.position.set(p.x,p.y,p.z);
      // During preparation the ball follows the bowler's hand, then reaches release.
      const progress=Math.min(1,frame.phaseTime/CONFIG.runup);
      if(progress<0.91) {
        const rootZ=p.z+3.8*(1-progress*progress*(3-2*progress));
        const action=Math.max(0,Math.min(1,(progress-.6)/.4));const a=-.2+action*action*(3-2*action)*Math.PI*1.1;
        this.heldBall.position.set(.265,1.42+Math.sin(a)*.55,rootZ-Math.cos(a)*.55);
      }
      this.heldBall.scale.setScalar(visualBallScale(this.camera.position.distanceTo(this.heldBall.position),this.container.clientHeight,this.camera.fov));
    }
    this.marker.visible=frame.marker>0&&!!frame.delivery;
    if(frame.delivery) {this.marker.position.x=frame.delivery.bounce.x;this.marker.position.z=frame.delivery.bounce.z;}
    const markerOpacity=Math.min(.90,frame.marker*2.2);
    (this.marker.material as THREE.MeshBasicMaterial).opacity=markerOpacity;
    ((this.marker.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=markerOpacity*.9;
    const bounceAge=frame.time-this.bounceTime;
    this.bouncePulse.visible=bounceAge>=0&&bounceAge<PRESENTATION.bounce.duration&&(frame.phase==='delivery'||frame.phase==='outgoing'||frame.phase==='feedback');
    if(this.bouncePulse.visible){const t=bounceAge/PRESENTATION.bounce.duration;this.bouncePulse.scale.setScalar(1+t*PRESENTATION.bounce.expansion);(this.bouncePulse.material as THREE.MeshBasicMaterial).opacity=(1-t)*.8;}
    const contactAge=frame.time-this.contactTime;
    this.contactPulse.visible=contactAge>=0&&contactAge<PRESENTATION.contact.duration&&(frame.phase==='outgoing'||frame.phase==='feedback');
    if(this.contactPulse.visible){
      const t=contactAge/PRESENTATION.contact.duration,perfect=this.contactQuality==='perfect';
      this.contactPulse.quaternion.copy(this.camera.quaternion);
      this.contactPulse.scale.setScalar(.025+t*(perfect?PRESENTATION.contact.perfectExpansion:PRESENTATION.contact.otherExpansion));
      ((this.contactPulse.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=(1-t)*(1-t)*(perfect?.85:.50);
    }
    const bowled=frame.phase==='feedback'&&frame.outcome?.wicket==='bowled';
    for(let i=0;i<this.stumpBails.length;i++) {
      const bail=this.stumpBails[i];
      if(i<2&&bowled) {bail.position.y=.725+Math.sin(Math.min(frame.phaseTime*5,Math.PI))*.24;bail.rotation.x=frame.phaseTime*7;bail.position.z=-.72-frame.phaseTime*.35;}
      else {bail.position.y=.725;bail.rotation.x=0;bail.position.z=i<2?-.72:20.84;}
    }
    this.debugGroup.visible=frame.debug;
    if(frame.debug&&frame.delivery?.id!==this.lastDelivery) {
      this.lastDelivery=frame.delivery?.id??-1;
      for(const obj of [...this.debugGroup.children]) {this.debugGroup.remove(obj);if(obj instanceof THREE.Mesh){obj.geometry.dispose();(obj.material as THREE.Material).dispose();}}
      for(const f of frame.delivery?.field??[]) {
        for(const [radius,color] of [[f.catchRadius,'#edb267'],[f.groundRadius,'#75c9ff']] as const) {
          const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.04,radius+.04,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(f.x,.03,f.z);this.debugGroup.add(ring);
        }
      }
    }
    this.renderer.render(this.scene,this.camera);
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.resizeObserver.disconnect();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    this.scene.traverse(obj=>{
      if(obj instanceof THREE.Mesh||obj instanceof THREE.Line) {
        geometries.add(obj.geometry);for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]) {materials.add(mat);for(const value of Object.values(mat))if(value instanceof THREE.Texture)textures.add(value);}
      }
    });for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
    this.renderer.dispose();this.renderer.domElement.remove();
  }
}
