import type { Dispatch, ReactNode, SetStateAction } from 'react';

export type ChildrenModalType = {
  setOnModal: Dispatch<SetStateAction<boolean>>;
  children?: ReactNode;
  dimClick?: boolean;
  isDim?: boolean;
  onClose?: boolean;
  className?: string;
};
