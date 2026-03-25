import { useState } from 'react';
import { auditDocument } from '../config/apiAdapter';
import FileUpload from '../components/FileUpload';
import AuditResults from '../components/AuditResults';

export default function Audit() {
  const [auditFile, setAuditFile] = useState(null);
  const [rulesFile, setRulesFile] = useState(null);
  const [phase, setPhase] = useState('input'); // input | auditing | done
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auditFile) {
      setError('Please upload the file to be audited.');
      return;
    }
    if (!rulesFile) {
      setError('Please upload the formatting rules document.');
      return;
    }
    setError(null);
    setPhase('auditing');

    try {
      const result = await auditDocument({
        documentFile: auditFile,
        criteriaFile: rulesFile,
      });
      setIssues(result.issues || []);
      setPhase('done');
    } catch (err) {
      setError('Audit failed. Please try again.');
      setPhase('input');
    }
  };

  const handleReset = () => {
    setAuditFile(null);
    setRulesFile(null);
    setPhase('input');
    setIssues(null);
    setError(null);
  };

  return (
    <div className="page">
      <h1>Audit File</h1>
      <p className="page-subtitle">
        Upload a document and a set of formatting rules to check compliance
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {phase === 'input' && (
        <form onSubmit={handleSubmit} className="audit-form">
          <div className="upload-section">
            <div className="upload-box">
              <h3>File to Audit</h3>
              <p>The document that will be checked against the formatting rules.</p>
              <FileUpload
                accept=".pdf,.docx,.txt,.doc,.csv"
                label="Select File to Audit"
                onFiles={(files) => setAuditFile(files[0])}
              />
              {auditFile && <span className="file-tag">{auditFile.name}</span>}
            </div>

            <div className="upload-box">
              <h3>Formatting Rules</h3>
              <p>An unstructured document describing the formatting rules the file must follow.</p>
              <FileUpload
                accept=".pdf,.docx,.txt,.doc"
                label="Select Rules Document"
                onFiles={(files) => setRulesFile(files[0])}
              />
              {rulesFile && <span className="file-tag">{rulesFile.name}</span>}
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            Run Audit
          </button>
        </form>
      )}

      {phase === 'auditing' && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Analyzing documents for compliance issues...</p>
        </div>
      )}

      {phase === 'done' && (
        <>
          <AuditResults issues={issues} />
          <button className="btn btn-outline" onClick={handleReset} style={{ marginTop: '1.5rem' }}>
            Start New Audit
          </button>
        </>
      )}
    </div>
  );
}
