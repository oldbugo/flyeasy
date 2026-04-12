"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";

import { SessionContentLoading } from "@/components/sessions/session-content-loading";
import {
  getSessionIdFromPathname,
  getSessionLoadingDescriptorForPath,
  normalizeInternalPath
} from "@/components/sessions/session-loading-descriptor";
import { cn } from "@/components/shared/ui";

type SessionNavigationContextValue = {
  beginNavigation: (
    href: string,
    options?: {
      alignViewportToTabAnchor?: boolean;
    }
  ) => void;
  pendingHref: string | null;
};

const SessionNavigationContext = createContext<SessionNavigationContextValue | null>(null);

export function SessionNavigationProvider({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const normalizedPathname = normalizeInternalPath(pathname);
  const resolvedPendingHref =
    pendingHref && normalizeInternalPath(pendingHref) !== normalizedPathname
      ? pendingHref
      : null;

  useEffect(() => {
    if (!pendingHref || normalizeInternalPath(pendingHref) !== normalizedPathname) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      setPendingHref((current) =>
        current && normalizeInternalPath(current) === normalizedPathname ? null : current
      );
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [normalizedPathname, pendingHref]);

  useEffect(() => {
    return () => {
      stopSessionViewportScrollAnimation(scrollAnimationFrameRef);
    };
  }, []);

  const value = useMemo<SessionNavigationContextValue>(
    () => ({
      beginNavigation: (href: string, options) => {
        if (options?.alignViewportToTabAnchor) {
          scrollSessionViewportToTabAnchor(scrollAnimationFrameRef);
        }
        setPendingHref(href);
      },
      pendingHref: resolvedPendingHref
    }),
    [resolvedPendingHref]
  );

  return (
    <SessionNavigationContext.Provider value={value}>
      {children}
    </SessionNavigationContext.Provider>
  );
}

function getSessionViewportTabAlignmentMetrics() {
  if (typeof document === "undefined") {
    return null;
  }

  const viewport = document.querySelector<HTMLElement>("[data-session-scroll-viewport]");
  const stickyBar = document.querySelector<HTMLElement>("[data-session-sticky-bar]");
  const contentAnchor = document.querySelector<HTMLElement>("[data-session-content-start-anchor]");
  const anchor = document.querySelector<HTMLElement>("[data-session-tab-anchor]");

  if (!viewport) {
    return null;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const targetElement = contentAnchor ?? stickyBar ?? anchor;

  if (!targetElement) {
    return null;
  }

  const targetRect = targetElement.getBoundingClientRect();
  const viewportPaddingTop = Number.parseFloat(getComputedStyle(viewport).paddingTop || "0") || 0;
  const stickyTopInset = stickyBar
    ? Number.parseFloat(getComputedStyle(stickyBar).top || "0") || 0
    : 0;
  const stickyInset = stickyBar ? viewportPaddingTop + stickyTopInset : 8;
  const stickyHeight = stickyBar?.getBoundingClientRect().height ?? 0;
  const contentGap = stickyBar ? 4 : 0;
  const desiredViewportTop = contentAnchor ? stickyInset + stickyHeight + contentGap : stickyInset;
  const targetTop = Math.max(
    0,
    viewport.scrollTop + (targetRect.top - viewportRect.top) - desiredViewportTop
  );
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

  return {
    maxScrollTop,
    targetTop,
    viewport
  };
}

function scrollSessionViewportToTabAnchor(
  animationFrameRef?: React.RefObject<number | null>
) {
  const metrics = getSessionViewportTabAlignmentMetrics();

  if (!metrics) {
    return null;
  }

  const { maxScrollTop, targetTop, viewport } = metrics;
  const desiredTop = Math.min(targetTop, maxScrollTop);

  animateSessionViewportScroll(viewport, desiredTop, animationFrameRef);

  return desiredTop;
}

function stopSessionViewportScrollAnimation(
  animationFrameRef?: React.RefObject<number | null>
) {
  if (animationFrameRef?.current === null || animationFrameRef?.current === undefined) {
    return;
  }

  window.cancelAnimationFrame(animationFrameRef.current);
  animationFrameRef.current = null;
}

function animateSessionViewportScroll(
  viewport: HTMLElement,
  targetTop: number,
  animationFrameRef?: React.RefObject<number | null>
) {
  const startTop = viewport.scrollTop;
  const distance = targetTop - startTop;

  if (Math.abs(distance) < 2) {
    stopSessionViewportScrollAnimation(animationFrameRef);
    viewport.scrollTop = targetTop;
    return;
  }

  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    stopSessionViewportScrollAnimation(animationFrameRef);
    viewport.scrollTop = targetTop;
    return;
  }

  stopSessionViewportScrollAnimation(animationFrameRef);

  const durationMs = Math.min(320, Math.max(180, Math.abs(distance) * 0.08 + 180));
  const startTime = performance.now();
  const easeOutQuint = (progress: number) => 1 - Math.pow(1 - progress, 5);

  const step = (timestamp: number) => {
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const easedProgress = easeOutQuint(progress);

    viewport.scrollTop = startTop + distance * easedProgress;

    if (progress < 1) {
      if (animationFrameRef) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        window.requestAnimationFrame(step);
      }
      return;
    }

    viewport.scrollTop = targetTop;

    if (animationFrameRef) {
      animationFrameRef.current = null;
    }
  };

  if (animationFrameRef) {
    animationFrameRef.current = window.requestAnimationFrame(step);
    return;
  }

  window.requestAnimationFrame(step);
}

export function useSessionNavigation() {
  const context = useContext(SessionNavigationContext);

  if (!context) {
    throw new Error("useSessionNavigation must be used within SessionNavigationProvider.");
  }

  return context;
}

export function SessionMainNavigationViewport({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSessionNavigation();
  const normalizedPathname = normalizeInternalPath(pathname);

  if (!pendingHref) {
    return <div className="flex min-w-0 flex-col">{children}</div>;
  }

  const pendingPathname = normalizeInternalPath(pendingHref);
  const currentSessionId = getSessionIdFromPathname(normalizedPathname);
  const pendingSessionId = getSessionIdFromPathname(pendingPathname);

  if (!pendingSessionId || pendingSessionId === currentSessionId) {
    return <div className="flex min-w-0 flex-col">{children}</div>;
  }

  return (
    <SessionViewportFill mode="main">
      <SessionContentLoading {...getSessionLoadingDescriptorForPath(pendingPathname)} />
    </SessionViewportFill>
  );
}

export function SessionPaneNavigationViewport({
  children,
  sessionId
}: {
  children: ReactNode;
  sessionId: string;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSessionNavigation();
  const normalizedPathname = normalizeInternalPath(pathname);
  const pendingPathname = pendingHref ? normalizeInternalPath(pendingHref) : null;
  const pendingSessionId = pendingPathname ? getSessionIdFromPathname(pendingPathname) : null;
  const isPendingPaneNavigation =
    Boolean(pendingPathname) &&
    pendingSessionId === sessionId &&
    pendingPathname !== normalizedPathname;
  const paneHeight = usePendingSessionPaneHeight(isPendingPaneNavigation);
  const rootStyle = isPendingPaneNavigation
    ? ({
        height: `${paneHeight}px`,
        minHeight: `${paneHeight}px`
      } satisfies CSSProperties)
    : undefined;

  return (
    <div
      className="relative flex min-w-0 flex-col"
      data-session-pane-navigation-root
      style={rootStyle}
    >
      <div
        aria-hidden={isPendingPaneNavigation ? true : undefined}
        className={cn(
          "flex min-w-0 flex-col",
          isPendingPaneNavigation &&
            "pointer-events-none absolute inset-0 overflow-hidden opacity-0"
        )}
      >
        {children}
      </div>

      {isPendingPaneNavigation && pendingPathname ? (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          data-session-pane-loading-overlay
        >
          <div
            className="absolute inset-0 z-[1] overflow-hidden rounded-[30px]"
            data-session-pane-loading-surface
          >
            <SessionContentLoading
              {...getSessionLoadingDescriptorForPath(pendingPathname)}
              surface="panel"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionViewportFill({
  className,
  children,
  mode
}: {
  className?: string;
  children: ReactNode;
  mode: "main" | "pane";
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const height = useSessionViewportFillHeight(mode, nodeRef);

  const style = {
    height: `${height}px`,
    minHeight: `${height}px`
  } satisfies CSSProperties;

  return (
    <div
      ref={nodeRef}
      className={cn("flex min-w-0 flex-col overflow-hidden", className)}
      style={style}
    >
      {children}
    </div>
  );
}

function useSessionViewportFillHeight(
  mode: "main" | "pane",
  rootRef?: React.RefObject<HTMLElement | HTMLDivElement | null>
) {
  const [height, setHeight] = useState(360);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewport = document.querySelector<HTMLElement>("[data-session-scroll-viewport]");
    if (!viewport) {
      return;
    }

    let rafId: number | null = null;

    const updateHeight = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        const currentViewport = document.querySelector<HTMLElement>(
          "[data-session-scroll-viewport]"
        );
        const currentRoot = rootRef?.current ?? null;

        if (!currentViewport) {
          return;
        }

        const viewportRect = currentViewport.getBoundingClientRect();
        const viewportStyle = getComputedStyle(currentViewport);
        const viewportPaddingTop =
          Number.parseFloat(viewportStyle.paddingTop || "0") || 0;
        const viewportPaddingBottom =
          Number.parseFloat(viewportStyle.paddingBottom || "0") || 0;
        const availableHeight =
          mode === "pane" && currentRoot
            ? viewportRect.bottom - currentRoot.getBoundingClientRect().top
            : currentViewport.clientHeight - viewportPaddingTop - viewportPaddingBottom;
        const nextHeight = Math.max(320, Math.round(availableHeight));

        setHeight((current) => (current === nextHeight ? current : nextHeight));
      });
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(viewport);

    if (rootRef?.current) {
      resizeObserver.observe(rootRef.current);
    }

    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [mode, rootRef]);

  return height;
}

function usePendingSessionPaneHeight(isPendingPaneNavigation: boolean) {
  const [height, setHeight] = useState(360);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !isPendingPaneNavigation) {
      return;
    }

    const viewport = document.querySelector<HTMLElement>("[data-session-scroll-viewport]");
    const stickyBar = document.querySelector<HTMLElement>("[data-session-sticky-bar]");

    if (!viewport) {
      return;
    }

    let rafId: number | null = null;

    const updateLayout = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        const currentViewport = document.querySelector<HTMLElement>(
          "[data-session-scroll-viewport]"
        );
        const currentStickyBar = document.querySelector<HTMLElement>("[data-session-sticky-bar]");

        if (!currentViewport) {
          return;
        }

        const viewportPaddingTop =
          Number.parseFloat(getComputedStyle(currentViewport).paddingTop || "0") || 0;
        const stickyTopInset = currentStickyBar
          ? Number.parseFloat(getComputedStyle(currentStickyBar).top || "0") || 0
          : 0;
        const stickyHeight = currentStickyBar?.getBoundingClientRect().height ?? 0;
        const contentGap = currentStickyBar ? 4 : 8;
        const paneTopOffset = viewportPaddingTop + stickyTopInset + stickyHeight + contentGap;
        const nextHeight = Math.max(
          320,
          Math.round(currentViewport.clientHeight - paneTopOffset)
        );

        setHeight((current) => (current === nextHeight ? current : nextHeight));
      });
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(() => {
      updateLayout();
    });

    resizeObserver.observe(viewport);
    if (stickyBar) {
      resizeObserver.observe(stickyBar);
    }
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLayout);

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isPendingPaneNavigation]);

  return height;
}
