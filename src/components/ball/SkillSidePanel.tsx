'use client';

import { getSkill, type SkillId } from '@/constants/skills';

import { SKILL_PANEL_WIDTH } from './constants';
import type { AimMode, GamePhase, PlaybackRate } from './types';

type SkillSidePanelProps = {
  phase: GamePhase;
  equipped: SkillId[];
  pp: number;
  aimMode: AimMode;
  playbackPaused: boolean;
  playbackRate: PlaybackRate;
  onRestart: () => void;
  onQuickEnd: () => void;
  onActivateSkill: (id: SkillId) => void;
};

export default function SkillSidePanel({
  phase,
  equipped,
  pp,
  aimMode,
  playbackPaused,
  playbackRate,
  onRestart,
  onQuickEnd,
  onActivateSkill,
}: SkillSidePanelProps) {
  return (
    <aside
      className="absolute bottom-0 flex flex-col gap-1.5"
      style={{
        width: SKILL_PANEL_WIDTH,
        right: 'calc(100% + 8px)',
      }}
    >
      {phase === 'playing' ? (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="rounded-md border border-slate-500 bg-slate-900 px-1.5 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
            onClick={onRestart}
          >
            재시작
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-500 bg-slate-900 px-1.5 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-200"
            onClick={onQuickEnd}
          >
            빠른종료
          </button>
        </div>
      ) : (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center text-[10px] text-amber-200">
          {playbackPaused ? '일시정지' : '재생 중'} · {playbackRate}x
        </p>
      )}
      {equipped.length > 0 ? (
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
                onClick={() => onActivateSkill(id)}
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
      ) : null}
    </aside>
  );
}
