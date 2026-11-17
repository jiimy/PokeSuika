export type ReplaySkillPhase = 'aim' | 'pick' | 'cast';

export type ReplayQuakeBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type ReplayAction =
  | { time: number; type: 'MOVE'; x: number }
  | { time: number; type: 'DROP'; x: number; pokemonType: number }
  | {
      time: number;
      type: 'SKILL';
      skillId: string;
      /** aim=조준 시작, pick=중간 선택(트릭 1번째), cast/생략=실제 시전 */
      phase?: ReplaySkillPhase;
      x?: number;
      y?: number;
      x2?: number;
      y2?: number;
      pokemonType?: number;
      fromTier?: number;
      toTier?: number;
      /** 사슬묶기 후 현재/다음 공 */
      currentTier?: number;
      nextTier?: number;
      /** 지진 직후 공 위치·속도 (재생 결정론) */
      quakes?: ReplayQuakeBody[];
    };

export type ReplayData = {
  version: '1.0';
  seed: number;
  skills: string[];
  actions: ReplayAction[];
};

export type SaveReplayPayload = {
  guestId?: string | null;
  userId?: string | null;
  score: number;
  maxGrade: number;
  durationSec: number;
  replayData: ReplayData;
};

export type ReplayListItem = {
  id: string;
  score: number;
  max_grade: number | null;
  duration_sec: number | null;
  created_at: string;
  user_id?: string | null;
  guest_id?: string | null;
};
