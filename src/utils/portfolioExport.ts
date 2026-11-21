import type { JournalTrade, MarketType, PaperAccount } from '../types';

export interface ExportableHoldingRow {
  symbol: string;
  market: MarketType;
  sector?: string;
  dateAdded: string;
  quantity: number;
  buyPrice: number;
  livePrice: number | null;
  invested: number;
  current: number;
  todayGain: number | null;
  todayGainPct: number | null;
  pnl: number;
  pnlPct: number;
}

export interface PortfolioCsvExportInput {
  generatedAt?: Date;
  summary: {
    holdingsCount: number;
    profitableCount: number;
    totalInvested: number;
    totalCurrent: number;
    totalPnL: number;
    totalPnLPct: number;
    totalTodayGain: number;
    totalTodayGainPct: number;
    hasLiveDayData: boolean;
  };
  holdings: ExportableHoldingRow[];
  journalTrades: JournalTrade[];
  paperAccount: PaperAccount;
}

function formatNum(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return value.toFixed(decimals);
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  let str = String(value);
  const isPureNumber = /^-?\d+(\.\d+)?$/.test(str.trim());
  if (!isPureNumber && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(',');
}

interface UnifiedTradeRow {
  sortKey: string;
  date: string;
  source: 'Trade Journal' | 'Paper Trading';
  symbol: string;
  market: string;
  side: string;
  status: string;
  category: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  exitDate: string;
  totalValue: number;
  realizedPnL: number | null;
  realizedPnLPct: number | null;
  notes: string;
}

export function buildPortfolioCsv(input: PortfolioCsvExportInput): string {
  const now = input.generatedAt ?? new Date();
  const generatedIso = now.toISOString();

  const unifiedTrades: UnifiedTradeRow[] = [];

  for (const t of input.journalTrades) {
    const entryDate = (t.entryDate || t.createdAt || '').slice(0, 10);
    const exitDate = t.exitDate ? t.exitDate.slice(0, 10) : t.closedAt ? t.closedAt.slice(0, 10) : '';
    const exitPrice =
      typeof t.exitPrice === 'number' && Number.isFinite(t.exitPrice) ? t.exitPrice : null;

    let realizedPnL: number | null = null;
    let realizedPnLPct: number | null = null;
    if (t.status === 'CLOSED') {
      if (typeof t.pnl === 'number' && Number.isFinite(t.pnl)) {
        realizedPnL = t.pnl;
      } else if (exitPrice !== null) {
        realizedPnL =
          t.type === 'SELL'
            ? (t.entryPrice - exitPrice) * t.quantity
            : (exitPrice - t.entryPrice) * t.quantity;
      }
      if (typeof t.pnlPercent === 'number' && Number.isFinite(t.pnlPercent)) {
        realizedPnLPct = t.pnlPercent;
      } else if (realizedPnL !== null && t.entryPrice * t.quantity > 0) {
        realizedPnLPct = (realizedPnL / (t.entryPrice * t.quantity)) * 100;
      }
    }

    const noteParts = [t.strategyTag, t.emotionTag, t.notes]
      .map((s) => (s || '').trim())
      .filter(Boolean);

    unifiedTrades.push({
      sortKey: t.createdAt || entryDate,
      date: entryDate,
      source: 'Trade Journal',
      symbol: t.symbol.toUpperCase().trim(),
      market: t.market || 'NSE',
      side: t.type,
      status: t.status,
      category: t.category || 'Positional',
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      exitPrice,
      exitDate,
      totalValue: t.entryPrice * t.quantity,
      realizedPnL,
      realizedPnLPct,
      notes: noteParts.join(' | '),
    });
  }

  const paperHistory = Array.isArray(input.paperAccount?.history) ? input.paperAccount.history : [];
  for (const p of paperHistory) {
    const dt = (p.timestamp || p.date || '').slice(0, 10);
    const category = [p.product, p.orderType].filter(Boolean).join(' / ') || 'Paper';
    unifiedTrades.push({
      sortKey: p.timestamp || p.date || p.id,
      date: dt,
      source: 'Paper Trading',
      symbol: p.symbol.toUpperCase().trim(),
      market: p.market || 'NSE',
      side: p.type,
      status: 'EXECUTED',
      category,
      quantity: p.shares,
      entryPrice: p.price,
      exitPrice: null,
      exitDate: '',
      totalValue: Number.isFinite(p.total) ? p.total : p.shares * p.price,
      realizedPnL: null,
      realizedPnLPct: null,
      notes: '',
    });
  }

  unifiedTrades.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const lines: string[] = [];

  lines.push(toCsvRow(['PORTFOLIO SUMMARY']));
  lines.push(toCsvRow(['Metric', 'Value']));
  lines.push(toCsvRow(['Exported At (UTC)', generatedIso]));
  lines.push(toCsvRow(['Active Holdings', input.summary.holdingsCount]));
  lines.push(toCsvRow(['Profitable Holdings', input.summary.profitableCount]));
  lines.push(toCsvRow(['Total Invested (INR)', formatNum(input.summary.totalInvested)]));
  lines.push(toCsvRow(['Current Total Value (INR)', formatNum(input.summary.totalCurrent)]));
  lines.push(toCsvRow(['Overall P/L (INR)', formatNum(input.summary.totalPnL)]));
  lines.push(toCsvRow(['Overall P/L (%)', formatNum(input.summary.totalPnLPct)]));
  lines.push(
    toCsvRow([
      "Today's Gain (INR)",
      input.summary.hasLiveDayData ? formatNum(input.summary.totalTodayGain) : '',
    ])
  );
  lines.push(
    toCsvRow([
      "Today's Gain (%)",
      input.summary.hasLiveDayData ? formatNum(input.summary.totalTodayGainPct) : '',
    ])
  );
  lines.push(toCsvRow(['Recorded Trades Count', unifiedTrades.length]));
  lines.push('');

  lines.push(toCsvRow(['CURRENT HOLDINGS']));
  lines.push(
    toCsvRow([
      'Symbol',
      'Market',
      'Sector',
      'Trade Date',
      'Quantity',
      'Buy Price',
      'Live Price',
      'Invested Value',
      'Current Value',
      "Today's Gain",
      "Today's Gain (%)",
      'Overall P/L',
      'Overall P/L (%)',
    ])
  );

  for (const h of input.holdings) {
    lines.push(
      toCsvRow([
        h.symbol,
        h.market,
        h.sector || 'Unclassified',
        h.dateAdded,
        h.quantity,
        formatNum(h.buyPrice),
        h.livePrice !== null ? formatNum(h.livePrice) : '',
        formatNum(h.invested),
        formatNum(h.current),
        h.todayGain !== null ? formatNum(h.todayGain) : '',
        h.todayGainPct !== null ? formatNum(h.todayGainPct) : '',
        formatNum(h.pnl),
        formatNum(h.pnlPct),
      ])
    );
  }
  lines.push('');

  lines.push(toCsvRow(['TRADE HISTORY']));
  lines.push(
    toCsvRow([
      'Date',
      'Source',
      'Symbol',
      'Market',
      'Side',
      'Status',
      'Category / Product',
      'Quantity',
      'Entry / Execution Price',
      'Exit Price',
      'Exit Date',
      'Total Value',
      'Realized P/L',
      'Realized P/L (%)',
      'Strategy / Notes',
    ])
  );

  for (const tr of unifiedTrades) {
    lines.push(
      toCsvRow([
        tr.date,
        tr.source,
        tr.symbol,
        tr.market,
        tr.side,
        tr.status,
        tr.category,
        tr.quantity,
        formatNum(tr.entryPrice),
        tr.exitPrice !== null ? formatNum(tr.exitPrice) : '',
        tr.exitDate,
        formatNum(tr.totalValue),
        tr.realizedPnL !== null ? formatNum(tr.realizedPnL) : '',
        tr.realizedPnLPct !== null ? formatNum(tr.realizedPnLPct) : '',
        tr.notes,
      ])
    );
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadPortfolioCsv(input: PortfolioCsvExportInput): string {
  const csv = buildPortfolioCsv(input);
  const now = input.generatedAt ?? new Date();
  const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const filename = `predictx-portfolio-${dateStamp}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
