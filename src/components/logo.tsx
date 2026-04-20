/**
 * Neon Logo Component
 * A reusable logo component featuring the 'Great Vibes' font,
 * gradient text, and a reactive hover glow effect.
 * Used consistently across the site for branding.
 */
"use client";

import { SITE_CONFIG } from "@/lib/config";

interface NeonLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NeonLogo({ size = "lg", className = "" }: NeonLogoProps) {
  const sizeClasses = {
    sm: "text-3xl",
    md: "text-4xl",
    lg: "text-5xl",
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative flex items-center justify-center group cursor-default">
        {/* Reactive Glow Background */}
        <div className="absolute -inset-6 rounded-full bg-violet-600/10 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
        <h1
          className={`relative p-2 font-great-vibes text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] animate-gradient select-none drop-shadow-sm ${sizeClasses[size]}`}
          style={{ fontFamily: SITE_CONFIG.theme.fontFamily }}
        >
          {SITE_CONFIG.name}
        </h1>
      </div>
    </div>
  );
}
