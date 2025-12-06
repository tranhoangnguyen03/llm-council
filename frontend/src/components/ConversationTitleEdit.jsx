import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api'

export default function ConversationTitleEdit({ conversation, onSaved, onCancel }) {
  const [title, setTitle] = useState(conversation?.title || '')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const validate = (t) => {
    const trimmed = t.trim()
    if (trimmed.length < 1 || trimmed.length > 50) return 'Title must be 1–50 characters'
    if (!/^[\w\s\-_.]+$/.test(trimmed)) return 'Only letters, numbers, spaces and .-_'
    return ''
  }

  const save = async () => {
    const v = validate(title)
    if (v) { setError(v); return }
    const res = await api.updateConversationTitle(conversation.id, title.trim())
    onSaved && onSaved(res.title)
  }

  return (
    <div className="title-edit">
      <label htmlFor="conv-title" className="sr-only">Conversation title</label>
      <input
        id="conv-title"
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input"
        aria-invalid={!!error}
        aria-describedby={error ? 'title-error' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onCancel && onCancel()
        }}
      />
      <div className="actions">
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {error && <div id="title-error" className="error" role="alert">{error}</div>}
    </div>
  )
}