import { CONFIG } from '../core/config';
import { copy } from '../core/math';
import type { Ball, Delivery, Vec3 } from '../core/types';

const EPSILON = 1e-9;

export function createBall(delivery: Delivery): Ball {
  return { position: copy(delivery.release), velocity: copy(delivery.velocity), bounced: false };
}

/** Exact integration of constant acceleration with linear air resistance. */
function air(ball: Ball, dt: number, lateral: number) {
  const drag = CONFIG.airDrag;
  const decay = Math.exp(-drag * dt);
  const integral = (1 - decay) / drag;
  const accelerationIntegral = (dt - integral) / drag;
  ball.position.x += ball.velocity.x * integral + lateral * accelerationIntegral;
  ball.position.y += ball.velocity.y * integral - CONFIG.gravity * accelerationIntegral;
  ball.position.z += ball.velocity.z * integral;
  ball.velocity.x = ball.velocity.x * decay + lateral * integral;
  ball.velocity.y = ball.velocity.y * decay - CONFIG.gravity * integral;
  ball.velocity.z *= decay;
}

function heightAt(ball: Ball, dt: number): number {
  const drag = CONFIG.airDrag;
  const integral = -Math.expm1(-drag * dt) / drag;
  return ball.position.y + ball.velocity.y * integral - CONFIG.gravity * (dt - integral) / drag;
}

/** Integrates a live ball. The returned landing is the actual swept ground contact. */
export function stepBall(
  ball: Ball,
  dt: number,
  delivery: Delivery | null,
  outgoing = false,
): { bounced: boolean; landing: Vec3 | null } {
  if (!(dt > 0)) return { bounced: false, landing: null };
  const radius = CONFIG.ballRadius;
  if (outgoing && ball.position.y <= radius + EPSILON && ball.velocity.y <= EPSILON) {
    ball.position.y = radius;
    ball.velocity.y = 0;
    const speed = Math.hypot(ball.velocity.x, ball.velocity.z);
    if (speed < EPSILON) {
      ball.velocity.x = 0;
      ball.velocity.z = 0;
      return { bounced: false, landing: null };
    }
    const movingTime = Math.min(dt, speed / CONFIG.rollingFriction);
    const travelled = speed * movingTime - CONFIG.rollingFriction * movingTime * movingTime / 2;
    ball.position.x += ball.velocity.x / speed * travelled;
    ball.position.z += ball.velocity.z / speed * travelled;
    const scale = Math.max(0, speed - CONFIG.rollingFriction * dt) / speed;
    ball.velocity.x *= scale;
    ball.velocity.z *= scale;
    return { bounced: false, landing: null };
  }

  const lateral = !outgoing && !ball.bounced && delivery ? delivery.swing : 0;
  if (heightAt(ball, dt) > radius || (ball.velocity.y > 0 && ball.position.y <= radius + EPSILON)) {
    air(ball, dt, lateral);
    // A very small hop may start and finish within one fixed step. Integrate it below.
    if (ball.position.y >= radius) return { bounced: false, landing: null };
    // Recover the start exactly for the uncommon sub-step hop.
    air(ball, -dt, lateral);
  }

  let low = 0;
  let high = dt;
  for (let i = 0; i < 28; i++) {
    const middle = (low + high) / 2;
    if (heightAt(ball, middle) > radius) low = middle;
    else high = middle;
  }
  const impactTime = high;
  air(ball, impactTime, lateral);
  ball.position.y = radius;
  const landing = copy(ball.position);
  const firstBounce = !ball.bounced;
  ball.bounced = true;
  const restitution = outgoing ? CONFIG.physics.outgoingRestitution : delivery?.restitution ?? CONFIG.physics.defaultRestitution;
  ball.velocity.y = Math.abs(ball.velocity.y) * restitution;
  ball.velocity.z *= outgoing ? CONFIG.physics.outgoingBounceRetention : CONFIG.physics.incomingBounceRetention;
  ball.velocity.x *= outgoing ? CONFIG.physics.outgoingBounceRetention : CONFIG.physics.incomingBounceRetention;
  if (!outgoing && firstBounce && delivery) ball.velocity.x += delivery.turn;
  if (outgoing && ball.velocity.y < CONFIG.physics.settleVerticalSpeed) ball.velocity.y = 0;
  const remaining = dt - impactTime;
  if (remaining > EPSILON) stepBall(ball, remaining, delivery, outgoing);
  return { bounced: true, landing };
}

/** Uses the same fixed-step integrator as play; no independently faked bounce or arrival. */
export function predictDelivery(delivery: Delivery): { bounce: Vec3; contact: Vec3; arrival: number } {
  const ball = createBall(delivery);
  let bounce: Vec3 | null = null;
  let time = 0;
  for (let i = 0; i < 600; i++) {
    const before = copy(ball.position);
    const event = stepBall(ball, CONFIG.step, delivery);
    if (event.landing && !bounce) bounce = event.landing;
    if (ball.position.z <= CONFIG.contactZ) {
      const fraction = (before.z - CONFIG.contactZ) / (before.z - ball.position.z);
      return {
        bounce: bounce ?? copy(ball.position),
        contact: {
          x: before.x + (ball.position.x - before.x) * fraction,
          y: before.y + (ball.position.y - before.y) * fraction,
          z: CONFIG.contactZ,
        },
        arrival: time + CONFIG.step * fraction,
      };
    }
    time += CONFIG.step;
  }
  throw new Error('Delivery did not reach the batting contact region.');
}
