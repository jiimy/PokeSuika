'use client';

import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
  children: ReactNode;
  setOnModal?: Dispatch<SetStateAction<boolean>>;
};

export default function ModalPortal({ children, setOnModal }: ModalPortalProps) {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && setOnModal) {
        setOnModal(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = originalStyle;
    };
  }, [setOnModal]);

  if (typeof window === 'undefined') return null;

  const modalRoot = document.getElementById('modal');
  if (!modalRoot) return null;

  return createPortal(children, modalRoot);
}
