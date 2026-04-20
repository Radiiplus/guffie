/**
 * Formatting Utilities
 * Handles human-readable numbers (K, M, B) and relative timestamps.
 */

/**
 * Formats a number into a human-readable string (e.g., 1200 -> 1.2k, 1500000 -> 1.5m)
 */
export const formatCompactNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || Number.isNaN(num)) return "0";
  if (num === 0) return "0";
  
  const absNum = Math.abs(num);
  
  // Billion
  if (absNum >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "b";
  }
  
  // Million
  if (absNum >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  }
  
  // Thousand
  if (absNum >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  
  // Hundred (Optional: only if > 100, otherwise just number)
  // Your request asked for 'h', but standard UI usually keeps <1k as raw numbers.
  // Implementing strictly as requested:
  if (absNum >= 100) {
     // Only show 'h' if it's exactly hundreds or if you prefer that style. 
     // Standard practice: 150 -> 150, 1200 -> 1.2k. 
     // If you strictly want 150 -> 1.5h:
     return (num / 100).toFixed(1).replace(/\.0$/, "") + "h";
  }

  return num.toString();
};

/**
 * Formats a date string into a relative time string (e.g., "2m", "3d", "1w")
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  // Handle invalid dates
  if (isNaN(date.getTime())) return "";

  const secondsPast = (now.getTime() - date.getTime()) / 1000;

  if (secondsPast < 60) {
    const s = Math.round(secondsPast);
    return `${s}s`;
  }
  
  const minutesPast = secondsPast / 60;
  if (minutesPast < 60) {
    const m = Math.round(minutesPast);
    return `${m}m`;
  }
  
  const hoursPast = minutesPast / 60;
  if (hoursPast < 24) {
    const h = Math.round(hoursPast);
    return `${h}h`;
  }
  
  const daysPast = hoursPast / 24;
  if (daysPast < 7) {
    const d = Math.round(daysPast);
    return `${d}d`;
  }
  
  const weeksPast = daysPast / 7;
  if (weeksPast < 4.3) { // Approx 4.3 weeks in a month
    const w = Math.round(weeksPast);
    return `${w}w`;
  }
  
  const monthsPast = daysPast / 30.44; // Average days in a month
  if (monthsPast < 12) {
    const mo = Math.round(monthsPast);
    return `${mo}mo`;
  }
  
  const yearsPast = daysPast / 365.25;
  const y = Math.round(yearsPast);
  return `${y}y`;
};
