'use client';

type IdleStartOverlayProps = {
  onStart: () => void;
};

export default function IdleStartOverlay({ onStart }: IdleStartOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/70 px-6">
      <button
        type="button"
        className="rounded-full bg-emerald-500 px-6 py-2.5 text-base font-bold text-slate-950 hover:bg-emerald-400"
        onClick={(e) => {
          e.stopPropagation();
          onStart();
        }}
      >
        게임 시작
      </button>
    </div>
  );
}
