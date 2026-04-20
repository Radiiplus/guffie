/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { api, type SessionUserPublic } from "@/lib/api";

const SESSION_USER_STORAGE_KEY = "guffie:session:user";

export interface SessionUserView extends SessionUserPublic {
  initials: string;
}

interface SessionUserContextValue {
  user: SessionUserView | null;
  loading: boolean;
  refreshSessionUser: () => Promise<SessionUserView | null>;
  setSessionUser: (user: SessionUserPublic) => void;
  updateUser: (patch: Partial<SessionUserPublic>) => void;
  clearSessionUser: () => void;
}

const SessionUserContext = React.createContext<SessionUserContextValue | null>(null);

const computeInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const toSessionUserView = (user: SessionUserPublic): SessionUserView => ({
  fullName: user.fullName,
  username: user.username,
  country: user.country ?? null,
  createdAt: user.createdAt,
  avatarUrl: user.avatarUrl ?? null,
  initials: computeInitials(user.fullName),
});

const readCachedUser = (): SessionUserView | null => {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUserView> & Record<string, unknown>;
    if (!parsed?.username || !parsed?.fullName || !parsed?.createdAt) return null;
    return {
      fullName: String(parsed.fullName),
      username: String(parsed.username),
      country: parsed.country == null ? null : String(parsed.country),
      createdAt: String(parsed.createdAt),
      avatarUrl: parsed.avatarUrl == null ? null : String(parsed.avatarUrl),
      initials: parsed.initials ? String(parsed.initials) : computeInitials(String(parsed.fullName)),
    };
  } catch {
    return null;
  }
};

const writeCachedUser = (user: SessionUserView | null) => {
  if (typeof window === "undefined") return;
  if (!user) {
    window.sessionStorage.removeItem(SESSION_USER_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user));
};

export function SessionUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUserView | null>(() => readCachedUser());
  const [loading, setLoading] = React.useState(false);

  const refreshSessionUser = React.useCallback(async () => {
    setLoading(true);
    try {
      const session = await api.validateSession();
      if (!session.valid || !session.user) {
        setUser(null);
        writeCachedUser(null);
        return null;
      }

      const nextUser = toSessionUserView(session.user);
      setUser(nextUser);
      writeCachedUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const setSessionUser = React.useCallback((nextUser: SessionUserPublic) => {
    const userWithInitials = toSessionUserView(nextUser);
    setUser(userWithInitials);
    writeCachedUser(userWithInitials);
  }, []);

  const updateUser = React.useCallback((patch: Partial<SessionUserPublic>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged: SessionUserPublic = {
        fullName: patch.fullName ?? prev.fullName,
        username: patch.username ?? prev.username,
        country: patch.country ?? prev.country,
        createdAt: patch.createdAt ?? prev.createdAt,
        avatarUrl: patch.avatarUrl ?? prev.avatarUrl ?? null,
      };
      const next = toSessionUserView(merged);
      writeCachedUser(next);
      return next;
    });
  }, []);

  const clearSessionUser = React.useCallback(() => {
    setUser(null);
    writeCachedUser(null);
  }, []);

  React.useEffect(() => {
    // Central policy:
    // use cached session user for immediate paint, then always refresh from backend
    // so fields like avatarUrl stay current.
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
    }
    refreshSessionUser().catch(() => {
      // Keep cached/null state on failure.
    });
  }, [refreshSessionUser]);

  const value = React.useMemo<SessionUserContextValue>(
    () => ({ user, loading, refreshSessionUser, setSessionUser, updateUser, clearSessionUser }),
    [user, loading, refreshSessionUser, setSessionUser, updateUser, clearSessionUser]
  );

  return <SessionUserContext.Provider value={value}>{children}</SessionUserContext.Provider>;
}

export const useSessionUser = () => {
  const ctx = React.useContext(SessionUserContext);
  if (!ctx) {
    throw new Error("useSessionUser must be used within SessionUserProvider");
  }
  return ctx;
};
