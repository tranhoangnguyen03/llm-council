import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text;

  let result = text;
  // Replace each "Response X" with the actual model name
  Object.entries(labelToModel).forEach(([label, model]) => {
    const modelShortName = model.split('/')[1] || model;
    result = result.replace(new RegExp(label, 'g'), `**${modelShortName}**`);
  });
  return result;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings, onRerun, disabled = false, loadingModel = null }) {
  const [activeTab, setActiveTab] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  if (!rankings || rankings.length === 0) {
    return null;
  }

  return (
    <div className="stage stage2">
      <h3 className="stage-title">Stage 2: Peer Rankings</h3>

      <h4>Raw Evaluations</h4>
      <p className="stage-description">
        Each model evaluated all responses (anonymized as Response A, B, C, etc.) and provided rankings.
        Below, model names are shown in <strong>bold</strong> for readability, but the original evaluation used anonymous labels.
      </p>

      <div className="tabs">
        {rankings.map((rank, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {rank.model.split('/')[1] || rank.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="ranking-model">
          {rankings[activeTab].model}
        </div>
        <div className="ranking-content markdown-content">
          <ReactMarkdown>
            {deAnonymizeText(rankings[activeTab].ranking, labelToModel)}
          </ReactMarkdown>
        </div>
        {onRerun && (
          <div className="actions" style={{ marginTop: 8 }}>
            <button
              className="icon-button"
              onClick={() => onRerun(rankings[activeTab].model)}
              disabled={disabled || loadingModel === rankings[activeTab].model}
              aria-label="Rerun ranking"
              aria-busy={loadingModel === rankings[activeTab].model}
            >
              {loadingModel === rankings[activeTab].model ? 'Regenerating…' : 'Rerun'}
            </button>
            {loadingModel === rankings[activeTab].model && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }} aria-live="polite">
                <span className="spinner" style={{ width: 16, height: 16 }} />
              </span>
            )}
          </div>
        )}

        {rankings[activeTab].parsed_ranking &&
          rankings[activeTab].parsed_ranking.length > 0 && (
            <div className="parsed-ranking">
              <strong>Extracted Ranking:</strong>
              <ol>
                {rankings[activeTab].parsed_ranking.map((label, i) => (
                  <li key={i}>
                    {labelToModel && labelToModel[label]
                      ? labelToModel[label].split('/')[1] || labelToModel[label]
                      : label}
                  </li>
                ))}
              </ol>
            </div>
          )}
      </div>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="aggregate-rankings">
          <h4>
            Aggregate Rankings (Street Cred)
            <span
              className="icon-button"
              style={{ marginLeft: 8 }}
              aria-label="Ranking methodology information"
              title="Avg Rank is the average position across peer rankings (ordinal). Lower position is better. Values are rounded to whole numbers."
              role="button"
              tabIndex={0}
              aria-expanded={showInfo}
              aria-controls="ranking-methodology"
              onClick={() => setShowInfo((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowInfo((v) => !v); } }}
            >
              ℹ️
            </span>
          </h4>
          {showInfo && (
            <div id="ranking-methodology" className="stage-loading" role="region" aria-label="Ranking methodology details">
              <span>
                Avg Rank is the average position across peer evaluations. Positions are ordinal (1st, 2nd, …), lower is better, and values are rounded to whole numbers. "Votes" indicates how many evaluations contributed.
              </span>
            </div>
          )}
          <p className="stage-description">
            Combined results across all peer evaluations (lower position is better). Avg Rank represents the average position across rankings and is rounded to whole numbers.
          </p>
          <div className="aggregate-list">
            {aggregateRankings.map((agg, index) => (
              <div key={index} className="aggregate-item">
                <span className="rank-position">#{index + 1}</span>
                <span className="rank-model">
                  {agg.model.split('/')[1] || agg.model}
                </span>
                <span className="rank-score" title="Average ranking position across all evaluations">
                  Avg Rank: {Math.round(agg.average_rank)}
                </span>
                <span className="rank-count">
                  ({agg.rankings_count} votes)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
