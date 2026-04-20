import type { SignalTier } from "./types";

interface ContentSignal {
  viewed: number;
  avgVisibleTimeMs: number;
  scrollStops: number;
  interacted: number;
  totalVisibleTimeMs: number;
}

interface AttentionAggregates {
  activeTimeMs: number;
  scrollDistancePx: number;
  scrollVelocityAvg: number;
  scrollStops: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  pageViews: number;
}

export class PulseLens {
  private aggregates: AttentionAggregates = {
    activeTimeMs: 0,
    scrollDistancePx: 0,
    scrollVelocityAvg: 0,
    scrollStops: 0,
    keyPresses: 0,
    mouseClicks: 0,
    mouseMoves: 0,
    pageViews: 0,
  };

  private contentSignals = new Map<string, ContentSignal>();
  private signalTier: SignalTier = "standard";
  private started = false;

  private lastScrollY = 0;
  private lastScrollTime = 0;
  private scrollVelocitySum = 0;
  private scrollVelocityCount = 0;
  private scrollStopThreshold = 0.5;
  private scrollPauseThreshold = 800;

  private activeTimeInterval: ReturnType<typeof setInterval> | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  private contentVisibility = new Map<
    string,
    {
      startTime: number;
      totalTime: number;
      stops: number;
      lastVisibility: number;
    }
  >();

  private lastMouseMoveAt = 0;
  private mouseMoveThrottleMs = 250;

  start(level: SignalTier = "standard"): void {
    if (this.started) return;
    this.started = true;
    this.signalTier = level;

    this.activeTimeInterval = setInterval(() => {
      if (!document.hidden) {
        this.aggregates.activeTimeMs += 1000;
      }
    }, 1000);

    if (this.signalTier !== "minimal") {
      this.lastScrollY = window.scrollY;
      this.lastScrollTime = performance.now();
      window.addEventListener("scroll", this.handleScroll, { passive: true });
    }

    window.addEventListener("click", this.handleClick, { passive: true });
    window.addEventListener("keydown", this.handleKeyPress, { passive: true });
    window.addEventListener("mousemove", this.handleMouseMove, { passive: true });

    if (level === "enhanced" && "IntersectionObserver" in window) {
      this.setupIntersectionObserver();
    }

    this.aggregates.pageViews++;
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.activeTimeInterval) {
      clearInterval(this.activeTimeInterval);
      this.activeTimeInterval = null;
    }

    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("click", this.handleClick);
    window.removeEventListener("keydown", this.handleKeyPress);
    window.removeEventListener("mousemove", this.handleMouseMove);

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  updateLevel(level: SignalTier): void {
    this.signalTier = level;

    if (level === "minimal") {
      window.removeEventListener("scroll", this.handleScroll);
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
      return;
    }

    window.addEventListener("scroll", this.handleScroll, { passive: true });
    if (level === "enhanced" && !this.intersectionObserver) {
      this.setupIntersectionObserver();
    }
  }

  private handleScroll = (): void => {
    const now = performance.now();
    const deltaMs = now - this.lastScrollTime;
    if (deltaMs <= 0) return;

    const scrollDelta = Math.abs(window.scrollY - this.lastScrollY);
    const velocity = scrollDelta / deltaMs;

    this.aggregates.scrollDistancePx += scrollDelta;
    this.scrollVelocitySum += velocity;
    this.scrollVelocityCount++;
    this.aggregates.scrollVelocityAvg =
      this.scrollVelocityCount > 0 ? this.scrollVelocitySum / this.scrollVelocityCount : 0;

    if (velocity < this.scrollStopThreshold) {
      this.aggregates.scrollStops++;
    }
    if (deltaMs > this.scrollPauseThreshold) {
      this.aggregates.scrollStops++;
    }

    this.lastScrollY = window.scrollY;
    this.lastScrollTime = now;
  };

  private handleClick = (): void => {
    this.aggregates.mouseClicks++;
  };

  private handleKeyPress = (): void => {
    this.aggregates.keyPresses++;
  };

  private handleMouseMove = (): void => {
    const now = Date.now();
    if (now - this.lastMouseMoveAt < this.mouseMoveThrottleMs) return;
    this.lastMouseMoveAt = now;
    this.aggregates.mouseMoves++;
  };

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = this.getElementId(entry.target);
          if (!id) continue;

