import React from 'react';
import { LayoutDashboard, History, PlusCircle, Code } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <aside className="app-sidebar">
      <div className="brand-section">
        <div className="brand-logo">M</div>
        <h2 className="brand-name">MATAD Holdings</h2>
      </div>

      <nav>
        <ul className="nav-links">
          <li>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <History size={20} />
              <span>Activity Ledger</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('manual')}
              className={`nav-item ${activeTab === 'manual' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <PlusCircle size={20} />
              <span>Manual Assets</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div>MATAD Collective Fund</div>
        <div style={{ color: 'rgba(255,255,255,0.3)' }}>V1.0 (Static Pages Mode)</div>
        <a 
          href="https://github.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-item"
          style={{ padding: '4px 0', marginTop: '10px', fontSize: '0.75rem', gap: '8px' }}
        >
          <Code size={14} />
          <span>GitHub Repository</span>
        </a>
      </div>
    </aside>
  );
}
