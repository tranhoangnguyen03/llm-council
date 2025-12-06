import React, { useEffect, useRef } from 'react'

export default function ConfirmDialog({ open, title, description, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const firstBtnRef = useRef(null)

  useEffect(() => {
    if (open && firstBtnRef.current) {
      firstBtnRef.current.focus()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter') onConfirm()
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        ref={dialogRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-desc">{description}</p>
        <div className="dialog-actions">
          <button ref={firstBtnRef} className="btn danger" onClick={onConfirm}>{confirmText}</button>
          <button className="btn" onClick={onCancel}>{cancelText}</button>
        </div>
      </div>
    </div>
  )
}