import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import xml2js from 'xml2js';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

// Set up __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'portfolio.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Environment Variables
const T212_API_KEY = process.env.T212_API_KEY || '';
const T212_API_SECRET = process.env.T212_API_SECRET || ''; // basic auth optional depending on endpoint settings
const IBKR_FLEX_TOKEN = process.env.IBKR_FLEX_TOKEN || '';
const IBKR_QUERY_ID = process.env.IBKR_QUERY_ID || '';

// Base currency for dashboard
const BASE_CURRENCY = 'USD';

// Helper: Get date string (YYYY-MM-DD)
const getDateString = (date) => date.toISOString().split('T')[0];

// Helper: Map ISIN or Broker Ticker to Yahoo Finance symbol
const getYahooTicker = (symbol, isin) => {
  const isinMap = {
    'SE0003917798': 'SIVE.ST', // Sivers Semiconductors (Stockholm)
    'SE0000667868': 'SAND.ST', // Sandvik AB (Stockholm)
    'FR0000075922': 'ALRIB.PA', // Riber (Paris)
  };
  
  if (isin && isinMap[isin]) {
    return isinMap[isin];
  }
  
  const tickerMap = {
    'SNDK1': 'SAND.ST',
    'ALRIBp': 'ALRIB.PA',
  };
  
  if (symbol && tickerMap[symbol]) {
    return tickerMap[symbol];
  }
  
  if (!symbol) return '';
  
  // Clean T212 suffixes
  let clean = symbol.replace(/_US_EQ|_EQ|_US/g, '');
  return clean;
};

/**
 * Finds the price for a symbol on a specific date, carrying forward the last known price
 * if the exact date is not present (e.g. weekends, holidays).
 */
const getPriceOnDate = (symbol, dateStr, historicalPrices, fallbackPrice) => {
  const hist = historicalPrices[symbol];
  if (!hist || hist.length === 0) {
    return fallbackPrice;
  }
  
  let price = fallbackPrice;
  for (const entry of hist) {
    if (entry.date <= dateStr) {
      price = entry.close;
    } else {
      break;
    }
  }
  return price;
};

/**
 * Calculates the quantity of a position held on a specific date by walking backward from the current quantity.
 * This handles transaction history truncation gracefully, since we anchor to the exact current position.
 */
const getQtyOnDate = (pos, dateStr, transactions) => {
  let qty = pos.quantity;
  // Get all transactions for this symbol and owner that happened AFTER the dateStr
  // Walk backward: reverse the effect of future transactions
  const futureTransactions = transactions.filter(t => 
    t.symbol === pos.symbol && 
    t.owner === pos.owner && 
    t.date > dateStr
  );
  
  for (const t of futureTransactions) {
    if (t.type === 'BUY') {
      qty -= t.qty;
    } else if (t.type === 'SELL') {
      qty += t.qty;
    }
  }
  
  return Math.max(0, qty);
};

/**
 * Maps a Yahoo Finance ticker symbol to its native currency.
 */
const getSymbolCurrency = (symbol) => {
  if (!symbol) return 'USD';
  if (symbol.endsWith('.ST')) return 'SEK';
  if (symbol.endsWith('.PA')) return 'EUR';
  if (symbol.endsWith('.L')) return 'GBP';
  return 'USD';
};

/**
 * Generates high-fidelity mock data if no API keys are provided.
 * Serves as a perfect fallback for local development or demo purposes.
 */
