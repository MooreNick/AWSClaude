export default function RetrievedDocuments({ documents, onProceed, onCancel }) {
  if (!documents || documents.length === 0) return null;

  return (
    <div className="retrieved-docs">
      <h3>Retrieved Documents</h3>
      <p className="subtitle">The following documents were found relevant to your request:</p>
      <div className="doc-list">
        {documents.map((doc, idx) => (
          <div key={idx} className="doc-card">
            <div className="doc-name">{doc.name}</div>
            <div className="doc-passage">
              <span className="passage-label">Relevant passage:</span>
              <blockquote>{doc.passage}</blockquote>
            </div>
            {doc.score !== undefined && (
              <div className="doc-score">Relevance: {(doc.score * 100).toFixed(1)}%</div>
            )}
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="btn btn-primary" onClick={onProceed}>
          Proceed with Generation
        </button>
        <button className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
