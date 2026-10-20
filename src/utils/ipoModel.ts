export interface IPOSample {
  gmpPct: number;
  subX?: number;
  qibX?: number;
  issueSizeCr?: number;
  hot?: boolean;
  weak?: boolean;
  actualGainPct?: number;
  name?: string;
}

export const FEATURES = ['bias', 'gmpPct', 'lnSub', 'lnQib', 'lnSize', 'sector'] as const;
export const PRIOR_W = [0, 0.85, 1.2, 0.6, -0.8, 2.0];

const REF_SUB = Math.log(4);
const REF_QIB = Math.log(4);
const REF_SIZE = Math.log(1000);

export function featurize(s: IPOSample): number[] {
  return [
    1,
    s.gmpPct,
    s.subX && s.subX > 0 ? Math.log(1 + s.subX) - REF_SUB : 0,
    s.qibX && s.qibX > 0 ? Math.log(1 + s.qibX) - REF_QIB : 0,
    s.issueSizeCr && s.issueSizeCr > 0 ? Math.log(s.issueSizeCr) - REF_SIZE : 0,
    s.hot ? 1 : s.weak ? -1 : 0,
  ];
}

const dot = (a: number[], b: number[]) => a.reduce((t, v, i) => t + v * b[i], 0);

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r) => r[n]);
}

export function fit(samples: IPOSample[], lambda = 30): number[] {
  const rows = samples.filter((s) => Number.isFinite(s.actualGainPct) && Number.isFinite(s.gmpPct));
  if (!rows.length) return [...PRIOR_W];
  const p = PRIOR_W.length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? lambda : 0)));
  const b = PRIOR_W.map((w) => lambda * w);
  for (const s of rows) {
    const x = featurize(s);
    for (let i = 0; i < p; i++) {
      b[i] += x[i] * s.actualGainPct!;
      for (let j = 0; j < p; j++) A[i][j] += x[i] * x[j];
    }
  }
  return solve(A, b);
}

export interface ModelReport {
  weights: number[];
  n: number;
  trained: boolean;
  mae: number | null;          
  priorMae: number | null;     
  directionAcc: number | null; 
  sigma: number;               
}

export function trainReport(samples: IPOSample[]): ModelReport {
  const rows = samples.filter((s) => Number.isFinite(s.actualGainPct) && Number.isFinite(s.gmpPct));
  const weights = fit(rows);
  if (rows.length < 3) {
    return { weights, n: rows.length, trained: rows.length > 0, mae: null, priorMae: null, directionAcc: null, sigma: 8 };
  }
  let err = 0, perr = 0, hit = 0;
  rows.forEach((s, i) => {
    const w = fit(rows.filter((_, j) => j !== i));
    const pred = dot(w, featurize(s));
    err += Math.abs(pred - s.actualGainPct!);
    perr += Math.abs(dot(PRIOR_W, featurize(s)) - s.actualGainPct!);
    if (Math.sign(pred) === Math.sign(s.actualGainPct!) || (Math.abs(pred) < 1 && Math.abs(s.actualGainPct!) < 1)) hit++;
  });
  const mae = err / rows.length;
  return { weights, n: rows.length, trained: true, mae, priorMae: perr / rows.length, directionAcc: (hit / rows.length) * 100, sigma: Math.max(4, mae * 1.25) };
}

export function predictGain(s: IPOSample, report: ModelReport) {
  const raw = dot(report.weights, featurize(s));
  const gain = Math.max(-40, Math.min(150, raw));
  return { gain, low: gain - report.sigma, high: gain + report.sigma };
}
