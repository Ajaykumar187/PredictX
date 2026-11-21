import app from '../src/server/app.js';

export default function handler(req: any, res: any) {
  const isVercel = !!process.env.VERCEL;
  console.log(`[PredictX Vercel Entry] >>> Incoming HTTP ${req.method} ${req.url} (isVercel=${isVercel})`);

  if (req.query && req.query.__path) {
    const rawPath = req.query.__path as string;
    delete req.query.__path;
    const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const searchParams = new URLSearchParams(req.query);
    const qs = searchParams.toString();
    const rewritten = `/api${cleanPath}${qs ? `?${qs}` : ''}`;
    console.log(`[PredictX Vercel Entry] Rewriting URL from "${req.url}" to "${rewritten}"`);
    req.url = rewritten;
  } else if (req.headers && req.headers['x-matched-path'] && (req.url === '/api' || req.url === '/')) {
    const matched = req.headers['x-matched-path'];
    console.log(`[PredictX Vercel Entry] Normalizing URL using x-matched-path: "${matched}"`);
    req.url = matched;
  }

  return app(req, res);
}
