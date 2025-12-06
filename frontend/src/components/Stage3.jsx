import ReactMarkdown from 'react-markdown';
import './Stage3.css';

export default function Stage3({ finalResponse, onRerun, disabled = false, loading = false }) {
  if (!finalResponse) {
    return null;
  }

  return (
    <div className="stage stage3">
      <h3 className="stage-title">Stage 3: Final Council Answer</h3>
      <div className="final-response">
        <div className="chairman-label">
          Chairman: {finalResponse.model.split('/')[1] || finalResponse.model}
        </div>
        <div className="final-text markdown-content">
          <ReactMarkdown>{finalResponse.response}</ReactMarkdown>
        </div>
        {onRerun && (
          <div className="actions" style={{ marginTop: 8 }}>
            <button
              className="icon-button"
              onClick={onRerun}
              disabled={disabled}
              aria-label="Rerun verdict"
              aria-busy={loading}
            >
              {loading ? 'Regenerating…' : 'Rerun Verdict'}
            </button>
            {loading && (
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
