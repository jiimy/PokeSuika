/** 수박게임 공 단계 11개 (작 → 큼). 같은 단계 2개 합치면 다음 단계로. */
export type BallTier = {
  id: number;
  name: string;
  radius: number;
  color: string;
  stroke: string;
  score: number;
};

export const BALL_TIERS: BallTier[] = [
  { id: 0, name: '체리', radius: 14, color: '#f87171', stroke: '#b91c1c', score: 1 },
  { id: 1, name: '딸기', radius: 18, color: '#fb7185', stroke: '#be123c', score: 3 },
  { id: 2, name: '포도', radius: 23, color: '#c084fc', stroke: '#7e22ce', score: 6 },
  { id: 3, name: '귤', radius: 28, color: '#fb923c', stroke: '#c2410c', score: 10 },
  { id: 4, name: '오렌지', radius: 34, color: '#fdba74', stroke: '#c2410c', score: 15 },
  { id: 5, name: '사과', radius: 40, color: '#f87171', stroke: '#991b1b', score: 21 },
  { id: 6, name: '배', radius: 47, color: '#facc15', stroke: '#a16207', score: 28 },
  { id: 7, name: '복숭아', radius: 54, color: '#fda4af', stroke: '#9f1239', score: 36 },
  { id: 8, name: '파인애플', radius: 62, color: '#fde047', stroke: '#ca8a04', score: 45 },
  { id: 9, name: '멜론', radius: 72, color: '#86efac', stroke: '#15803d', score: 55 },
  { id: 10, name: '수박', radius: 84, color: '#4ade80', stroke: '#166534', score: 66 },
];

export const MAX_TIER_ID = BALL_TIERS.length - 1;

/** 드롭 가능한 초기 공 단계 (0~3 = 1~4단계) */
export const DROP_TIER_MAX = 3;

export function getTier(id: number): BallTier {
  const clamped = Math.max(0, Math.min(MAX_TIER_ID, id));
  const tier = BALL_TIERS.at(clamped);
  if (!tier) {
    throw new Error(`Invalid ball tier: ${id}`);
  }
  return tier;
}

export type DropRngOptions = {
  /** 트릭룸: 1~2단계(id 0~1) 가중치 증가 */
  boostLowTiers?: boolean;
  /** 흉내내기: 고정 단계 */
  forceTierId?: number | null;
  /** 사슬묶기: 제외할 단계 */
  excludeTierId?: number | null;
  /** 리플레이용 시드 RNG (기본 Math.random) */
  random?: () => number;
};

export function randomDropTierId(opts?: DropRngOptions): number {
  const roll = opts?.random;

  if (opts?.forceTierId != null) {
    return Math.max(0, Math.min(DROP_TIER_MAX, opts.forceTierId));
  }

  let totalWeight = 0;
  const entries: { id: number; weight: number }[] = [];
  for (let id = 0; id <= DROP_TIER_MAX; id++) {
    if (opts?.excludeTierId === id) continue;
    const weight = opts?.boostLowTiers && id <= 1 ? 3 : 1;
    entries.push({ id, weight });
    totalWeight += weight;
  }

  if (totalWeight <= 0 || entries.length === 0) {
    return 0;
  }

  // Math.random 은 호출 시점에만 사용 (프리렌더 경로에서 기본값으로 평가되지 않게)
  const unit = roll ? roll() : Math.random();
  let ticket = unit * totalWeight;
  let chosen = 0;
  for (const entry of entries) {
    chosen = entry.id;
    ticket -= entry.weight;
    if (ticket < 0) {
      return entry.id;
    }
  }
  return chosen;
}
