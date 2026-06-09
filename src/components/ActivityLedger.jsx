import React, { useState } from 'react';
import { Search, Filter, Calendar } from 'lucide-react';

export default function ActivityLedger({ data, manualTransactions }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('ALL'); // 'ALL' | 'MATT' | 'ADDI' | 'MANUAL'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'

  if (!data) return <div style={{ padding: '20px' }}>Loading ledger...</div>;

  // Merge broker transactions and manual transactions
  const allTransactions = [...data.transactions, ...manualTransactions];

  // Filter logic
  const filteredTx = allTransactions.filter(tx => {
    const matchesSearch = tx.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOwner = 
      ownerFilter === 'ALL' || 
      tx.owner.toUpperCase() === ownerFilter;
      
    const matchesType = 
      typeFilter === 'ALL' || 
      tx.type.toUpperCase() === typeFilter;

    return matchesSearch && matchesOwner && matchesType;
  });

  // Sort by date descending
  filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Format currency helper
  const formatUSD = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and Filters bar */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
        
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input 
            type="text" 
            className="glass-input" 
            placeholder="Search by ticker symbol..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px', width: '100%' }}
          />
        </div>

        {/* Owner Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} /> Owner:
          </span>
          <select 
            className="glass-input" 
            value={ownerFilter} 
            onChange={e => setOwnerFilter(e.target.value)}
            style={{ background: 'rgba(8, 12, 24, 0.95)', padding: '8px 12px' }}
          >
            <option value="ALL">All Portfolios</option>
            <option value="MATT">Matt (IBKR)</option>
            <option value="ADDI">Addi (T212)</option>
            <option value="MANUAL">Manual Assets</option>
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Type:
          </span>
          <select 
            className="glass-input" 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            style={{ background: 'rgba(8, 12, 24, 0.95)', padding: '8px 12px' }}
          >
            <option value="ALL">All Actions</option>
            <option value="BUY">Buys</option>
            <option value="SELL">Sells</option>
          </select>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="glass-panel card-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>Owner</th>
              <th>Action</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total Amount</th>
              <th>Broker / Source</th>
            </tr>
          </thead>
          <tbody>
            {filteredTx.length > 0 ? (
              filteredTx.map((tx, idx) => (
                <tr key={tx.id || idx}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: 'none', padding: '18px 20px' }}>
                    <Calendar size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                    {tx.date}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'white' }}>{tx.symbol}</span>
                  </td>
                  <td>
                    <span className={`badge ${tx.owner.toLowerCase()}`}>
                      {tx.owner}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${tx.type.toLowerCase()}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{tx.qty}</td>
                  <td>{formatUSD(tx.price)}</td>
                  <td style={{ fontWeight: 600 }}>{formatUSD(tx.amount || (tx.qty * tx.price))}</td>
                  <td style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>
                    {tx.broker}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '30px' }}>
                  No transaction records match the active search filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
