"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Megaphone } from "lucide-react";
import { endpoints } from "@/lib/config";

type BannerLevel = "info" | "warning" | "critical";
type ActiveBanner = {
  id: string;
  message: string;
  level: BannerLevel;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  createdAt: string;
};

const levelStyles: Record<BannerLevel, { icon: any; className: string }> = {
  info: {
    icon: Info,
    className: "bg-blue-500/20 border-blue-400/40 text-blue-100",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-amber-500/20 border-amber-400/50 text-amber-100",
  },
  critical: {
    icon: Megaphone,
    className: "bg-rose-600/30 border-rose-400/60 text-rose-50",
  },
};

export function GlobalBanner() {
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(endpoints.activeBanner, { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as { active: boolean; banner: ActiveBanner | null };
        if (cancelled) return;
        if (!payload.active || !payload.banner) {
          setBanner(null);
          return;
        }
        setBanner(payload.banner);
      } catch {
        // Ignore transient banner fetch failures.
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 30000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    if (dismissedId && dismissedId !== banner.id) {
      setDismissedId(null);
    }
  }, [banner?.id]);

  const visible = banner && banner.id !== dismissedId;
  const style = useMemo(() => {
    if (!banner) return levelStyles.info;
    return levelStyles[banner.level] || levelStyles.info;
  }, [banner?.level]);

  if (!visible || !banner) return null;

  const Icon = style.icon;

  return (
    <div className={`sticky top-0 z-[120] border-b px-4 py-3 ${style.className}`}>
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm font-medium leading-relaxed">{banner.message}</p>
        <button
          onClick={() => setDismissedId(banner.id)}
          className="ml-auto text-xs font-semibold uppercase tracking-wide opacity-80 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
