import React from 'react'

type ModalTitleType = {
  children: React.ReactNode
}

const ModalTitle = ({ children }: ModalTitleType) => {
  return (
    <div className='mb-16 text-xl'>
      {children}
    </div>
  )
}

export default ModalTitle