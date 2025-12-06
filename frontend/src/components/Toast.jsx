import React, { useEffect } from 'react'

export default function Toast({ message, type = 'info', onDismiss }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss && onDismiss(), 3000)
    return () => clearTimeout(id)
  }, [onDismiss])

  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button className="icon-button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  )
}