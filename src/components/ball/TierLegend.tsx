'use client';

import { BALL_TIERS } from '@/constants/ballTiers';

export default function TierLegend() {
  return (
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
  );
}
