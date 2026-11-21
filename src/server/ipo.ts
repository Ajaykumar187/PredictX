export interface LiveIPO {
  name: string;
  status: 'Upcoming' | 'Open' | 'Closed' | 'Unknown';
  gmpRs: number | null;
  gmpPct: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  estListingPrice: number | null;
  issueSizeCr: number | null;
  lotSize: number | null;
  dates: string;
  subscriptionX: number | null;
  qibSubX: number | null;
  niiSubX: number | null;
  retailSubX: number | null;
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

const firstPositiveNum = (t: string): number | null => {
  const list = nums(t);
  return list.length > 0 && Number.isFinite(list[0]) && list[0] > 0 ? list[0] : null;
};

const firstNonNegativeNum = (t: string): number | null => {
  const clean = t.trim();
  if (!clean || clean === '-' || clean === '--' || /^n\/?a$/i.test(clean)) return null;
  const match = clean.replace(/,/g, '').match(/^\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) && val >= 0 ? val : null;
};

const cleanIpoName = (raw: string): string =>
  raw
    .replace(/\[email protected\][^\s]*/gi, '')
    .replace(/GMP\s*:.*$/i, '')
    .replace(/\b(NSE|BSE)\s+SME\b/gi, '')
    .replace(/\b(IPO|SME)\b/gi, '')
    .replace(/\s+[UOCL]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const normName = (n: string) =>
  cleanIpoName(n)
    .toLowerCase()
    .replace(/\b(ltd|limited|ipo|sme|pvt|private|india|industries|technologies|technology|holdings|enterprise|enterprises)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

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
    const priceMatch = tr.match(/data-label="Price[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const sizeMatch = tr.match(/data-label="IPO Size"[^>]*>([\s\S]*?)<\/td>/i);
    const lotMatch = tr.match(/data-label="Lot"[^>]*>([\s\S]*?)<\/td>/i);
    const openMatch = tr.match(/data-label="Open"[^>]*>([\s\S]*?)<\/td>/i);
    const closeMatch = tr.match(/data-label="Close"[^>]*>([\s\S]*?)<\/td>/i);

    if (!nameMatch) continue;
    const anchorMatch = nameMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const titleMatch = nameMatch[1].match(/title="([^"]+)"/i);
    const rawName = anchorMatch ? stripTags(anchorMatch[1]) : (titleMatch ? stripTags(titleMatch[1]) : stripTags(nameMatch[1]));
    const name = cleanIpoName(rawName);
    if (!name || name.length < 2) continue;

    const gmpRaw = gmpMatch ? stripTags(gmpMatch[1]) : '';
    const hasNoGmp = /₹\s*--/.test(gmpRaw);
    const gmpNumList = hasNoGmp ? [] : nums(gmpRaw);
    const gmpRs = gmpNumList.length ? gmpNumList[0] : null;
    const pctMatch = gmpRaw.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*%/);
    const gmpPct = pctMatch ? Number(pctMatch[1]) : null;

    const priceRaw = priceMatch ? stripTags(priceMatch[1]) : '';
    const priceNums = nums(priceRaw).filter((n) => n > 0);
    const priceHigh = priceNums.length ? priceNums[priceNums.length - 1] : null;
    const priceLow = priceNums.length > 1 ? priceNums[0] : priceHigh;

    const issueSizeCr = sizeMatch ? firstPositiveNum(stripTags(sizeMatch[1])) : null;
    const lotSize = lotMatch ? firstPositiveNum(stripTags(lotMatch[1])) : null;

    const subRaw = subMatch ? stripTags(subMatch[1]) : '';
    const subscriptionX = firstPositiveNum(subRaw);

    const open = openMatch ? stripTags(openMatch[1]) : '';
    const close = closeMatch ? stripTags(closeMatch[1]) : '';

    const fullNameCell = stripTags(nameMatch[1]);
    let status: LiveIPO['status'] = 'Open';
    if (/upcoming/i.test(tr) || /\bU\s*$/.test(fullNameCell)) status = 'Upcoming';
    else if (/closed/i.test(tr) || /listed/i.test(tr) || /\b[CL]\s*$/.test(fullNameCell)) status = 'Closed';
    else if (/\bO\s*$/.test(fullNameCell)) status = 'Open';

    list.push({
      name,
      status,
      gmpRs,
      gmpPct: gmpPct ?? (gmpRs != null && priceHigh ? Number(((gmpRs / priceHigh) * 100).toFixed(2)) : null),
      priceLow,
      priceHigh,
      estListingPrice: priceHigh && gmpRs != null ? Number((priceHigh + gmpRs).toFixed(2)) : null,
      issueSizeCr,
      lotSize,
      dates: [open, close].filter(Boolean).join(' - '),
      subscriptionX,
      qibSubX: null,
      niiSubX: null,
      retailSubX: null,
      sources: ['investorgain.com'],
    });
  }

  if (list.length === 0) throw new Error('investorgain: no rows matched in HTML');
  return list;
}

