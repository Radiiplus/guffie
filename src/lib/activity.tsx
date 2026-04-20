import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { PulseLens } from "@/lib/Telemetry/attention";
import { NodePrint } from "@/lib/Telemetry/device";
import { RuntimeGauge } from "@/lib/Telemetry/performance";
import { FocusGate } from "@/lib/Telemetry/visibility";

type MetricPoint = {
  count: number;
  totalMs: number;
};

type AggregateRecord = {
  startedAt: number;
  updatedAt: number;
  metrics: Record<string, MetricPoint>;
};

type AttentionSnapshot = {
  activeTimeMs: number;
  scrollDistancePx: number;
  scrollStops: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  pageViews: number;
};

type VisibilitySnapshot = {
  visibleTimeMs: number;
  hiddenTimeMs: number;
  visibilityChanges: number;
};

const DB_NAME = "guffi-activity";
const DB_VERSION = 1;
const STORE_NAME = "aggregate";
const RECORD_KEY = "weekly";
const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;
const FLUSH_CHECK_INTERVAL_MS = 60 * 1000;

const ROUTE_STATIC_SET = new Set([
  "",
  "login",
  "register",
  "reset",
  "create",
  "a",
  "p",
  "chat",
  "n",
  "settings",
]);

const nowRecord = (): AggregateRecord => ({
  startedAt: Date.now(),
  updatedAt: Date.now(),
  metrics: {},
});

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });

const readAggregate = async (): Promise<AggregateRecord | null> => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        const raw = req.result as AggregateRecord | undefined;
        if (!raw || typeof raw !== "object") {
          resolve(null);
          return;
        }
        if (!raw.metrics || typeof raw.metrics !== "object") {
          resolve(null);
          return;
        }
        resolve(raw);
      };
      req.onerror = () => reject(req.error || new Error("Failed to read IndexedDB aggregate"));
    });
  } finally {
    db.close();
  }
};

const writeAggregate = async (record: AggregateRecord): Promise<void> => {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to write IndexedDB aggregate"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
    });
  } finally {
    db.close();
  }
};

const normalizePathname = (pathname: string): string => {
  const clean = (pathname || "/").split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return "/";

  if (parts[0] === "p") {
    if (parts.length >= 5 && parts[2] === "c" && parts[4] === "r") return "/p/:postId/c/:commentId/r/:replyId";
    if (parts.length >= 3 && parts[2] === "c") return "/p/:postId/c/:commentId";
    return "/p/:postId";
  }
  if (parts[0] === "a") {
    if (parts.length >= 5 && parts[2] === "c" && parts[4] === "r") return "/a/:postId/c/:commentId/r/:replyId";
    if (parts.length >= 3 && parts[2] === "c") return "/a/:postId/c/:commentId";
    if (parts.length >= 2) return "/a/:postId";
    return "/a";
  }
  if (parts[0] === "n") {
    if (parts.length >= 2) return "/n/:id";
    return "/n";
  }
  if (parts.length === 1 && !ROUTE_STATIC_SET.has(parts[0])) {
    return "/:username";
  }
  return clean;
};

const metricKey = (group: "route:view" | "route:active", value: string) => `${group}:${value}`;

const slugValue = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";

