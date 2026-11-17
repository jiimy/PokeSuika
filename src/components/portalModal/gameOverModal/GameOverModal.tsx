'use client';

import BasicModal from '@/components/portalModal/basicModal/BasicModal';

import shared from '../modal.module.scss';
import s from './gameOverModal.module.scss';

type GameOverModalProps = {
  open: boolean;
  score: number;
  pp: number;
  saveMessage?: string;
  onRetry: () => void;
};

export default function GameOverModal({
  open,
  score,
  pp,
  saveMessage,
  onRetry,
}: GameOverModalProps) {
  if (!open) return null;

  return (
    <BasicModal
      setOnModal={(next) => {
        const shouldOpen = typeof next === 'function' ? next(true) : next;
        if (!shouldOpen) onRetry();
      }}
      dimClick={false}
      className={`${shared.panel} ${shared.panelCompact}`}
    >
      <h2 className={shared.titleDanger}>게임 오버</h2>
      <p className={shared.description}>
        최종 점수 {score} · PP {pp}
      </p>
      {saveMessage ? <p className={shared.meta}>{saveMessage}</p> : null}
      <button
        type="button"
        className={`${shared.btnPrimary} ${s.retry}`}
        onClick={onRetry}
      >
        다시 하기
      </button>
    </BasicModal>
  );
}
