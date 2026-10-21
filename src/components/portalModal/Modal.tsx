import ModalFrame from "./ModalFrame";
import ModalButton from "./modalItem/ModalButton";
import ModalContent from "./modalItem/ModalContent";
import ModalTitle from "./modalItem/ModalTitle";


export const Modal = Object.assign(ModalFrame, {
  Title: ModalTitle,
  Content: ModalContent,
  Buttons: ModalButton
})