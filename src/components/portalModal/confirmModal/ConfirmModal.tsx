import { ChildrenModalType } from '@/types/modal';
import classNames from 'classnames';
import ModalFrame from '../ModalFrame';
import s from './comfirmModal.module.scss';
import { Modal } from '../Modal';

type modal = {
  title: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};

const ConfirmModal = ({
  setOnModal,
  dimClick,
  isDim = false,
  className,
  title,
  children,
  onConfirm,
  onCancel,
}: ChildrenModalType & modal) => {

  return (
    <ModalFrame
      setOnModal={setOnModal}
      isDim={isDim}
      onClose
      dimClick={dimClick}
      zindex={40}
      className={classNames([s.confirm_modal], className)}
    >
      <Modal.Title>{title}</Modal.Title>
      {children && <Modal.Content>{children}</Modal.Content>}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={async () => {
            try {
              await onConfirm?.();
            } finally {
              setOnModal(false);
            }
          }}
        >
          확인
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await onCancel?.();
            } finally {
              setOnModal(false);
            }
          }}
        >
          취소
        </button>
      </div>
    </ModalFrame>
  );
};

export default ConfirmModal;