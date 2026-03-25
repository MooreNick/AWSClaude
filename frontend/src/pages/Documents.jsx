import { useState, useEffect } from 'react';
import { listFiles, uploadFile } from '../config/apiAdapter';
import { SEARCH_TYPES } from '../config/options';
import FileUpload from '../components/FileUpload';
import SelectField from '../components/SelectField';

const FOLDER_OPTIONS = [
  ...SEARCH_TYPES.map((s) => ({ value: s.value, label: s.label })),
  { value: 'resumes', label: 'Resumes' },
];

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterFolder, setFilterFolder] = useState('');
  const [uploadFolder, setUploadFolder] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const docs = await listFiles(filterFolder || undefined);
      setDocuments(docs);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch documents.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filterFolder]);

  const handleUpload = async () => {
    if (!uploadFolder) {
      setMessage({ type: 'error', text: 'Please select a destination folder.' });
      return;
    }
    if (uploadFiles.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one file.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      for (const file of uploadFiles) {
        await uploadFile(file, uploadFolder);
      }
      setMessage({ type: 'success', text: `Uploaded ${uploadFiles.length} file(s) successfully.` });
      setUploadFiles([]);
      fetchDocuments();
    } catch (err) {
      setMessage({ type: 'error', text: 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <h1>Document Library</h1>
      <p className="page-subtitle">Browse and manage RAG documents stored in S3</p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Upload section */}
      <section className="section">
        <h2>Upload Documents</h2>
        <div className="form-row">
          <SelectField
            label="Destination Folder"
            name="uploadFolder"
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            options={FOLDER_OPTIONS}
          />
          <FileUpload
            accept=".pdf,.docx,.txt,.doc,.csv"
            multiple
            label="Select Files"
            onFiles={setUploadFiles}
          />
        </div>
        {uploadFiles.length > 0 && (
          <div className="file-list">
            {uploadFiles.map((f, i) => (
              <span key={i} className="file-tag">
                {f.name}
              </span>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </section>

      {/* Browse section */}
      <section className="section">
        <h2>Browse Documents</h2>
        <SelectField
          label="Filter by Folder"
          name="filterFolder"
          value={filterFolder}
          onChange={(e) => setFilterFolder(e.target.value)}
          options={[{ value: '', label: 'All' }, ...FOLDER_OPTIONS]}
        />
        {loading ? (
          <p className="loading">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="empty">No documents found.</p>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Folder</th>
                <th>Size</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => (
                <tr key={idx}>
                  <td>{doc.name}</td>
                  <td>{doc.folder}</td>
                  <td>{doc.size}</td>
                  <td>{doc.last_modified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
