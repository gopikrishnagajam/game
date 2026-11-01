import { CONFIG } from '../core/config';
import type { CricketGame } from '../core/game';
import type { Difficulty, Direction, Outcome, Team, Vec3 } from '../core/types';
import { battingFeedback, type BattingFeedback } from './feedback';

const directionNames: Record<Direction,string> = {
  straight:'Straight',longOn:'Midwicket',cover:'Covers',leg:'Square leg',point:'Point',
  fineLeg:'Fine leg',thirdMan:'Third man',late:'Behind square',
};
export const outcomeText = (o:Outcome) => o.wicket?({bowled:'BOWLED!',lbw:'LBW!',caught:'CAUGHT!'})[o.wicket]
  : o.runs===6?'SIX!':o.runs===4?'FOUR!':o.runs===0?'DOT BALL':`${o.runs} ${o.runs===1?'RUN':'RUNS'}`;
const key=(label:string)=>`<kbd>${label}</kbd>`;

export class GameUI {
  team:Team='blue';
  difficulty:Difficulty='club';
  private el:HTMLElement;
  private tracker:HTMLCanvasElement;
  private trail:Vec3[]=[];
  private lastBall=0;
  private helpWasPaused=false;
  private selected:Direction='straight';
  private feedbackTimer=0;
  private contactFeedback:BattingFeedback|null=null;
  private lastMatchBalls='';
  private textCache=new Map<string,string>();
  private lastScreen='';
  private wasPaused=false;
  private focusBeforePause:HTMLElement|null=null;

