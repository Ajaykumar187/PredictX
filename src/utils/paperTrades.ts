export interface PaperOrder {
  id: string;
  time: string;
  underlying: string;
  expiry: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
}
export interface PaperPosition {
  key: string;
  underlying: string;
  expiry: string;
  strike: number;
  type: 'CE' | 'PE';
  qty: number; 
  avg: number;
  realized: number;
}

import { userKey } from './storage';
const KEY_BASE = 'predictx_paper_option_orders';
const keyNow = () => userKey(KEY_BASE);
const EVT = 'predictx_paper_orders_updated';

export function getOrders(): PaperOrder[] {
  try {
    return JSON.parse(localStorage.getItem(keyNow()) || '[]');
  } catch {
    return [];
  }
}

export function placeOrders(orders: Omit<PaperOrder, 'id' | 'time'>[]) {
  const all = getOrders();
  const now = new Date().toISOString();
  orders.forEach((o, i) => all.push({ ...o, id: `${Date.now()}_${i}`, time: now }));
  try {
    localStorage.setItem(keyNow(), JSON.stringify(all.slice(-300)));
  } catch {  }
  window.dispatchEvent(new Event(EVT));
}

export function clearOrders() {
  try {
    localStorage.removeItem(keyNow());
  } catch { }
  window.dispatchEvent(new Event(EVT));
}

export function subscribeOrders(cb: () => void) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

export function derivePositions(orders: PaperOrder[]): PaperPosition[] {
  const map = new Map<string, PaperPosition>();
  for (const o of orders) {
    const key = `${o.underlying}|${o.expiry}|${o.strike}|${o.type}`;
    const p = map.get(key) || { key, underlying: o.underlying, expiry: o.expiry, strike: o.strike, type: o.type, qty: 0, avg: 0, realized: 0 };
    const signed = o.action === 'BUY' ? o.qty : -o.qty;
    if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed)) {
      const total = Math.abs(p.qty) + o.qty;
      p.avg = (p.avg * Math.abs(p.qty) + o.price * o.qty) / total;
      p.qty += signed;
    } else {
      const closing = Math.min(Math.abs(p.qty), o.qty);
      p.realized += (p.qty > 0 ? o.price - p.avg : p.avg - o.price) * closing;
      const remaining = o.qty - closing;
      p.qty += signed;
      if (p.qty === 0) p.avg = 0;
      else if (remaining > 0) p.avg = o.price;
    }
    map.set(key, p);
  }
  return [...map.values()];
}
