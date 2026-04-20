/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { useSessionUser } from "@/lib/session";

interface NotificationStateContextValue {
  unreadCount: number;
  locallyReadIds: Set<string>;
  setUnreadCountFromServer: (count: number) => void;
  markAsReadLocal: (id: string) => void;
  markAllAsReadLocal: () => void;
  clearLocalRead: (id: string) => void;
  resetState: () => void;
}

const NotificationStateContext = React.createContext<NotificationStateContextValue | null>(null);

export function NotificationStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSessionUser();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [locallyReadIds, setLocallyReadIds] = React.useState<Set<string>>(new Set());

  const setUnreadCountFromServer = React.useCallback((count: number) => {
    setUnreadCount(Math.max(0, count));
  }, []);

  const markAsReadLocal = React.useCallback((id: string) => {
    setLocallyReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsReadLocal = React.useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearLocalRead = React.useCallback((id: string) => {
    setLocallyReadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const resetState = React.useCallback(() => {
    setUnreadCount(0);
    setLocallyReadIds(new Set());
  }, []);

  React.useEffect(() => {
    if (!user) {
      resetState();
    } else {
      setLocallyReadIds(new Set());
    }
  }, [user?.username, resetState]);

  const value = React.useMemo<NotificationStateContextValue>(
    () => ({
      unreadCount,
      locallyReadIds,
      setUnreadCountFromServer,
      markAsReadLocal,
      markAllAsReadLocal,
      clearLocalRead,
      resetState,
    }),
    [unreadCount, locallyReadIds, setUnreadCountFromServer, markAsReadLocal, markAllAsReadLocal, clearLocalRead, resetState]
  );

  return <NotificationStateContext.Provider value={value}>{children}</NotificationStateContext.Provider>;
}

export const useNotificationState = () => {
  const ctx = React.useContext(NotificationStateContext);
  if (!ctx) {
    throw new Error("useNotificationState must be used within NotificationStateProvider");
  }
  return ctx;
};

