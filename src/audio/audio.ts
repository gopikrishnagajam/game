import type { Quality } from '../core/types';

/** Original synthesized effects. Nothing is fetched and no third-party samples are used. */
export class CricketAudio {
  enabled = true;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext(); this.gain = this.context.createGain();
      this.gain.gain.value = 0.25; this.gain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  toggle() { this.enabled = !this.enabled; return this.enabled; }
  private tone(freq: number, duration: number, volume: number, type: OscillatorType='sine', end?: number) {
    if(!this.enabled || !this.context || !this.gain) return;
    const t=this.context.currentTime, osc=this.context.createOscillator(), env=this.context.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,t);
    if(end)osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    env.gain.setValueAtTime(0.001,t);env.gain.linearRampToValueAtTime(volume,t+0.002);env.gain.exponentialRampToValueAtTime(0.001,t+duration);
    osc.connect(env);env.connect(this.gain);osc.start(t);osc.stop(t+duration+0.01);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  private noise(duration:number, volume:number, cutoff:number) {
    if(!this.enabled || !this.context || !this.gain)return;
    const count=Math.ceil(this.context.sampleRate*duration), buffer=this.context.createBuffer(1,count,this.context.sampleRate);
    const values=buffer.getChannelData(0);
    // Audio noise is cosmetic; it is independent of gameplay RNG.
    for(let i=0;i<count;i++)values[i]=(Math.random()*2-1)*Math.exp(-i/count*7);
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=volume;
    source.connect(filter);filter.connect(gain);gain.connect(this.gain);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  contact(quality:Quality){
    // A short crack, wooden body and high transient identify the sweet spot.
    // Edges/mishits have a thinner, duller knock; the sound never predicts runs.
    if(quality==='perfect') {
      this.noise(.048,.88,6500);this.noise(.10,.13,1900);
      this.tone(185,.105,.31,'triangle',92);this.tone(1150,.032,.10,'sine',650);
    } else if(quality==='good') {
      this.noise(.050,.60,4200);this.tone(165,.09,.23,'triangle',86);this.tone(820,.025,.055,'sine',520);
    } else {
      this.noise(.035,.34,2100);this.tone(125,.075,.15,'triangle',70);this.tone(1550,.025,.04,'sine',860);
    }
  }
  bounce(){this.noise(0.038,0.22,1100);this.tone(95,.04,.07,'triangle',55);}
  wicket(){this.noise(0.18,1.0,4700);this.tone(330,0.2,0.20,'triangle',100);}
  boundary(){this.tone(660,0.15,0.15);setTimeout(()=>this.tone(880,0.22,0.12),110);}
  click(){this.tone(700,0.05,0.08,'sine',500);}
  dispose(){void this.context?.close();}
}
