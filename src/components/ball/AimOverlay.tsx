'use client';

import { DROP_TIER_MAX, getTier } from '@/constants/ballTiers';

import type { AimMode } from './types';

type AimOverlayProps = {
  aimMode: AimMode;
  aimHint: string;
  currentTierId: number;
  boundTierId: number | null;
  onBlowAway: (tierId: number) => void;
  onCancel: () => void;
};

export default function AimOverlay({
  aimMode,
  aimHint,
  currentTierId,
  boundTierId,
  onBlowAway,
  onCancel,
}: AimOverlayProps) {
  if (!aimMode) return null;

  if (aimMode === 'blowAway') {
    return (
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
                onClick={() => onBlowAway(id)}
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
                <span className="text-[9px] font-semibold">{tier.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className="rounded-full border border-slate-400 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-200"
            onClick={onCancel}
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-1">
      <span className="rounded-full bg-amber-400/95 px-3 py-1 text-xs font-bold text-slate-950">
        {aimHint}
      </span>
      <button
        type="button"
        className="pointer-events-auto rounded-full border border-slate-400 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-200"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        취소
      </button>
    </div>
  );
}
