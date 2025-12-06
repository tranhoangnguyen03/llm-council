import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1.css';

export default function Stage1({ responses, onRerun, disabled = false, loadingModel = null }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

      <div className="tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {resp.model.split('/')[1] || resp.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="model-name">{responses[activeTab].model}</div>
        <div className="response-text markdown-content">
          <ReactMarkdown>{responses[activeTab].response}</ReactMarkdown>
        </div>
        {onRerun && (
          <div className="actions" style={{ marginTop: 8 }}>
            <button
              className="icon-button"
              onClick={() => onRerun(responses[activeTab].model)}
              disabled={disabled || loadingModel === responses[activeTab].model}
              aria-label="Rerun model"
              aria-busy={loadingModel === responses[activeTab].model}
            >
              {loadingModel === responses[activeTab].model ? 'Regenerating…' : 'Rerun'}
            </button>
            {loadingModel === responses[activeTab].model && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }} aria-live="polite">
                <span className="spinner" style={{ width: 16, height: 16 }} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
