'use client';

import { BOARD_WIDTH, PLAYBACK_RATES } from './constants';
import { formatPlaybackTime } from './physics';
import type { PlaybackRate } from './types';

type ReplayControlsProps = {
  playbackPaused: boolean;
  playbackRate: PlaybackRate;
  playbackElapsedMs: number;
  playbackDurationMs: number;
  onTogglePause: () => void;
  onPause: () => void;
  onSeek: (ms: number) => void;
  onChangeRate: (rate: PlaybackRate) => void;
  onStop: () => void;
};

export default function ReplayControls({
  playbackPaused,
  playbackRate,
  playbackElapsedMs,
  playbackDurationMs,
  onTogglePause,
  onPause,
  onSeek,
  onChangeRate,
  onStop,
}: ReplayControlsProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5"
      style={{ width: BOARD_WIDTH }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          title={playbackPaused ? '재생' : '일시정지'}
          className="shrink-0 rounded-md border border-amber-400/70 bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePause();
          }}
        >
          {playbackPaused ? '▶' : '❚❚'}
        </button>
        <input
          type="range"
          min={0}
          max={playbackDurationMs}
          step={1}
          value={Math.min(playbackElapsedMs, playbackDurationMs)}
          aria-label="재생 위치"
          className="h-2 flex-1 cursor-pointer accent-amber-400"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!playbackPaused) onPause();
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onSeek(Number(e.target.value));
          }}
        />
        <span className="shrink-0 tabular-nums text-[11px] text-slate-300">
          {formatPlaybackTime(playbackElapsedMs)} /{' '}
          {formatPlaybackTime(playbackDurationMs)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                playbackRate === rate
                  ? 'border-amber-400 bg-amber-500/25 text-amber-100'
                  : 'border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-400'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onChangeRate(rate);
              }}
            >
              {rate}x
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-500 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-200"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
        >
          재생 종료
        </button>
      </div>
    </div>
  );
}
