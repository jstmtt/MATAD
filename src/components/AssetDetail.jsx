import React from 'react';
import { X, TrendingUp, TrendingDown, Calendar, ShoppingBag } from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function AssetDetail({ asset, data, onClose, manualTransactions }) {
  if (!asset) return null;

  const symbol = asset.symbol;
  const owner = asset.owner;

  // Format currency helper
  const formatUSD = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  // Get historical price data for this symbol
  const priceHistory = data.historicalPrices[symbol] || [];

  // Filter transactions for this asset and owner
  // Include manual transactions if this is a manual asset
  const brokerTrades = data.transactions.filter(t => t.symbol === symbol && t.owner === owner);
  const matchedManualTrades = manualTransactions.filter(t => t.symbol === symbol);
  
  const trades = owner === 'Manual' ? matchedManualTrades : brokerTrades;
  
  // Sort trades by date descending
  const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Merge trade data into historical prices to overlay dots on the chart
  // This will add `buyPrice` or `sellPrice` to the historical data points
  const chartData = priceHistory.map(pricePoint => {
    const matchedTradesOnDate = trades.filter(t => t.date === pricePoint.date);
    
    let buyPrice = null;
    let sellPrice = null;
    let tooltipTradeInfo = '';

    matchedTradesOnDate.forEach(trade => {
      if (trade.type === 'BUY') {
        buyPrice = pricePoint.close;
        tooltipTradeInfo += `Bought ${trade.qty} @ ${formatUSD(trade.price)}\n`;
      } else if (trade.type === 'SELL') {
        sellPrice = pricePoint.close;
        tooltipTradeInfo += `Sold ${trade.qty} @ ${formatUSD(trade.price)}\n`;
      }
    });

    return {
      ...pricePoint,
      buyPrice,
      sellPrice,
      tradeInfo: tooltipTradeInfo.trim()
    };
  });

  const profitLoss = asset.profitLoss;
  const isProfit = profitLoss >= 0;
  const plPct = (profitLoss / (asset.avgPrice * asset.quantity)) * 100;

  // Custom tooltips showing stock price AND trade details if they exist on that date
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(8, 12, 24, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          maxWidth: '240px'
        }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
            {dataPoint.date}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.9rem', color: 'white', fontWeight: 700 }}>
            Price: {formatUSD(dataPoint.close)}
          </p>
          {dataPoint.tradeInfo && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
              color: 'hsl(var(--accent))',
              whiteSpace: 'pre-line',
              fontWeight: 500
            }}>
              {dataPoint.tradeInfo}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-ticker-symbol">{symbol}</span>
            <div className="modal-ticker-details">
              <span className="modal-ticker-name">{asset.name}</span>
              <div className="modal-ticker-owner">
                <span className={`badge ${owner.toLowerCase()}`}>
                  {owner}'s Portfolio
                </span>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginLeft: '10px' }}>
                  Managed via {asset.broker}
                </span>
              </div>
            </div>
          </div>
          <div className="modal-header-right">
            <div className="modal-current-price">{formatUSD(asset.currentPrice)}</div>
            <div style={{ 
              color: isProfit ? 'hsl(var(--success))' : 'hsl(var(--danger))',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px'
            }}>
              {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{isProfit ? '+' : ''}{formatUSD(profitLoss)} ({isProfit ? '+' : ''}{plPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Modal Stats Grid */}
        <div className="modal-stats-grid">
          <div className="modal-stat-box">
            <div className="modal-stat-label">Position Quantity</div>
            <div className="modal-stat-value">{asset.quantity}</div>
          </div>
          <div className="modal-stat-box">
            <div className="modal-stat-label">Average Buy Price</div>
            <div className="modal-stat-value">{formatUSD(asset.avgPrice)}</div>
          </div>
          <div className="modal-stat-box">
            <div className="modal-stat-label">Invested Capital</div>
            <div className="modal-stat-value">{formatUSD(asset.avgPrice * asset.quantity)}</div>
          </div>
          <div className="modal-stat-box">
            <div className="modal-stat-label">Current Market Value</div>
            <div className="modal-stat-value">{formatUSD(asset.marketValue)}</div>
          </div>
        </div>

        {/* Stock Chart with Buy/Sell Dots */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'white' }}>Historical Price & Trade Markers</h4>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))' }}></span>
                Buys
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--danger))' }}></span>
                Sells
              </span>
            </div>
          </div>
          
          <div className="chart-container" style={{ height: '280px' }}>
            {priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.15)" 
                    fontSize={10} 
                    tickLine={false}
                    dy={5}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.15)" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${val}`}
                    dx={-5}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    name="Stock Price"
                    type="monotone" 
                    dataKey="close" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* Buy Marker overlays */}
                  <Line 
                    name="Buys"
                    type="monotone" 
                    dataKey="buyPrice" 
                    stroke="none" 
                    dot={{ r: 6, fill: 'hsl(var(--success))', stroke: 'white', strokeWidth: 1.5 }}
                  />
                  {/* Sell Marker overlays */}
                  <Line 
                    name="Sells"
                    type="monotone" 
                    dataKey="sellPrice" 
                    stroke="none" 
                    dot={{ r: 6, fill: 'hsl(var(--danger))', stroke: 'white', strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
                No historical price data available for this asset.
              </div>
            )}
          </div>
        </div>

        {/* Transaction History for Asset */}
        <div>
          <h4 style={{ fontSize: '1rem', color: 'white', marginBottom: '15px' }}>Transaction History</h4>
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table className="dashboard-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.length > 0 ? (
                  sortedTrades.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: 'none' }}>
                        <Calendar size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                        {t.date}
                      </td>
                      <td>
                        <span className={`badge ${t.type.toLowerCase()}`}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{t.qty}</td>
                      <td>{formatUSD(t.price)}</td>
                      <td style={{ fontWeight: 600 }}>{formatUSD(t.amount || (t.qty * t.price))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px' }}>
                      No transaction records found for this asset.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
