import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CricketPlayer } from './player';
import type { RenderFrame, Shot, Stroke } from '../core/types';
import { CONFIG } from '../core/config';

/** Developer asset authoring utility. Bakes the original articulated rig and curves
 * into a portable GLB; gameplay continues to use the very same curves for collision. */
export async function exportOriginalCricketPlayer():Promise<ArrayBuffer> {
  const player=new CricketPlayer();
  const root=player.group;
  root.name='FunCricket_Original_Articulated_Batter';
  const nodes:THREE.Object3D[]=[];root.traverse(node=>{if(node!==root){node.name=`BatterPart_${nodes.length.toString().padStart(3,'0')}`;nodes.push(node);}});
  const frame:RenderFrame={time:0,phase:'delivery',phaseTime:0,match:null,delivery:null,ball:null,shot:null,shotAge:0,marker:0,outcome:null,milestone:false,debug:false};
  const families:({name:string;stroke?:Stroke;type?:Shot['type'];angle?:number;quality?:Shot['quality'];raw?:number})[]=[
    {name:'Ready_Stance'},
    {name:'Forward_Defense',stroke:'forwardDefense',type:'defend'},
    {name:'Back_Foot_Defense',stroke:'backDefense',type:'defend'},
    {name:'Duck_Sway',stroke:'duck',type:'defend'},
    {name:'Front_Foot_Straight_Drive',stroke:'straightDrive'},
    {name:'Cover_Drive',stroke:'coverDrive',angle:-Math.PI/4},
    {name:'On_Drive_Flick',stroke:'onDrive',angle:Math.PI/4},
    {name:'Back_Foot_Punch',stroke:'backPunch'},
    {name:'Square_Cut',stroke:'cut',angle:-Math.PI/2},
    {name:'Pull',stroke:'pull',angle:Math.PI/2},
    {name:'Lofted_Straight_Drive',stroke:'loftStraight',type:'loft'},
    {name:'Lofted_Cover_Drive',stroke:'loftDrive',type:'loft',angle:-Math.PI/4},
    {name:'Lofted_On_Drive',stroke:'loftDrive',type:'loft',angle:Math.PI/4},
    {name:'Late_Cut',stroke:'lateCut',angle:-Math.PI*.85},
    {name:'Missed_Swing_Recovery',stroke:'straightDrive',quality:'miss',raw:0},
    {name:'Milestone_Bat_Raise'},
  ];
  const clips:THREE.AnimationClip[]=[];
  for(const family of families) {
    const duration=family.stroke?CONFIG.lead[family.stroke]+.95:1.5;
    const count=37;
    const times:number[]=[];
    const values=nodes.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    let shot:Shot|null=null;
    if(family.stroke)shot={type:family.type??'ground',direction:'straight',stroke:family.stroke,committedAt:0,contactAt:CONFIG.lead[family.stroke],target:{x:0,y:family.stroke==='cut'||family.stroke==='pull'?1.1:.62,z:CONFIG.contactZ},angle:family.angle??0,suitability:1,timingError:family.quality==='miss'?.2:0,quality:family.quality??'perfect',raw:family.raw??1,contribution:50};
    for(let i=0;i<count;i++) {
      const t=i/(count-1)*duration;times.push(t);
      frame.time=t;frame.phaseTime=t;frame.shotAge=t;frame.shot=shot;
      frame.milestone=family.name==='Milestone_Bat_Raise';
      // Bake the same verified-contact finish as the renderer. A missed-swing
      // clip retains its ordinary recovery and never receives a hit flourish.
      frame.phase=frame.milestone?'feedback':shot&&shot.quality!=='miss'&&t>=CONFIG.lead[shot.stroke]?'outgoing':'delivery';
      player.updateBatter(frame);
      nodes.forEach((node,index)=>{const v=values[index];v.p.push(node.position.x,node.position.y,node.position.z);v.q.push(node.quaternion.x,node.quaternion.y,node.quaternion.z,node.quaternion.w);v.s.push(node.scale.x,node.scale.y,node.scale.z);});
    }
    const tracks:THREE.KeyframeTrack[]=[];
    nodes.forEach((node,i)=>{
      for(const [key,property,size] of [['p','position',3],['q','quaternion',4],['s','scale',3]] as const) {
        const data=values[i][key];let varies=false;
        for(let j=size;j<data.length;j++)if(Math.abs(data[j]-data[j%size])>1e-7){varies=true;break;}
        if(varies)tracks.push(key==='q'?new THREE.QuaternionKeyframeTrack(`${node.uuid}.${property}`,times,data):new THREE.VectorKeyframeTrack(`${node.uuid}.${property}`,times,data));
      }
    });
    clips.push(new THREE.AnimationClip(family.name,duration,tracks));
  }
  frame.shot=null;frame.milestone=false;frame.time=0;player.updateBatter(frame);
  root.userData={author:'Fun Cricket project',license:'Original project asset',units:'meters',coordinates:'Y up; +Z toward bowler; +X leg side',animationSource:'src/animation/pose.ts',contactNote:'Gameplay samples original curves for exact bat collider synchronization.'};
  const result=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:true});
  return result as ArrayBuffer;
}