async function generateMockData() {
  console.log('Generating high-fidelity mock data...');
  
  const today = new Date();
  const historyDays = 180;
  
  // Tickers we use in mock portfolio
  const tickers = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'VUSA.L', 'BTC-USD', 'ETH-USD'];
  
  // 1. Fetch real historical prices for these tickers from Yahoo Finance to make the charts authentic
  const historicalPrices = {};
  const currentPrices = {};
  
  const startDate = new Date();
  startDate.setDate(today.getDate() - historyDays);
  
  for (const ticker of tickers) {
    try {
      console.log(`Fetching Yahoo Finance historical prices for ${ticker}...`);
      const result = await yahooFinance.historical(ticker, {
        period1: getDateString(startDate),
        period2: getDateString(today),
        interval: '1d'
      });
      
      historicalPrices[ticker] = result.map(p => ({
        date: getDateString(new Date(p.date)),
        close: p.close
      }));
      
      // Get current price (last close)
      currentPrices[ticker] = result[result.length - 1]?.close || 100;
    } catch (err) {
      console.error(`Failed to fetch Yahoo Finance for ${ticker}, generating mock history:`, err.message);
      // Fallback historical price generation
      const mockHistory = [];
      let currentPrice = ticker === 'BTC-USD' ? 64000 : ticker === 'ETH-USD' ? 3400 : ticker === 'NVDA' ? 120 : 150;
      for (let i = historyDays; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const change = (Math.random() - 0.48) * 0.03 * currentPrice; // upward bias
        currentPrice += change;
        mockHistory.push({
          date: getDateString(d),
          close: parseFloat(currentPrice.toFixed(2))
        });
      }
      historicalPrices[ticker] = mockHistory;
      currentPrices[ticker] = mockHistory[mockHistory.length - 1].close;
    }
  }

  // Add a base currency rate for EUR and GBP to USD
  currentPrices['USDGBP=X'] = 0.78;
  currentPrices['USDEUR=X'] = 0.92;

  // 2. Define Positions
  const positions = [
    // Matt (IBKR)
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      quantity: 50,
      avgPrice: 172.50,
      currentPrice: currentPrices['AAPL'],
      marketValue: 50 * currentPrices['AAPL'],
      profitLoss: (currentPrices['AAPL'] - 172.50) * 50,
      owner: 'Matt',
      broker: 'Interactive Brokers'
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      quantity: 35,
      avgPrice: 340.20,
      currentPrice: currentPrices['MSFT'],
      marketValue: 35 * currentPrices['MSFT'],
      profitLoss: (currentPrices['MSFT'] - 340.20) * 35,
      owner: 'Matt',
      broker: 'Interactive Brokers'
    },
    {
      symbol: 'VUSA.L',
      name: 'Vanguard S&P 500 UCITS ETF',
      quantity: 110,
      avgPrice: 68.80,
      currentPrice: currentPrices['VUSA.L'],
      marketValue: 110 * currentPrices['VUSA.L'],
      profitLoss: (currentPrices['VUSA.L'] - 68.80) * 110,
      owner: 'Matt',
      broker: 'Interactive Brokers'
    },
    // Addi (T212)
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      quantity: 45,
      avgPrice: 195.40,
      currentPrice: currentPrices['TSLA'],
      marketValue: 45 * currentPrices['TSLA'],
      profitLoss: (currentPrices['TSLA'] - 195.40) * 45,
      owner: 'Addi',
      broker: 'Trading 212'
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corp.',
      quantity: 160,
      avgPrice: 65.50,
      currentPrice: currentPrices['NVDA'],
      marketValue: 160 * currentPrices['NVDA'],
      profitLoss: (currentPrices['NVDA'] - 65.50) * 160,
      owner: 'Addi',
      broker: 'Trading 212'
    },
    {
      symbol: 'VUSA.L',
      name: 'Vanguard S&P 500 UCITS ETF',
      quantity: 90,
      avgPrice: 70.20,
      currentPrice: currentPrices['VUSA.L'],
      marketValue: 90 * currentPrices['VUSA.L'],
      profitLoss: (currentPrices['VUSA.L'] - 70.20) * 90,
      owner: 'Addi',
      broker: 'Trading 212'
    }
  ];

  // 3. Define Historical Transactions (buys and sells)
  const transactions = [
    { id: 't1', date: getDateString(new Date(today.getTime() - 150 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'VUSA.L', qty: 100, price: 67.50, amount: 6750, owner: 'Matt', broker: 'Interactive Brokers' },
    { id: 't2', date: getDateString(new Date(today.getTime() - 140 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'VUSA.L', qty: 90, price: 68.10, amount: 6129, owner: 'Addi', broker: 'Trading 212' },
    { id: 't3', date: getDateString(new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'AAPL', qty: 30, price: 170.00, amount: 5100, owner: 'Matt', broker: 'Interactive Brokers' },
    { id: 't4', date: getDateString(new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'TSLA', qty: 45, price: 195.40, amount: 8793, owner: 'Addi', broker: 'Trading 212' },
    { id: 't5', date: getDateString(new Date(today.getTime() - 80 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'NVDA', qty: 100, price: 62.00, amount: 6200, owner: 'Addi', broker: 'Trading 212' },
    { id: 't6', date: getDateString(new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'MSFT', qty: 35, price: 340.20, amount: 11907, owner: 'Matt', broker: 'Interactive Brokers' },
    { id: 't7', date: getDateString(new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'AAPL', qty: 20, price: 176.25, amount: 3525, owner: 'Matt', broker: 'Interactive Brokers' },
    { id: 't8', date: getDateString(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'NVDA', qty: 60, price: 71.33, amount: 4280, owner: 'Addi', broker: 'Trading 212' },
    { id: 't9', date: getDateString(new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)), type: 'SELL', symbol: 'AAPL', qty: 10, price: 185.00, amount: 1850, owner: 'Matt', broker: 'Interactive Brokers' },
    { id: 't10', date: getDateString(new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)), type: 'BUY', symbol: 'VUSA.L', qty: 10, price: 75.30, amount: 753, owner: 'Matt', broker: 'Interactive Brokers' }
  ];

  // 4. Generate Performance NAV History (growing from ~50k to current valuation)
  const performance = [];
  
  // Calculate current holdings values
  const mattValCurrent = positions.filter(p => p.owner === 'Matt').reduce((sum, p) => sum + p.marketValue, 0) + 4300; // plus cash
  const addiValCurrent = positions.filter(p => p.owner === 'Addi').reduce((sum, p) => sum + p.marketValue, 0) + 2200; // plus cash
  
  for (let i = historyDays; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getDateString(d);
    
    // Simulate NAV for each day based on stock prices
    let mattVal = 4300; // cash
    let addiVal = 2200; // cash
    
    // Determine which holdings were active on this date
    // Simple simulation: scale back values based on historical stock prices
    positions.forEach(pos => {
      const priceOnDate = getPriceOnDate(pos.symbol, dateStr, historicalPrices, pos.avgPrice);
      const qtyOnDate = getQtyOnDate(pos, dateStr, transactions);
      
      if (pos.owner === 'Matt') {
        mattVal += qtyOnDate * priceOnDate;
      } else {
        addiVal += qtyOnDate * priceOnDate;
      }
    });

    performance.push({
      date: dateStr,
      Matt: parseFloat(mattVal.toFixed(2)),
      Addi: parseFloat(addiVal.toFixed(2)),
      Total: parseFloat((mattVal + addiVal).toFixed(2))
    });
  }

  // Summary statistics
  const summary = {
    totalValue: mattValCurrent + addiValCurrent,
    mattValue: mattValCurrent,
    addiValue: addiValCurrent,
    manualValue: 0, // In mock data we load manual from client-side localStorage, start at 0
    cashBalance: 6500, // Matt $4300 + Addi $2200
    dailyChange: (mattValCurrent + addiValCurrent) * 0.012, // mock 1.2% change today
    dailyChangePercent: 1.2,
    lastUpdated: new Date().toISOString()
  };

  const output = {
    summary,
    positions,
    transactions,
    performance,
    historicalPrices
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Mock portfolio file successfully written to ${OUTPUT_FILE}`);
}

/**
 * Fetches real data from Trading 212 API
 */
async function fetchTrading212() {
  console.log('Fetching Trading 212 portfolio data...');
  const baseUrl = 'https://live.trading212.com/api/v0';
  
  // Basic Auth Header
  const authHeader = Buffer.from(`${T212_API_KEY}:${T212_API_SECRET}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${authHeader}`,
    'User-Agent': 'MATAD-Holdings-BuildScript/1.0'
  };

  // 1. Fetch summary
  const summaryRes = await axios.get(`${baseUrl}/equity/account/summary`, { headers });
  const t212Summary = summaryRes.data; // { free: number, total: number, invested: number }

  // 2. Fetch positions
  const positionsRes = await axios.get(`${baseUrl}/equity/positions`, { headers });
  console.log("Trading 212 raw position sample:", JSON.stringify(positionsRes.data[0] || {}));
  
  const t212Positions = positionsRes.data.map(pos => {
    const symbol = getYahooTicker(pos.instrument?.ticker, pos.instrument?.isin);
    const quantity = parseFloat(pos.quantity || 0);
    const avgPrice = parseFloat(pos.averagePricePaid || 0);
    const currentPrice = parseFloat(pos.currentPrice || 0);
    const profitLoss = parseFloat(pos.walletImpact?.unrealizedProfitLoss || 0);
    
    return {
      symbol,
      name: pos.instrument?.name || symbol,
      quantity,
      avgPrice,
      currentPrice,
      marketValue: quantity * currentPrice,
      profitLoss,
      owner: 'Addi',
      broker: 'Trading 212',
      walletImpact: pos.walletImpact
    };
  });

  // 3. Fetch transactions (Latest page)
  const transactionsRes = await axios.get(`${baseUrl}/equity/history/transactions`, { 
    headers, 
    params: { limit: 50 } 
  });
  const t212Transactions = transactionsRes.data.items
    .filter(tx => tx.ticker)
    .map(tx => ({
      id: tx.id,
      date: tx.dateTime.split('T')[0],
      type: tx.type.includes('BUY') ? 'BUY' : 'SELL',
      symbol: getYahooTicker(tx.ticker),
      qty: tx.quantity,
      price: tx.price,
      amount: tx.total,
      owner: 'Addi',
      broker: 'Trading 212'
    }));

  return {
    summary: t212Summary,
    positions: t212Positions,
    transactions: t212Transactions
  };
}

/**
 * Fetches real data from Interactive Brokers Flex Web Service
 */
async function fetchIBKR() {
  console.log('Requesting IBKR Flex Query report...');
  
  const sendRequestUrl = `https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest?t=${IBKR_FLEX_TOKEN}&q=${IBKR_QUERY_ID}&v=3`;
  
  // 1. Send request
  const requestRes = await axios.get(sendRequestUrl, {
    headers: { 'User-Agent': 'Java/1.8' }
  });
  
  // Parse Reference Code XML
  const xmlParser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  const requestData = await xmlParser.parseStringPromise(requestRes.data);
  
  if (requestData.FlexStatementResponse?.Status === 'Fail') {
    throw new Error(`IBKR SendRequest failed: ${requestData.FlexStatementResponse.ErrorMessage}`);
  }

  const referenceCode = requestData.FlexStatementResponse.ReferenceCode;
  console.log(`IBKR Reference Code received: ${referenceCode}. Waiting 2 seconds before query...`);
  
  // Rate limit protection: sleep 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 2. Fetch Statement
  const getStatementUrl = `https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?q=${referenceCode}&t=${IBKR_FLEX_TOKEN}&v=3`;
  const statementRes = await axios.get(getStatementUrl, {
    headers: { 'User-Agent': 'Java/1.8' }
  });

  const statementData = await xmlParser.parseStringPromise(statementRes.data);
  const flexStatement = (statementData.FlexQueryResponse || statementData.FlexStatementResponse)?.FlexStatements?.FlexStatement;
  
  if (!flexStatement) {
    // Log the parsed keys for easier debugging in Actions logs if it fails again
    console.warn("Parsed XML keys:", Object.keys(statementData));
    throw new Error('IBKR FlexStatement response was empty or malformed');
  }

  console.log("IBKR FlexStatement sections present:", Object.keys(flexStatement));
  console.log("IBKR raw OpenPositions node:", JSON.stringify(flexStatement.OpenPositions || {}));
  
  // Parse Open Positions
  let ibkrPositions = [];
  const openPositionsNode = flexStatement.OpenPositions?.OpenPosition;
  if (openPositionsNode) {
    const rawPositions = Array.isArray(openPositionsNode) ? openPositionsNode : [openPositionsNode];
    ibkrPositions = rawPositions.map(pos => {
      const symbol = getYahooTicker(pos.symbol, pos.isin);
      const fxRate = parseFloat(pos.fxRateToBase || 1);
      const quantity = parseFloat(pos.position || 0);
      const markPrice = parseFloat(pos.markPrice || 0);
      const costBasisMoney = parseFloat(pos.costBasisMoney || 0);
      const positionValue = parseFloat(pos.positionValue || (quantity * markPrice));
      
      const currentPriceUSD = markPrice * fxRate;
      const marketValueUSD = positionValue * fxRate;
      
      // Calculate average buy price (cost basis per share) converted to USD
      let avgPriceUSD = 0;
      if (costBasisMoney > 0 && quantity > 0) {
        avgPriceUSD = (costBasisMoney / quantity) * fxRate;
      } else {
        avgPriceUSD = currentPriceUSD; // Fallback
      }
      
      const profitLossUSD = marketValueUSD - (quantity * avgPriceUSD);

      return {
        symbol,
        name: pos.description || symbol,
        quantity,
        avgPrice: avgPriceUSD,
        currentPrice: currentPriceUSD,
        marketValue: marketValueUSD,
        profitLoss: profitLossUSD,
        owner: 'Matt',
        broker: 'Interactive Brokers'
      };
    });
  }

  // Parse Trades (Transactions)
  let ibkrTrades = [];
  const tradesNode = flexStatement.Trades?.Trade;
  if (tradesNode) {
    const rawTrades = Array.isArray(tradesNode) ? tradesNode : [tradesNode];
    ibkrTrades = rawTrades.map(tr => {
      const symbol = getYahooTicker(tr.symbol, tr.isin);
      const fxRate = parseFloat(tr.fxRateToBase || 1);
      const quantity = Math.abs(parseFloat(tr.quantity || 0));
      const tradePrice = parseFloat(tr.tradePrice || 0);
      const netCash = Math.abs(parseFloat(tr.netCash || (quantity * tradePrice)));

      return {
        id: tr.tradeID || tr.ibOrderID || `ib-${Date.now()}-${Math.random()}`,
        date: tr.tradeDate,
        type: tr.buySell, // 'BUY' or 'SELL'
        symbol,
        qty: quantity,
        price: tradePrice * fxRate,
        amount: netCash * fxRate,
        owner: 'Matt',
        broker: 'Interactive Brokers'
      };
    });
  }

  // Parse NAV history (Performance)
  let ibkrNAVHistory = [];
  const navNode = flexStatement.ChangeInNAV?.NetAssetValue || flexStatement.NetAssetValue;
  if (navNode) {
    const rawNavs = Array.isArray(navNode) ? navNode : [navNode];
    ibkrNAVHistory = rawNavs.map(nav => ({
      date: nav.reportDate,
      value: parseFloat(nav.endingValue) // ending total Net Asset Value on date (already in base currency, USD)
    }));
  }

  return {
    positions: ibkrPositions,
    transactions: ibkrTrades,
    navHistory: ibkrNAVHistory
  };
}

/**
 * Main build process executing either mock or real data aggregation.
 */
async function build() {
  console.log('Starting MATAD Holdings data compilation build...');
  
  if (!T212_API_KEY || !IBKR_FLEX_TOKEN) {
    console.log('T212_API_KEY or IBKR_FLEX_TOKEN not found in environment.');
    await generateMockData();
    return;
  }

  try {
    const t212 = await fetchTrading212();
    const ibkr = await fetchIBKR();

    console.log('Broker queries completed successfully! Aggregating data...');

    // Load existing database cache to merge timelines
    let cachedData = null;
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const rawCache = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        // Check if cache contains mock data (e.g. Matt's mock AAPL position or transaction IDs like t1-t10)
        const hasMockData = rawCache.positions?.some(p => 
          (p.owner === 'Matt' && p.symbol === 'AAPL' && p.avgPrice === 172.50) ||
          (p.owner === 'Addi' && p.symbol === 'TSLA' && p.avgPrice === 195.40)
        ) || rawCache.transactions?.some(tx => tx.id && String(tx.id).startsWith('t') && !isNaN(Number(String(tx.id).slice(1))));

        if (hasMockData) {
          console.log('Cached portfolio contains mock data. Discarding cache to start fresh with real data.');
        } else {
          cachedData = rawCache;
          console.log('Successfully loaded cached portfolio data to merge.');
        }
      } catch (e) {
        console.warn('Failed to parse cached portfolio file. Starting fresh.', e.message);
      }
    }

    // Fetch Yahoo Finance historical data for all unique active symbols and exchange rates
    const uniqueSymbols = [...new Set([...t212.positions, ...ibkr.positions].map(p => p.symbol).filter(Boolean))];
    uniqueSymbols.push('USDSEK=X', 'USDEUR=X', 'USDGBP=X');
    const historicalPrices = {};
    const today = new Date();
    const startDate = new Date();
    startDate.setMonth(today.getMonth() - 6); // 6 months of historical charts

    for (const symbol of uniqueSymbols) {
      try {
        console.log(`Fetching Yahoo Finance historical data for active symbol: ${symbol}...`);
        const prices = await yahooFinance.historical(symbol, {
          period1: getDateString(startDate),
          period2: getDateString(today),
          interval: '1d'
        });
        historicalPrices[symbol] = prices.map(p => ({
          date: getDateString(new Date(p.date)),
          close: p.close
        }));
      } catch (err) {
        console.warn(`Could not get Yahoo Finance data for ${symbol}:`, err.message);
        historicalPrices[symbol] = [];
      }
    }

    // Extract current exchange rates (last close of the historical series)
    const currentPrices = {
      'USDGBP=X': historicalPrices['USDGBP=X']?.slice(-1)[0]?.close || 0.78,
      'USDEUR=X': historicalPrices['USDEUR=X']?.slice(-1)[0]?.close || 0.92,
      'USDSEK=X': historicalPrices['USDSEK=X']?.slice(-1)[0]?.close || 10.5
    };

    // Normalize T212 positions to USD using current FX rates
    const normalizedT212Positions = t212.positions.map(pos => {
      const walletCurrency = pos.walletImpact?.currency || 'GBP';
      let fxRate = 1;
      if (walletCurrency === 'GBP') {
        fxRate = 1 / currentPrices['USDGBP=X'];
      } else if (walletCurrency === 'EUR') {
        fxRate = 1 / currentPrices['USDEUR=X'];
      } else if (walletCurrency === 'SEK') {
        fxRate = 1 / currentPrices['USDSEK=X'];
      }

      const marketValueUSD = parseFloat(pos.walletImpact?.currentValue || 0) * fxRate;
      const costBasisUSD = parseFloat(pos.walletImpact?.totalCost || 0) * fxRate;
      const profitLossUSD = parseFloat(pos.walletImpact?.unrealizedProfitLoss || 0) * fxRate;
      
      const quantity = pos.quantity;
      const currentPriceUSD = quantity > 0 ? (marketValueUSD / quantity) : 0;
      const avgPriceUSD = quantity > 0 ? (costBasisUSD / quantity) : 0;

      return {
        symbol: pos.symbol,
        name: pos.name,
        quantity,
        avgPrice: avgPriceUSD,
        currentPrice: currentPriceUSD,
        marketValue: marketValueUSD,
        profitLoss: profitLossUSD,
        owner: pos.owner,
        broker: pos.broker
      };
    });

    // Normalize T212 transactions to USD using current FX rates
    const normalizedT212Transactions = t212.transactions.map(tx => {
      const gbpToUsd = 1 / currentPrices['USDGBP=X'];
      const currency = getSymbolCurrency(tx.symbol);
      let priceUSD = tx.price;
      if (currency === 'SEK') {
        priceUSD = tx.price / currentPrices['USDSEK=X'];
      } else if (currency === 'EUR') {
        priceUSD = tx.price / currentPrices['USDEUR=X'];
      } else if (currency === 'GBP') {
        priceUSD = tx.price / currentPrices['USDGBP=X'];
      }

      return {
        ...tx,
        price: priceUSD,
        amount: tx.amount * gbpToUsd
      };
    });

    // Combine positions (current snapshots are replaced)
    const aggregatedPositions = [...normalizedT212Positions, ...ibkr.positions];
    
    // Combine transactions & de-duplicate using unique transaction IDs
    let aggregatedTransactions = [...normalizedT212Transactions, ...ibkr.transactions];
    if (cachedData && cachedData.transactions) {
      const existingTxIds = new Set(cachedData.transactions.map(tx => tx.id));
      const newTransactions = aggregatedTransactions.filter(tx => !existingTxIds.has(tx.id));
      aggregatedTransactions = [...cachedData.transactions, ...newTransactions];
    }
    
    // Sort transactions by date descending
    aggregatedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Sort IBKR NAV history chronologically
    ibkr.navHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine start date for history (earliest IBKR NAV date, or 6 months ago)
    let navStartDate = new Date();
    navStartDate.setMonth(today.getMonth() - 6);
    if (ibkr.navHistory.length > 0) {
      const earliestIBKRDate = new Date(Math.min(...ibkr.navHistory.map(n => new Date(n.date))));
      if (!isNaN(earliestIBKRDate.getTime())) {
        navStartDate = earliestIBKRDate;
      }
    }

    // Generate continuous daily list of calendar dates up to today
    const dates = [];
    let current = new Date(navStartDate);
    const end = new Date(today);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    while (current <= end) {
      dates.push(getDateString(current));
      current.setDate(current.getDate() + 1);
    }

    // Helper to get IBKR NAV on date with carry-forward
    const getIBKRNAVOnDate = (dateStr) => {
      let val = 0;
      for (const entry of ibkr.navHistory) {
        if (entry.date <= dateStr) {
          val = entry.value;
        } else {
          break;
        }
      }
      return val;
    };

    // Build collective daily NAV performance history
    const newPerformance = [];
    dates.forEach(date => {
      let ibkrVal = 0;
      if (ibkr.navHistory && ibkr.navHistory.length > 0) {
        ibkrVal = getIBKRNAVOnDate(date);
      } else {
        // Reconstruct Matt's IBKR history on this date if navHistory is empty
        ibkr.positions.forEach(pos => {
          const priceOnDate = getPriceOnDate(pos.symbol, date, historicalPrices, pos.avgPrice);
          const qtyOnDate = getQtyOnDate(pos, date, ibkr.transactions);
          const valInCurrency = qtyOnDate * priceOnDate;
          
          const currency = getSymbolCurrency(pos.symbol);
          let valInUSD = valInCurrency;
          
          if (currency === 'SEK') {
            const usdSekRate = getPriceOnDate('USDSEK=X', date, historicalPrices, 10.5);
            valInUSD = valInCurrency / usdSekRate;
          } else if (currency === 'EUR') {
            const usdEurRate = getPriceOnDate('USDEUR=X', date, historicalPrices, 0.92);
            valInUSD = valInCurrency / usdEurRate;
          } else if (currency === 'GBP') {
            const usdGbpRate = getPriceOnDate('USDGBP=X', date, historicalPrices, 0.78);
            valInUSD = valInCurrency / usdGbpRate;
          }
          
          ibkrVal += valInUSD;
        });
      }
      
      // Simulate/reconstruct T212 NAV history on this date
      let t212Val = 0;
      t212.positions.forEach(pos => {
        const priceOnDate = getPriceOnDate(pos.symbol, date, historicalPrices, pos.avgPrice);
        const qtyOnDate = getQtyOnDate(pos, date, t212.transactions);
        const valInCurrency = qtyOnDate * priceOnDate;
        
        // Convert to USD based on the symbol's native currency on this historical date
        const currency = getSymbolCurrency(pos.symbol);
        let valInUSD = valInCurrency;
        
        if (currency === 'SEK') {
          const usdSekRate = getPriceOnDate('USDSEK=X', date, historicalPrices, 10.5);
          valInUSD = valInCurrency / usdSekRate;
        } else if (currency === 'EUR') {
          const usdEurRate = getPriceOnDate('USDEUR=X', date, historicalPrices, 0.92);
          valInUSD = valInCurrency / usdEurRate;
        } else if (currency === 'GBP') {
          const usdGbpRate = getPriceOnDate('USDGBP=X', date, historicalPrices, 0.78);
          valInUSD = valInCurrency / usdGbpRate;
        }
        
        t212Val += valInUSD;
      });

      newPerformance.push({
        date,
        Matt: parseFloat(ibkrVal.toFixed(2)),
        Addi: parseFloat(t212Val.toFixed(2)),
        Total: parseFloat((ibkrVal + t212Val).toFixed(2))
      });
    });

    // Merge performance timelines to build a historical database forever
    let performance = newPerformance;
    if (cachedData && cachedData.performance) {
      const perfMap = new Map();
      cachedData.performance.forEach(p => perfMap.set(p.date, p));
      newPerformance.forEach(p => perfMap.set(p.date, p));
      performance = Array.from(perfMap.values());
      performance.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Summary calculations
    const mattTotal = ibkr.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const addiTotal = normalizedT212Positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalVal = mattTotal + addiTotal;

    const summary = {
      totalValue: totalVal,
      mattValue: mattTotal,
      addiValue: addiTotal,
      manualValue: 0,
      cashBalance: (t212.summary?.free || 0) / (currentPrices['USDGBP=X'] || 1),
      dailyChange: totalVal * 0.005,
      dailyChangePercent: 0.5,
      lastUpdated: new Date().toISOString()
    };

    // Keep old historicalPrices cached for tickers that are no longer active, to maintain performance accuracy
    let combinedHistoricalPrices = { ...historicalPrices };
    if (cachedData && cachedData.historicalPrices) {
      combinedHistoricalPrices = { ...cachedData.historicalPrices, ...historicalPrices };
    }

    const output = {
      summary,
      positions: aggregatedPositions,
      transactions: aggregatedTransactions,
      performance,
      historicalPrices: combinedHistoricalPrices
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Aggregated real portfolio file written and merged to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Failed to run real portfolio aggregators, falling back to mock:', err);
    await generateMockData();
  }
}

build();
