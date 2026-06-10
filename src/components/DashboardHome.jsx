import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign, 
  ArrowUpRight,
  PieChart as PieIcon,
  Maximize2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function DashboardHome({ data, onSelectAsset, manualAssets }) {
  const [timeframe, setTimeframe] = useState('all'); // '30d', '90d', 'all'
  const [logScale, setLogScale] = useState(false);

  if (!data) return <div style={{ padding: '20px' }}>Loading portfolio data...</div>;

  // Process data to merge with manual assets
  const manualTotal = manualAssets.reduce((sum, a) => sum + (a.qty * a.currentPrice), 0);
  
  // Update current valuations with manual assets included
  const totalVal = data.summary.totalValue + manualTotal;
  const mattVal = data.summary.mattValue;
  const addiVal = data.summary.addiValue;
  
  // Mix in manual positions into the holdings list
  const manualPositions = manualAssets.map(asset => ({
    symbol: asset.symbol,
    name: asset.name,
    quantity: asset.qty,
    avgPrice: asset.avgPrice,
    currentPrice: asset.currentPrice,
    marketValue: asset.qty * asset.currentPrice,
    profitLoss: (asset.currentPrice - asset.avgPrice) * asset.qty,
    owner: 'Manual',
    broker: 'Manual Tracking'
  }));

  const allPositions = [...data.positions, ...manualPositions];
  // Sort positions by market value descending
  allPositions.sort((a, b) => b.marketValue - a.marketValue);

  // Format currency helper
  const formatUSD = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatPriceUSD = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Format percent helper
  const formatPercent = (val) => {
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  // Recharts timeframe filter
  const filteredPerformance = () => {
    const perf = data.performance;
    if (timeframe === '30d') return perf.slice(-30);
    if (timeframe === '90d') return perf.slice(-90);
    return perf;
  };

  // Log scale adapter for chart data
  const getChartData = () => {
    const dataList = filteredPerformance();
    return dataList.map(p => {
      const item = {
        ...p,
        _Matt: p.Matt,
        _Addi: p.Addi,
        _Total: p.Total,
      };
      
      if (logScale) {
        // Floor values to at least $100 so log scale functions properly
        item.Matt = p.Matt < 100 ? 100 : p.Matt;
        item.Addi = p.Addi < 100 ? 100 : p.Addi;
        item.Total = p.Total < 100 ? 100 : p.Total;
      }
      return item;
    });
  };

  // Pie chart data for allocation (Owner Split)
  const ownerAllocationData = [
    { name: "Matt (IBKR)", value: mattVal, color: 'hsl(250, 84%, 67%)' },
    { name: "Addi (T212)", value: addiVal, color: 'hsl(180, 80%, 55%)' },
    { name: "Manual Assets", value: manualTotal, color: 'hsl(25, 90%, 55%)' }
  ].filter(item => item.value > 0);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(8, 12, 24, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{label}</p>
          {payload.map((entry, index) => {
            const originalVal = item[`_${entry.name}`] !== undefined ? item[`_${entry.name}`] : entry.value;
            return (
              <p key={index} style={{ margin: '3px 0', fontSize: '0.85rem', color: entry.color, fontWeight: 500 }}>
                {entry.name}: {formatUSD(originalVal)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. Stat Grid */}
      <div className="overview-grid">
        {/* Total Value */}
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Collective Portfolio Value</span>
            <Wallet size={16} style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <div className="stat-value">{formatUSD(totalVal)}</div>
          <div className={`stat-change ${data.summary.dailyChangePercent >= 0 ? 'positive' : 'negative'}`}>
            {data.summary.dailyChangePercent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{formatPercent(data.summary.dailyChangePercent)} (Today)</span>
          </div>
        </div>

        {/* Matt's Portfolio */}
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Matt (Interactive Brokers)</span>
            <span className="badge matt">IBKR</span>
          </div>
          <div className="stat-value">{formatUSD(mattVal)}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
            {((mattVal / totalVal) * 100).toFixed(1)}% of total fund
          </div>
        </div>

        {/* Addi's Portfolio */}
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Addi (Trading 212)</span>
            <span className="badge addi">T212</span>
          </div>
          <div className="stat-value">{formatUSD(addiVal)}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
            {((addiVal / totalVal) * 100).toFixed(1)}% of total fund
          </div>
        </div>

        {/* Manual Assets */}
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Manual Tracked Assets</span>
            <span className="badge manual">Manual</span>
          </div>
          <div className="stat-value">{formatUSD(manualTotal)}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
            {((manualTotal / totalVal) * 100).toFixed(1)}% of total fund
          </div>
        </div>
      </div>

      {/* 2. Charts Section */}
      <div className="performance-section">
        {/* NAV History Area Chart */}
        <div className="glass-panel chart-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <h3>Fund Performance</h3>
              <p>Combined net asset values over time</p>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <ul className="legend-list">
                <li className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: 'hsl(var(--accent))' }}></span>
                  <span>Total</span>
                </li>
                <li className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: 'hsl(var(--primary))' }}></span>
                  <span>Matt</span>
                </li>
                <li className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ff7799' }}></span>
                  <span>Addi</span>
                </li>
              </ul>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="chart-filters">
                  <button 
                    onClick={() => setLogScale(!logScale)} 
                    className={`chart-filter-btn ${logScale ? 'active' : ''}`}
                    style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}
                  >LOG</button>
                </div>
                <div className="chart-filters">
                  <button 
                    onClick={() => setTimeframe('30d')} 
                    className={`chart-filter-btn ${timeframe === '30d' ? 'active' : ''}`}
                  >30D</button>
                  <button 
                    onClick={() => setTimeframe('90d')} 
                    className={`chart-filter-btn ${timeframe === '90d' ? 'active' : ''}`}
                  >90D</button>
                  <button 
                    onClick={() => setTimeframe('all')} 
                    className={`chart-filter-btn ${timeframe === 'all' ? 'active' : ''}`}
                  >ALL</button>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180, 80%, 55%)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="hsl(180, 80%, 55%)" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorMatt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(250, 84%, 67%)" stopOpacity={0.08}/>
                    <stop offset="95%" stopColor="hsl(250, 84%, 67%)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10}
                  dy={10} 
                  tickLine={false}
                />
                 <YAxis 
                   stroke="rgba(255,255,255,0.2)" 
                   fontSize={10}
                   dx={-10}
                   tickLine={false}
                   axisLine={false}
                   scale={logScale ? "log" : "auto"}
                   domain={logScale ? [100, "auto"] : [0, "auto"]}
                   tickFormatter={(val) => val >= 1000 ? `$${(val/1000).toFixed(0)}k` : `$${val}`}
                 />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  name="Matt" 
                  type="monotone" 
                  dataKey="Matt" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorMatt)" 
                />
                <Area 
                  name="Addi" 
                  type="monotone" 
                  dataKey="Addi" 
                  stroke="#ff7799" 
                  strokeWidth={2}
                  fillOpacity={0} 
                />
                <Area 
                  name="Total Fund" 
                  type="monotone" 
                  dataKey="Total" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Allocation Pie Chart */}
        <div className="glass-panel allocation-card">
          <div className="chart-title" style={{ marginBottom: '15px' }}>
            <h3>Fund Allocation</h3>
            <p>Asset distribution by portfolio</p>
          </div>
          
          <div style={{ height: '180px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ownerAllocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {ownerAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatUSD(value)} />
              </PieChart>
            </ResponsiveContainer>
            
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>Aggregated</p>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{formatUSD(totalVal)}</h4>
            </div>
          </div>

          <div className="allocation-breakdown">
            {ownerAllocationData.map((item, idx) => (
              <div className="allocation-bar-row" key={idx}>
                <div className="allocation-label-info">
                  <span className="allocation-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                    {item.name}
                  </span>
                  <span className="allocation-value">{formatUSD(item.value)} ({((item.value / totalVal) * 100).toFixed(1)}%)</span>
                </div>
                <div className="allocation-bar-container">
                  <div 
                    className="allocation-bar" 
                    style={{ 
                      width: `${(item.value / totalVal) * 100}%`,
                      backgroundColor: item.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Holdings Section */}
      <div className="holdings-section">
        <div className="section-header">
          <h2>Fund Holdings</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
            <span>Click on any asset to view transaction details and price chart overlay.</span>
          </div>
        </div>

        <div className="glass-panel card-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Owner</th>
                <th>Quantity</th>
                <th>Avg Buy Price</th>
                <th>Current Price</th>
                <th>Market Value</th>
                <th>Unrealized P/L</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allPositions.map((pos, idx) => {
                const isProfit = pos.profitLoss >= 0;
                const plPct = (pos.profitLoss / (pos.avgPrice * pos.quantity)) * 100;
                
                return (
                  <tr key={idx} onClick={() => onSelectAsset(pos)}>
                    <td>
                      <div className="ticker-cell">
                        <span className="ticker-sym">{pos.symbol}</span>
                        <span className="ticker-name">{pos.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${pos.owner.toLowerCase()}`}>
                        {pos.owner}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{pos.quantity}</td>
                    <td>{formatPriceUSD(pos.avgPrice)}</td>
                    <td>{formatPriceUSD(pos.currentPrice)}</td>
                    <td style={{ fontWeight: 600 }}>{formatUSD(pos.marketValue)}</td>
                    <td>
                      <span style={{
                        color: isProfit ? 'hsl(var(--success))' : 'hsl(var(--danger))',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isProfit ? '+' : ''}{formatPriceUSD(pos.profitLoss)}
                        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                          ({isProfit ? '+' : ''}{plPct.toFixed(1)}%)
                        </span>
                      </span>
                    </td>
                    <td>
                      <button 
                        className="delete-btn"
                        style={{ color: 'hsl(var(--text-muted))', background: 'none' }}
                        title="View details"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
