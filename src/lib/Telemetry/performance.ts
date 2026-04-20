interface LongTaskEntry extends PerformanceEntry {
  duration: number;
  startTime: number;
}

export class RuntimeGauge {
  private navigationEntry: PerformanceNavigationTiming | null = null;
  private resourceEntries: PerformanceResourceTiming[] = [];
  private longTasks: LongTaskEntry[] = [];
  private paintEntries: PerformancePaintTiming[] = [];
  private observer: PerformanceObserver | null = null;

  start(): void {
    if (window.performance && window.performance.getEntriesByType) {
      const navEntries = window.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (navEntries.length > 0) this.navigationEntry = navEntries[0];

      this.resourceEntries = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      this.paintEntries = window.performance.getEntriesByType("paint") as PerformancePaintTiming[];
    }

    if ("PerformanceObserver" in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          this.longTasks.push(...(list.getEntries() as unknown as LongTaskEntry[]));
        });
        this.observer.observe({ type: "longtask", buffered: true });
      } catch {
        this.observer = null;
      }
    }
  }

  getAggregates(): {
    loadTimeMs: number;
    domInteractiveMs: number;
    firstContentfulPaintMs: number;
    longTaskCount: number;
    resourceCount: number;
  } {
    return {
      loadTimeMs: this.navigationEntry?.loadEventEnd ?? 0,
      domInteractiveMs: this.navigationEntry?.domInteractive ?? 0,
      firstContentfulPaintMs:
        this.paintEntries.find((p) => p.name === "first-contentful-paint")?.startTime ?? 0,
      longTaskCount: this.longTasks.length,
      resourceCount: this.resourceEntries.length,
    };
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
