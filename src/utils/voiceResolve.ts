import { searchStocksApi } from './stockApi';
import { ParsedCommand, StockRef } from './voiceCommands';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function resolveStockRef(cmd: ParsedCommand): Promise<StockRef | null> {
  if (cmd.alias) return cmd.alias;
  if (!cmd.stockPhrase) return null;
  const phrase = norm(cmd.stockPhrase);
  if (!phrase) return null;
  try {
    const results = await searchStocksApi(cmd.stockPhrase);
    if (!results?.length) return null;
    const tokens = phrase.split(' ');
    const scored = results
      .map((r) => {
        const hay = `${norm(r.displaySymbol || r.symbol)} ${norm(r.longName || '')}`;
        const hits = tokens.filter((t) => hay.includes(t)).length;
        const exact = norm(r.displaySymbol || r.symbol) === phrase.replace(/ /g, '');
        return { r, score: hits / tokens.length + (exact ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 0.6) return null;
    return { symbol: (best.r.displaySymbol || best.r.symbol).replace(/\.(NS|BO)$/i, ''), market: best.r.market, name: best.r.longName };
  } catch {
    return null;
  }
}
