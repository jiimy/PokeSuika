'use client';

import type { ChildrenModalType } from '@/types/modal';

import ModalFrame from '../ModalFrame';

export default function BasicModal({
  setOnModal,
  children,
  dimClick = true,
  isDim = true,
  className,
}: ChildrenModalType) {
  return (
    <ModalFrame
      setOnModal={setOnModal}
      isDim={dimClick || isDim}
      onClose
      dimClick={dimClick}
      className={className}
    >
      {children}
    </ModalFrame>
  );
}
