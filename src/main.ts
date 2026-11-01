import './style.css';
import CricketScene from './rendering/scene';
import { CricketGame } from './core/game';
import { CricketAudio } from './audio/audio';
import { InputManager } from './input/input';
import { GameUI } from './ui/ui';
import type { Difficulty, Team } from './core/types';

const app=document.querySelector<HTMLElement>('#app')!;
const viewport=document.createElement('div');viewport.className='viewport';app.append(viewport);
const audio=new CricketAudio();
let ui:GameUI;
let input:InputManager;
let last=performance.now(),lastUI=0;
let running=true,manualClock=false;
const game=new CricketGame({
  bounce:(point,time)=>{audio.bounce();scene?.bounce(point,time);},
  contact:o=>{audio.contact(o.quality);if(game.ball)scene?.contact(game.ball.position,game.time,o.quality);ui?.contact(o);},
  result:o=>{if(o.wicket)audio.wicket();else if(o.runs>=4)audio.boundary();},
  next:()=>{input?.unlock();scene?.resetDelivery();},
});
let scene:CricketScene;
try {scene=new CricketScene(viewport);} catch(error) {
  app.innerHTML='<div class="load-error"><h1>A little more graphics power.</h1><p>Fun Cricket needs WebGL. Enable hardware acceleration in your browser, then reload.</p></div>';
  throw error;
}
const start=(team:Team,difficulty:Difficulty)=>{
  void audio.unlock();audio.click();input.reset();ui.reset();game.start(team,difficulty);last=performance.now();ui.update();
};
const pause=()=>{game.togglePause();input.clear();ui.update();};
ui=new GameUI(app,game,{start,sound:()=>{void audio.unlock();return audio.toggle();},pause});
input=new InputManager((type,direction,timestamp)=>{
  // A key can arrive between rendered frames. Bring the same fixed-step clock
  // up to its timestamp before committing, preserving timing at low render FPS.
  if(!manualClock){const now=Math.max(last,Math.min(performance.now(),timestamp));game.advanceRealTime((now-last)/1000);last=now;}
  return game.commit(type,direction);
},()=>game.advancePresentation(),pause,()=>ui.direction(input.direction),
()=>!game.paused && (game.phase==='runup'||game.phase==='delivery'));

const debug=import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
game.debug=debug;
function frame(now:number) {
  if(!running)return;
  now=Math.max(now,last);const dt=(now-last)/1000;last=now;
  game.advanceRealTime(dt);
  scene.update(game.frame());
  if(now-lastUI>33){ui.update();lastUI=now;}
  const visible=game.ball?!scene.isBallVisible(game.ball.position):false;
  ui.drawTracker(visible,game.ball?.position??null);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.update();
window.addEventListener('resize',()=>scene.resize());
window.addEventListener('blur',()=>{
  if(['runup','delivery','outgoing','feedback'].includes(game.phase)){game.paused=true;input.clear();ui.update();}
});
document.addEventListener('visibilitychange',()=>{
  last=performance.now();
  if(document.hidden && ['runup','delivery','outgoing','feedback'].includes(game.phase)){game.paused=true;input.clear();}
});
if(import.meta.env.DEV && debug) {
  Object.assign(window,{__cricket:{game,scene,start,ui,input,stopRendering:()=>{running=false;manualClock=true;},snapshot:()=>structuredClone({phase:game.phase,match:game.match,delivery:game.delivery,ball:game.ball,shot:game.shot,outcome:game.outcome,contact:game.contactDebug})}});
}
if(import.meta.hot)import.meta.hot.dispose(()=>{running=false;input.dispose();scene.dispose();audio.dispose();});
