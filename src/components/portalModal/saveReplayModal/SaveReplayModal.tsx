'use client';

import BasicModal from '@/components/portalModal/basicModal/BasicModal';

import shared from '../modal.module.scss';
import s from './saveReplayModal.module.scss';

type SaveReplayModalProps = {
  open: boolean;
  onConfirm: () => void;
  onSkip: () => void;
};

export default function SaveReplayModal({
  open,
  onConfirm,
  onSkip,
}: SaveReplayModalProps) {
  if (!open) return null;

  return (
    <BasicModal
      setOnModal={(next) => {
        const shouldOpen = typeof next === 'function' ? next(true) : next;
        if (!shouldOpen) onSkip();
      }}
      dimClick={false}
      className={`${shared.panel} ${shared.panelCompact} ${s.modal}`}
    >
      <h2 className={shared.title}>기록 저장</h2>
      <p className={shared.description}>이번 플레이 기록을 저장할까요?</p>
      <div className={`${shared.actionsCenter} ${s.actions}`}>
        <button
          type="button"
          className={shared.btnPrimary}
          onClick={onConfirm}
        >
          예
        </button>
        <button
          type="button"
          className={shared.btnSecondary}
          onClick={onSkip}
        >
          아니오
        </button>
      </div>
    </BasicModal>
  );
}
