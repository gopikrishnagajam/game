import { describe,it,expect } from 'vitest';
import { CricketGame } from '../src/core/game';
import { CONFIG } from '../src/core/config';
import { selectStroke } from '../src/batting/batting';
import type { Direction,ShotType } from '../src/core/types';

/** Test that the authored swing actually reaches ordinary balls across the
 * promised timing windows, rather than merely labeling theoretical hits. */
describe('physical contact across fixed timing windows',()=>{
  it.each(['defend','ground','loft'] as ShotType[])('keeps well-selected %s shots playable across the perfect window',type=>{
    let attempts=0,hits=0;
    const failures:string[]=[];
    for(let seed=0;seed<24;seed++)for(const offset of [-0.75,0,0.75]){
      const game=new CricketGame();game.start('blue','club',seed);
      while(game.phase==='runup')game.advance(CONFIG.step);
      const d=game.delivery!;
      // High bouncers are intentionally ducked rather than batted in this matrix.
      if(d.contact.y>1.5 || d.length==='yorker')continue;
      const direction:Direction=type==='defend'?'straight':d.contact.x<-.12?'cover':d.contact.x>.12?'longOn':'straight';
      const inputTime=d.arrival-CONFIG.lead[selectStroke(d,type,direction)]+offset*CONFIG.timing[type].perfect;
      while(game.phase==='delivery' && game.deliveryTime+1e-10<inputTime)game.advance(CONFIG.step);
      game.commit(type,direction);attempts++;
      while(game.phase==='delivery')game.advance(CONFIG.step);
      if(game.phase==='outgoing')hits++;else failures.push(`${seed}/${offset}:${d.length}:${d.contact.y.toFixed(2)}`);
    }
    expect(hits/attempts,`${type}: ${hits}/${attempts}, misses ${failures.join(',')}`).toBeGreaterThan(0.8);
  });
});
