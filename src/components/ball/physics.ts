import Matter from 'matter-js';

import { getTier } from '@/constants/ballTiers';

import { GAME_OVER_LINE_Y, PLAYBACK_SIM_STEP_MS } from './constants';
import type { BallBody } from './types';

const { Engine, Runner, Bodies, Body, Composite } = Matter;

/** Matter 0.20: Runner.run은 기존 RAF를 끊지 않아 중첩되면 물리가 배속으로 돌아감 */
export function restartRunner(runner: Matter.Runner, engine: Matter.Engine) {
  Runner.stop(runner);
  Runner.run(runner, engine);
}

/** 라이브 Runner 와 동일하게 고정 16.67ms 스텝만 사용 (가변 delta → 튕김) */
export function resetSimClock(engine: Matter.Engine) {
  engine.timing.timeScale = 1;
  engine.timing.timestamp = 0;
  engine.timing.lastDelta = 0;
}

export function replaySimTime(engine: Matter.Engine | null): number {
  // floor 로 고정 스텝 경계와 맞춤 (round 시 17,33… 으로 어긋나 한 스텝 늦게 적용됨)
  return Math.max(0, Math.floor((engine?.timing.timestamp ?? 0) + 1e-6));
}

export function stepPlaybackPhysicsOnce(engine: Matter.Engine) {
  engine.timing.timeScale = 1;
  Engine.update(engine, PLAYBACK_SIM_STEP_MS);
}

export function clampBallToCutline(body: BallBody) {
  const r = body.circleRadius ?? 0;
  const minY = GAME_OVER_LINE_Y + r;
  if (body.position.y < minY) {
    Body.setPosition(body, { x: body.position.x, y: minY });
    if (body.velocity.y < 0) {
      Body.setVelocity(body, { x: body.velocity.x, y: 0 });
    }
  }
}

export function createBallBody(
  x: number,
  y: number,
  tierId: number,
): BallBody {
  const tier = getTier(tierId);
  const body = Bodies.circle(x, y, tier.radius, {
    restitution: 0.12,
    friction: 0.35,
    frictionAir: 0.012,
    density: 0.002 + tierId * 0.00025,
    label: `ball-${tierId}`,
    render: {
      fillStyle: tier.color,
      strokeStyle: tier.stroke,
      lineWidth: 2,
    },
  }) as BallBody;

  body.plugin = { tierId };
  return body;
}

export function isFieldBall(body: Matter.Body): body is BallBody {
  return (
    !!body.label?.startsWith('ball-') &&
    !(body as BallBody).isSensor &&
    !!(body as BallBody).plugin
  );
}

export function replaceBallTier(
  engine: Matter.Engine,
  body: BallBody,
  newTierId: number,
): BallBody {
  const { x, y } = body.position;
  const vel = { ...body.velocity };
  const angle = body.angle;
  Composite.remove(engine.world, body);
  const next = createBallBody(x, y, newTierId);
  Body.setVelocity(next, vel);
  Body.setAngle(next, angle);
  Composite.add(engine.world, next);
  return next;
}

export function formatPlaybackTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
