import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <h1>AI Document Assistant</h1>
      <p className="home-subtitle">Choose a workflow to get started</p>

      <div className="card-grid">
        <Link to="/documents" className="workflow-card">
          <div className="card-icon">&#128193;</div>
          <h2>Document Library</h2>
          <p>Browse, search, and upload documents to the RAG knowledge base stored in S3.</p>
        </Link>

        <Link to="/generate" className="workflow-card">
          <div className="card-icon">&#9997;</div>
          <h2>Generate Content</h2>
          <p>
            Provide context and preferences to generate structured documents using RAG-powered
            retrieval.
          </p>
        </Link>

        <Link to="/audit" className="workflow-card">
          <div className="card-icon">&#128269;</div>
          <h2>Audit File</h2>
          <p>
            Upload a document and a set of formatting rules to check compliance and surface issues.
          </p>
        </Link>
      </div>
    </div>
  );
}
