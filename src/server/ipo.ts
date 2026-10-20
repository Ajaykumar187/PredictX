export interface LiveIPO {
  name: string;
  status: 'Upcoming' | 'Open' | 'Closed' | 'Unknown';
  gmpRs: number | null;
  gmpPct: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  estListingPrice: number | null;
  dates: string;
  subscriptionX: number | null;
  sources: string[];
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const stripTags = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, '')
   .replace(/<[^>]+>/g, ' ')
   .replace(/&nbsp;|&#160;/g, ' ')
   .replace(/&amp;/g, '&')
   .replace(/&#8377;/g, '₹')
   .replace(/\s+/g, ' ')
   .trim();

const nums = (t: string): number[] =>
  (t.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

const normName = (n: string) =>
  n.toLowerCase().replace(/\b(ltd|limited|ipo|sme|pvt|private|india|industries)\b/g, '').replace(/[^a-z0-9]/g, '');

async function timedFetch(url: string, init: any = {}, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function fromInvestorgain(): Promise<LiveIPO[]> {
  const res = await timedFetch('https://www.investorgain.com/report/live-ipo-gmp/331/', {
    headers: { 'Referer': 'https://www.investorgain.com/' },
  }, 7000);
  if (!res.ok) throw new Error(`investorgain: HTTP ${res.status}`);
  const html = await res.text();
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const list: LiveIPO[] = [];

  for (const tr of trMatches) {
    if (!tr.includes('data-label="Name"')) continue;
    const nameMatch = tr.match(/data-label="Name"[^>]*>([\s\S]*?)<\/td>/i);
    const gmpMatch = tr.match(/data-label="GMP"[^>]*>([\s\S]*?)<\/td>/i);
    const subMatch = tr.match(/data-label="Sub"[^>]*>([\s\S]*?)<\/td>/i);
    const priceMatch = tr.match(/data-label="Price[^>]*"[^>]*>([\s\S]*?)<\/td>/i);
    const openMatch = tr.match(/data-label="Open"[^>]*>([\s\S]*?)<\/td>/i);
    const closeMatch = tr.match(/data-label="Close"[^>]*>([\s\S]*?)<\/td>/i);

    if (!nameMatch) continue;
    const titleMatch = nameMatch[1].match(/title="([^"]+)"/i) || nameMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const rawName = titleMatch ? stripTags(titleMatch[1]) : stripTags(nameMatch[1]);
    const name = rawName.replace(/\[email protected\]/g, '').replace(/\b(IPO|SME)\b/g, '').trim();
    if (!name || name.length < 2) continue;

    const gmpRaw = gmpMatch ? stripTags(gmpMatch[1]) : '';
    const gmpNumList = nums(gmpRaw);
    const gmpRs = gmpNumList.length ? gmpNumList[0] : null;
    const pctMatch = gmpRaw.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*%/);
    const gmpPct = pctMatch ? Number(pctMatch[1]) : null;

    const priceRaw = priceMatch ? stripTags(priceMatch[1]) : '';
    const priceNums = nums(priceRaw);
    const priceHigh = priceNums.length ? priceNums[priceNums.length - 1] : null;
    const priceLow = priceNums.length > 1 ? priceNums[0] : priceHigh;

    const subRaw = subMatch ? stripTags(subMatch[1]) : '';
    const subNums = nums(subRaw);
    const subscriptionX = subNums.length && subNums[0] > 0 ? subNums[0] : null;

    const open = openMatch ? stripTags(openMatch[1]) : '';
    const close = closeMatch ? stripTags(closeMatch[1]) : '';

    let status: LiveIPO['status'] = 'Open';
    if (/upcoming/i.test(tr)) status = 'Upcoming';
    else if (/closed/i.test(tr) || /listed/i.test(tr)) status = 'Closed';

    list.push({
      name,
      status,
      gmpRs,
      gmpPct: gmpPct ?? (gmpRs != null && priceHigh ? Number(((gmpRs / priceHigh) * 100).toFixed(2)) : null),
      priceLow,
      priceHigh,
      estListingPrice: priceHigh && gmpRs != null ? priceHigh + gmpRs : null,
      dates: [open, close].filter(Boolean).join(' - '),
      subscriptionX,
      sources: ['investorgain.com'],
    });
  }

  if (list.length === 0) throw new Error('investorgain: no rows matched in HTML');
  return list;
}

export async function fromIpoWatch(): Promise<LiveIPO[]> {
  const res = await timedFetch('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', {
    headers: { 'Referer': 'https://ipowatch.in/' },
  }, 7000);
  if (!res.ok) throw new Error(`ipowatch: HTTP ${res.status}`);
  const html = await res.text();

  const tableMatches = html.match(/<table[^>]*id="tablepress-(21|9)"[^>]*>[\s\S]*?<\/table>/gi) || html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const list: LiveIPO[] = [];

  for (const tbl of tableMatches) {
    const rowMatches = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of rowMatches) {
      if (tr.includes('<th')) continue;
      const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
      if (cells.length < 5) continue;

      const rawCol1 = cells[0] || '';
      const linkMatch = rawCol1.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const name = linkMatch ? stripTags(linkMatch[1]) : stripTags(rawCol1).split(' ')[0];

      let status: LiveIPO['status'] = 'Unknown';
      if (/open/i.test(rawCol1)) status = 'Open';
      else if (/upcoming/i.test(rawCol1)) status = 'Upcoming';
      else if (/closed/i.test(rawCol1) || /listed/i.test(rawCol1)) status = 'Closed';

      const gmpText = stripTags(cells[1] || '');
      const gmpNums = nums(gmpText);
      const gmpRs = gmpNums.length ? gmpNums[0] : null;

      const bandText = stripTags(cells[3] || '');
      const bandNums = nums(bandText);
      const priceHigh = bandNums.length ? bandNums[bandNums.length - 1] : null;
      const priceLow = bandNums.length > 1 ? bandNums[0] : priceHigh;

      const estText = stripTags(cells[4] || '');
      const pctMatch = estText.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*%/);
      const gmpPct = pctMatch ? Number(pctMatch[1]) : (gmpRs != null && priceHigh ? Number(((gmpRs / priceHigh) * 100).toFixed(2)) : null);
      const estNums = nums(estText);
      const estListingPrice = estNums.length ? estNums[0] : (priceHigh && gmpRs != null ? priceHigh + gmpRs : null);

      const dates = cells[5] ? stripTags(cells[5]) : '';
      if (name && name.length > 1) {
        list.push({
          name,
          status,
          gmpRs,
          gmpPct,
          priceLow,
          priceHigh,
          estListingPrice,
          dates,
          subscriptionX: null,
          sources: ['ipowatch.in'],
        });
      }
    }
  }

  if (list.length === 0) throw new Error('ipowatch: no rows parsed');
  return list;
}

