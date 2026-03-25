import { useState } from 'react';
import { searchDocuments, generateDocument } from '../config/apiAdapter';
import { SEARCH_TYPES, DOC_TYPES, TONE_OPTIONS } from '../config/options';
import SelectField from '../components/SelectField';
import FileUpload from '../components/FileUpload';
import RetrievedDocuments from '../components/RetrievedDocuments';

export default function Generate() {
  const [form, setForm] = useState({
    searchType: '',
    docType: '',
    tone: '',
    checkResume: false,
    contextText: '',
  });
  const [contextFiles, setContextFiles] = useState([]);
  const [phase, setPhase] = useState('input'); // input | retrieving | review | generating | done
  const [retrievedDocs, setRetrievedDocs] = useState([]);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.searchType || !form.docType || !form.tone) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.contextText && contextFiles.length === 0) {
      setError('Please provide context via text or file upload.');
      return;
    }
    setError(null);
    setPhase('retrieving');

    try {
      const docs = await searchDocuments({
        query: form.contextText,
        category: form.searchType,
        file: contextFiles[0] || null,
      });
      setRetrievedDocs(docs);
      setPhase('review');
    } catch (err) {
      setError('Retrieval failed. Please try again.');
      setPhase('input');
    }
  };

  const handleProceed = async () => {
    setPhase('generating');
    setError(null);
    try {
      const result = await generateDocument({
        query: form.contextText,
        passages: retrievedDocs.map((d) => d.passage),
        tone: form.tone,
      });
      setGeneratedDoc(result);
      setPhase('done');
    } catch (err) {
      setError('Generation failed. Please try again.');
      setPhase('review');
    }
  };

  const handleReset = () => {
    setForm({ searchType: '', docType: '', tone: '', checkResume: false, contextText: '' });
    setContextFiles([]);
    setPhase('input');
    setRetrievedDocs([]);
    setGeneratedDoc(null);
    setError(null);
  };

  return (
    <div className="page">
      <h1>Generate Content</h1>
      <p className="page-subtitle">
        Provide context and preferences to generate a structured document
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Phase: Input */}
      {phase === 'input' && (
        <form onSubmit={handleSubmit} className="generate-form">
          <div className="form-grid">
            <SelectField
              label="Search Type *"
              name="searchType"
              value={form.searchType}
              onChange={handleChange}
              options={SEARCH_TYPES}
            />
            <SelectField
              label="Document Type *"
              name="docType"
              value={form.docType}
              onChange={handleChange}
              options={DOC_TYPES}
            />
            <SelectField
              label="Tone *"
              name="tone"
              value={form.tone}
              onChange={handleChange}
              options={TONE_OPTIONS}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="checkResume"
                checked={form.checkResume}
                onChange={handleChange}
              />
              Include employee resume matching
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="contextText">Context / Instructions</label>
            <textarea
              id="contextText"
              name="contextText"
              rows={6}
              value={form.contextText}
              onChange={handleChange}
              placeholder="Describe what the document should cover..."
            />
          </div>

          <div className="form-group">
            <label>Upload Context Documents</label>
            <FileUpload
              accept=".pdf,.docx,.txt"
              multiple
              label="Attach Files (.pdf, .docx, .txt)"
              onFiles={setContextFiles}
            />
            {contextFiles.length > 0 && (
              <div className="file-list">
                {contextFiles.map((f, i) => (
                  <span key={i} className="file-tag">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary">
            Retrieve &amp; Review Documents
          </button>
        </form>
      )}

      {/* Phase: Retrieving */}
      {phase === 'retrieving' && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Searching for relevant documents...</p>
        </div>
      )}

      {/* Phase: Review retrieved docs */}
      {phase === 'review' && (
        <RetrievedDocuments
          documents={retrievedDocs}
          onProceed={handleProceed}
          onCancel={handleReset}
        />
      )}

      {/* Phase: Generating */}
      {phase === 'generating' && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Generating your document...</p>
        </div>
      )}

      {/* Phase: Done */}
      {phase === 'done' && generatedDoc && (
        <div className="generated-result">
          <h3>Generated Document</h3>
          <div className="doc-meta">
            <span>Type: {DOC_TYPES.find((d) => d.value === form.docType)?.label}</span>
            <span>Tone: {TONE_OPTIONS.find((t) => t.value === form.tone)?.label}</span>
          </div>
          <div className="generated-content">
            <pre>{generatedDoc.content}</pre>
          </div>
          {generatedDoc.download_url && (
            <a
              href={generatedDoc.download_url}
              className="btn btn-primary"
              download
            >
              Download Document
            </a>
          )}
          <button className="btn btn-outline" onClick={handleReset}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
