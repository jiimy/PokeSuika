import React from 'react'

type ModalContent = {
  children: React.ReactNode
}

const ModalContent = ({ children }: ModalContent) => {
  return (
    <div>
      {children}
    </div>
  )
}

export default ModalContent