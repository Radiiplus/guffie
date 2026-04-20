export class FocusGate {
  private totalVisibleTime = 0;
  private totalHiddenTime = 0;
  private lastVisibilityChange = Date.now();
  private isCurrentlyVisible = !document.hidden;
  private visibilityChangeCount = 0;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener("visibilitychange", this.handleChange);
    this.lastVisibilityChange = Date.now();
    this.isCurrentlyVisible = !document.hidden;
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    document.removeEventListener("visibilitychange", this.handleChange);
    this.updateCurrentState();
  }

  getAggregates(): {
    visibleTimeMs: number;
    hiddenTimeMs: number;
    visibilityChanges: number;
  } {
    this.updateCurrentState();
    return {
      visibleTimeMs: this.totalVisibleTime,
      hiddenTimeMs: this.totalHiddenTime,
      visibilityChanges: this.visibilityChangeCount,
    };
  }

  isVisible(): boolean {
    return this.isCurrentlyVisible;
  }

  private handleChange = (): void => {
    const now = Date.now();
    const delta = now - this.lastVisibilityChange;

    if (this.isCurrentlyVisible) {
      this.totalVisibleTime += delta;
    } else {
      this.totalHiddenTime += delta;
    }

    this.isCurrentlyVisible = !document.hidden;
    this.lastVisibilityChange = now;
    this.visibilityChangeCount++;
  };

  private updateCurrentState(): void {
    const now = Date.now();
    const delta = now - this.lastVisibilityChange;
    if (delta <= 0) return;

    if (this.isCurrentlyVisible) {
      this.totalVisibleTime += delta;
    } else {
      this.totalHiddenTime += delta;
    }
    this.lastVisibilityChange = now;
    this.isCurrentlyVisible = !document.hidden;
  }
}
