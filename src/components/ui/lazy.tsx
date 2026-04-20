import { Suspense, lazy, useEffect, useMemo } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";

type Dimension = number | string;

interface LazyLoadProps<TProps extends object = Record<string, unknown>> {
  width: Dimension;
  height: Dimension;
  loader: () => Promise<{ default: ComponentType<TProps> }>;
  componentProps?: TProps;
  onLoad?: () => void;
  fallback?: ReactNode;
  className?: string;
}

const toDimension = (value: Dimension): string =>
  typeof value === "number" ? `${value}px` : value;

export function LazyLoad<TProps extends object = Record<string, unknown>>({
  width,
  height,
  loader,
  componentProps,
  onLoad,
  fallback,
  className,
}: LazyLoadProps<TProps>) {
  const LazyComponent = useMemo(() => lazy(loader), [loader]);

  const style: CSSProperties = {
    width: toDimension(width),
    height: toDimension(height),
  };

  return (
    <span
      className={className}
      style={style}
    >
      <Suspense
        fallback={
          fallback ?? (
            <span
              className="inline-block h-full w-full rounded-sm bg-zinc-700/60 animate-pulse"
              aria-hidden="true"
            />
          )
        }
      >
        <Loaded onLoad={onLoad}>
          <LazyComponent {...(componentProps as TProps)} />
        </Loaded>
      </Suspense>
    </span>
  );
}

function Loaded({ children, onLoad }: { children: ReactNode; onLoad?: () => void }) {
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  return <>{children}</>;
}
