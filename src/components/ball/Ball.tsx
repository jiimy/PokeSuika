'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

import {
  BALL_TIERS,
  DROP_TIER_MAX,
  getTier,
  MAX_TIER_ID,
  randomDropTierId,
} from '@/constants/ballTiers';
import {
  getSkill,
  SKILL_PICK_COUNT,
  SKILLS,
  type SkillId,
} from '@/constants/skills';
import type { ReplayAction, ReplayData } from '@/types/replay';
import { getOrCreateGuestIdentity } from '@/utils/guestId';
import { ReplayRecorder } from '@/utils/replayRecorder';
import { createReplaySeed, createSeededRandom } from '@/utils/seededRandom';

const { Engine, Render, Runner, Bodies, Body, Composite, Events, World } =
  Matter;

export const BOARD_WIDTH = 400;
export const BOARD_HEIGHT = 560;
const WALL_THICKNESS = 40;
const DROP_Y = 56;
const DROP_COOLDOWN_MS = 450;
const GAME_OVER_LINE_Y = 110;
const COMBO_MULT_STEP = 0.1;
const TRICK_ROOM_TURNS = 10;
const MIMIC_TURNS = 3;
const BIND_TURNS = 3;
const SKILL_PANEL_WIDTH = 200;

type GamePhase = 'idle' | 'selecting' | 'playing' | 'gameover' | 'replay';
type AimMode = null | 'shrink' | 'trick' | 'blowAway';

type BallBody = Matter.Body & {
  plugin: {
    tierId: number;
    merging?: boolean;
  };
};

function clampBallToCutline(body: BallBody) {
  const r = body.circleRadius ?? 0;
  const minY = GAME_OVER_LINE_Y + r;
  if (body.position.y < minY) {
    Body.setPosition(body, { x: body.position.x, y: minY });
    if (body.velocity.y < 0) {
      Body.setVelocity(body, { x: body.velocity.x, y: 0 });
    }
  }
}

type BallProps = {
  onScoreChange?: (score: number) => void;
  onGameOverChange?: (over: boolean) => void;
  /** 비로그인으로 게임 시작 시 게스트 ID 전달 */
  onGuestSession?: (guestId: string) => void;
  /** 리플레이 저장 성공 시 */
  onReplaySaved?: () => void;
  /** 재생할 리플레이 (변경 시 보드에서 재생) */
  replayToPlay?: ReplayData | null;
  onReplayFinished?: () => void;
};

