import React from 'react'

type ModalContent = {
  children: React.ReactNode
}

const ModalButton = ({ children }: ModalContent) => {
  return (
    <div className='mt-20 flex'>
      {children}
    </div>
  )
}

export default ModalButton