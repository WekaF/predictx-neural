/**
 * Extended Notification API types
 * Adds support for properties not in the standard TypeScript definitions
 */

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface NotificationOptions {
  vibrate?: number | number[];
  actions?: NotificationAction[];
}