export const useActivityTracker = (isAuthenticated: boolean) => {
  const location = useLocation();
  const aggregateRef = useRef<AggregateRecord>(nowRecord());
  const loadedRef = useRef(false);
  const pendingRef = useRef<Array<{ key: string; count: number; totalMs: number }>>([]);
  const persistTimerRef = useRef<number | null>(null);
  const flushIntervalRef = useRef<number | null>(null);
  const flushInFlightRef = useRef(false);
  const activeRouteRef = useRef<string>("/");
  const activeStartPerfRef = useRef<number | null>(null);
  const attentionRef = useRef<PulseLens | null>(null);
  const visibilityRef = useRef<FocusGate | null>(null);
  const performanceRef = useRef<RuntimeGauge | null>(null);
  const deviceRef = useRef<NodePrint | null>(null);
  const behaviorIngestIntervalRef = useRef<number | null>(null);
  const lastAttentionRef = useRef<AttentionSnapshot>({
    activeTimeMs: 0,
    scrollDistancePx: 0,
    scrollStops: 0,
    keyPresses: 0,
    mouseClicks: 0,
    mouseMoves: 0,
    pageViews: 0,
  });
  const lastVisibilityRef = useRef<VisibilitySnapshot>({
    visibleTimeMs: 0,
    hiddenTimeMs: 0,
    visibilityChanges: 0,
  });
  const lastContentSignalsRef = useRef<Record<string, { viewed: number; interacted: number; scrollStops: number; totalVisibleTimeMs: number }>>({});
  const performanceCapturedRef = useRef(false);
  const deviceCapturedRef = useRef(false);

  const applyMetric = useCallback((key: string, count: number, totalMs: number) => {
    const rec = aggregateRef.current;
    if (!rec.metrics[key]) rec.metrics[key] = { count: 0, totalMs: 0 };
    rec.metrics[key].count += count;
    rec.metrics[key].totalMs += totalMs;
    rec.updatedAt = Date.now();
  }, []);

  const schedulePersist = useCallback(() => {
    if (!loadedRef.current) return;
    if (persistTimerRef.current !== null) return;
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const snapshot = aggregateRef.current;
      void writeAggregate(snapshot).catch((error) => {
        console.error("Activity persist failed:", error);
      });
    }, 1000);
  }, []);

  const trackMetric = useCallback((key: string, count = 1, totalMs = 0) => {
    if (!loadedRef.current) {
      pendingRef.current.push({ key, count, totalMs });
      return;
    }
    applyMetric(key, count, totalMs);
    schedulePersist();
  }, [applyMetric, schedulePersist]);

  const stopActiveTimer = useCallback(() => {
    const started = activeStartPerfRef.current;
    if (started == null) return;
    const delta = Math.max(0, Math.round(performance.now() - started));
    activeStartPerfRef.current = null;
    if (delta > 0) {
      trackMetric(metricKey("route:active", activeRouteRef.current), 1, delta);
    }
  }, [trackMetric]);

  const startActiveTimer = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    if (activeStartPerfRef.current != null) return;
    activeStartPerfRef.current = performance.now();
  }, []);

  const captureDeviceOnce = useCallback(async () => {
    if (deviceCapturedRef.current) return;
    if (!deviceRef.current) return;
    try {
      const device = await deviceRef.current.capture();
      trackMetric("device.capture", 1, 0);
      trackMetric("device.screen.width", Math.max(0, Math.floor(device.screen.width || 0)), 0);
      trackMetric("device.screen.height", Math.max(0, Math.floor(device.screen.height || 0)), 0);
      trackMetric("device.screen.dpr_x100", Math.max(0, Math.round((device.screen.dpr || 0) * 100)), 0);
      trackMetric("device.viewport.width", Math.max(0, Math.floor(device.viewport.width || 0)), 0);
      trackMetric("device.viewport.height", Math.max(0, Math.floor(device.viewport.height || 0)), 0);
      trackMetric("device.hardware.cores", Math.max(0, Math.floor(device.hardware.cores || 0)), 0);
      if (typeof device.hardware.memoryGB === "number") {
        trackMetric("device.hardware.memory_gb_x10", Math.max(0, Math.round(device.hardware.memoryGB * 10)), 0);
      }
      if (typeof device.connection.downlink === "number") {
        trackMetric("device.connection.downlink_x10", Math.max(0, Math.round(device.connection.downlink * 10)), 0);
      }
      if (typeof device.connection.rtt === "number") {
        trackMetric("device.connection.rtt_ms", Math.max(0, Math.round(device.connection.rtt)), 0);
      }
      if (typeof device.battery === "number") {
        trackMetric("device.battery_pct", Math.max(0, Math.round(device.battery * 100)), 0);
      }
      trackMetric(`device.lang:${slugValue(device.language || "unknown")}`, 1, 0);
      trackMetric(`device.tz:${slugValue(device.timezone || "unknown")}`, 1, 0);
      if (device.connection.effective) {
        trackMetric(`device.net.effective:${slugValue(device.connection.effective)}`, 1, 0);
      }
      if (device.connection.type) {
        trackMetric(`device.net.type:${slugValue(device.connection.type)}`, 1, 0);
      }
      if (device.connection.saveData) {
        trackMetric("device.net.save_data", 1, 0);
      }
      if (device.touch) {
        trackMetric("device.touch", 1, 0);
      }
      deviceCapturedRef.current = true;
    } catch (error) {
      console.error("Device capture failed:", error);
    }
  }, [trackMetric]);

  const capturePerformanceOnce = useCallback(() => {
    if (performanceCapturedRef.current) return;
    if (!performanceRef.current) return;
    try {
      const perf = performanceRef.current.getAggregates();
      if (perf.loadTimeMs > 0) trackMetric("perf.load_event", 1, perf.loadTimeMs);
      if (perf.domInteractiveMs > 0) trackMetric("perf.dom_interactive", 1, perf.domInteractiveMs);
      if (perf.firstContentfulPaintMs > 0) trackMetric("perf.fcp", 1, perf.firstContentfulPaintMs);
      if (perf.longTaskCount > 0) trackMetric("perf.long_tasks", perf.longTaskCount, 0);
      if (perf.resourceCount > 0) trackMetric("perf.resources", perf.resourceCount, 0);
      performanceCapturedRef.current = true;
    } catch (error) {
      console.error("Performance capture failed:", error);
    }
  }, [trackMetric]);

  const ingestBehaviorDeltas = useCallback(() => {
    const attention = attentionRef.current;
    const visibility = visibilityRef.current;
    if (!attention || !visibility) return;

    const attentionNow = attention.getAggregates();
    const attentionPrev = lastAttentionRef.current;
    const attentionDelta: AttentionSnapshot = {
      activeTimeMs: Math.max(0, attentionNow.activeTimeMs - attentionPrev.activeTimeMs),
      scrollDistancePx: Math.max(0, Math.round(attentionNow.scrollDistancePx - attentionPrev.scrollDistancePx)),
      scrollStops: Math.max(0, attentionNow.scrollStops - attentionPrev.scrollStops),
      keyPresses: Math.max(0, attentionNow.keyPresses - attentionPrev.keyPresses),
      mouseClicks: Math.max(0, attentionNow.mouseClicks - attentionPrev.mouseClicks),
      mouseMoves: Math.max(0, attentionNow.mouseMoves - attentionPrev.mouseMoves),
      pageViews: Math.max(0, attentionNow.pageViews - attentionPrev.pageViews),
    };
    lastAttentionRef.current = {
      activeTimeMs: attentionNow.activeTimeMs,
      scrollDistancePx: attentionNow.scrollDistancePx,
      scrollStops: attentionNow.scrollStops,
      keyPresses: attentionNow.keyPresses,
      mouseClicks: attentionNow.mouseClicks,
      mouseMoves: attentionNow.mouseMoves,
      pageViews: attentionNow.pageViews,
    };

    if (attentionDelta.activeTimeMs > 0) trackMetric("attention.active_time", 1, attentionDelta.activeTimeMs);
    if (attentionDelta.scrollDistancePx > 0) trackMetric("attention.scroll_distance_px", attentionDelta.scrollDistancePx, 0);
    if (attentionDelta.scrollStops > 0) trackMetric("attention.scroll_stops", attentionDelta.scrollStops, 0);
    if (attentionDelta.keyPresses > 0) trackMetric("attention.key_presses", attentionDelta.keyPresses, 0);
    if (attentionDelta.mouseClicks > 0) trackMetric("attention.mouse_clicks", attentionDelta.mouseClicks, 0);
    if (attentionDelta.mouseMoves > 0) trackMetric("attention.mouse_moves", attentionDelta.mouseMoves, 0);
    if (attentionDelta.pageViews > 0) trackMetric("attention.page_views", attentionDelta.pageViews, 0);

    const visibilityNow = visibility.getAggregates();
    const visibilityPrev = lastVisibilityRef.current;
    const visibleDelta = Math.max(0, visibilityNow.visibleTimeMs - visibilityPrev.visibleTimeMs);
    const hiddenDelta = Math.max(0, visibilityNow.hiddenTimeMs - visibilityPrev.hiddenTimeMs);
    const changeDelta = Math.max(0, visibilityNow.visibilityChanges - visibilityPrev.visibilityChanges);
    lastVisibilityRef.current = visibilityNow;

    if (visibleDelta > 0) trackMetric("visibility.visible_time", 1, visibleDelta);
    if (hiddenDelta > 0) trackMetric("visibility.hidden_time", 1, hiddenDelta);
    if (changeDelta > 0) trackMetric("visibility.changes", changeDelta, 0);

    const rawSignals = attention.getRawContentSignals();
    const previousSignals = lastContentSignalsRef.current;
    for (const [key, signal] of Object.entries(rawSignals)) {
      const prev = previousSignals[key] || {
        viewed: 0,
        interacted: 0,
        scrollStops: 0,
        totalVisibleTimeMs: 0,
      };
      const viewedDelta = Math.max(0, signal.viewed - prev.viewed);
      const interactedDelta = Math.max(0, signal.interacted - prev.interacted);
      const stopsDelta = Math.max(0, signal.scrollStops - prev.scrollStops);
      const visibleMsDelta = Math.max(0, signal.totalVisibleTimeMs - prev.totalVisibleTimeMs);
      if (viewedDelta > 0) trackMetric(`content.viewed:${key}`, viewedDelta, 0);
      if (interactedDelta > 0) trackMetric(`content.interacted:${key}`, interactedDelta, 0);
      if (stopsDelta > 0) trackMetric(`content.scroll_stops:${key}`, stopsDelta, 0);
      if (visibleMsDelta > 0) trackMetric(`content.visible_time:${key}`, 1, visibleMsDelta);
      previousSignals[key] = {
        viewed: signal.viewed,
        interacted: signal.interacted,
        scrollStops: signal.scrollStops,
        totalVisibleTimeMs: signal.totalVisibleTimeMs,
      };
    }
  }, [trackMetric]);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;
    const existing = await readAggregate();
    aggregateRef.current = existing || nowRecord();
    loadedRef.current = true;
    if (pendingRef.current.length > 0) {
      for (const item of pendingRef.current) {
        applyMetric(item.key, item.count, item.totalMs);
      }
      pendingRef.current = [];
      await writeAggregate(aggregateRef.current);
    }
  }, [applyMetric]);

  const flushIfDue = useCallback(async () => {
    await ensureLoaded();
    if (!isAuthenticated) return;
    if (flushInFlightRef.current) return;
    ingestBehaviorDeltas();
    capturePerformanceOnce();

    const activeStarted = activeStartPerfRef.current;
    if (activeStarted != null) {
      const delta = Math.max(0, Math.round(performance.now() - activeStarted));
      if (delta > 0) {
        applyMetric(metricKey("route:active", activeRouteRef.current), 1, delta);
        schedulePersist();
      }
      activeStartPerfRef.current = performance.now();
    }

    const record = aggregateRef.current;
    const now = Date.now();
    if (now - record.startedAt < CYCLE_MS) return;

    const metrics = Object.entries(record.metrics)
      .map(([key, point]) => ({
        key,
        count: Math.max(0, Math.floor(point.count || 0)),
        totalMs: Math.max(0, Math.round((point.totalMs || 0) * 1000) / 1000),
      }))
      .filter((m) => m.count > 0 || m.totalMs > 0);

    if (metrics.length === 0) {
      aggregateRef.current = nowRecord();
      await writeAggregate(aggregateRef.current);
      return;
    }

    flushInFlightRef.current = true;
    try {
      const result = await api.submitActivityAggregate({
        startedAt: new Date(record.startedAt).toISOString(),
        endedAt: new Date(now).toISOString(),
        spanMs: now - record.startedAt,
        metrics,
      });
      if (result.success) {
        aggregateRef.current = nowRecord();
        await writeAggregate(aggregateRef.current);
      }
    } catch (error) {
      console.error("Activity aggregate flush failed:", error);
    } finally {
      flushInFlightRef.current = false;
    }
  }, [ensureLoaded, isAuthenticated, ingestBehaviorDeltas, capturePerformanceOnce, applyMetric, schedulePersist]);

  const normalizedPath = useMemo(() => normalizePathname(location.pathname), [location.pathname]);

  useEffect(() => {
    void ensureLoaded().then(() => {
      attentionRef.current = new PulseLens();
      visibilityRef.current = new FocusGate();
      performanceRef.current = new RuntimeGauge();
      deviceRef.current = new NodePrint();

      attentionRef.current.start("enhanced");
      visibilityRef.current.start();
      performanceRef.current.start();

      lastAttentionRef.current = attentionRef.current.getAggregates();
      lastVisibilityRef.current = visibilityRef.current.getAggregates();

      void captureDeviceOnce();
      capturePerformanceOnce();

      activeRouteRef.current = normalizedPath;
      trackMetric(metricKey("route:view", normalizedPath), 1, 0);
      startActiveTimer();
      ingestBehaviorDeltas();
      void flushIfDue();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopActiveTimer();
        ingestBehaviorDeltas();
      } else {
        startActiveTimer();
        ingestBehaviorDeltas();
        void flushIfDue();
      }
    };
    const onPageHide = () => {
      stopActiveTimer();
      ingestBehaviorDeltas();
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (loadedRef.current) {
        void writeAggregate(aggregateRef.current);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    flushIntervalRef.current = window.setInterval(() => {
      ingestBehaviorDeltas();
      void flushIfDue();
    }, FLUSH_CHECK_INTERVAL_MS);

    behaviorIngestIntervalRef.current = window.setInterval(() => {
      ingestBehaviorDeltas();
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (flushIntervalRef.current !== null) {
        window.clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      if (behaviorIngestIntervalRef.current !== null) {
        window.clearInterval(behaviorIngestIntervalRef.current);
        behaviorIngestIntervalRef.current = null;
      }
      stopActiveTimer();
      ingestBehaviorDeltas();
      attentionRef.current?.stop();
      visibilityRef.current?.stop();
      performanceRef.current?.stop();
      attentionRef.current = null;
      visibilityRef.current = null;
      performanceRef.current = null;
      deviceRef.current = null;
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (loadedRef.current) {
        void writeAggregate(aggregateRef.current);
      }
    };
  }, [ensureLoaded, normalizedPath, trackMetric, startActiveTimer, flushIfDue, stopActiveTimer, ingestBehaviorDeltas, captureDeviceOnce, capturePerformanceOnce]);

  useEffect(() => {
    if (!loadedRef.current) return;
    ingestBehaviorDeltas();
    stopActiveTimer();
    activeRouteRef.current = normalizedPath;
    trackMetric(metricKey("route:view", normalizedPath), 1, 0);
    attentionRef.current?.observeContent();
    startActiveTimer();
    void flushIfDue();
  }, [normalizedPath, startActiveTimer, stopActiveTimer, trackMetric, flushIfDue, ingestBehaviorDeltas]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void flushIfDue();
  }, [isAuthenticated, flushIfDue]);
};
