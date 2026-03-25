import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Documents from './pages/Documents';
import Generate from './pages/Generate';
import Audit from './pages/Audit';
import './App.css';

function Nav() {
  const location = useLocation();
  const links = [
    { to: '/', label: 'Home' },
    { to: '/documents', label: 'Documents' },
    { to: '/generate', label: 'Generate' },
    { to: '/audit', label: 'Audit' },
  ];
  return (
    <nav className="main-nav">
      <div className="nav-brand">AI Document Assistant</div>
      <div className="nav-links">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={location.pathname === l.to ? 'active' : ''}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/audit" element={<Audit />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
