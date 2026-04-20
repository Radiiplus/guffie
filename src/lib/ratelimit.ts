type RateLimitRule = {
  max: number;
  windowMs: number;
  minIntervalMs?: number;
};

const actionTimestamps = new Map<string, number[]>();
const actionLastCall = new Map<string, number>();

const now = () => Date.now();

export const runWithInputRateLimit = async <T>(
  actionKey: string,
  rule: RateLimitRule,
  fn: () => Promise<T>,
  message?: string
): Promise<T> => {
  const current = now();
  const minInterval = rule.minIntervalMs || 0;
  const last = actionLastCall.get(actionKey) || 0;

  if (minInterval > 0 && current - last < minInterval) {
    throw new Error(message || "You're submitting too quickly. Please wait a moment.");
  }

  const existing = actionTimestamps.get(actionKey) || [];
  const valid = existing.filter((ts) => current - ts <= rule.windowMs);
  if (valid.length >= rule.max) {
    throw new Error(message || "Too many attempts. Please wait and try again.");
  }

  valid.push(current);
  actionTimestamps.set(actionKey, valid);
  actionLastCall.set(actionKey, current);
  return fn();
};

