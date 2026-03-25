export default function AuditResults({ issues }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="audit-results success">
        <h3>Audit Complete</h3>
        <p>No issues found. The document conforms to the provided formatting rules.</p>
      </div>
    );
  }

  return (
    <div className="audit-results">
      <h3>Audit Complete &mdash; {issues.length} Issue{issues.length !== 1 ? 's' : ''} Found</h3>
      <div className="issue-list">
        {issues.map((issue, idx) => (
          <div key={idx} className={`issue-card severity-${issue.severity || 'medium'}`}>
            <div className="issue-header">
              <span className="issue-number">#{idx + 1}</span>
              {issue.severity && (
                <span className={`severity-badge ${issue.severity}`}>{issue.severity}</span>
              )}
            </div>
            {issue.location && <div className="issue-location">{issue.location}</div>}
            <div className="issue-description">{issue.description}</div>
            {issue.rule && (
              <div className="issue-rule">
                <span className="rule-label">Rule:</span> {issue.rule}
              </div>
            )}
            {issue.suggestion && (
              <div className="issue-suggestion">
                <span className="suggestion-label">Suggestion:</span> {issue.suggestion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
