import React, { useState } from 'react';
import './Sidebar.css';
import IconButton from './IconButton';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';
import ConversationTitleEdit from './ConversationTitleEdit';
import { api } from '../api';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const startEdit = (id) => setEditingId(id);
  const cancelEdit = () => setEditingId(null);
  const saveTitle = async (id, newTitle) => {
    try {
      await api.updateConversationTitle(id, newTitle);
      setToast({ type: 'success', message: 'Title updated' });
    } catch {
      setToast({ type: 'error', message: 'Failed to update title' });
    } finally {
      setEditingId(null);
    }
  };

  const confirmDelete = (id) => setConfirmDeleteId(id);
  const cancelDelete = () => setConfirmDeleteId(null);
  const doDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setToast({ type: 'info', message: 'Deleting…' });
    setRemovingId(id);
    setTimeout(async () => {
      const result = await onDeleteConversation(id);
      if (result.ok) {
        setToast({ type: 'success', message: 'Conversation deleted' });
      } else {
        setToast({ type: 'error', message: 'Failed to delete conversation' });
      }
      setRemovingId(null);
    }, 150);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>LLM Council</h1>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      <div className="conversation-list" role="listbox" aria-label="Conversations">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              } ${removingId === conv.id ? 'removing' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
              role="option"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelectConversation(conv.id);
                if (e.key.toLowerCase() === 'e') startEdit(conv.id);
                if (e.key === 'Delete') confirmDelete(conv.id);
              }}
            >
              <div className="conversation-title">
                {conv.title || 'New Conversation'}
              </div>
              <div className="conversation-meta">
                {conv.message_count} messages
              </div>
              <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton label="Edit conversation" onClick={() => startEdit(conv.id)}>
                  ✎
                </IconButton>
                <IconButton label="Delete conversation" onClick={() => confirmDelete(conv.id)} variant="danger">
                  🗑
                </IconButton>
              </div>

              {editingId === conv.id && (
                <ConversationTitleEdit
                  conversation={{ id: conv.id, title: conv.title }}
                  onSaved={(t) => saveTitle(conv.id, t)}
                  onCancel={cancelEdit}
                />
              )}
            </div>
          ))
        )}
      </div>
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="Delete conversation?"
          description="This action cannot be undone."
          onConfirm={doDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
