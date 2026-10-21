import s from './popover.module.scss';

type popoverType = {
  children: any;
  id: string;
  dimClick?: boolean
}

// NOTE: 포탈모달 대용으로 쓸순없음. 딤클릭을 막지 못함. toast나 툴팁 정도로만 사용가능.
export const Popover = ({ children, id, dimClick }: popoverType) => {
  return (
    <>
      <dialog
        id={id}
        className={s.popover}
        popover={dimClick === true ? '' : 'manual'}
      >
        {children}
        <button
          type="button"
          className="close-btn"
          popoverTarget={id}
          popoverTargetAction="hide"
        >
          ❌
        </button>
      </dialog>
    </>
  );
};