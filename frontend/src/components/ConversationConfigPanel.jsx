import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export default function ConversationConfigPanel({ conversation, onUpdated, onSavingChange, embedded = false }) {
  const [expanded, setExpanded] = useState(embedded ? true : false);
  const [modelsCatalog, setModelsCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [councilModels, setCouncilModels] = useState(conversation?.council_models || []);
  const [chairmanModel, setChairmanModel] = useState(conversation?.chairman_model || '');
  const [addQuery, setAddQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const cacheKey = 'openrouter.models.cache';
  const [chairmanFocused, setChairmanFocused] = useState(false);

  useEffect(() => {
    if (embedded) return;
    const key = `configPanel:${conversation?.id}`;
    try {
      const raw = localStorage.getItem(key);
      setExpanded(raw === '1' ? true : false);
    } catch (_err) { void _err; }
  }, [conversation?.id, embedded]);

  useEffect(() => {
    if (embedded) return;
    const key = `configPanel:${conversation?.id}`;
    try {
      localStorage.setItem(key, expanded ? '1' : '0');
    } catch (_err) { void _err; }
  }, [expanded, conversation?.id, embedded]);

  useEffect(() => {
    setCouncilModels(conversation?.council_models || []);
    setChairmanModel(conversation?.chairman_model || '');
  }, [conversation?.council_models, conversation?.chairman_model]);

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const cached = (() => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (!obj || !obj.models || !obj.ts) return null;
          const age = Date.now() - obj.ts;
          if (age < 60 * 60 * 1000) return obj.models;
          return null;
        } catch { return null; }
      })();
      if (cached) {
        setModelsCatalog(cached);
        setCatalogLoading(false);
        return;
      }
      const res = await api.getModels();
      const list = Array.isArray(res?.models) ? res.models : [];
      setModelsCatalog(list);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ models: list, ts: Date.now() }));
      } catch (_err) { void _err; }
    } catch (e) {
      void e;
      setCatalogError('Failed to load models');
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => { loadCatalog(); }, []);

  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  const filtered = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return [];
    const list = modelsCatalog.filter(m => String(m.id).toLowerCase().includes(q));
    return list.slice(0, 10);
  }, [addQuery, modelsCatalog]);

  const addModel = async (modelId) => {
    const id = String(modelId || '').trim();
    if (!id) return;
    if (councilModels.includes(id)) {
      setStatus('Already added');
      return;
    }
    const next = [...councilModels, id];
    setSaving(true);
    setStatus('');
    try {
      const res = await api.updateConversationConfig(conversation.id, { council_models: next });
      setCouncilModels(res?.config?.council_models || next);
      setAddQuery('');
      setStatus('Saved');
      onUpdated?.();
    } catch (e) {
      void e;
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeModel = async (modelId) => {
    const next = (councilModels || []).filter(m => m !== modelId);
    setSaving(true);
    setStatus('');
    try {
      const res = await api.updateConversationConfig(conversation.id, { council_models: next });
      setCouncilModels(res?.config?.council_models || next);
      setStatus('Saved');
      onUpdated?.();
    } catch (e) {
      void e;
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveChairman = async (id) => {
    const cm = String(id || '').trim();
    setChairmanFocused(false);
    setSaving(true);
    setStatus('');
    try {
      const res = await api.updateConversationConfig(conversation.id, { chairman_model: cm });
      setChairmanModel(res?.config?.chairman_model || cm);
      setStatus('Saved');
      onUpdated?.();
    } catch (e) {
      void e;
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="config-panel" style={{ borderTop: embedded ? undefined : '1px solid var(--border-color)', background: 'var(--bg-elev)', padding: embedded ? 0 : 8 }}>
      {!embedded && (
        <button
          className="btn"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={`config-${conversation?.id}`}
          title={expanded ? 'Hide configuration' : 'Show configuration'}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>Configuration</span>
        </button>
      )}
      {(embedded ? true : expanded) && (
        <div id={`config-${conversation?.id}`} style={{ marginTop: 8, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Council Models</span>
            {saving && <span className="spinner" aria-hidden="true" style={{ width: 16, height: 16 }} />}
            {status && <span aria-live="polite" style={{ fontSize: 'var(--font-size-sm)' }}>{status}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(councilModels || []).length === 0 ? (
              <span>No models configured</span>
            ) : (
              (councilModels || []).map(m => (
                <div key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px' }}>
                  <span>{m}</span>
                  <button className="icon-button" onClick={() => removeModel(m)} disabled={saving} aria-label={`Remove ${m}`}>✕</button>
                </div>
              ))
            )}
          </div>
          <div style={{ position: 'relative', maxWidth: 480 }}>
            <input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder={catalogLoading ? 'Loading models…' : (catalogError ? 'Catalog unavailable' : 'Add a model…')}
              disabled={saving || catalogLoading}
              className="input"
              aria-label="Add council model"
            />
            {filtered.length > 0 && (
              <div role="listbox" className="dropdown" style={{ position: 'absolute', zIndex: 1000, left: 0, right: 0, background: 'var(--bg-elev)', border: '1px solid var(--border-color)', borderRadius: 6, marginTop: 4, maxHeight: 240, overflow: 'auto', boxShadow: 'var(--shadow-md)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                {filtered.map((m) => (
                  <div key={m.id} role="option" className="dropdown-item" style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseDown={(e) => e.preventDefault()} onClick={() => addModel(m.id)}>
                    <span>{m.id}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', opacity: 0.7 }}>{m.context_length ? `${m.context_length}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Chairman Model</span>
          </div>
          <div style={{ position: 'relative', maxWidth: 480 }}>
            <input
              value={chairmanModel || ''}
              onChange={(e) => setChairmanModel(e.target.value)}
              onFocus={() => setChairmanFocused(true)}
              onBlur={() => setTimeout(() => setChairmanFocused(false), 80)}
              placeholder={catalogLoading ? 'Loading models…' : (catalogError ? 'Catalog unavailable' : 'Select chairman…')}
              disabled={saving || catalogLoading}
              className="input"
              aria-label="Chairman model"
            />
            {String(chairmanModel || '').trim() && (
              <div className="actions" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn primary" disabled={saving} onClick={() => saveChairman(chairmanModel)}>Save</button>
              </div>
            )}
            {(() => {
              const q = String(chairmanModel || '').trim().toLowerCase();
              const list = q ? modelsCatalog.filter(m => String(m.id).toLowerCase().includes(q)).slice(0, 10) : [];
              if (!q || !chairmanFocused || list.length === 0) return null;
              return (
                <div role="listbox" className="dropdown" style={{ position: 'absolute', zIndex: 1000, left: 0, right: 0, background: 'var(--bg-elev)', border: '1px solid var(--border-color)', borderRadius: 6, marginTop: 4, maxHeight: 240, overflow: 'auto', boxShadow: 'var(--shadow-md)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  {list.map((m) => (
                    <div key={m.id} role="option" className="dropdown-item" style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseDown={(e) => e.preventDefault()} onClick={() => { saveChairman(m.id); setChairmanFocused(false); }}>
                      <span>{m.id}</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', opacity: 0.7 }}>{m.context_length ? `${m.context_length}` : ''}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}