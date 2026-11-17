'use client';

import { getTier } from '@/constants/ballTiers';

type BoardHudProps = {
  score: number;
  pp: number;
  combo: number;
  comboMultiplier: string | null;
  currentTierId: number;
  nextTierId: number;
  buffLabel: string;
};

export default function BoardHud({
  score,
  pp,
  combo,
  comboMultiplier,
  currentTierId,
  nextTierId,
  buffLabel,
}: BoardHudProps) {
  return (
    <>
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
      {buffLabel ? (
        <p className="text-left text-xs text-violet-300">{buffLabel}</p>
      ) : null}
    </>
  );
}
