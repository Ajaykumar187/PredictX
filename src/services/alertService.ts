import { MarketType, PriceAlert } from '../types';
import { storage } from '../utils/storage';
import { fetchBatchStockQuotes } from '../utils/stockApi';

export interface TriggeredAlertEvent {
  id: string;
  alertId: string;
  symbol: string;
  market: MarketType;
  alertType: 'price' | 'dividend_yield';
  targetValue: number;
  currentValue: number;
  direction: 'above' | 'below';
  currencySymbol: string;
  timestamp: string;
  title: string;
  message: string;
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const NOTIF_HISTORY_KEY = 'predictx_notification_history';
const NOTIF_SOUND_KEY = 'predictx_sound_enabled';
const NOTIF_BROWSER_KEY = 'predictx_browser_notifs_enabled';

class AlertService {
  private pollingTimer: any = null;
  private isPolling = false;
  private pollingIntervalMs = 60 * 1000; // 60s default
  private listeners: Array<(event: TriggeredAlertEvent) => void> = [];

  constructor() {
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        this.setBrowserNotificationsEnabled(true);
      }
      return res;
    } catch (err) {
      console.warn('[AlertService] Error requesting notification permission:', err);
      return this.getPermissionStatus();
    }
  }

  public isBrowserNotificationsEnabled(): boolean {
    if (!this.isSupported() || this.getPermissionStatus() !== 'granted') return false;
    const pref = localStorage.getItem(NOTIF_BROWSER_KEY);
    return pref !== null ? pref === 'true' : true;
  }

  public setBrowserNotificationsEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(NOTIF_BROWSER_KEY, String(enabled));
    } catch {}
  }

  public isSoundEnabled(): boolean {
    const pref = localStorage.getItem(NOTIF_SOUND_KEY);
    return pref !== null ? pref === 'true' : true;
  }

  public setSoundEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(NOTIF_SOUND_KEY, String(enabled));
    } catch {}
  }

  public playAlertSound(): void {
    if (!this.isSoundEnabled() || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25);
      gain2.gain.setValueAtTime(0.18, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.65);
    } catch (err) {
      console.debug('[AlertService] Audio playback skipped (browser autoplay policy):', err);
    }
  }

  public dispatchNotification(event: TriggeredAlertEvent): void {
    this.playAlertSound();

    if (this.isBrowserNotificationsEnabled()) {
      try {
        const notif = new Notification(event.title, {
          body: event.message,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2300BCD4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
          tag: `predictx-alert-${event.alertId}`,
        });

        notif.onclick = () => {
          window.focus();
          window.location.hash = '#alerts';
          notif.close();
        };
      } catch (e) {
        console.warn('[AlertService] Native notification failed:', e);
      }
    }

    this.addNotificationHistory(event);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('predictx_alert_triggered', {
          detail: event,
        })
      );
    }

    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[AlertService] Listener error:', err);
      }
    });
  }

  public evaluateAlert(
    alert: PriceAlert,
    currentVal: number
  ): { isMet: boolean; reason: string } {
    if (currentVal === undefined || isNaN(currentVal) || currentVal <= 0) {
      return { isMet: false, reason: 'Invalid or missing current price/yield' };
    }

    if (alert.alertType === 'dividend_yield') {
      const target = alert.targetYield ?? 2.0;
      const isMet = alert.direction === 'above' ? currentVal >= target : currentVal <= target;
      return {
        isMet,
        reason: `${alert.symbol} yield is ${currentVal}% (target: ${alert.direction} ${target}%)`,
      };
    }

    const target = alert.targetPrice;
    const isMet = alert.direction === 'above' ? currentVal >= target : currentVal <= target;
    const curSym = alert.market === 'US' ? '$' : '₹';
    return {
      isMet,
      reason: `${alert.symbol} price is ${curSym}${currentVal.toLocaleString()} (target: ${alert.direction} ${curSym}${target.toLocaleString()})`,
    };
  }

  public checkPrice(
    symbol: string,
    market: MarketType,
    currentPrice: number
  ): TriggeredAlertEvent[] {
    if (!symbol || !currentPrice || currentPrice <= 0) return [];
    const cleanSym = symbol.toUpperCase().trim();
    const alerts = storage.getAlerts();
    const triggeredEvents: TriggeredAlertEvent[] = [];
    let stateChanged = false;

    const updatedAlerts = alerts.map((al) => {
      const matchSymbol = al.symbol.toUpperCase().trim() === cleanSym;
      const matchMarket = !al.market || al.market === market;

      if (matchSymbol && matchMarket && !al.triggered && al.alertType !== 'dividend_yield') {
        const { isMet } = this.evaluateAlert(al, currentPrice);
        if (isMet) {
          const curSym = al.market === 'US' ? '$' : '₹';
          const dirText = al.direction === 'above' ? 'crossed above' : 'dropped below';
          const event: TriggeredAlertEvent = {
            id: `trig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            alertId: al.id,
            symbol: al.symbol,
            market: al.market,
            alertType: 'price',
            targetValue: al.targetPrice,
            currentValue: currentPrice,
            direction: al.direction,
            currencySymbol: curSym,
            timestamp: new Date().toISOString(),
            title: `🎯 Price Alert: ${al.symbol} Hit Target!`,
            message: `${al.symbol} has ${dirText} your target of ${curSym}${al.targetPrice.toLocaleString()}! Current price: ${curSym}${currentPrice.toLocaleString()}`,
          };

          triggeredEvents.push(event);
          stateChanged = true;
          return {
            ...al,
            triggered: true,
            triggeredAt: new Date().toISOString(),
            triggeredPrice: currentPrice,
          };
        }
      }
      return al;
    });

    if (stateChanged) {
      storage.saveAlerts(updatedAlerts);
      window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));
      triggeredEvents.forEach((ev) => this.dispatchNotification(ev));
    }

    return triggeredEvents;
  }

  public async evaluateAllAlerts(
    customQuotes?: Record<string, { price: number; change?: number; changePct?: number }>
  ): Promise<TriggeredAlertEvent[]> {
    const alerts = storage.getAlerts();
    if (alerts.length === 0) return [];

    let quotes = customQuotes;
    if (!quotes) {
      const activeAlerts = alerts.filter((a) => !a.triggered && a.alertType !== 'dividend_yield');
      if (activeAlerts.length === 0) return [];

      quotes = await fetchBatchStockQuotes(
        activeAlerts.map((a) => ({ symbol: a.symbol, market: a.market }))
      );
    }

    const triggeredEvents: TriggeredAlertEvent[] = [];
    let stateChanged = false;

    const updatedAlerts = alerts.map((al) => {
      if (al.triggered) return al;

      if (al.alertType === 'dividend_yield') {
        return al;
      }

      const quote = quotes?.[al.symbol.toUpperCase()];
      if (!quote || quote.price === undefined || quote.price <= 0) return al;

      const { isMet } = this.evaluateAlert(al, quote.price);
      if (isMet) {
        const curSym = al.market === 'US' ? '$' : '₹';
        const dirText = al.direction === 'above' ? 'crossed above' : 'dropped below';
        const event: TriggeredAlertEvent = {
          id: `trig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          alertId: al.id,
          symbol: al.symbol,
          market: al.market,
          alertType: 'price',
          targetValue: al.targetPrice,
          currentValue: quote.price,
          direction: al.direction,
          currencySymbol: curSym,
          timestamp: new Date().toISOString(),
          title: `🎯 Price Alert: ${al.symbol} Hit Target!`,
          message: `${al.symbol} has ${dirText} your target of ${curSym}${al.targetPrice.toLocaleString()}! Live price: ${curSym}${quote.price.toLocaleString()}`,
        };

        triggeredEvents.push(event);
        stateChanged = true;
        return {
          ...al,
          triggered: true,
          triggeredAt: new Date().toISOString(),
          triggeredPrice: quote.price,
        };
      }

      return al;
    });

    if (stateChanged) {
      storage.saveAlerts(updatedAlerts);
      window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));
      triggeredEvents.forEach((ev) => this.dispatchNotification(ev));
    }

    return triggeredEvents;
  }

  public rearmAlert(alertId: string, newTargetPrice?: number): boolean {
    const alerts = storage.getAlerts();
    let updated = false;

    const modified = alerts.map((al) => {
      if (al.id === alertId) {
        updated = true;
        return {
          ...al,
          triggered: false,
          triggeredAt: undefined,
          triggeredPrice: undefined,
          targetPrice: newTargetPrice !== undefined ? newTargetPrice : al.targetPrice,
        };
      }
      return al;
    });

    if (updated) {
      storage.saveAlerts(modified);
      window.dispatchEvent(new CustomEvent('predictx_alerts_updated'));
    }
    return updated;
  }

  public startPolling(intervalMs: number = this.pollingIntervalMs): void {
    if (this.isPolling) return;
    this.pollingIntervalMs = intervalMs;
    this.isPolling = true;

    setTimeout(() => {
      if (this.isPolling) {
        this.evaluateAllAlerts().catch((err) =>
          console.debug('[AlertService] Background poll check skipped:', err)
        );
      }
    }, 5000);

    this.pollingTimer = setInterval(() => {
      this.evaluateAllAlerts().catch((err) =>
        console.debug('[AlertService] Background poll error:', err)
      );
    }, this.pollingIntervalMs);

    console.log(`[AlertService] Polling service started (interval: ${this.pollingIntervalMs / 1000}s)`);
  }

  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
    console.log('[AlertService] Polling service stopped');
  }

  public isPollingActive(): boolean {
    return this.isPolling;
  }

  public getNotificationHistory(): TriggeredAlertEvent[] {
    try {
      const raw = localStorage.getItem(NOTIF_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addNotificationHistory(event: TriggeredAlertEvent): void {
    try {
      const history = this.getNotificationHistory();
      const updated = [event, ...history].slice(0, 50); // Keep last 50 events
      localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  }

  public clearNotificationHistory(): void {
    try {
      localStorage.removeItem(NOTIF_HISTORY_KEY);
    } catch {}
  }

  public dismissNotificationFromHistory(id: string): void {
    try {
      const history = this.getNotificationHistory().filter((h) => h.id !== id);
      localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }


  public subscribe(callback: (event: TriggeredAlertEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public sendTestNotification(): void {
    const testEvent: TriggeredAlertEvent = {
      id: `test-${Date.now()}`,
      alertId: 'test-alert',
      symbol: 'TEST.SAMPLE',
      market: 'NSE',
      alertType: 'price',
      targetValue: 2500,
      currentValue: 2515.5,
      direction: 'above',
      currencySymbol: '₹',
      timestamp: new Date().toISOString(),
      title: '🔔 PredictX Test Notification',
      message: 'Threshold monitoring is active! You will receive push notifications and alerts when stock prices hit your targets.',
    };
    this.dispatchNotification(testEvent);
  }
}

export const alertService = new AlertService();
