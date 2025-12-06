import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import ConversationConfigPanel from './ConversationConfigPanel';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  executionMode,
  onEditUserMessage,
  onRerunStage1Model,
  onRerunStage2Model,
  onRerunStage3,
  onSetMode,
  theme,
  onToggleTheme,
  editingPrompt,
  editPromptText,
  onEditChange,
  onEditSave,
  onEditCancel,
  rerunStage1ModelLoading,
  rerunStage2ModelLoading,
  rerunStage3Loading,
  resetting = false,
  onRefreshConversation,
  onContinueNextStage,
  continuing = false,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const [downloadLoading, setDownloadLoading] = useState({ json: false, yaml: false, md: false });
  const [downloadError, setDownloadError] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const buildPayload = (assistantMsg, userMsg) => {
    const stage1 = Array.isArray(assistantMsg?.stage1) ? assistantMsg.stage1.map((r) => ({ model: r.model, response: r.response })) : [];
    const stage2 = Array.isArray(assistantMsg?.stage2) ? assistantMsg.stage2.map((r) => ({ model: r.model, ranking: r.ranking, parsed_ranking: r.parsed_ranking })) : [];
    const stage3 = assistantMsg?.stage3 ? { model: assistantMsg.stage3.model, response: assistantMsg.stage3.response } : null;
    return {
      conversation_id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
      prompt: userMsg?.content || '',
      stage1,
      stage2,
      metadata: assistantMsg?.metadata || null,
      stage3,
    };
  };

  const toYAML = (value, indent = 0) => {
    const sp = '  '.repeat(indent);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      const safe = value.includes('\n') || value.includes(':') ? JSON.stringify(value) : value;
      return safe;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value.map((v) => `${sp}- ${toYAML(v, indent + 1).replace(/^\s+/, '')}`).join('\n');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => {
          const child = toYAML(v, indent + 1);
          const needsBlock = typeof v === 'object' && v !== null;
          return `${sp}${k}: ${needsBlock && !String(child).startsWith('- ') && !String(child).startsWith('{') ? '\n' + child : child}`;
        })
        .join('\n');
    }
    return String(value);
  };

  const toMarkdown = (payload) => {
    const lines = [];
    lines.push(`# LLM Council Results`);
    lines.push('');
    lines.push(`**Conversation**: ${payload.title} (${payload.conversation_id})`);
    lines.push(`**Created**: ${payload.created_at}`);
    lines.push('');
    lines.push('## Prompt');
    lines.push('');
    lines.push(payload.prompt || '');
    lines.push('');
    if (payload.stage1?.length) {
      lines.push('## Stage 1: Individual Responses');
      payload.stage1.forEach((r) => {
        lines.push('');
        lines.push(`### ${r.model}`);
        lines.push(r.response || '');
      });
      lines.push('');
    }
    if (payload.stage2?.length) {
      lines.push('## Stage 2: Peer Rankings');
      payload.stage2.forEach((r) => {
        lines.push('');
        lines.push(`### ${r.model}`);
        lines.push(r.ranking || '');
      });
      lines.push('');
    }
    if (payload.stage3) {
      lines.push('## Stage 3: Final Council Answer');
      lines.push('');
      lines.push(`### ${payload.stage3.model}`);
      lines.push(payload.stage3.response || '');
      lines.push('');
    }
    return lines.join('\n');
  };

  const triggerDownload = (content, mime, filename) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (format, assistantMsg, userMsg) => {
    setDownloadLoading((prev) => ({ ...prev, [format]: true }));
    setDownloadError(null);
    try {
      await Promise.resolve();
      const payload = buildPayload(assistantMsg, userMsg);
      let content = '';
      let mime = '';
      let ext = '';
      if (format === 'json') {
        content = JSON.stringify(payload, null, 2);
        mime = 'application/json';
        ext = 'json';
      } else if (format === 'yaml') {
        content = `---\n${toYAML(payload)}`;
        mime = 'text/yaml';
        ext = 'yaml';
      } else {
        content = toMarkdown(payload);
        mime = 'text/markdown';
        ext = 'md';
      }
      const filename = `council_${conversation.id}.${ext}`;
      triggerDownload(content, mime, filename);
      setDownloadStatus(`Downloaded ${ext.toUpperCase()} file`);
    } catch (e) {
      setDownloadError('Failed to generate download');
      console.error(e);
    } finally {
      setDownloadLoading((prev) => ({ ...prev, [format]: false }));
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          <p>Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-interface ${resetting ? 'resetting' : ''}`}>
      <div className="tabbar" role="tablist" aria-label="Views">
        <button
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'chat'}
          aria-controls={`tab-panel-chat-${conversation.id}`}
          id={`tab-chat-${conversation.id}`}
          onClick={() => setActiveTab('chat')}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') setActiveTab('config'); }}
          title="Main Chat"
        >Chat</button>
        <button
          className={`tab ${activeTab === 'config' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'config'}
          aria-controls={`tab-panel-config-${conversation.id}`}
          id={`tab-config-${conversation.id}`}
          onClick={() => setActiveTab('config')}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') setActiveTab('chat'); }}
          title="Configuration"
        >Configuration</button>
        <div className="tabbar-spacer" />
        <div className="toggle" aria-label="Theme toggle" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', marginRight: 8 }}>Theme:</span>
          <button
            type="button"
            className="toggle-switch"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Toggle dark mode"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="thumb" aria-hidden="true" />
          </button>
          <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 8 }}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </div>
      </div>

      {activeTab === 'config' && (
        <div id={`tab-panel-config-${conversation.id}`} role="tabpanel" aria-labelledby={`tab-config-${conversation.id}`} className="tab-panel">
          <div className="config-group">
            <div className="group-header">General Settings</div>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
              <label htmlFor={`exec-mode-${conversation.id}`} style={{ fontWeight: 600 }}>Execution Mode</label>
              <select id={`exec-mode-${conversation.id}`} value={executionMode} onChange={(e) => onSetMode?.(e.target.value)} className="select">
                <option value="step">Step-by-step</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
          <div className="config-group">
            <div className="group-header">Model Settings</div>
            <div className="group-body">
              <ConversationConfigPanel
                conversation={conversation}
                onUpdated={onRefreshConversation}
                onSavingChange={setSavingConfig}
                embedded={true}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div id={`tab-panel-chat-${conversation.id}`} role="tabpanel" aria-labelledby={`tab-chat-${conversation.id}`} className="tab-panel">
          <div className="messages-container">
            {conversation.messages.length === 0 ? (
              <div className="empty-state">
                <h2>Start a conversation</h2>
                <p>Ask a question to consult the LLM Council</p>
              </div>
            ) : (
              conversation.messages.map((msg, index) => (
                <div key={index} className="message-group">
                  {msg.role === 'user' ? (
                    <div className="user-message">
                      <div className="message-label">You</div>
                      <div className="message-content">
                        {editingPrompt && index === conversation.messages.length - 2 ? (
                          <div className="prompt-edit">
                            <textarea
                              className="input"
                              value={editPromptText}
                              onChange={(e) => onEditChange?.(e.target.value)}
                              disabled={isLoading}
                              rows={4}
                              style={{ width: '100%', minHeight: 80 }}
                              aria-label="Edit prompt"
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onEditSave?.(editPromptText)
                              }}
                            />
                            <div className="dialog-actions" style={{ marginTop: 8 }}>
                              <button className="btn primary" onClick={() => onEditSave?.(editPromptText)} disabled={isLoading}>Save and Rerun</button>
                              <button className="btn" onClick={onEditCancel} disabled={isLoading}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="markdown-content">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {index === conversation.messages.length - 2 && (
                              <div style={{ marginTop: 8 }}>
                                <button className="icon-button" onClick={onEditUserMessage} disabled={isLoading} aria-label="Edit prompt" title="Edit prompt">Edit</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="assistant-message">
                      <div className="message-label">LLM Council</div>

                      {/* Stage 1 */}
                      {msg.loading?.stage1 && (
                        <div className="stage-loading">
                          <div className="spinner"></div>
                          <span>Running Stage 1: Collecting individual responses...</span>
                        </div>
                      )}
                      {msg.stage1 && (
                        <Stage1
                          responses={msg.stage1}
                          onRerun={(model) => onRerunStage1Model?.(model)}
                          disabled={isLoading}
                          loadingModel={rerunStage1ModelLoading}
                        />
                      )}

                      {/* Stage 2 */}
                      {msg.loading?.stage2 && (
                        <div className="stage-loading">
                          <div className="spinner"></div>
                          <span>Running Stage 2: Peer rankings...</span>
                        </div>
                      )}
                      {msg.stage2 && (
                        <Stage2
                          rankings={msg.stage2}
                          labelToModel={msg.metadata?.label_to_model}
                          aggregateRankings={msg.metadata?.aggregate_rankings}
                          onRerun={(model) => onRerunStage2Model?.(model)}
                          disabled={isLoading}
                          loadingModel={rerunStage2ModelLoading}
                        />
                      )}

                      {(() => {
                        const canContinueStage2 = msg.stage1 && !msg.stage2;
                        const canContinueStage3 = msg.stage2 && !msg.stage3;
                        const canContinue = (msg.paused || executionMode === 'step') && (canContinueStage2 || canContinueStage3);
                        if (!canContinue) return null;
                        const nextLabel = canContinueStage2 ? 'Continue to Stage 2' : 'Continue to Stage 3';
                        return (
                          <div className="stage-loading" style={{ justifyContent: 'space-between' }}>
                            <span>Execution paused</span>
                            <button
                              className="btn primary"
                              onClick={() => onContinueNextStage?.()}
                              disabled={continuing || isLoading}
                              aria-busy={continuing}
                            >
                              {continuing ? 'Continuing…' : nextLabel}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Stage 3 */}
                      {msg.loading?.stage3 && (
                        <div className="stage-loading">
                          <div className="spinner"></div>
                          <span>Running Stage 3: Final synthesis...</span>
                        </div>
                      )}
                      {msg.stage3 && (
                        <Stage3
                          finalResponse={msg.stage3}
                          onRerun={() => onRerunStage3?.()}
                          disabled={isLoading || rerunStage3Loading}
                          loading={rerunStage3Loading}
                        />
                      )}
                      {(() => {
                        const isLastAssistant = index === conversation.messages.length - 1 && msg.role === 'assistant';
                        if (!isLastAssistant || !msg.stage3) return null;
                        const userMsg = conversation.messages[index - 1];
                        return (
                          <div className="stage-loading" style={{ marginTop: 12, fontStyle: 'normal', flexWrap: 'wrap' }} role="status" aria-live="polite">
                            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Process Completed</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                              <button
                                className="btn"
                                onClick={() => handleDownload('json', msg, userMsg)}
                                disabled={downloadLoading.json}
                                aria-label="Download results as JSON"
                                aria-busy={downloadLoading.json}
                                title="Download JSON"
                              >
                                <span aria-hidden="true">{`{}`}</span>
                                {downloadLoading.json ? 'Preparing…' : 'JSON'}
                                {downloadLoading.json && <span className="spinner" style={{ width: 16, height: 16 }} />}
                              </button>
                              <button
                                className="btn"
                                onClick={() => handleDownload('yaml', msg, userMsg)}
                                disabled={downloadLoading.yaml}
                                aria-label="Download results as YAML"
                                aria-busy={downloadLoading.yaml}
                                title="Download YAML"
                              >
                                <span aria-hidden="true">📄</span>
                                {downloadLoading.yaml ? 'Preparing…' : 'YAML'}
                                {downloadLoading.yaml && <span className="spinner" style={{ width: 16, height: 16 }} />}
                              </button>
                              <button
                                className="btn"
                                onClick={() => handleDownload('md', msg, userMsg)}
                                disabled={downloadLoading.md}
                                aria-label="Download results as Markdown"
                                aria-busy={downloadLoading.md}
                                title="Download Markdown"
                              >
                                <span aria-hidden="true">#</span>
                                {downloadLoading.md ? 'Preparing…' : 'Markdown'}
                                {downloadLoading.md && <span className="spinner" style={{ width: 16, height: 16 }} />}
                              </button>
                            </div>
                            {downloadStatus && <span style={{ marginLeft: 8 }}>{downloadStatus}</span>}
                            {downloadError && <span style={{ marginLeft: 8, color: 'var(--color-danger)' }}>{downloadError}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <span>Consulting the council...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {conversation.messages.length === 0 && (
            <form className="input-form" onSubmit={handleSubmit}>
              <textarea
                className="message-input"
                placeholder="Ask your question... (Shift+Enter for new line, Enter to send)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || savingConfig}
                rows={3}
              />
              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || isLoading || savingConfig}
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
