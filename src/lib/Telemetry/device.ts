interface DeviceInfo {
  screen: {
    width: number;
    height: number;
    dpr: number;
    colorDepth: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  language: string;
  timezone: string;
  userAgent: string;
  cookiesEnabled: boolean;
  touch: boolean;
  connection: {
    type?: string;
    effective?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  hardware: {
    cores: number;
    memoryGB: number | null;
  };
  webgl: {
    vendor: string;
    renderer: string;
  };
  battery: number | null;
}

export class NodePrint {
  private device: DeviceInfo | null = null;

  async capture(): Promise<DeviceInfo> {
    this.device = {
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        dpr: window.devicePixelRatio || 1,
        colorDepth: window.screen.colorDepth || 24,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      language: navigator.language || "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      cookiesEnabled: navigator.cookieEnabled,
      touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      connection: this.getConnectionInfo(),
      hardware: {
        cores: navigator.hardwareConcurrency || 4,
        memoryGB: (navigator as any).deviceMemory || null,
      },
      webgl: this.getWebGLInfo(),
      battery: await this.getBatteryLevel(),
    };
    return this.device;
  }

  getDevice(): Partial<DeviceInfo> {
    return this.device || {};
  }

  private getConnectionInfo(): DeviceInfo["connection"] {
    const conn = (navigator as any).connection;
    if (!conn) return {};
    return {
      type: conn.type || undefined,
      effective: conn.effectiveType || undefined,
      downlink: conn.downlink || undefined,
      rtt: conn.rtt || undefined,
      saveData: conn.saveData || undefined,
    };
  }

  private getWebGLInfo(): DeviceInfo["webgl"] {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return { vendor: "Unknown", renderer: "Unknown" };
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (!ext) return { vendor: "Unknown", renderer: "Unknown" };
      return {
        vendor: (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL),
        renderer: (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL),
      };
    } catch {
      return { vendor: "Unknown", renderer: "Unknown" };
    }
  }

  private async getBatteryLevel(): Promise<number | null> {
    try {
      const nav = navigator as any;
      if (!nav.getBattery) return null;
      const battery = await nav.getBattery();
      return battery.level ?? null;
    } catch {
      return null;
    }
  }
}

export type { DeviceInfo };
