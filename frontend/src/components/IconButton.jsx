import React from 'react'

export default function IconButton({ label, onClick, children, variant = 'default' }) {
  const className = `icon-button ${variant}`
  return (
    <button className={className} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}