          const type = this.getElementType(entry.target);
          if (!type) continue;

          const key = `${type}:${id}`;

          if (entry.isIntersecting && entry.intersectionRatio > 0.25) {
            if (!this.contentVisibility.has(key)) {
              this.contentVisibility.set(key, {
                startTime: Date.now(),
                totalTime: 0,
                stops: 0,
                lastVisibility: entry.intersectionRatio,
              });
              this.trackView(type, id);
            }
            const data = this.contentVisibility.get(key);
            if (data) data.lastVisibility = entry.intersectionRatio;
            continue;
          }

          const data = this.contentVisibility.get(key);
          if (!data) continue;
          const visibleTime = Date.now() - data.startTime;
          data.totalTime += visibleTime;
          if (visibleTime > 500 && data.lastVisibility > 0.5) {
            data.stops++;
          }
          this.updateContentSignal(type, id, data);
          this.contentVisibility.delete(key);
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "0px",
      },
    );

    this.observeContent();
  }

  observeContent(): void {
    if (!this.intersectionObserver) return;
    document.querySelectorAll("[data-post-id]").forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
    document.querySelectorAll("[data-profile-uuid]").forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
    document.querySelectorAll("[data-comment-id]").forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
  }

  trackView(
    contentType: "post" | "comment" | "profile" | "message",
    contentId: string,
  ): void {
    const key = `${contentType}:${contentId}`;
    if (!this.contentSignals.has(key)) {
      this.contentSignals.set(key, {
        viewed: 1,
        avgVisibleTimeMs: 0,
        scrollStops: 0,
        interacted: 0,
        totalVisibleTimeMs: 0,
      });
      return;
    }
    const signal = this.contentSignals.get(key);
    if (signal) signal.viewed++;
  }

  recordInteraction(
    contentType: "post" | "comment" | "profile" | "message",
    contentId: string,
    _action: string,
  ): void {
    const key = `${contentType}:${contentId}`;
    if (!this.contentSignals.has(key)) {
      this.contentSignals.set(key, {
        viewed: 1,
        avgVisibleTimeMs: 0,
        scrollStops: 0,
        interacted: 1,
        totalVisibleTimeMs: 0,
      });
      return;
    }
    const signal = this.contentSignals.get(key);
    if (signal) signal.interacted++;
  }

  getAggregates(): AttentionAggregates {
    return { ...this.aggregates };
  }

  getContentSignals(): Record<string, Partial<ContentSignal>> {
    const result: Record<string, Partial<ContentSignal>> = {};
    for (const [key, signal] of this.contentSignals) {
      if (signal.viewed <= 0 && signal.interacted <= 0) continue;
      result[key] = {
        viewed: signal.viewed,
        avgVisibleTimeMs:
          signal.totalVisibleTimeMs > 0
            ? Math.round(signal.totalVisibleTimeMs / Math.max(1, signal.viewed))
            : 0,
        scrollStops: signal.scrollStops,
        interacted: signal.interacted,
      };
    }
    return result;
  }

  getRawContentSignals(): Record<string, ContentSignal> {
    const result: Record<string, ContentSignal> = {};
    for (const [key, signal] of this.contentSignals) {
      result[key] = { ...signal };
    }
    return result;
  }

  private getElementId(el: Element): string | null {
    return (
      el.getAttribute("data-post-id") ||
      el.getAttribute("data-comment-id") ||
      el.getAttribute("data-profile-uuid") ||
      null
    );
  }

  private getElementType(el: Element): "post" | "comment" | "profile" | null {
    if (el.hasAttribute("data-post-id")) return "post";
    if (el.hasAttribute("data-comment-id")) return "comment";
    if (el.hasAttribute("data-profile-uuid")) return "profile";
    return null;
  }

  private updateContentSignal(
    contentType: "post" | "comment" | "profile" | "message",
    contentId: string,
    data: { totalTime: number; stops: number },
  ): void {
    const key = `${contentType}:${contentId}`;
    const signal = this.contentSignals.get(key);
    if (!signal) return;
    signal.totalVisibleTimeMs += data.totalTime;
    signal.scrollStops += data.stops;
  }
}
