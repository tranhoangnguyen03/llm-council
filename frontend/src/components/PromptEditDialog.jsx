import React, { useEffect, useRef, useState } from 'react'

export default function PromptEditDialog({ open, initialText, onSave, onCancel, isBusy }) {
  const [text, setText] = useState(initialText || '')
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onCancel?.()
    if (e.key === 'Enter' && e.metaKey) doSave()
  }

  const doSave = () => {
    const trimmed = (text || '').trim()
    if (!trimmed) { setError('Prompt cannot be empty'); return }
    onSave?.(trimmed)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-edit-title"
        aria-describedby="prompt-edit-desc"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="prompt-edit-title">Edit your prompt</h2>
        <p id="prompt-edit-desc">Update the original prompt and rerun the council.</p>
        <label htmlFor="prompt-edit-text" className="sr-only">Prompt</label>
        <textarea
          id="prompt-edit-text"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input"
          rows={6}
          aria-invalid={!!error}
          aria-describedby={error ? 'prompt-edit-error' : undefined}
          style={{ width: '100%', minHeight: 120 }}
        />
        <div className="dialog-actions">
          <button className="btn primary" onClick={doSave} disabled={isBusy}>Save and Rerun</button>
          <button className="btn" onClick={onCancel} disabled={isBusy}>Cancel</button>
        </div>
        {error && <div id="prompt-edit-error" className="error" role="alert">{error}</div>}
        <div style={{ marginTop: 8, color: 'var(--color-text-subtle)', fontSize: 'var(--font-size-xs)' }}>
          Tip: Press ⌘ Enter to save.
        </div>
      </div>
    </div>
  )
}