  constructor(private root:HTMLElement, private game:CricketGame, private handlers:{
    start:(team:Team,difficulty:Difficulty)=>void; sound:()=>boolean; pause:()=>void;
  }) {
    this.el=document.createElement('div');this.el.className='interface';
    this.el.innerHTML=`
      <header class="topbar">
        <button class="brand" id="home" aria-label="Fun Cricket home"><span class="brand-ball" aria-hidden="true">◒</span> FUN<span>CRICKET</span><i>03</i></button>
        <div class="edition"><span class="live-dot"></span> THE TWO-OVER CHASE <span class="edition-divider">/</span> DESKTOP EDITION</div>
        <nav><button class="icon-button" id="sound" aria-label="Turn sound off"><span id="sound-icon">◖))</span><span id="sound-label">SOUND ON</span></button><button class="icon-button" id="help" aria-label="How to play"><span class="circle-question">?</span><span>HOW TO PLAY</span></button></nav>
      </header>
      <section class="hero" id="menu-panel">
        <div class="eyebrow"><span></span> SMALL GAME. BIG INNINGS.</div>
        <h1>TWO OVERS.<br>ONE <em>CHASE.</em></h1>
        <p>Read the delivery. Find your timing.<br>Make every ball count.</p>
        <button class="primary-button" id="play">PLAY QUICK CHASE <span>↗</span></button>
        <div class="hero-spec"><div><b>12</b><span>BALLS</span></div><i></i><div><b>03</b><span>WICKETS</span></div><i></i><div><b>01</b><span>TARGET</span></div></div>
        <div class="hero-controls"><span>${key('↑')}${key('←')}${key('↓')}${key('→')} Choose your direction</span><span>${key('A')} Defend ${key('S')} Ground ${key('D')} Loft</span></div>
      </section>
      <div class="stadium-caption" id="stadium-caption"><span class="caption-line"></span><span>THE OVAL <small>DAY SESSION · RIGHT-HAND BAT</small></span></div>
      <section class="setup-panel card" id="setup-panel" hidden aria-label="Match setup">
        <button class="back-button" id="setup-back">← BACK</button><div class="eyebrow">QUICK CHASE / MATCH SETUP</div>
        <h2>Make it your innings.</h2><p class="subtle">Two overs. Three wickets. A target to chase.</p>
        <div class="field-label">01 <span>CHOOSE YOUR SIDE</span></div>
        <div class="team-options"><button class="team-card selected" data-team="blue" aria-pressed="true"><span class="jersey blue-jersey">01</span><b>Team Blue</b><small>COOL UNDER PRESSURE</small><i class="selection-dot"></i></button><button class="team-card" data-team="yellow" aria-pressed="false"><span class="jersey yellow-jersey">01</span><b>Team Yellow</b><small>PLAY WITH INTENT</small><i class="selection-dot"></i></button></div>
        <div class="field-label">02 <span>PICK YOUR CHALLENGE</span></div>
        <div class="difficulty-options">${(['beginner','club','pro'] as Difficulty[]).map(d=>`<button class="difficulty-card ${d==='club'?'selected':''}" data-difficulty="${d}" aria-pressed="${d==='club'}"><b>${d==='beginner'?'Beginner':d==='club'?'Club':'Pro'}</b><span>CHASE <strong>${CONFIG.difficulty[d].target}</strong></span></button>`).join('')}</div>
        <p class="setup-note" id="setup-note">70% gameplay pace. Balanced bowling and genuine variation.</p>
        <button class="primary-button" id="start">CHASE <span id="setup-target">24</span> RUNS <span>→</span></button>
      </section>
      <div class="match-ui" id="match-ui" tabindex="-1" hidden>
        <section class="scoreboard" aria-label="Live scoreboard"><div class="score-main"><span class="team-swatch" id="team-swatch"></span><div><span class="score-label" id="score-team">TEAM BLUE</span><div class="score-number"><span id="score">0</span><span class="score-separator">/</span><span id="wickets">0</span></div></div><div class="overs"><b id="overs">0.0</b><span>OVERS / 2</span></div></div><div class="chase-stat"><span>TARGET</span><b id="target">24</b></div><div class="chase-equation"><b><span id="needed">24</span> <small>NEEDED</small></b><span>FROM <strong id="remaining">12</strong> BALLS</span></div><button class="pause-button" id="pause" aria-label="Pause match">Ⅱ</button></section>
        <div class="over-line"><div><span class="live-dot"></span><span id="bowler-label">PACE ATTACK</span><span id="bowler-speed"></span></div><div class="ball-history" id="history" aria-label="Current over outcomes"></div></div>
        <div class="delivery-status" id="delivery-status" aria-live="polite">GET READY</div>
        <div class="feedback" id="feedback" aria-live="polite"><span id="feedback-quality"></span><strong id="feedback-result"></strong><small id="feedback-note"></small></div>
        <div class="bottom-hud"><section class="batter-card"><div class="batter-heading"><span class="bat-mark">▰</span><b id="batter-name">BATTER 01</b><span class="on-strike">ON STRIKE</span><strong><span id="batter-runs">0</span><small> (<span id="batter-balls">0</span>)</small></strong></div><div class="confidence-heading"><span>CONFIDENCE</span><b id="confidence-value">50%</b></div><div class="confidence-track"><span id="confidence-fill"></span></div><div class="non-striker" id="non-striker">BATTER 02 <span>0 (0)</span></div></section>
        <section class="controls-card"><div class="direction-readout"><span class="compass-arrow" id="direction-arrow">↑</span><div><span>SHOT DIRECTION</span><b id="direction-name">Straight</b></div><span class="direction-lock" id="direction-lock"></span></div><div class="shot-controls"><span>${key('A')} DEFEND</span><span>${key('S')} GROUND</span><span>${key('D')} LOFT</span></div><small id="control-hint">AIM DURING RUN-UP · PRESS TO TIME YOUR SWING</small></section></div>
        <aside class="tracker" id="tracker" hidden><div><span class="live-dot"></span> BALL TRACKER <small>LIVE</small></div><canvas width="200" height="200" id="tracker-canvas" aria-label="Live top-down ball tracker"></canvas></aside>
      </div>
      <section class="result-panel card" id="result-panel" hidden aria-label="Match result"><div class="eyebrow" id="result-eyebrow">CHASE COMPLETE</div><h2 id="result-title">VICTORY.</h2><p id="result-subtitle"></p><div class="result-score"><strong id="final-score"></strong><div><span id="final-overs"></span><small id="final-target"></small></div></div><div class="scorecard-head"><span>BATTING CARD</span><span>RUNS <i>/</i> BALLS</span></div><div id="scorecard"></div><button class="primary-button" id="play-again">ONE MORE CHASE <span>↗</span></button><button class="secondary-button" id="result-menu">RETURN TO MENU</button></section>
      <div class="pause-overlay" id="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="card pause-card"><div class="eyebrow">TAKE A BREATHER</div><h2 id="pause-title">Innings paused.</h2><p>Your next ball can wait.</p><button class="primary-button" id="resume">BACK TO THE CREASE <span>→</span></button><button class="secondary-button" id="pause-menu">END MATCH & RETURN</button></div></div>
      <dialog id="help-dialog"><button class="dialog-close" id="close-help" aria-label="Close instructions">×</button><div class="eyebrow">YOUR TIME AT THE CREASE</div><h2>Pick. Time. Chase.</h2><div class="help-step"><b>01</b><div><h3>Find a gap</h3><p>Use the arrow keys during the run-up to choose a direction. Combine two arrows for a diagonal. Your selection carries into the next delivery until you change it.</p></div></div><div class="help-step"><b>02</b><div><h3>Read the ball</h3><p>Follow the ball from the bowler's hand and watch the bounce ring. Beginner gives you the most time to react. Pace comes first; spin takes the second over.</p></div></div><div class="help-step"><b>03</b><div><h3>Time your stroke</h3><p>${key('A')} Defend or duck. ${key('S')} Play along the ground. ${key('D')} Go aerial. After release, press before the ball reaches you to give your bat time to swing. Early, perfect, late and missed feedback helps you adjust the next shot.</p></div></div><div class="help-tip">One shot per ball. Timing and direction matter. Grounded strokes cannot be caught; lofted shots carry that risk. Odd runs change the striker. Your last three deliveries shape your confidence.</div><button class="primary-button" id="help-got-it">GOT IT <span>→</span></button></dialog>
      <footer class="page-footer" id="page-footer"><span>BUILT FOR THE NEXT BALL.</span><span>NO LONG INNINGS. JUST GOOD CRICKET.</span><span>v0.3</span></footer>
      <div class="debug-panel" id="debug-panel" hidden></div>
    `;
    root.append(this.el);this.tracker=this.get<HTMLCanvasElement>('tracker-canvas');
    this.get('play').onclick=()=>{game.setup();this.update();};
    this.get('setup-back').onclick=()=>{game.menu();this.update();};
    this.get('home').onclick=()=>{if(game.phase==='menu'||game.phase==='setup'||game.phase==='complete'){game.menu();this.update();}else {handlers.pause();}};
    this.get('start').onclick=()=>handlers.start(this.team,this.difficulty);
    this.get('play-again').onclick=()=>handlers.start(this.team,this.difficulty);
    this.get('result-menu').onclick=()=>{game.menu();this.update();};
    this.get('pause-menu').onclick=()=>{game.menu();this.update();};
    this.get('sound').onclick=()=>{const on=handlers.sound();this.get('sound-label').textContent=`SOUND ${on?'ON':'OFF'}`;this.get('sound').setAttribute('aria-label',`Turn sound ${on?'off':'on'}`);};
    for(const id of ['pause','resume'])this.get(id).onclick=handlers.pause;
    const help=this.get<HTMLDialogElement>('help-dialog');
    this.get('help').onclick=()=>{this.helpWasPaused=game.paused;if(!game.paused&&['runup','delivery','outgoing','feedback'].includes(game.phase))handlers.pause();help.showModal();};
    const close=()=>help.close();
    this.get('close-help').onclick=close;this.get('help-got-it').onclick=close;
    help.addEventListener('close',()=>{game.paused=this.helpWasPaused;this.update();});
    this.el.addEventListener('keydown',event=>{
      if(event.key!=='Tab'||!game.paused||help.open||this.get('pause-overlay').hidden)return;
      const first=this.get('resume'),last=this.get('pause-menu');
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-team]').forEach(button=>button.onclick=()=>{
      this.team=button.dataset.team as Team;this.updateSelection();
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(button=>button.onclick=()=>{
      this.difficulty=button.dataset.difficulty as Difficulty;this.updateSelection();
    });
  }
  private get<T extends HTMLElement = HTMLElement>(id:string):T{return this.el.querySelector<T>(`#${id}`)!;}
  private text(id:string,value:string|number){const s=String(value);if(this.textCache.get(id)!==s){this.get(id).textContent=s;this.textCache.set(id,s);}}
  private show(id:string,on:boolean){this.get(id).hidden=!on;}
  private updateSelection(){
    this.el.querySelectorAll<HTMLElement>('[data-team]').forEach(e=>{const on=e.dataset.team===this.team;e.classList.toggle('selected',on);e.setAttribute('aria-pressed',String(on));});
    this.el.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(e=>{const on=e.dataset.difficulty===this.difficulty;e.classList.toggle('selected',on);e.setAttribute('aria-pressed',String(on));});
    this.text('setup-target',CONFIG.difficulty[this.difficulty].target);
    const pace=Math.round(CONFIG.difficulty[this.difficulty].timeScale*100);
    this.text('setup-note',`${pace}% gameplay pace. `+{beginner:'More time to read the ball. Gentler movement.',club:'Balanced bowling and genuine variation.',pro:'Sharper bowling. Stronger movement.'}[this.difficulty]);
  }
  direction(direction:Direction){this.selected=direction;}
  contact(outcome:Outcome){
    this.contactFeedback=battingFeedback(outcome);
    this.feedbackTimer=this.game.time+0.75;
  }
  reset(){this.trail=[];this.lastMatchBalls='';this.feedbackTimer=0;this.contactFeedback=null;this.selected='straight';}
  update(){
    const game=this.game, phase=game.phase, playing=['runup','delivery','outgoing','feedback'].includes(phase);
    const screen=phase==='menu'?'menu':phase==='setup'?'setup':phase==='complete'?'result':'play';
    this.root.dataset.screen=screen;
    this.show('menu-panel',phase==='menu');this.show('stadium-caption',phase==='menu');this.show('page-footer',phase==='menu');
    this.show('setup-panel',phase==='setup');this.show('match-ui',playing);this.show('result-panel',phase==='complete');this.show('pause-overlay',game.paused && playing);
    const paused=game.paused&&playing;
    if(paused&&!this.wasPaused){
      this.focusBeforePause=document.activeElement instanceof HTMLElement?document.activeElement:null;
      this.get('resume').focus({preventScroll:true});
    } else if(screen!==this.lastScreen){
      this.get(screen==='menu'?'play':screen==='setup'?'setup-back':screen==='result'?'play-again':'match-ui').focus({preventScroll:true});
    } else if(!paused&&this.wasPaused&&!this.get<HTMLDialogElement>('help-dialog').open){
      (this.focusBeforePause?.getClientRects().length?this.focusBeforePause:this.get('match-ui')).focus({preventScroll:true});
    }
    this.wasPaused=paused;this.lastScreen=screen;
    const match=game.match;
    if(!match)return;
    const batter=match.batters[match.striker],other=match.batters[match.nonStriker];
    this.text('score-team',`TEAM ${match.team.toUpperCase()} vs ${match.team==='blue'?'YELLOW':'BLUE'}`);
    this.get('team-swatch').style.background=match.team==='blue'?'#5a9eff':'#f4cb4b';
    this.text('score',match.runs);this.text('wickets',match.wickets);
    this.text('overs',`${Math.floor(match.balls/6)}.${match.balls%6}`);this.text('target',match.target);
    this.text('needed',Math.max(0,match.target-match.runs));this.text('remaining',12-match.balls);
    this.text('batter-name',batter.name.toUpperCase());this.text('batter-runs',batter.runs);this.text('batter-balls',batter.balls);
    this.text('confidence-value',`${Math.round(batter.confidence)}%`);
    this.get('confidence-fill').style.width=`${batter.confidence}%`;
    this.get('confidence-fill').style.background=batter.confidence<30?'#e78c71':batter.confidence>65?'#d5ef73':'#e6c979';
    this.get('non-striker').innerHTML=`${other.name.toUpperCase()} <span>${other.runs} (${other.balls})</span>`;
    const historyKey=`${match.balls}:${phase==='feedback'?'feedback':'live'}`;
    if(this.lastMatchBalls!==historyKey){
      const overStart=game.phase==='feedback' && match.balls%6===0?Math.max(0,match.balls-6):Math.floor(match.balls/6)*6;
      const outcomes=match.outcomes.slice(overStart,overStart+6);
      this.get('history').innerHTML=Array.from({length:6},(_,i)=>{const o=outcomes[i];return `<span class="${!o?'pending':o.wicket?'wicket':o.runs>=4?'boundary':''}">${o?o.wicket?'W':o.runs:'·'}</span>`;}).join('');
      this.lastMatchBalls=historyKey;
    }
    const d=game.delivery;
    this.text('bowler-label',d?`${match.balls<6 || (phase==='feedback' && match.balls===6)?'OVER 01':'OVER 02'} / ${d.style==='offSpin'?'OFF-SPIN':d.style==='legSpin'?'LEG-SPIN':d.style==='medium'?'MEDIUM PACE':'FAST PACE'}`:'');
    this.text('bowler-speed',d && phase!=='runup'?`${Math.round(d.speed*3.6)} KM/H`:'');
    this.text('delivery-status',phase==='runup'?(match.balls===6?'SPIN ATTACK · PICK YOUR DIRECTION':`BALL ${match.balls%6+1} · PICK YOUR DIRECTION`):phase==='delivery'&&!game.shot?(game.ball?.bounced?'BOUNCED · TIME YOUR STROKE':'BALL RELEASED · WATCH THE BOUNCE'):'');
    const direction=game.shot?.direction??this.selected;
    this.text('direction-name',directionNames[direction]);this.text('direction-lock',game.shot?'LOCKED':'');
    this.text('direction-arrow',({straight:'↑',cover:'↗',longOn:'↖',leg:'←',point:'→',fineLeg:'↙',thirdMan:'↘',late:'↓'})[direction]);
    this.text('control-hint',phase==='runup'?'ARROWS TO AIM · SHOT AFTER RELEASE':game.shot?'ONE STROKE COMMITTED · WATCH YOUR SHOT':'DIRECTION RETAINED · PRESS TO TIME YOUR SWING');
    const feedback=this.get('feedback');const result=phase==='feedback'&&game.outcome;
    const visible=!!result||(phase==='outgoing'&&game.time<this.feedbackTimer);
    feedback.classList.toggle('visible',visible);
    feedback.classList.toggle('wicket-feedback',!!game.outcome?.wicket);
    feedback.classList.toggle('contact-feedback',phase==='outgoing');
    const resolved=result?battingFeedback(game.outcome!,game.shot?.stroke==='duck'):this.contactFeedback;
    feedback.dataset.timing=resolved?.tone??'neutral';
    this.text('feedback-quality',resolved?.label??'');
    this.text('feedback-result',result?outcomeText(game.outcome!):'');
    const extra=result?(game.outcome!.dropped?'DROPPED CATCH':game.milestone?'MILESTONE · BAT RAISED':match.balls===6?'PACE DONE. SPIN NEXT.':''):'';
    this.text('feedback-note',[resolved?.note,extra].filter(Boolean).join(' · '));
    if(phase==='complete')this.renderResult();
    this.show('debug-panel',game.debug);
    if(game.debug)this.get('debug-panel').textContent=JSON.stringify({phase,time:game.deliveryTime.toFixed(3),ball:game.ball?.position,delivery:game.delivery?{arrival:game.delivery.arrival,contact:game.delivery.contact,field:game.delivery.fieldName}:null,shot:game.shot?{stroke:game.shot.stroke,error:game.shot.timingError,raw:game.shot.raw}:null,contact:game.contactDebug,result:game.outcome},null,2);
  }
  private renderResult(){
    const m=this.game.match!;this.text('result-title',m.won?'VICTORY.':'DEFEAT.');
    this.text('result-eyebrow',m.won?'VICTORY / TARGET REACHED':'DEFEAT / CHASE COMPLETE');
    this.text('result-subtitle',m.won?`${m.target} was the ask. You made it happen.`:`${Math.max(0,m.target-m.runs)} more runs were needed. There’s always another chase.`);
    this.text('final-score',`${m.runs}/${m.wickets}`);this.text('final-overs',`${Math.floor(m.balls/6)}.${m.balls%6} OVERS`);this.text('final-target',`TARGET ${m.target}`);
    const signature=m.batters.map(b=>`${b.runs}:${b.balls}:${b.out}`).join('/');
    if(this.get('scorecard').dataset.signature!==signature){this.get('scorecard').innerHTML=m.batters.map(b=>`<div class="scorecard-row"><span>${b.name}<small>${b.out?'OUT':b.balls?'NOT OUT':'DID NOT BAT'}</small></span><b>${b.runs}<small> / ${b.balls}</small></b></div>`).join('');this.get('scorecard').dataset.signature=signature;}
  }
  drawTracker(visible:boolean,position:Vec3|null){
    const playing=['outgoing','feedback'].includes(this.game.phase);
    this.show('tracker',visible && playing);
    if(this.game.delivery?.id!==this.lastBall){this.trail=[];this.lastBall=this.game.delivery?.id??0;}
    if(!visible || !position || !playing)return;
    if(!this.trail.length || Math.hypot(position.x-this.trail[this.trail.length-1].x,position.z-this.trail[this.trail.length-1].z)>0.5){this.trail.push({...position});if(this.trail.length>65)this.trail.shift();}
    const c=this.tracker.getContext('2d')!;c.clearRect(0,0,200,200);
    c.fillStyle='#29443b';c.beginPath();c.arc(100,100,82,0,Math.PI*2);c.fill();
    c.strokeStyle='#83937a';c.lineWidth=1;c.stroke();c.setLineDash([2,6]);c.beginPath();c.arc(100,100,48,0,Math.PI*2);c.stroke();c.setLineDash([]);
    const scale=82/CONFIG.boundary;
    const project=(p:Vec3)=>({x:100-p.x*scale,y:100-p.z*scale});
    c.fillStyle='#baae83';c.fillRect(97,100-CONFIG.pitchLength*scale,6,CONFIG.pitchLength*scale);
    c.strokeStyle='#d7ed9e';c.lineWidth=1.6;c.beginPath();this.trail.forEach((p,i)=>{const q=project(p);if(!i)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);});c.stroke();
    const p=project(position);const off=Math.hypot(p.x-100,p.y-100)>88;
    if(off){const angle=Math.atan2(p.y-100,p.x-100);p.x=100+88*Math.cos(angle);p.y=100+88*Math.sin(angle);}
    c.fillStyle='#d5f275';c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.globalAlpha=0.2;c.fill();c.globalAlpha=1;
    c.fillStyle='#fffcec';c.beginPath();c.arc(p.x,p.y,3,0,Math.PI*2);c.fill();
  }
}