export async function fromInvestorgainSubscription(): Promise<LiveIPO[]> {
  const res = await timedFetch('https://www.investorgain.com/report/ipo-subscription-live/333/', {
    headers: { 'Referer': 'https://www.investorgain.com/' },
  }, 7000);
  if (!res.ok) throw new Error(`investorgain-sub: HTTP ${res.status}`);
  const html = await res.text();
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const list: LiveIPO[] = [];

  for (const tr of trMatches) {
    if (!tr.includes('data-label="Name"')) continue;
    const nameMatch = tr.match(/data-label="Name"[^>]*>([\s\S]*?)<\/td>/i);
    const totalMatch = tr.match(/data-label="Total"[^>]*>([\s\S]*?)<\/td>/i);
    const qibMatch = tr.match(/data-label="QIB"[^>]*>([\s\S]*?)<\/td>/i);
    const niiMatch = tr.match(/data-label="NII"[^>]*>([\s\S]*?)<\/td>/i);
    const riiMatch = tr.match(/data-label="RII"[^>]*>([\s\S]*?)<\/td>/i);
    const sizeMatch = tr.match(/data-label="IPO Size"[^>]*>([\s\S]*?)<\/td>/i);
    const priceMatch = tr.match(/data-label="IPO Price"[^>]*>([\s\S]*?)<\/td>/i);
    const closeMatch = tr.match(/data-label="Closing Date"[^>]*>([\s\S]*?)<\/td>/i);

    if (!nameMatch) continue;
    const anchorMatch = nameMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const rawNameCell = stripTags(nameMatch[1]);
    const rawName = anchorMatch ? stripTags(anchorMatch[1]) : rawNameCell;
    const name = cleanIpoName(rawName);
    if (!name || name.length < 2) continue;

    let gmpRs: number | null = null;
    let gmpPct: number | null = null;
    const gmpEmbedded = rawNameCell.match(/GMP\s*:\s*₹?\s*(-?\d+(?:\.\d+)?)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*%\s*\))?/i);
    if (gmpEmbedded) {
      gmpRs = Number(gmpEmbedded[1]);
      if (gmpEmbedded[2] != null) gmpPct = Number(gmpEmbedded[2]);
    }

    const totalRaw = totalMatch ? stripTags(totalMatch[1]) : '';
    const subscriptionX = firstNonNegativeNum(totalRaw);
    const qibSubX = qibMatch ? firstNonNegativeNum(stripTags(qibMatch[1])) : null;
    const niiSubX = niiMatch ? firstNonNegativeNum(stripTags(niiMatch[1])) : null;
    const retailSubX = riiMatch ? firstNonNegativeNum(stripTags(riiMatch[1])) : null;
    const issueSizeCr = sizeMatch ? firstPositiveNum(stripTags(sizeMatch[1])) : null;

    const priceRaw = priceMatch ? stripTags(priceMatch[1]) : '';
    const priceNums = nums(priceRaw).filter((n) => n > 0);
    const priceHigh = priceNums.length ? priceNums[priceNums.length - 1] : null;
    const priceLow = priceNums.length > 1 ? priceNums[0] : priceHigh;

    let status: LiveIPO['status'] = 'Open';
    if (/\bU\s*$/.test(rawNameCell) || /upcoming/i.test(tr)) status = 'Upcoming';
    else if (/\b[CL]\s*$/.test(rawNameCell) || /closed|listed/i.test(tr)) status = 'Closed';
    else if (/\bO\s*$/.test(rawNameCell)) status = 'Open';

    const closeDate = closeMatch ? stripTags(closeMatch[1]) : '';

    list.push({
      name,
      status,
      gmpRs,
      gmpPct: gmpPct ?? (gmpRs != null && priceHigh ? Number(((gmpRs / priceHigh) * 100).toFixed(2)) : null),
      priceLow,
      priceHigh,
      estListingPrice: priceHigh && gmpRs != null ? Number((priceHigh + gmpRs).toFixed(2)) : null,
      issueSizeCr,
      lotSize: null,
      dates: closeDate ? `Closes ${closeDate}` : '',
      subscriptionX,
      qibSubX,
      niiSubX,
      retailSubX,
      sources: ['investorgain.com (Sub)'],
    });
  }

  if (list.length === 0) throw new Error('investorgain-sub: no rows matched in HTML');
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
      const name = cleanIpoName(linkMatch ? stripTags(linkMatch[1]) : stripTags(rawCol1).split(' ')[0]);

      const statusText = cells[7] ? stripTags(cells[7]) : rawCol1;
      let status: LiveIPO['status'] = 'Unknown';
      if (/open/i.test(statusText)) status = 'Open';
      else if (/upcoming/i.test(statusText)) status = 'Upcoming';
      else if (/closed|listed/i.test(statusText)) status = 'Closed';

      const gmpText = stripTags(cells[1] || '');
      const gmpNums = nums(gmpText);
      const gmpRs = gmpNums.length ? gmpNums[0] : null;

      const bandText = stripTags(cells[3] || '');
      const bandNums = nums(bandText).filter((n) => n > 0);
      const priceHigh = bandNums.length ? bandNums[bandNums.length - 1] : null;
      const priceLow = bandNums.length > 1 ? bandNums[0] : priceHigh;

      const estText = stripTags(cells[4] || '');
      const pctMatch = estText.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*%/);
      const gmpPct = pctMatch ? Number(pctMatch[1]) : (gmpRs != null && priceHigh ? Number(((gmpRs / priceHigh) * 100).toFixed(2)) : null);
      const estNums = nums(estText).filter((n) => n > 0);
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
          issueSizeCr: null,
          lotSize: null,
          dates,
          subscriptionX: null,
          qibSubX: null,
          niiSubX: null,
          retailSubX: null,
          sources: ['ipowatch.in'],
        });
      }
    }
  }

  if (list.length === 0) throw new Error('ipowatch: no rows parsed');
  return list;
}

