export type ReplayAction =
  | { time: number; type: 'MOVE'; x: number }
  | { time: number; type: 'DROP'; x: number; pokemonType: number }
  | {
      time: number;
      type: 'SKILL';
      skillId: string;
      x?: number;
      y?: number;
      x2?: number;
      y2?: number;
      pokemonType?: number;
      fromTier?: number;
      toTier?: number;
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
