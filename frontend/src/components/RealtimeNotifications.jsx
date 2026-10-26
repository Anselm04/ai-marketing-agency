import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { X, Wifi, WifiOff, Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';

function NotificationItem({ notification, onDismiss }) {
  const icons = {
    info: <Info className="w-4 h-4 text-blue-500" />,
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    error: <AlertTriangle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm animate-in slide-in-from-right">
      <div className="mt-0.5 shrink-0">{icons[notification.type || 'info']}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{notification.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ConnectionStatus() {
  const { connected } = useSocket();
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      {connected ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-green-500" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-gray-400" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}

export function NotificationBell() {
  const { notifications, clearNotifications, dismissNotification, connected } = useSocket();
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Notifications</span>
            <div className="flex items-center gap-2">
              <ConnectionStatus />
              <button
                onClick={clearNotifications}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                {connected ? 'No new notifications' : 'Connect to see live notifications'}
              </p>
            ) : (
              notifications.map((n, i) => (
                <NotificationItem
                  key={n.id || n.createdAt || i}
                  notification={n}
                  onDismiss={() => dismissNotification(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