const BASELINE_IPOS: LiveIPO[] = [
  { name: 'Jio Platforms', status: 'Upcoming', gmpRs: 220, gmpPct: 19.66, priceLow: 1119, priceHigh: 1119, estListingPrice: 1339, issueSizeCr: 15000, lotSize: 13, dates: '21-23 Oct', subscriptionX: null, qibSubX: null, niiSubX: null, retailSubX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Bonfiglioli Transmissions', status: 'Upcoming', gmpRs: 180, gmpPct: 30.71, priceLow: 586, priceHigh: 586, estListingPrice: 766, issueSizeCr: 1250, lotSize: 25, dates: '15-19 Oct', subscriptionX: null, qibSubX: null, niiSubX: null, retailSubX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Tonbo Imaging', status: 'Upcoming', gmpRs: 500, gmpPct: 71.43, priceLow: 700, priceHigh: 700, estListingPrice: 1200, issueSizeCr: 680, lotSize: 21, dates: '15-19 Oct', subscriptionX: null, qibSubX: null, niiSubX: null, retailSubX: null, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Fusion CX', status: 'Open', gmpRs: 34, gmpPct: 11.76, priceLow: 289, priceHigh: 289, estListingPrice: 323, issueSizeCr: 840, lotSize: 51, dates: '14-16 Oct', subscriptionX: 1.45, qibSubX: 1.92, niiSubX: 1.12, retailSubX: 1.38, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'HD Fire Protect', status: 'Open', gmpRs: 91, gmpPct: 33.58, priceLow: 271, priceHigh: 271, estListingPrice: 362, issueSizeCr: 495, lotSize: 55, dates: '13-15 Oct', subscriptionX: 4.82, qibSubX: 6.45, niiSubX: 5.12, retailSubX: 3.64, sources: ['ipowatch.in', 'investorgain.com'] },
  { name: 'Adroit Industries', status: 'Open', gmpRs: 55, gmpPct: 41.04, priceLow: 134, priceHigh: 134, estListingPrice: 189, issueSizeCr: 210, lotSize: 111, dates: '23-25 Sep', subscriptionX: 176.85, qibSubX: 112.4, niiSubX: 245.1, retailSubX: 162.3, sources: ['investorgain.com'] },
];

function findMatchingIpo(list: LiveIPO[], candidateName: string): LiveIPO | undefined {
  const key = normName(candidateName);
  if (!key) return undefined;
  return list.find((x) => {
    const k = normName(x.name);
    if (!k) return false;
    if (k === key) return true;
    const minLen = Math.min(k.length, key.length);
    if (minLen >= 6 && (k.includes(key) || key.includes(k))) return true;
    return false;
  });
}

function mergeIpoInto(target: LiveIPO, incoming: LiveIPO): void {
  if (target.status === 'Unknown' && incoming.status !== 'Unknown') target.status = incoming.status;
  if ((target.gmpRs == null || target.gmpRs === 0) && incoming.gmpRs != null && incoming.gmpRs !== 0) target.gmpRs = incoming.gmpRs;
  if ((target.gmpPct == null || target.gmpPct === 0) && incoming.gmpPct != null && incoming.gmpPct !== 0) target.gmpPct = incoming.gmpPct;
  if (!target.priceHigh && incoming.priceHigh) target.priceHigh = incoming.priceHigh;
  if (!target.priceLow && incoming.priceLow) target.priceLow = incoming.priceLow;
  if (!target.estListingPrice && incoming.estListingPrice) target.estListingPrice = incoming.estListingPrice;
  if (!target.issueSizeCr && incoming.issueSizeCr) target.issueSizeCr = incoming.issueSizeCr;
  if (!target.lotSize && incoming.lotSize) target.lotSize = incoming.lotSize;
  if (target.subscriptionX == null && incoming.subscriptionX != null) target.subscriptionX = incoming.subscriptionX;
  else if (incoming.subscriptionX != null && incoming.subscriptionX > 0 && (target.subscriptionX == null || target.subscriptionX === 0)) {
    target.subscriptionX = incoming.subscriptionX;
  }
  if (target.qibSubX == null && incoming.qibSubX != null) target.qibSubX = incoming.qibSubX;
  if (target.niiSubX == null && incoming.niiSubX != null) target.niiSubX = incoming.niiSubX;
  if (target.retailSubX == null && incoming.retailSubX != null) target.retailSubX = incoming.retailSubX;
  if ((!target.dates || target.dates === '-') && incoming.dates) target.dates = incoming.dates;
  for (const s of incoming.sources) {
    if (!target.sources.includes(s)) target.sources.push(s);
  }
}

let cache: { at: number; payload: any } | null = null;

export async function getLiveIpos(force = false) {
  if (!force && cache && Date.now() - cache.at < 2 * 60_000) {
    return cache.payload;
  }

  const errors: string[] = [];
  const used: string[] = [];
  const [igRes, subRes, watchRes] = await Promise.allSettled([
    fromInvestorgain(),
    fromInvestorgainSubscription(),
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
      const existing = findMatchingIpo(list, item.name);
      if (existing) {
        mergeIpoInto(existing, item);
      } else {
        list.push(item);
      }
    }
  } else if (igRes.status === 'rejected') {
    errors.push(igRes.reason?.message || 'investorgain failed');
  }

  if (subRes.status === 'fulfilled' && subRes.value.length > 0) {
    if (!used.includes('investorgain.com')) used.push('investorgain.com');
    for (const item of subRes.value) {
      const existing = findMatchingIpo(list, item.name);
      if (existing) {
        mergeIpoInto(existing, item);
      } else {
        list.push(item);
      }
    }
  } else if (subRes.status === 'rejected') {
    errors.push(subRes.reason?.message || 'investorgain subscription failed');
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
