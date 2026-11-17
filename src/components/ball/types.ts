import type Matter from 'matter-js';

import type { ReplayData } from '@/types/replay';

import type { PLAYBACK_RATES } from './constants';

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export type GamePhase = 'idle' | 'selecting' | 'playing' | 'gameover' | 'replay';

export type AimMode = null | 'shrink' | 'trick' | 'blowAway';

export type BallBody = Matter.Body & {
  plugin: {
    tierId: number;
    merging?: boolean;
  };
};

export type BallProps = {
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