function createBallBody(x: number, y: number, tierId: number): BallBody {
  const tier = getTier(tierId);
  const body = Bodies.circle(x, y, tier.radius, {
    restitution: 0.12,
    friction: 0.35,
    frictionAir: 0.01,
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

function isFieldBall(body: Matter.Body): body is BallBody {
  return (
    !!body.label?.startsWith('ball-') &&
    !(body as BallBody).isSensor &&
    !!(body as BallBody).plugin
  );
}

function replaceBallTier(
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

export default function Ball({
  onScoreChange,
  onGameOverChange,
  onGuestSession,
  onReplaySaved,
  replayToPlay,
  onReplayFinished,
}: BallProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const previewRef = useRef<BallBody | null>(null);
  const droppingRef = useRef(false);
  const gameOverRef = useRef(false);
  const playingRef = useRef(false);
  const mergeLockRef = useRef(new Set<number>());
  const pointerXRef = useRef(BOARD_WIDTH / 2);
  const scoreRef = useRef(0);
  const ppRef = useRef(0);
  const mergeStreakRef = useRef(0);
  const comboClearTimerRef = useRef<number | null>(null);

  const trickRoomLeftRef = useRef(0);
  const mimicLeftRef = useRef(0);
  const mimicTierRef = useRef<number | null>(null);
  const bindLeftRef = useRef(0);
  const bindTierRef = useRef<number | null>(null);
  const aimModeRef = useRef<AimMode>(null);
  const trickPickRef = useRef<BallBody | null>(null);
  /** 지진 직후 커트라인 게임오버 무시 */
  const quakeSafeRef = useRef(false);
  const quakeSafeUntilRef = useRef(0);
  /** 프리렌더에서 Math.random 금지 — 마운트 후 useEffect에서 교체 */
  const rngRef = useRef<() => number>(() => 0.5);
  const maxGradeRef = useRef(0);
  const recorderRef = useRef(new ReplayRecorder());
  const savingReplayRef = useRef(false);
  const isPlaybackRef = useRef(false);
  const playbackRafRef = useRef<number | null>(null);
  const playbackRef = useRef<{
    actions: ReplayAction[];
    index: number;
    startedAt: number;
  } | null>(null);

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [pickedSkills, setPickedSkills] = useState<SkillId[]>([]);
  const [equipped, setEquipped] = useState<SkillId[]>([]);
  const [score, setScore] = useState(0);
  const [pp, setPp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [currentTierId, setCurrentTierId] = useState(0);
  const [nextTierId, setNextTierId] = useState(1);
  const [aimMode, setAimMode] = useState<AimMode>(null);
  const [aimHint, setAimHint] = useState('');
  const [buffLabel, setBuffLabel] = useState('');
  const [boundTierId, setBoundTierId] = useState<number | null>(null);
  const [replaySaveMsg, setReplaySaveMsg] = useState('');

  const currentTierRef = useRef(0);
  const nextTierRef = useRef(1);

  useEffect(() => {
    rngRef.current = () => Math.random();
    const cur = randomDropTierId();
    const next = randomDropTierId();
    currentTierRef.current = cur;
    nextTierRef.current = next;
    setCurrentTierId(cur);
    setNextTierId(next);
  }, []);

  const syncScore = useCallback(
    (value: number) => {
      scoreRef.current = value;
      setScore(value);
      onScoreChange?.(value);
    },
    [onScoreChange],
  );

  const syncPp = useCallback((value: number) => {
    ppRef.current = value;
    setPp(value);
  }, []);

  const saveReplay = useCallback(async () => {
    if (savingReplayRef.current || isPlaybackRef.current) return;
    savingReplayRef.current = true;
    setReplaySaveMsg('기록 저장 중…');
    try {
      const { guestId, userId } = getOrCreateGuestIdentity();
      onGuestSession?.(guestId);
      const recorder = recorderRef.current;
      recorder.stop();
      const replayData = recorder.toReplayData();
      if (replayData.actions.length === 0) {
        setReplaySaveMsg('저장할 플레이가 없습니다');
        return;
      }
      const res = await fetch('/api/game-replays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          userId,
          score: scoreRef.current,
          maxGrade: maxGradeRef.current,
          durationSec: recorder.durationSec(),
          replayData,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setReplaySaveMsg(json.error ?? '기록 저장 실패');
        return;
      }
      setReplaySaveMsg(`기록 저장됨 · ${guestId}`);
      onReplaySaved?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '기록 저장 실패';
      setReplaySaveMsg(message);
    } finally {
      savingReplayRef.current = false;
    }
  }, [onGuestSession, onReplaySaved]);

  const setOver = useCallback(
    (over: boolean) => {
      gameOverRef.current = over;
      if (over) {
        playingRef.current = false;
        if (isPlaybackRef.current) {
          isPlaybackRef.current = false;
          playbackRef.current = null;
          if (playbackRafRef.current != null) {
            cancelAnimationFrame(playbackRafRef.current);
            playbackRafRef.current = null;
          }
          setPhase('idle');
          onReplayFinished?.();
        } else {
          setPhase('gameover');
          setAimMode(null);
          aimModeRef.current = null;
          trickPickRef.current = null;
          void saveReplay();
        }
      }
      onGameOverChange?.(over);
    },
    [onGameOverChange, saveReplay, onReplayFinished],
  );

  const refreshBuffLabel = useCallback(() => {
    const parts: string[] = [];
    if (trickRoomLeftRef.current > 0) {
      parts.push(`트릭룸 ${trickRoomLeftRef.current}`);
    }
    if (mimicLeftRef.current > 0 || mimicTierRef.current != null) {
      const left =
        mimicLeftRef.current +
        (mimicTierRef.current != null &&
        nextTierRef.current === mimicTierRef.current
          ? 1
          : 0);
      if (left > 0) parts.push(`흉내내기 ${left}`);
    }
    if (bindLeftRef.current > 0) {
      parts.push(`사슬묶기 ${bindLeftRef.current}`);
    }
    setBuffLabel(parts.join(' · '));
  }, []);

  const nextDropTier = useCallback(() => {
    if (mimicLeftRef.current > 0 && mimicTierRef.current != null) {
      const tier = mimicTierRef.current;
      mimicLeftRef.current -= 1;
      if (mimicLeftRef.current <= 0) mimicTierRef.current = null;
      if (trickRoomLeftRef.current > 0) trickRoomLeftRef.current -= 1;
      refreshBuffLabel();
      return tier;
    }

    const exclude =
      bindLeftRef.current > 0 ? bindTierRef.current : null;
    const tier = randomDropTierId({
      boostLowTiers: trickRoomLeftRef.current > 0,
      excludeTierId: exclude,
      random: rngRef.current,
    });

    if (trickRoomLeftRef.current > 0) trickRoomLeftRef.current -= 1;
    if (bindLeftRef.current > 0) {
      bindLeftRef.current -= 1;
      if (bindLeftRef.current <= 0) {
        bindTierRef.current = null;
        setBoundTierId(null);
      }
    }
    refreshBuffLabel();
    return tier;
  }, [refreshBuffLabel]);

  const clampDropX = useCallback((x: number, tierId: number) => {
    const r = getTier(tierId).radius;
    return Math.min(BOARD_WIDTH - r - 4, Math.max(r + 4, x));
  }, []);

  const clearFieldBalls = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const body of [...engine.world.bodies]) {
      if (!body.label?.startsWith('wall-')) {
        Composite.remove(engine.world, body);
      }
    }
    previewRef.current = null;
  }, []);

  const spawnPreview = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || gameOverRef.current || !playingRef.current) return;

    if (previewRef.current) {
      Composite.remove(engine.world, previewRef.current);
      previewRef.current = null;
    }

    const tierId = currentTierRef.current;
    const x = clampDropX(pointerXRef.current, tierId);
    const preview = createBallBody(x, DROP_Y, tierId);
    preview.isStatic = true;
    preview.isSensor = true;
    preview.collisionFilter = { group: -1, category: 0x0002, mask: 0 };
    preview.render.opacity = 0.85;
    previewRef.current = preview;
    Composite.add(engine.world, preview);
  }, [clampDropX]);

  const clearComboUiSoon = useCallback(() => {
    if (comboClearTimerRef.current != null) {
      window.clearTimeout(comboClearTimerRef.current);
    }
    comboClearTimerRef.current = window.setTimeout(() => {
      setCombo(0);
      comboClearTimerRef.current = null;
    }, 1200);
  }, []);

  const dropBallAt = useCallback(
    (dropX: number, tierId: number, record: boolean) => {
      const engine = engineRef.current;
      if (!engine || gameOverRef.current || !playingRef.current) return;

      droppingRef.current = true;
      mergeStreakRef.current = 0;
      setCombo(0);

      if (previewRef.current) {
        Composite.remove(engine.world, previewRef.current);
        previewRef.current = null;
      }

      const x = clampDropX(dropX, tierId);
      const ball = createBallBody(x, DROP_Y, tierId);
      Composite.add(engine.world, ball);
      if (record) recorderRef.current.recordDrop(x, tierId);
      if (tierId > maxGradeRef.current) maxGradeRef.current = tierId;

      currentTierRef.current = nextTierRef.current;
      nextTierRef.current = nextDropTier();
      setCurrentTierId(currentTierRef.current);
      setNextTierId(nextTierRef.current);

      window.setTimeout(() => {
        droppingRef.current = false;
        if (!gameOverRef.current && playingRef.current) spawnPreview();
      }, isPlaybackRef.current ? 120 : DROP_COOLDOWN_MS);
    },
    [clampDropX, spawnPreview, nextDropTier],
  );

  const dropBall = useCallback(() => {
    const preview = previewRef.current;
    if (
      !preview ||
      droppingRef.current ||
      gameOverRef.current ||
      !playingRef.current ||
      aimModeRef.current ||
      isPlaybackRef.current
    ) {
      return;
    }

    dropBallAt(preview.position.x, currentTierRef.current, true);
  }, [dropBallAt]);

  const spendPp = useCallback(
    (cost: number) => {
      if (ppRef.current < cost) return false;
      syncPp(ppRef.current - cost);
      return true;
    },
    [syncPp],
  );

  const cancelAim = useCallback(() => {
    aimModeRef.current = null;
    trickPickRef.current = null;
    setAimMode(null);
    setAimHint('');
  }, []);

  const applyBlowAway = useCallback(
    (tierId: number) => {
      if (tierId === currentTierRef.current) return;
      if (tierId < 0 || tierId > DROP_TIER_MAX) return;
      if (
        bindLeftRef.current > 0 &&
        bindTierRef.current != null &&
        tierId === bindTierRef.current
      ) {
        return;
      }
      if (!spendPp(getSkill('blowAway').cost)) return;
      recorderRef.current.recordSkill('blowAway', { pokemonType: tierId });
      currentTierRef.current = tierId;
      setCurrentTierId(tierId);
      spawnPreview();
      cancelAim();
    },
    [spendPp, spawnPreview, cancelAim],
  );

  const findBallAt = useCallback((boardX: number, boardY: number) => {
    const engine = engineRef.current;
    if (!engine) return null;
    let best: BallBody | null = null;
    let bestDist = Infinity;
    for (const body of engine.world.bodies) {
      if (!isFieldBall(body) || body.plugin.merging) continue;
      const dx = body.position.x - boardX;
      const dy = body.position.y - boardY;
      const dist = Math.hypot(dx, dy);
      const hit = (body.circleRadius ?? 0) + 6;
      if (dist <= hit && dist < bestDist) {
        best = body;
        bestDist = dist;
      }
    }
    return best;
  }, []);

  const applyShrink = useCallback(
    (target: BallBody) => {
      const engine = engineRef.current;
      if (!engine) return;
      const tierId = target.plugin.tierId;
      if (tierId <= 0) return;
      if (!spendPp(getSkill('shrink').cost)) return;
      const lower = Math.floor(rngRef.current() * tierId);
      recorderRef.current.recordSkill('shrink', {
        x: target.position.x,
        y: target.position.y,
        fromTier: tierId,
        toTier: lower,
      });
      replaceBallTier(engine, target, lower);
      cancelAim();
    },
    [spendPp, cancelAim],
  );

  const applyTrickSwap = useCallback(
    (a: BallBody, b: BallBody) => {
      if (a.id === b.id) return;
      if (!spendPp(getSkill('trick').cost)) return;
      const posA = { ...a.position };
      const posB = { ...b.position };
      const velA = { ...a.velocity };
      const velB = { ...b.velocity };
      recorderRef.current.recordSkill('trick', {
        x: posA.x,
        y: posA.y,
        x2: posB.x,
        y2: posB.y,
      });
      Body.setPosition(a, posB);
      Body.setPosition(b, posA);
      Body.setVelocity(a, velB);
      Body.setVelocity(b, velA);
      cancelAim();
    },
    [spendPp, cancelAim],
  );

  const handleBoardPointer = useCallback(
    (clientX: number, clientY: number, isClick: boolean) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * BOARD_WIDTH;
      const y = ((clientY - rect.top) / rect.height) * BOARD_HEIGHT;
      pointerXRef.current = x;

      if (isPlaybackRef.current) return;

      const preview = previewRef.current;
      if (preview && playingRef.current && !gameOverRef.current && !aimModeRef.current) {
        const clampedX = clampDropX(x, currentTierRef.current);
        Body.setPosition(preview, {
          x: clampedX,
          y: DROP_Y,
        });
        recorderRef.current.recordMove(clampedX);
      } else if (playingRef.current && !gameOverRef.current) {
        recorderRef.current.recordMove(x);
      }

      if (!isClick || !playingRef.current || gameOverRef.current) return;

      const mode = aimModeRef.current;
      if (mode === 'blowAway') return;

      if (mode === 'shrink') {
        const target = findBallAt(x, y);
        if (!target) return;
        applyShrink(target);
        return;
      }

      if (mode === 'trick') {
        const target = findBallAt(x, y);
        if (!target) return;
        if (!trickPickRef.current) {
          trickPickRef.current = target;
          setAimHint('두 번째 공을 선택하세요');
          return;
        }
        applyTrickSwap(trickPickRef.current, target);
        return;
      }

      dropBall();
    },
    [clampDropX, findBallAt, applyShrink, applyTrickSwap, dropBall],
  );

  const activateSkill = useCallback(
    (id: SkillId) => {
      if (!playingRef.current || gameOverRef.current) return;
      const skill = getSkill(id);
      const engine = engineRef.current;

      if (id === 'shrink') {
        if (ppRef.current < skill.cost) return;
        aimModeRef.current = 'shrink';
        trickPickRef.current = null;
        setAimMode('shrink');
        setAimHint('작아질 공을 보드에서 클릭');
        return;
      }

      if (id === 'trick') {
        if (ppRef.current < skill.cost) return;
        aimModeRef.current = 'trick';
        trickPickRef.current = null;
        setAimMode('trick');
        setAimHint('서로 바꿀 공 2개를 순서대로 클릭');
        return;
      }

      if (id === 'blowAway') {
        if (ppRef.current < skill.cost) return;
        aimModeRef.current = 'blowAway';
        trickPickRef.current = null;
        setAimMode('blowAway');
        setAimHint('바꿀 공을 선택하세요');
        return;
      }

      if (id === 'earthquake') {
        if (!engine) return;
        if (!spendPp(skill.cost)) return;
        const rand = rngRef.current;
        quakeSafeRef.current = true;
        quakeSafeUntilRef.current = performance.now() + 500;
        for (const body of engine.world.bodies) {
          if (!isFieldBall(body) || body.plugin.merging) continue;
          const r = body.circleRadius ?? 0;
          const minY = GAME_OVER_LINE_Y + r;
          const liftY = Math.max(minY, Math.min(body.position.y, BOARD_HEIGHT * 0.55));
          Body.setVelocity(body, {
            x: (rand() - 0.5) * 14,
            y: -8 - rand() * 5,
          });
          Body.setPosition(body, {
            x: Math.min(
              BOARD_WIDTH - 20,
              Math.max(20, body.position.x + (rand() - 0.5) * 40),
            ),
            y: liftY,
          });
          clampBallToCutline(body);
        }
        recorderRef.current.recordSkill('earthquake');
        cancelAim();
        return;
      }

      if (id === 'trickRoom') {
        if (!spendPp(skill.cost)) return;
        trickRoomLeftRef.current = TRICK_ROOM_TURNS;
        recorderRef.current.recordSkill('trickRoom');
        refreshBuffLabel();
        cancelAim();
        return;
      }

      if (id === 'mimic') {
        if (!spendPp(skill.cost)) return;
        const tier = currentTierRef.current;
        mimicTierRef.current = tier;
        mimicLeftRef.current = MIMIC_TURNS - 1;
        nextTierRef.current = tier;
        setNextTierId(tier);
        recorderRef.current.recordSkill('mimic', { pokemonType: tier });
        refreshBuffLabel();
        cancelAim();
        return;
      }

      if (id === 'bind') {
        if (!spendPp(skill.cost)) return;
        const tier = currentTierRef.current;
        bindTierRef.current = tier;
        bindLeftRef.current = BIND_TURNS;
        setBoundTierId(tier);
        const reroll = () =>
          randomDropTierId({
            boostLowTiers: trickRoomLeftRef.current > 0,
            excludeTierId: tier,
            random: rngRef.current,
          });
        if (currentTierRef.current === tier) {
          currentTierRef.current = reroll();
          setCurrentTierId(currentTierRef.current);
          spawnPreview();
        }
        if (nextTierRef.current === tier) {
          nextTierRef.current = reroll();
          setNextTierId(nextTierRef.current);
        }
        recorderRef.current.recordSkill('bind', { pokemonType: tier });
        refreshBuffLabel();
        cancelAim();
      }
    },
    [spendPp, spawnPreview, cancelAim, refreshBuffLabel],
  );

  const beginPlay = useCallback(() => {
    if (pickedSkills.length !== SKILL_PICK_COUNT) return;

    clearFieldBalls();
    mergeLockRef.current.clear();
    mergeStreakRef.current = 0;
    trickRoomLeftRef.current = 0;
    mimicLeftRef.current = 0;
    mimicTierRef.current = null;
    bindLeftRef.current = 0;
    bindTierRef.current = null;
    setBoundTierId(null);
    quakeSafeRef.current = false;
    quakeSafeUntilRef.current = 0;
    cancelAim();
    setBuffLabel('');
    setCombo(0);
    setComboFlash(0);
    setReplaySaveMsg('');
    syncScore(0);
    syncPp(0);
    setOver(false);
    gameOverRef.current = false;

    const seed = createReplaySeed();
    rngRef.current = createSeededRandom(seed);
    maxGradeRef.current = 0;
    const { guestId } = getOrCreateGuestIdentity();
    onGuestSession?.(guestId);
    recorderRef.current.start(seed, pickedSkills);

    currentTierRef.current = randomDropTierId({ random: rngRef.current });
    nextTierRef.current = randomDropTierId({ random: rngRef.current });
    maxGradeRef.current = Math.max(
      currentTierRef.current,
      nextTierRef.current,
    );
    setCurrentTierId(currentTierRef.current);
    setNextTierId(nextTierRef.current);

    setEquipped([...pickedSkills]);
    playingRef.current = true;
    setPhase('playing');
    droppingRef.current = false;
    spawnPreview();
  }, [
    pickedSkills,
    clearFieldBalls,
    cancelAim,
    syncScore,
    syncPp,
    setOver,
    spawnPreview,
    onGuestSession,
  ]);

  const stopPlaybackLoop = useCallback(() => {
    if (playbackRafRef.current != null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    playbackRef.current = null;
    isPlaybackRef.current = false;
  }, []);

  const goIdle = useCallback(() => {
    playingRef.current = false;
    gameOverRef.current = false;
    quakeSafeRef.current = false;
    quakeSafeUntilRef.current = 0;
    bindLeftRef.current = 0;
    bindTierRef.current = null;
    stopPlaybackLoop();
    recorderRef.current.reset();
    rngRef.current = () => Math.random();
    maxGradeRef.current = 0;
    clearFieldBalls();
    cancelAim();
    setEquipped([]);
    setPickedSkills([]);
    setBuffLabel('');
    setBoundTierId(null);
    setReplaySaveMsg('');
    setPhase('idle');
    syncScore(0);
    syncPp(0);
    onGameOverChange?.(false);
  }, [
    clearFieldBalls,
    cancelAim,
    syncScore,
    syncPp,
    onGameOverChange,
    stopPlaybackLoop,
  ]);

  const findBallNear = useCallback((x: number, y: number) => {
    const engine = engineRef.current;
    if (!engine) return null;
    let best: BallBody | null = null;
    let bestDist = Infinity;
    for (const body of engine.world.bodies) {
      if (!isFieldBall(body) || body.plugin.merging) continue;
      const dist = Math.hypot(body.position.x - x, body.position.y - y);
      if (dist < bestDist) {
        best = body;
        bestDist = dist;
      }
    }
    return bestDist < 80 ? best : null;
  }, []);

  const applyPlaybackAction = useCallback(
    (action: ReplayAction) => {
      const engine = engineRef.current;
      if (!engine || !playingRef.current) return;

      if (action.type === 'MOVE') {
        pointerXRef.current = action.x;
        const preview = previewRef.current;
        if (preview) {
          Body.setPosition(preview, {
            x: clampDropX(action.x, currentTierRef.current),
            y: DROP_Y,
          });
        }
        return;
      }

      if (action.type === 'DROP') {
        currentTierRef.current = action.pokemonType;
        setCurrentTierId(action.pokemonType);
        dropBallAt(action.x, action.pokemonType, false);
        return;
      }

      if (action.type === 'SKILL') {
        const id = action.skillId as SkillId;
        if (id === 'blowAway' && action.pokemonType != null) {
          currentTierRef.current = action.pokemonType;
          setCurrentTierId(action.pokemonType);
          spawnPreview();
          return;
        }
        if (id === 'shrink' && action.x != null && action.y != null && action.toTier != null) {
          const target = findBallNear(action.x, action.y);
          if (target) replaceBallTier(engine, target, action.toTier);
          return;
        }
        if (id === 'trick' && action.x != null && action.y != null && action.x2 != null && action.y2 != null) {
          const a = findBallNear(action.x, action.y);
          const b = findBallNear(action.x2, action.y2);
          if (a && b && a.id !== b.id) {
            const posA = { ...a.position };
            const posB = { ...b.position };
            const velA = { ...a.velocity };
            const velB = { ...b.velocity };
            Body.setPosition(a, posB);
            Body.setPosition(b, posA);
            Body.setVelocity(a, velB);
            Body.setVelocity(b, velA);
          }
          return;
        }
        if (id === 'earthquake') {
          const rand = rngRef.current;
          quakeSafeRef.current = true;
          quakeSafeUntilRef.current = performance.now() + 500;
          for (const body of engine.world.bodies) {
            if (!isFieldBall(body) || body.plugin.merging) continue;
            const r = body.circleRadius ?? 0;
            const minY = GAME_OVER_LINE_Y + r;
            const liftY = Math.max(
              minY,
              Math.min(body.position.y, BOARD_HEIGHT * 0.55),
            );
            Body.setVelocity(body, {
              x: (rand() - 0.5) * 14,
              y: -8 - rand() * 5,
            });
            Body.setPosition(body, {
              x: Math.min(
                BOARD_WIDTH - 20,
                Math.max(20, body.position.x + (rand() - 0.5) * 40),
              ),
              y: liftY,
            });
            clampBallToCutline(body);
          }
          return;
        }
        if (id === 'trickRoom') {
          trickRoomLeftRef.current = TRICK_ROOM_TURNS;
          refreshBuffLabel();
          return;
        }
        if (id === 'mimic' && action.pokemonType != null) {
          mimicTierRef.current = action.pokemonType;
          mimicLeftRef.current = MIMIC_TURNS - 1;
          nextTierRef.current = action.pokemonType;
          setNextTierId(action.pokemonType);
          refreshBuffLabel();
          return;
        }
        if (id === 'bind' && action.pokemonType != null) {
          bindTierRef.current = action.pokemonType;
          bindLeftRef.current = BIND_TURNS;
          setBoundTierId(action.pokemonType);
          refreshBuffLabel();
        }
      }
    },
    [clampDropX, dropBallAt, findBallNear, spawnPreview, refreshBuffLabel],
  );

  const startPlayback = useCallback(
    (data: ReplayData) => {
      stopPlaybackLoop();
      clearFieldBalls();
      mergeLockRef.current.clear();
      mergeStreakRef.current = 0;
      trickRoomLeftRef.current = 0;
      mimicLeftRef.current = 0;
      mimicTierRef.current = null;
      bindLeftRef.current = 0;
      bindTierRef.current = null;
      setBoundTierId(null);
      quakeSafeRef.current = false;
      cancelAim();
      setBuffLabel('');
      setCombo(0);
      setReplaySaveMsg('');
      syncScore(0);
      syncPp(0);
      gameOverRef.current = false;
      recorderRef.current.reset();

      rngRef.current = createSeededRandom(data.seed);
      maxGradeRef.current = 0;
      const skills = data.skills.filter((s): s is SkillId =>
        SKILLS.some((def) => def.id === s),
      );
      setEquipped(skills);
      setPickedSkills(skills);

      currentTierRef.current = randomDropTierId({ random: rngRef.current });
      nextTierRef.current = randomDropTierId({ random: rngRef.current });
      setCurrentTierId(currentTierRef.current);
      setNextTierId(nextTierRef.current);

      isPlaybackRef.current = true;
      playingRef.current = true;
      setPhase('replay');
      droppingRef.current = false;
      spawnPreview();

      playbackRef.current = {
        actions: data.actions,
        index: 0,
        startedAt: performance.now(),
      };

      const tick = () => {
        const pb = playbackRef.current;
        if (!pb || !isPlaybackRef.current) return;
        const elapsed = performance.now() - pb.startedAt;
        while (pb.index < pb.actions.length) {
          const action = pb.actions[pb.index];
          if (!action || action.time > elapsed) break;
          pb.index += 1;
          applyPlaybackAction(action);
        }
        if (pb.index >= pb.actions.length) {
          window.setTimeout(() => {
            if (!isPlaybackRef.current) return;
            playingRef.current = false;
            isPlaybackRef.current = false;
            playbackRef.current = null;
            setPhase('idle');
            onReplayFinished?.();
          }, 800);
          return;
        }
        playbackRafRef.current = requestAnimationFrame(tick);
      };
      playbackRafRef.current = requestAnimationFrame(tick);
    },
    [
      stopPlaybackLoop,
      clearFieldBalls,
      cancelAim,
      syncScore,
      syncPp,
      spawnPreview,
      applyPlaybackAction,
      onReplayFinished,
    ],
  );

  const quickEnd = useCallback(() => {
    if (!playingRef.current || isPlaybackRef.current) return;
    const engine = engineRef.current;
    if (engine && previewRef.current) {
      Composite.remove(engine.world, previewRef.current);
      previewRef.current = null;
    }
    cancelAim();
    setOver(true);
  }, [cancelAim, setOver]);

  const lastReplayRef = useRef<ReplayData | null>(null);
  useEffect(() => {
    if (!replayToPlay || replayToPlay === lastReplayRef.current) return;
    lastReplayRef.current = replayToPlay;
    startPlayback(replayToPlay);
  }, [replayToPlay, startPlayback]);

  useEffect(() => {
    if (!replayToPlay) lastReplayRef.current = null;
  }, [replayToPlay]);

  const togglePick = (id: SkillId) => {
    setPickedSkills((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= SKILL_PICK_COUNT) return prev;
      return [...prev, id];
    });
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = Engine.create({
      gravity: { x: 0, y: 1.05, scale: 0.001 },
    });
    engineRef.current = engine;

    const render = Render.create({
      element: host,
      engine,
      options: {
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        wireframes: false,
        background: '#0f172a',
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      },
    });
    renderRef.current = render;

    const floor = Bodies.rectangle(
      BOARD_WIDTH / 2,
      BOARD_HEIGHT + WALL_THICKNESS / 2 - 8,
      BOARD_WIDTH + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      {
        isStatic: true,
        label: 'wall-floor',
        render: { fillStyle: '#334155' },
      },
    );
    const left = Bodies.rectangle(
      -WALL_THICKNESS / 2 + 8,
      BOARD_HEIGHT / 2,
      WALL_THICKNESS,
      BOARD_HEIGHT * 2,
      {
        isStatic: true,
        label: 'wall-left',
        render: { fillStyle: '#334155' },
      },
    );
    const right = Bodies.rectangle(
      BOARD_WIDTH + WALL_THICKNESS / 2 - 8,
      BOARD_HEIGHT / 2,
      WALL_THICKNESS,
      BOARD_HEIGHT * 2,
      {
        isStatic: true,
        label: 'wall-right',
        render: { fillStyle: '#334155' },
      },
    );

    Composite.add(engine.world, [floor, left, right]);

    const runner = Runner.create();
    runnerRef.current = runner;
    Render.run(render);
    Runner.run(runner, engine);

    Events.on(engine, 'collisionStart', (event) => {
      if (!playingRef.current || gameOverRef.current) return;

      for (const pair of event.pairs) {
        const a = pair.bodyA as BallBody;
        const b = pair.bodyB as BallBody;
        if (!a.plugin || !b.plugin) continue;
        if (a.isSensor || b.isSensor) continue;
        if (a.plugin.merging || b.plugin.merging) continue;
        if (a.plugin.tierId !== b.plugin.tierId) continue;

        const tierId = a.plugin.tierId;
        if (tierId >= MAX_TIER_ID) continue;

        if (mergeLockRef.current.has(a.id) || mergeLockRef.current.has(b.id)) {
          continue;
        }
        mergeLockRef.current.add(a.id);
        mergeLockRef.current.add(b.id);

        a.plugin.merging = true;
        b.plugin.merging = true;

        const midX = (a.position.x + b.position.x) / 2;
        const midY = (a.position.y + b.position.y) / 2;
        const nextId = tierId + 1;

        Composite.remove(engine.world, [a, b]);
        mergeLockRef.current.delete(a.id);
        mergeLockRef.current.delete(b.id);

        if (trickPickRef.current?.id === a.id || trickPickRef.current?.id === b.id) {
          trickPickRef.current = null;
        }

        const merged = createBallBody(midX, midY, nextId);
        Composite.add(engine.world, merged);
        if (nextId > maxGradeRef.current) maxGradeRef.current = nextId;

        mergeStreakRef.current += 1;
        const streak = mergeStreakRef.current;
        const comboLevel = Math.max(0, streak - 1);
        const multiplier = 1 + comboLevel * COMBO_MULT_STEP;
        const base = getTier(nextId).score;
        const gained = Math.round(base * multiplier);
        syncScore(scoreRef.current + gained);
        syncPp(ppRef.current + 1);

        if (comboLevel >= 1) {
          setCombo(comboLevel);
          setComboFlash((n) => n + 1);
          clearComboUiSoon();
        }
      }
    });

    Events.on(engine, 'afterUpdate', () => {
      if (!playingRef.current || gameOverRef.current || droppingRef.current) {
        return;
      }

      const balls = engine.world.bodies.filter(
        (body) => isFieldBall(body) && !body.plugin.merging,
      );

      if (quakeSafeRef.current) {
        for (const body of balls) {
          clampBallToCutline(body);
        }
        const minSafeMs = performance.now() < quakeSafeUntilRef.current;
        const stillMoving = balls.some((body) => {
          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          return speed >= 0.35;
        });
        if (minSafeMs || stillMoving) {
          return;
        }
        quakeSafeRef.current = false;
      }

      const settledOverLine = balls.some((body) => {
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        return (
          body.position.y - (body.circleRadius ?? 0) < GAME_OVER_LINE_Y &&
          speed < 0.15
        );
      });

      if (settledOverLine) {
        setOver(true);
        if (previewRef.current) {
          Composite.remove(engine.world, previewRef.current);
          previewRef.current = null;
        }
      }
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      ctx.save();
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(12, GAME_OVER_LINE_Y);
      ctx.lineTo(BOARD_WIDTH - 12, GAME_OVER_LINE_Y);
      ctx.stroke();

      const pick = trickPickRef.current;
      if (pick && !pick.plugin?.merging) {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          pick.position.x,
          pick.position.y,
          (pick.circleRadius ?? 10) + 4,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    });

    return () => {
      if (comboClearTimerRef.current != null) {
        window.clearTimeout(comboClearTimerRef.current);
        comboClearTimerRef.current = null;
      }
      Events.off(engine, 'collisionStart');
      Events.off(engine, 'afterUpdate');
      Events.off(render, 'afterRender');
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      World.clear(engine.world, false);
      Engine.clear(engine);
      engineRef.current = null;
      renderRef.current = null;
      runnerRef.current = null;
      previewRef.current = null;
    };
  }, [syncScore, syncPp, setOver, clearComboUiSoon]);

  const comboMultiplier =
    combo >= 1 ? (1 + combo * COMBO_MULT_STEP).toFixed(1) : null;
  const showHud =
    phase === 'playing' || phase === 'gameover' || phase === 'replay';

  const showSkills =
    (phase === 'playing' || phase === 'replay') && equipped.length > 0;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        className="relative flex flex-col gap-2"
        style={{ width: BOARD_WIDTH }}
      >
        {showSkills ? (
          <aside
            className="absolute bottom-0 flex flex-col gap-1.5"
            style={{
              width: SKILL_PANEL_WIDTH,
              right: `calc(100% + 8px)`,
            }}
          >
            {phase === 'playing' ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-slate-500 bg-slate-900 px-1.5 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
                  onClick={goIdle}
                >
                  재시작
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-500 bg-slate-900 px-1.5 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-200"
                  onClick={quickEnd}
                >
                  빠른종료
                </button>
              </div>
            ) : (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center text-[10px] text-amber-200">
                재생 중
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {equipped.map((id) => {
                const skill = getSkill(id);
                const canAfford = pp >= skill.cost && phase === 'playing';
                const active = aimMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={phase !== 'playing'}
                    title={`${skill.description} (PP ${skill.cost})`}
                    onClick={() => activateSkill(id)}
                    className={`flex min-h-[72px] flex-col rounded-md border px-1.5 py-1.5 text-left leading-tight transition disabled:cursor-default ${
                      active
                        ? 'border-amber-300 bg-amber-400/90 text-slate-950'
                        : canAfford
                          ? 'border-slate-500 bg-slate-900 text-slate-100 hover:border-sky-300'
                          : 'border-slate-700 bg-slate-950 text-slate-500'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{skill.name}</div>
                    <div className="text-[9px] opacity-80">PP {skill.cost}</div>
                    <p
                      className={`mt-auto pt-1 text-[9px] leading-snug ${
                        active ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {skill.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}
          {showHud ? (
            <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="font-semibold tabular-nums">점수 {score}</div>
                <div className="tabular-nums text-sky-300">PP {pp}</div>
                {combo >= 1 ? (
                  <span className="text-amber-300 tabular-nums">
                    {combo}콤보 ×{comboMultiplier}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">다음</span>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{
                    background: getTier(nextTierId).color,
                    borderColor: getTier(nextTierId).stroke,
                    color: '#0f172a',
                  }}
                  title={getTier(nextTierId).name}
                >
                  {getTier(nextTierId).name.slice(0, 1)}
                </span>
                <span className="text-slate-400">현재</span>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{
                    background: getTier(currentTierId).color,
                    borderColor: getTier(currentTierId).stroke,
                    color: '#0f172a',
                  }}
                  title={getTier(currentTierId).name}
                >
                  {getTier(currentTierId).name.slice(0, 1)}
                </span>
              </div>
            </div>
          ) : null}

          {buffLabel ? (
            <p className="text-left text-xs text-violet-300">{buffLabel}</p>
          ) : null}

          <div
            ref={hostRef}
            className="relative touch-none overflow-hidden rounded-xl border border-slate-600 shadow-lg"
            style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
            onMouseMove={(e) => handleBoardPointer(e.clientX, e.clientY, false)}
            onClick={(e) => handleBoardPointer(e.clientX, e.clientY, true)}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) handleBoardPointer(t.clientX, t.clientY, false);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              const t = e.changedTouches[0];
              if (t) handleBoardPointer(t.clientX, t.clientY, true);
            }}
            role="application"
            aria-label="수박 게임 보드"
          >
          {phase === 'idle' ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/70 px-6">
              <p className="text-center text-sm text-slate-300">
                기술을 고른 뒤 게임을 시작하세요
              </p>
              <button
                type="button"
                className="rounded-full bg-emerald-500 px-6 py-2.5 text-base font-bold text-slate-950 hover:bg-emerald-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickedSkills([]);
                  setPhase('selecting');
                }}
              >
                게임 시작
              </button>
            </div>
          ) : null}

          {phase === 'selecting' ? (
            <div
              className="absolute inset-0 z-20 flex flex-col gap-2 overflow-y-auto bg-slate-950/92 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-sm font-semibold text-white">
                기술 {SKILL_PICK_COUNT}개 선택 ({pickedSkills.length}/
                {SKILL_PICK_COUNT})
              </p>
              <ul className="flex flex-col gap-1.5">
                {SKILLS.map((skill) => {
                  const on = pickedSkills.includes(skill.id);
                  const full =
                    !on && pickedSkills.length >= SKILL_PICK_COUNT;
                  return (
                    <li key={skill.id}>
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => togglePick(skill.id)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                          on
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                            : 'border-slate-600 bg-slate-900/80 text-slate-200 hover:border-slate-400'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {skill.name}
                          </span>
                          <span className="text-xs text-sky-300">
                            PP {skill.cost}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {skill.description}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={goIdle}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={pickedSkills.length !== SKILL_PICK_COUNT}
                  className="flex-1 rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={beginPlay}
                >
                  시작
                </button>
              </div>
            </div>
          ) : null}

          {aimMode === 'blowAway' ? (
            <div
              className="absolute inset-x-0 top-3 z-20 mx-2 rounded-lg border border-amber-300/80 bg-slate-950/92 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-center text-xs font-semibold text-amber-200">
                {aimHint}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: DROP_TIER_MAX + 1 }, (_, id) => {
                  const tier = getTier(id);
                  const disabled =
                    id === currentTierId ||
                    (boundTierId != null && id === boundTierId);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => applyBlowAway(id)}
                      className="inline-flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-1 disabled:cursor-not-allowed disabled:opacity-35"
                      style={{
                        background: tier.color,
                        borderColor: tier.stroke,
                        color: '#0f172a',
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center rounded-full border-2 text-[10px] font-bold"
                        style={{
                          width: Math.max(22, tier.radius),
                          height: Math.max(22, tier.radius),
                          borderColor: tier.stroke,
                          background: tier.color,
                        }}
                      >
                        {tier.name.slice(0, 1)}
                      </span>
                      <span className="text-[9px] font-semibold">
                        {tier.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  className="rounded-full border border-slate-400 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-200"
                  onClick={cancelAim}
                >
                  취소
                </button>
              </div>
            </div>
          ) : aimMode ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-1">
              <span className="rounded-full bg-amber-400/95 px-3 py-1 text-xs font-bold text-slate-950">
                {aimHint}
              </span>
              <button
                type="button"
                className="pointer-events-auto rounded-full border border-slate-400 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-200"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelAim();
                }}
              >
                취소
              </button>
            </div>
          ) : null}

          {combo >= 1 && phase === 'playing' ? (
            <div
              key={comboFlash}
              className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center"
              aria-live="polite"
            >
              <span className="animate-bounce rounded-full bg-amber-400/95 px-3 py-1 text-sm font-bold text-slate-950 shadow-md">
                {combo}콤보! ×{comboMultiplier}
              </span>
            </div>
          ) : null}
          </div>
      </div>

      {phase === 'gameover' ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-950/40 px-4 py-3 text-center">
          <p className="font-semibold text-rose-200">게임 오버</p>
          <p className="text-sm text-slate-300">
            최종 점수 {score} · PP {pp}
          </p>
          {replaySaveMsg ? (
            <p className="text-xs text-sky-300">{replaySaveMsg}</p>
          ) : null}
          <button
            type="button"
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            onClick={goIdle}
          >
            다시 하기
          </button>
        </div>
      ) : phase === 'playing' ? (
        <p className="text-center text-xs text-slate-400">
          클릭으로 드롭 · 보드 왼쪽 기술 사용 · 합체 시 PP +1
        </p>
      ) : phase === 'replay' ? (
        <p className="text-center text-xs text-amber-300">
          기록 재생 중…
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-1.5 opacity-90">
        {BALL_TIERS.map((tier) => (
          <span
            key={tier.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-slate-900"
            style={{
              background: tier.color,
              border: `1px solid ${tier.stroke}`,
            }}
            title={`단계 ${tier.id + 1}`}
          >
            {tier.name}
          </span>
        ))}
      </div>
    </div>
  );
}
