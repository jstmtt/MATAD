import React, { useState } from 'react';
import { Plus, Trash2, Download, Upload, Coins, DollarSign, Wallet } from 'lucide-react';

export default function ManualEntry({ manualAssets, setManualAssets, manualTransactions, setManualTransactions }) {
  // Asset Form State
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [type, setType] = useState('Crypto'); // 'Crypto', 'Cash', 'Stock', 'Other'
  
  // Transaction Form State
  const [txSymbol, setTxSymbol] = useState('');
  const [txType, setTxType] = useState('BUY'); // 'BUY', 'SELL'
  const [txQty, setTxQty] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Active sub-tab
  const [subTab, setSubTab] = useState('assets'); // 'assets' | 'transactions'

  // Format Helper
  const formatUSD = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  // Add Asset Handler
  const handleAddAsset = (e) => {
    e.preventDefault();
    if (!symbol || !name || !qty || !avgPrice || !currentPrice) return;

    const parsedSymbol = symbol.trim().toUpperCase();
    const newAsset = {
      id: 'm-asset-' + Date.now(),
      symbol: parsedSymbol,
      name: name.trim(),
      qty: parseFloat(qty),
      avgPrice: parseFloat(avgPrice),
      currentPrice: parseFloat(currentPrice),
      type
    };

    // Add baseline transaction if not already exist
    const newTx = {
      id: 'm-tx-' + Date.now(),
      date: txDate || new Date().toISOString().split('T')[0],
      type: 'BUY',
      symbol: parsedSymbol,
      qty: parseFloat(qty),
      price: parseFloat(avgPrice),
      amount: parseFloat(qty) * parseFloat(avgPrice),
      owner: 'Manual',
      broker: 'Manual Tracking'
    };

    setManualAssets([...manualAssets, newAsset]);
    setManualTransactions([...manualTransactions, newTx]);

    // Reset Form
    setSymbol('');
    setName('');
    setQty('');
    setAvgPrice('');
    setCurrentPrice('');
  };

  // Add Transaction Handler
  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!txSymbol || !txQty || !txPrice || !txDate) return;

    const parsedSymbol = txSymbol.trim().toUpperCase();
    
    // Add transaction
    const newTx = {
      id: 'm-tx-' + Date.now(),
      date: txDate,
      type: txType,
      symbol: parsedSymbol,
      qty: parseFloat(txQty),
      price: parseFloat(txPrice),
      amount: parseFloat(txQty) * parseFloat(txPrice),
      owner: 'Manual',
      broker: 'Manual Tracking'
    };

    setManualTransactions([...manualTransactions, newTx]);

    // Update the asset quantity and cost basis automatically if it exists in our assets list!
    const targetAssetIndex = manualAssets.findIndex(a => a.symbol === parsedSymbol);
    if (targetAssetIndex > -1) {
      const updatedAssets = [...manualAssets];
      const asset = updatedAssets[targetAssetIndex];
      
      let newQty = asset.qty;
      let newCost = asset.qty * asset.avgPrice;

      if (txType === 'BUY') {
        newQty += parseFloat(txQty);
        newCost += parseFloat(txQty) * parseFloat(txPrice);
      } else {
        newQty = Math.max(0, newQty - parseFloat(txQty));
        newCost = Math.max(0, newCost - (parseFloat(txQty) * asset.avgPrice)); // subtract proportionate cost
      }

      asset.qty = newQty;
      asset.avgPrice = newQty > 0 ? parseFloat((newCost / newQty).toFixed(2)) : 0;
      setManualAssets(updatedAssets);
    }

    // Reset
    setTxSymbol('');
    setTxQty('');
    setTxPrice('');
  };

  // Delete Asset
  const handleDeleteAsset = (id, symbol) => {
    setManualAssets(manualAssets.filter(a => a.id !== id));
    // Optionally clear transactions too
    setManualTransactions(manualTransactions.filter(t => t.symbol !== symbol));
  };

  // Delete Transaction
  const handleDeleteTransaction = (id) => {
    setManualTransactions(manualTransactions.filter(t => t.id !== id));
  };

  // Data Export (JSON)
  const exportData = () => {
    const backup = {
      assets: manualAssets,
      transactions: manualTransactions
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matad_manual_portfolio_backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Data Import (JSON)
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.assets && backup.transactions) {
          setManualAssets(backup.assets);
          setManualTransactions(backup.transactions);
          alert('Backup imported successfully!');
        } else {
          alert('Invalid file format. Backup must contain assets and transactions.');
        }
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Tab Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`glass-button ${subTab === 'assets' ? '' : 'secondary'}`}
            onClick={() => setSubTab('assets')}
          >
            <Wallet size={16} />
            Tracked Assets
          </button>
          <button 
            className={`glass-button ${subTab === 'transactions' ? '' : 'secondary'}`}
            onClick={() => setSubTab('transactions')}
          >
            <Coins size={16} />
            Add Trade / Transaction
          </button>
        </div>

        {/* Import/Export controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportData} className="glass-button secondary" title="Export local data to JSON file">
            <Download size={14} />
            Export Backup
          </button>
          <label className="glass-button secondary" style={{ cursor: 'pointer' }} title="Import backup JSON file">
            <Upload size={14} />
            Import Backup
            <input type="file" onChange={handleImport} accept=".json" style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {subTab === 'assets' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          
          {/* Add Asset Form */}
          <div className="glass-panel form-card" style={{ margin: '0' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'hsl(var(--accent))' }} />
              Add Manual Asset
            </h3>
            
            <form onSubmit={handleAddAsset}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Asset Name</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    placeholder="e.g. Bitcoin, Gold"
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ticker / Code</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    placeholder="e.g. BTC-USD, GLD"
                    value={symbol} 
                    onChange={e => setSymbol(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input" 
                    placeholder="e.g. 0.45"
                    value={qty} 
                    onChange={e => setQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Average Buy Price ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input" 
                    placeholder="e.g. 45000"
                    value={avgPrice} 
                    onChange={e => setAvgPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Current Price ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input" 
                    placeholder="e.g. 68500"
                    value={currentPrice} 
                    onChange={e => setCurrentPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Asset Category</label>
                  <select 
                    className="glass-input" 
                    value={type} 
                    onChange={e => setType(e.target.value)}
                    style={{ background: 'rgba(8, 12, 24, 0.95)' }}
                  >
                    <option value="Crypto">Cryptocurrency</option>
                    <option value="Cash">Cash / Savings</option>
                    <option value="Stock">External Stock</option>
                    <option value="Other">Other (Physical/Commodities)</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="glass-button">Add Asset to Portfolio</button>
              </div>
            </form>
          </div>

          {/* List of Manual Assets */}
          <div className="glass-panel manual-list-card">
            <h3 style={{ marginBottom: '15px' }}>Your Manual Tracked Assets</h3>
            
            {manualAssets.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px' }}>
                No manually tracked assets yet. Use the form above to add your cash, crypto, or other holdings.
              </p>
            ) : (
              <div className="card-table-wrap" style={{ border: 'none' }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Avg Cost</th>
                      <th>Current Price</th>
                      <th>Market Value</th>
                      <th>Unrealized P/L</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualAssets.map(asset => {
                      const mv = asset.qty * asset.currentPrice;
                      const pl = mv - (asset.qty * asset.avgPrice);
                      const isProfit = pl >= 0;
                      
                      return (
                        <tr key={asset.id}>
                          <td>
                            <div className="ticker-cell">
                              <span className="ticker-sym">{asset.symbol}</span>
                              <span className="ticker-name">{asset.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge manual">{asset.type}</span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{asset.qty}</td>
                          <td>{formatUSD(asset.avgPrice)}</td>
                          <td>{formatUSD(asset.currentPrice)}</td>
                          <td style={{ fontWeight: 600 }}>{formatUSD(mv)}</td>
                          <td style={{ color: isProfit ? 'hsl(var(--success))' : 'hsl(var(--danger))', fontWeight: 600 }}>
                            {isProfit ? '+' : ''}{formatUSD(pl)}
                          </td>
                          <td>
                            <button 
                              onClick={() => handleDeleteAsset(asset.id, asset.symbol)}
                              className="delete-btn"
                              title="Delete asset"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          
          {/* Add Transaction Form */}
          <div className="glass-panel form-card" style={{ margin: '0' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'hsl(var(--primary))' }} />
              Log Manual Trade / Transaction
            </h3>
            
            <form onSubmit={handleAddTransaction}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Asset Ticker</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    placeholder="e.g. BTC-USD, GLD (Must match asset code)"
                    value={txSymbol} 
                    onChange={e => setTxSymbol(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Transaction Type</label>
                  <select 
                    className="glass-input" 
                    value={txType} 
                    onChange={e => setTxType(e.target.value)}
                    style={{ background: 'rgba(8, 12, 24, 0.95)' }}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity traded</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input" 
                    placeholder="e.g. 0.05"
                    value={txQty} 
                    onChange={e => setTxQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Trade Price ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input" 
                    placeholder="e.g. 62000"
                    value={txPrice} 
                    onChange={e => setTxPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Date of Execution</label>
                  <input 
                    type="date" 
                    className="glass-input" 
                    value={txDate} 
                    onChange={e => setTxDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="glass-button">Record Transaction</button>
              </div>
            </form>
          </div>

          {/* List of Manual Transactions */}
          <div className="glass-panel manual-list-card">
            <h3 style={{ marginBottom: '15px' }}>Manual Transactions Logs</h3>
            
            {manualTransactions.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px' }}>
                No transactions recorded yet.
              </p>
            ) : (
              <div className="card-table-wrap" style={{ border: 'none' }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Total Amount</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...manualTransactions].sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                      <tr key={tx.id}>
                        <td>{tx.date}</td>
                        <td style={{ fontWeight: 700, color: 'white' }}>{tx.symbol}</td>
                        <td>
                          <span className={`badge ${tx.type.toLowerCase()}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{tx.qty}</td>
                        <td>{formatUSD(tx.price)}</td>
                        <td style={{ fontWeight: 600 }}>{formatUSD(tx.amount)}</td>
                        <td>
                          <button 
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="delete-btn"
                            title="Delete transaction log"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
