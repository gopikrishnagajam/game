import {describe,it,expect} from 'vitest';
import {CONFIG} from '../src/core/config';
import {RNG,copy,vec} from '../src/core/math';
import {createShot,launchVelocity,sweptBatContact} from '../src/batting/batting';
import {sampleBatPose} from '../src/animation/pose';
import {stepBall} from '../src/physics/ball';
import type {Ball,Delivery} from '../src/core/types';

const delivery:Delivery={id:0,style:'fast',bowler:'Fixture',length:'short',variation:'Stock',
  speed:38,release:vec(.2,2.1,18),velocity:vec(0,1,-38),swing:0,turn:0,restitution:.6,
  bounce:vec(0,.036,8),arrival:.5,contact:vec(-.2,1.3,CONFIG.contactZ),field:[],fieldName:'balanced',strategy:'normal'};

describe('coherent contact flight',()=>{
  it('directs a high grounded cut into the turf before distant interception zones',()=>{
    const shot=createShot(delivery,'ground','point',delivery.arrival-CONFIG.lead.cut);
    const response=launchVelocity(shot,delivery.velocity,50,0,8,new RNG(1));
    expect(response.aerial).toBe(false);expect(response.velocity.y).toBeLessThan(0);
    const ball:Ball={position:copy(delivery.contact),velocity:response.velocity,bounced:false};
    let landing=null;
    for(let tick=0;tick<120 && !landing;tick++)landing=stepBall(ball,CONFIG.step,null,true).landing;
    expect(landing).not.toBeNull();
    expect(Math.hypot(landing!.x-delivery.contact.x,landing!.z-delivery.contact.z)).toBeLessThan(CONFIG.batting.launch.groundContactDistance);
    expect(landing!.y).toBe(CONFIG.ballRadius);
  });
  it('dissipates power on a very weak edge instead of retaining a full powered shot',()=>{
    const shot=createShot(delivery,'ground','point',delivery.arrival-CONFIG.lead.cut);
    const clean=launchVelocity(shot,delivery.velocity,50,0,8,new RNG(1));
    const weak=launchVelocity({...shot,raw:0,quality:'miss'},delivery.velocity,50,.8,8,new RNG(1));
    const speed=(v:typeof clean.velocity)=>Math.hypot(v.x,v.y,v.z);
    expect(speed(weak.velocity)).toBeLessThan(5);
    expect(speed(clean.velocity)).toBeGreaterThan(speed(weak.velocity)*6);
  });
  it('lets a shoe-height yorker pass beneath an unsuitable horizontal late cut',()=>{
    const yorker={...delivery,length:'yorker' as const,contact:vec(-.2,.08,CONFIG.contactZ)};
    const shot=createShot(yorker,'ground','late',yorker.arrival-CONFIG.lead.lateCut);
    expect(shot.target.y).toBe(CONFIG.batting.minHorizontalHeight);
    const before=sampleBatPose(shot,CONFIG.lead.lateCut-CONFIG.step,null),after=sampleBatPose(shot,CONFIG.lead.lateCut,null);
    const ballBefore=vec(-.2,.08,CONFIG.contactZ+.25),ballAfter=vec(-.2,.08,CONFIG.contactZ-.05);
    expect(sweptBatContact(ballBefore,ballAfter,before,after)).toBeNull();
  });
});
