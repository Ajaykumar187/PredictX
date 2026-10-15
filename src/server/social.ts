import type { Router } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const env = (k: string) => (process.env[k] || '').trim();
const supa = () => ({ url: env('SUPABASE_URL').replace(/\/$/, ''), key: env('SUPABASE_SERVICE_KEY') });
const dbConfigured = () => !!(supa().url && supa().key);
const mailConfigured = () => !!(env('RESEND_API_KEY') && env('RESEND_FROM') && env('CRON_SECRET'));

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const START_CASH = 1_000_000;

async function db(path: string, init: RequestInit = {}) {
  const { url, key } = supa();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Database error ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const unsubSig = (email: string) => createHmac('sha256', env('CRON_SECRET')).update(email).digest('hex');
const confirmSig = (email: string) => createHmac('sha256', env('CRON_SECRET')).update('confirm:' + email).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function sendMail(to: string, subject: string, html: string) {
  const r = await fetch(env('RESEND_API_URL') || 'https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('RESEND_FROM'), to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}`);
}

function digestHtml(email: string, rows: Array<{ symbol: string; market: string; price: number; changePct: number }>) {
  const appUrl = env('APP_URL').replace(/\/$/, '');
  const cur = (m: string) => (m === 'US' ? '$' : '₹');
  const body = rows
    .map((r) => {
      const color = r.changePct >= 0 ? '#059669' : '#e11d48';
      return `<tr><td style="padding:6px 10px;font-weight:600">${r.symbol}</td><td style="padding:6px 10px">${cur(r.market)}${r.price.toFixed(2)}</td><td style="padding:6px 10px;color:${color};font-weight:600">${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%</td></tr>`;
    })
    .join('');
  const unsub = appUrl ? `${appUrl}/api/digest/unsubscribe?email=${encodeURIComponent(email)}&t=${unsubSig(email)}` : '';
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
<h2 style="margin-bottom:4px">PredictX — aapki watchlist</h2>
<p style="color:#64748b;margin-top:0">Pichhle close ke mukable badlav.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${body}</table>
<p style="color:#94a3b8;font-size:12px;margin-top:20px">Sirf jaankari ke liye, financial advice nahi.${unsub ? ` <a href="${unsub}">Unsubscribe</a>` : ''}</p></div>`;
}

export function registerSocial(router: Router) {

  router.get('/leaderboard', async (_req, res) => {
    if (!dbConfigured()) return res.json({ configured: false, rows: [] });
    try {
      const rows = await db('leaderboard?select=username,total_value,return_pct,updated_at&order=return_pct.desc&limit=50');
      res.json({ configured: true, rows: rows || [] });
    } catch (e: any) {
      res.json({ configured: true, rows: [], error: e.message });
    }
  });

  router.post('/leaderboard/submit', async (req, res) => {
    if (!dbConfigured()) return res.json({ configured: false });
    const { username, email, token, totalValue } = req.body || {};
    const em = String(email || '').trim().toLowerCase();
    const un = String(username || '').trim();
    const tv = Number(totalValue);
    if (!EMAIL_RE.test(em)) return res.status(400).json({ error: 'Valid email chahiye (Account page par register karein).' });
    if (!USER_RE.test(un)) return res.status(400).json({ error: 'Username 3-24 characters: letters, numbers, _ . -' });
    if (typeof token !== 'string' || token.length < 16) return res.status(400).json({ error: 'Token missing' });
    if (!Number.isFinite(tv) || tv <= 0 || tv > 1e10) return res.status(400).json({ error: 'Total value galat hai' });

    const returnPct = Math.max(-100, Math.min(1000, ((tv - START_CASH) / START_CASH) * 100));
    try {
      const existing = await db(`leaderboard?select=token_hash&email=eq.${encodeURIComponent(em)}`);
      if (existing?.length && existing[0].token_hash !== sha(token)) {
        return res.status(403).json({ error: 'Is email se pehle kisi aur device/browser ne score submit kiya hai.' });
      }
      const taken = await db(`leaderboard?select=email&username=eq.${encodeURIComponent(un)}`);
      if (taken?.length && taken[0].email !== em) return res.status(409).json({ error: 'Yeh username le liya gaya hai.' });

      await db('leaderboard?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          email: em,
          username: un,
          token_hash: sha(token),
          total_value: Math.round(tv),
          return_pct: Number(returnPct.toFixed(2)),
          updated_at: new Date().toISOString(),
        }),
      });
      const better = await db(`leaderboard?select=email&return_pct=gt.${returnPct.toFixed(2)}`);
      res.json({ configured: true, ok: true, rank: (better?.length || 0) + 1 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/digest/status', (_req, res) => res.json({ configured: dbConfigured() && mailConfigured() }));

  router.post('/digest/subscribe', async (req, res) => {
    if (!(dbConfigured() && mailConfigured())) return res.json({ configured: false });
    const { email, token, watchlist, enabled } = req.body || {};
    const em = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return res.status(400).json({ error: 'Valid email daalein.' });
    if (typeof token !== 'string' || token.length < 16) return res.status(400).json({ error: 'Token missing' });
    const list = (Array.isArray(watchlist) ? watchlist : [])
      .filter((w: any) => w && typeof w.symbol === 'string' && /^[A-Za-z0-9.&^ -]{1,20}$/.test(w.symbol))
      .slice(0, 25)
      .map((w: any) => ({ symbol: w.symbol.toUpperCase(), market: ['NSE', 'BSE', 'US', 'INDEX'].includes(w.market) ? w.market : 'NSE' }));
    try {
      const existing = await db(`digest_subscribers?select=token_hash,confirmed&email=eq.${encodeURIComponent(em)}`);
      if (existing?.length && existing[0].token_hash !== sha(token)) {
        return res.status(403).json({ error: 'Is email par pehle kisi aur browser se subscribe kiya gaya hai.' });
      }
      const confirmed = !!existing?.[0]?.confirmed;
      await db('digest_subscribers?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ email: em, token_hash: sha(token), watchlist: list, enabled: enabled !== false, confirmed }),
      });
      // Double opt-in: nobody gets digests until the owner of the mailbox clicks the link.
      if (!confirmed && enabled !== false) {
        const base = (env('APP_URL') || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const link = `${base}/api/digest/confirm?email=${encodeURIComponent(em)}&t=${confirmSig(em)}`;
        await sendMail(
          em,
          'PredictX: daily email confirm karein',
          `<p>PredictX ka daily watchlist email shuru karne ke liye confirm karein:</p><p><a href="${esc(link)}">Confirm karein</a></p><p>Agar yeh aapne nahi maanga, to ignore karein — kuch nahi bheja jayega.</p>`
        );
      }
      res.json({ configured: true, ok: true, count: list.length, needsConfirm: !confirmed && enabled !== false });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/digest/confirm', async (req, res) => {
    const em = String(req.query.email || '').trim().toLowerCase();
    if (!mailConfigured() || !dbConfigured() || !EMAIL_RE.test(em) || !safeEq(String(req.query.t || ''), confirmSig(em))) {
      return res.status(400).send('Invalid link');
    }
    try {
      await db(`digest_subscribers?email=eq.${encodeURIComponent(em)}`, { method: 'PATCH', body: JSON.stringify({ confirmed: true, enabled: true }), headers: { Prefer: 'return=minimal' } });
      res.send('Confirm ho gaya. Ab weekdays subah aapko watchlist email milegi.');
    } catch {
      res.status(500).send('Kuch gadbad hui, baad mein try karein.');
    }
  });

  router.get('/digest/unsubscribe', async (req, res) => {
    const em = String(req.query.email || '').trim().toLowerCase();
    const t = String(req.query.t || '');
    if (!mailConfigured() || !dbConfigured() || !EMAIL_RE.test(em)) return res.status(400).send('Invalid link');
    const expected = Buffer.from(unsubSig(em));
    const got = Buffer.from(t);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return res.status(400).send('Invalid link');
    try {
      await db(`digest_subscribers?email=eq.${encodeURIComponent(em)}`, { method: 'PATCH', body: JSON.stringify({ enabled: false }), headers: { Prefer: 'return=minimal' } });
      res.send('Aap unsubscribe ho gaye. Ab daily email nahi aayegi.');
    } catch {
      res.status(500).send('Kuch gadbad hui, baad mein try karein.');
    }
  });

  router.get('/digest/run', async (req, res) => {
    if (!(dbConfigured() && mailConfigured())) return res.status(503).json({ error: 'Not configured' });
    const auth = String(req.headers.authorization || '');
    const want = Buffer.from(`Bearer ${env('CRON_SECRET')}`);
    const got = Buffer.from(auth);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const subs: Array<{ email: string; watchlist: any[]; last_sent: string | null }> = await db(
        'digest_subscribers?select=email,watchlist,last_sent&enabled=eq.true&confirmed=eq.true&limit=200'
      );
      const { batchQuotes } = await import('./batchQuotes.js');
      let sent = 0;
      let skipped = 0;
      let failed = 0;
      for (const s of subs || []) {
        if (s.last_sent && Date.now() - new Date(s.last_sent).getTime() < 20 * 3600 * 1000) { skipped++; continue; }
        if (!s.watchlist?.length) { skipped++; continue; }
        try {
          const quotes = await batchQuotes(s.watchlist.map((w) => ({ symbol: w.symbol, market: w.market })));
          if (!quotes.length) { skipped++; continue; }
          const r = await fetch(env('RESEND_API_URL') || 'https://api.resend.com/emails', {
            method: 'POST',
            signal: AbortSignal.timeout(8000),
            headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env('RESEND_FROM'),
              to: [s.email],
              subject: 'PredictX: aapki watchlist ka aaj ka haal',
              html: digestHtml(s.email, quotes.map((q) => ({ symbol: q.symbol, market: q.market, price: q.price, changePct: q.changePct }))),
            }),
          });
          if (!r.ok) throw new Error(`Resend ${r.status}`);
          await db(`digest_subscribers?email=eq.${encodeURIComponent(s.email)}`, { method: 'PATCH', body: JSON.stringify({ last_sent: new Date().toISOString() }), headers: { Prefer: 'return=minimal' } });
          sent++;
        } catch {
          failed++;
        }
      }
      res.json({ ok: true, sent, skipped, failed });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
