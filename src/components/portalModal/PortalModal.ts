import { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  children: React.ReactNode;
  setOnModal?: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModalPortal = ({ children, setOnModal }: ModalProps) => {
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

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(children, modalRoot);
};

export default ModalPortal;