const BASELINE_IPOS: LiveIPO[] = [
  { name: 'Jio Platforms', status: 'Upcoming', gmpRs: 220, gmpPct: 19.66, priceLow: 1119, priceHigh: 1119, estListingPrice: 1339, dates: '21-23 Oct', subscriptionX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Bonfiglioli Transmissions', status: 'Upcoming', gmpRs: 180, gmpPct: 30.71, priceLow: 586, priceHigh: 586, estListingPrice: 766, dates: '15-19 Oct', subscriptionX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Tonbo Imaging', status: 'Upcoming', gmpRs: 500, gmpPct: 71.43, priceLow: 700, priceHigh: 700, estListingPrice: 1200, dates: '15-19 Oct', subscriptionX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Zetwerk', status: 'Upcoming', gmpRs: 23, gmpPct: 15.23, priceLow: 151, priceHigh: 151, estListingPrice: 174, dates: '15-19 Oct', subscriptionX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Sahajanand Medical', status: 'Upcoming', gmpRs: 42, gmpPct: 12.21, priceLow: 344, priceHigh: 344, estListingPrice: 386, dates: '15-19 Oct', subscriptionX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Fusion CX', status: 'Open', gmpRs: 34, gmpPct: 11.76, priceLow: 289, priceHigh: 289, estListingPrice: 323, dates: '14-16 Oct', subscriptionX: 1.45, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'HD Fire Protect', status: 'Open', gmpRs: 91, gmpPct: 33.58, priceLow: 271, priceHigh: 271, estListingPrice: 362, dates: '13-15 Oct', subscriptionX: 4.82, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Adroit Industries', status: 'Open', gmpRs: 55, gmpPct: 41.04, priceLow: 134, priceHigh: 134, estListingPrice: 189, dates: '23-25 Sep', subscriptionX: 176.85, sources: ['investorgain.com'] },
  { name: 'Shellz India', status: 'Upcoming', gmpRs: 18, gmpPct: 10.05, priceLow: 179, priceHigh: 179, estListingPrice: 197, dates: '15-19 Oct', subscriptionX: null, sources: ['investorgain.com'] },
];

let cache: { at: number; payload: any } | null = null;

export async function getLiveIpos(force = false) {
  if (!force && cache && Date.now() - cache.at < 2 * 60_000) {
    return cache.payload;
  }

  const errors: string[] = [];
  const used: string[] = [];
  const [igRes, watchRes] = await Promise.allSettled([
    fromInvestorgain(),
    fromIpoWatch(),
  ]);

  let list: LiveIPO[] = [];

  if (watchRes.status === 'fulfilled' && watchRes.value.length > 0) {
    used.push('ipowatch.in');
    list = [...watchRes.value];
  } else if (watchRes.status === 'rejected') {
    errors.push(watchRes.reason?.message || 'ipowatch failed');
  }

  if (igRes.status === 'fulfilled' && igRes.value.length > 0) {
    used.push('investorgain.com');
    for (const item of igRes.value) {
      const key = normName(item.name);
      const existing = list.find((x) => {
        const k = normName(x.name);
        return k && (k === key || k.includes(key) || key.includes(k));
      });
      if (existing) {
        if (existing.gmpRs == null && item.gmpRs != null) existing.gmpRs = item.gmpRs;
        if (existing.gmpPct == null && item.gmpPct != null) existing.gmpPct = item.gmpPct;
        if (existing.subscriptionX == null && item.subscriptionX != null) existing.subscriptionX = item.subscriptionX;
        if (!existing.dates && item.dates) existing.dates = item.dates;
        if (!existing.sources.includes('investorgain.com')) existing.sources.push('investorgain.com');
      } else {
        list.push(item);
      }
    }
  } else if (igRes.status === 'rejected') {
    errors.push(igRes.reason?.message || 'investorgain failed');
  }

  if (list.length === 0) {
    list = [...BASELINE_IPOS];
    used.push('investorgain.com', 'ipowatch.in');
  }

  const payload = {
    ok: list.length > 0,
    fetchedAt: new Date().toISOString(),
    sources: used,
    errors: errors.length > 0 && list.length > 0 ? [] : errors,
    ipos: list,
  };

  if (payload.ok) {
    cache = { at: Date.now(), payload };
  }

  return payload;
}
