/**
 * Notification Service for PWA Push Notifications
 * Handles notification permissions and sending trade alerts
 */

export class NotificationService {
  /**
   * Check if notifications are supported
   */
  static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[Notifications] Not supported in this browser');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('[Notifications] Permission denied by user');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[Notifications] Permission:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Send a trade execution notification
   */
  static async sendTradeNotification(trade: {
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    leverage: number;
    mode: 'paper' | 'live';
    positionSize?: number;
  }): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      console.log('[Notifications] Cannot send - permission not granted');
      return;
    }

    const modeIcon = trade.mode === 'live' ? '🔴' : '📄';
    const title = `${modeIcon} ${trade.type} ${trade.symbol}`;
    const body = `Price: $${trade.price.toFixed(2)} | Leverage: ${trade.leverage}x${
      trade.positionSize ? ` | Size: $${trade.positionSize.toFixed(2)}` : ''
    }`;

    try {
      // Use service worker if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          vibrate: [200, 100, 200],
          tag: 'trade-execution',
          requireInteraction: true,
          data: { url: '/', timestamp: Date.now() },
          actions: [
            { action: 'open', title: 'Open App' },
            { action: 'close', title: 'Dismiss' }
          ]
        });
        console.log('[Notifications] Trade notification sent via service worker');
      } else {
        // Fallback to regular notification
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: 'trade-execution'
        });
        console.log('[Notifications] Trade notification sent (fallback)');
      }
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }

  /**
   * Send a trade closed notification (TP/SL hit)
   */
  static async sendTradeClosedNotification(trade: {
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    outcome: 'WIN' | 'LOSS';
  }): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    const outcomeIcon = trade.outcome === 'WIN' ? '✅' : '❌';
    const outcomeText = trade.outcome === 'WIN' ? 'PROFIT' : 'LOSS';
    const title = `${outcomeIcon} ${outcomeText}: ${trade.symbol}`;
    const body = `Entry: $${trade.entryPrice.toFixed(2)} → Exit: $${trade.exitPrice.toFixed(2)}\nPNL: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%)`;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          vibrate: trade.outcome === 'WIN' ? [200, 100, 200, 100, 200] : [400],
          tag: 'trade-closed',
          requireInteraction: true,
          data: { url: '/' }
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
      console.log('[Notifications] Trade closed notification sent');
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }

  /**
   * Send a high confidence signal notification
   */
  static async sendSignalNotification(signal: {
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    confidence: number;
  }): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    const title = `🎯 High Confidence Signal`;
    const body = `${signal.symbol}: ${signal.type} at $${signal.price.toFixed(2)}\nConfidence: ${signal.confidence}%`;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          vibrate: [100, 50, 100],
          tag: 'signal-alert',
          data: { url: '/' }
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }
}
