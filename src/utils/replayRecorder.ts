import type { ReplayAction, ReplayData } from '@/types/replay';

const MOVE_MIN_DX = 4;
const MOVE_MIN_MS = 50;

export class ReplayRecorder {
  private seed = 0;
  private skills: string[] = [];
  private actions: ReplayAction[] = [];
  private startedAt = 0;
  private lastMoveX: number | null = null;
  private lastMoveAt = -Infinity;
  private active = false;

  start(seed: number, skills: string[]) {
    this.seed = seed;
    this.skills = [...skills];
    this.actions = [];
    this.startedAt = performance.now();
    this.lastMoveX = null;
    this.lastMoveAt = -Infinity;
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  reset() {
    this.active = false;
    this.actions = [];
    this.skills = [];
    this.seed = 0;
    this.lastMoveX = null;
  }

  private now(): number {
    return Math.max(0, Math.round(performance.now() - this.startedAt));
  }

  recordMove(x: number) {
    if (!this.active) return;
    const t = this.now();
    const rounded = Math.round(x);
    if (
      this.lastMoveX != null &&
      Math.abs(rounded - this.lastMoveX) < MOVE_MIN_DX &&
      t - this.lastMoveAt < MOVE_MIN_MS
    ) {
      return;
    }
    this.lastMoveX = rounded;
    this.lastMoveAt = t;
    this.actions.push({ time: t, type: 'MOVE', x: rounded });
  }

  recordDrop(x: number, pokemonType: number) {
    if (!this.active) return;
    this.actions.push({
      time: this.now(),
      type: 'DROP',
      x: Math.round(x),
      pokemonType,
    });
  }

  recordSkill(
    skillId: string,
    extra?: Omit<Extract<ReplayAction, { type: 'SKILL' }>, 'time' | 'type' | 'skillId'>,
  ) {
    if (!this.active) return;
    this.actions.push({
      time: this.now(),
      type: 'SKILL',
      skillId,
      ...extra,
    });
  }

  durationSec(): number {
    if (this.startedAt <= 0) return 0;
    return Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
  }

  toReplayData(): ReplayData {
    return {
      version: '1.0',
      seed: this.seed,
      skills: [...this.skills],
      actions: [...this.actions],
    };
  }
}
