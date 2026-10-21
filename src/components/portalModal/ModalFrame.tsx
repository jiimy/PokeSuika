'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';

import ModalPortal from './PortalModal';

type ModalFrameProps = {
  children: ReactNode;
  setOnModal: Dispatch<SetStateAction<boolean>>;
  onClose?: boolean;
  isDim?: boolean;
  dimClick?: boolean;
  className?: string;
};

export default function ModalFrame({
  children,
  setOnModal,
  onClose = true,
  isDim = true,
  dimClick,
  className,
}: ModalFrameProps) {
  const closeOnBackdrop = () => {
    if (dimClick) setOnModal(false);
  };

  return (
    <ModalPortal setOnModal={setOnModal}>
      <div className="fixed inset-0 z-50">
        {isDim ? (
          <div className="absolute inset-0 bg-black/50" aria-hidden />
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center p-4"
          onClick={closeOnBackdrop}
        >
          <div
            className={`relative flex max-h-[min(800px,calc(100vh-80px))] w-full max-w-[520px] flex-col rounded-xl border border-slate-600 bg-slate-900 p-5 text-slate-100 shadow-xl ${className ?? ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            {onClose ? (
              <button
                type="button"
                aria-label="닫기"
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setOnModal(false)}
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
