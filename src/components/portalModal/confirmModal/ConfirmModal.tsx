import type { ChildrenModalType } from '@/types/modal';

import { Modal } from '../Modal';
import ModalFrame from '../ModalFrame';

type modal = {
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};

const ConfirmModal = ({
  setOnModal,
  dimClick,
  isDim = true,
  className,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: ChildrenModalType & modal) => {
  return (
    <ModalFrame
      setOnModal={setOnModal}
      isDim={isDim}
      onClose
      dimClick={dimClick}
      className={className}
    >
      <Modal.Title>{title}</Modal.Title>
      {children ? <Modal.Content>{children}</Modal.Content> : null}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          className={
            danger
              ? 'rounded-full bg-rose-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-400'
              : 'rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400'
          }
          onClick={async () => {
            try {
              await onConfirm?.();
            } finally {
              setOnModal(false);
            }
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-500 bg-slate-900 px-4 py-1.5 text-sm font-semibold text-slate-100 hover:border-slate-300"
          onClick={async () => {
            try {
              await onCancel?.();
            } finally {
              setOnModal(false);
            }
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </ModalFrame>
  );
};

export default ConfirmModal;
