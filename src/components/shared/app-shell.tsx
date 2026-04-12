"use client";

import { AirplaneLandingIcon } from "@phosphor-icons/react/dist/csr/AirplaneLanding";
import { AirplaneTakeoffIcon } from "@phosphor-icons/react/dist/csr/AirplaneTakeoff";
import { CardsThreeIcon } from "@phosphor-icons/react/dist/csr/CardsThree";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PowerIcon } from "@phosphor-icons/react/dist/csr/Power";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

import {
  SessionMainNavigationViewport,
  SessionNavigationProvider,
  useSessionNavigation
} from "@/components/sessions/session-navigation-feedback";
import {
  getSessionIdFromPathname,
  normalizeInternalPath
} from "@/components/sessions/session-loading-descriptor";
import { DesktopQuitButton } from "@/components/shared/desktop-quit-button";
import { cn, getIconButtonClassName } from "@/components/shared/ui";
import { primaryNav } from "@/lib/app-shell/navigation";
import type { SessionListItem } from "@/lib/db/queries/sessions";
import { resolveAirportInput, resolveCityInput } from "@/lib/locations/catalog";

type AppShellProps = {
  children: ReactNode;
  sessions: SessionListItem[];
};

type SidebarContentDensity = "regular" | "tight";

type SidebarPreviewState = {
  session: SidebarSessionSummary;
  top: number;
};

type SidebarSessionSummary = {
  arrivalCode: string;
  arrivalLabel: string;
  arrivalLocationName: string;
  arrivalTimeLabel: string;
  bestFare: string;
  departureCode: string;
  departureLabel: string;
  departureLocationName: string;
  departureTimeLabel: string;
  hasCompletedRun: boolean;
  href: string;
  id: string;
  isLiveMonitored: boolean;
  name: string;
  stopovers: SidebarSessionStopover[];
  totalStopoverDurationLabel: string | null;
};

type SidebarSessionStopover = {
  code: string;
};

const SIDEBAR_OVERSHOOT_MULTIPLIER = 1.1;
const SIDEBAR_SNAP_WIDTHS = [84, 360] as const;
const SIDEBAR_DIMENSIONS = {
  minWidth: 72,
  collapsedWidth: SIDEBAR_SNAP_WIDTHS[0],
  defaultWidth: SIDEBAR_SNAP_WIDTHS[1],
  expandedWidth: SIDEBAR_SNAP_WIDTHS[1],
  maxWidth: Math.round(SIDEBAR_SNAP_WIDTHS[1] * SIDEBAR_OVERSHOOT_MULTIPLIER),
  transitionThreshold: 200
} as const;
const SIDEBAR_STORAGE_KEY = "flyeasy.sidebar.width";
const SIDEBAR_SNAP_DURATION_MS = 360;
const COLLAPSED_SIDEBAR_SESSION_WIDTH =
  "calc(2.5rem + (var(--sidebar-expand-progress, 0) * 9rem))";

export function AppShell({ children, sessions }: AppShellProps) {
  return (
    <SessionNavigationProvider>
      <AppShellFrame sessions={sessions}>{children}</AppShellFrame>
    </SessionNavigationProvider>
  );
}

function AppShellFrame({ children, sessions }: AppShellProps) {
  const pathname = usePathname();
  const { pendingHref } = useSessionNavigation();
  const resolvedPrimaryNavPathname = pendingHref ? normalizeInternalPath(pendingHref) : pathname;
  const isSessionWorkspace = pathname.startsWith("/sessions/");
  const usesFramelessMainViewport =
    isSessionWorkspace || pathname === "/" || pathname.startsWith("/settings");
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapAnimating, setIsSnapAnimating] = useState(false);
  const [isSidebarExpandAnimating, setIsSidebarExpandAnimating] = useState(false);
  const [sidebarContentDensity, setSidebarContentDensity] =
    useState<SidebarContentDensity>("regular");
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DIMENSIONS.defaultWidth);
  const asideRef = useRef<HTMLElement | null>(null);
  const mainShellRef = useRef<HTMLElement | null>(null);
  const mainScrollViewportRef = useRef<HTMLElement | null>(null);
  const mainContentInnerRef = useRef<HTMLDivElement | null>(null);
  const sidebarShellRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedStoredWidthRef = useRef(false);
  const dragStateRef = useRef<{ currentWidth: number; startWidth: number; startX: number } | null>(
    null
  );
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragWidthRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const expandAnimationTimeoutRef = useRef<number | null>(null);
  const isExpanded = isSidebarExpanded(sidebarWidth);
  const sessionSummaries = useMemo(() => sessions.map(toSidebarSessionSummary), [sessions]);
  const sidebarVisualStyle = {
    width: sidebarWidth,
    ["--sidebar-expand-progress" as string]: String(getSidebarExpandProgress(sidebarWidth))
  } satisfies CSSProperties;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    const parsed = Number(storedValue);

    if (!Number.isFinite(parsed)) {
      hasLoadedStoredWidthRef.current = true;
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      hasLoadedStoredWidthRef.current = true;
      setSidebarWidth(getSidebarReleaseWidth(clampSidebarWidth(parsed)));
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredWidthRef.current) {
      return;
    }

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const asideNode = asideRef.current;

    if (!asideNode || typeof window === "undefined") {
      return;
    }

    const updateDensity = () => {
      const width = asideNode.getBoundingClientRect().width;
      asideNode.style.setProperty("--sidebar-expand-progress", String(getSidebarExpandProgress(width)));

      setSidebarContentDensity((current) => {
        if (current === "regular" && width < 320) {
          return "tight";
        }

        if (current === "tight" && width > 336) {
          return "regular";
        }

        return current;
      });
    };

    updateDensity();

    const resizeObserver = new ResizeObserver(() => {
      updateDensity();
    });

    resizeObserver.observe(asideNode);
    window.addEventListener("resize", updateDensity);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDensity);
    };
  }, []);

  useEffect(() => {
    const mainShellNode = mainShellRef.current;
    const mainContentNode = mainContentInnerRef.current;

    if (!mainShellNode || !mainContentNode || typeof window === "undefined") {
      return;
    }

    let rafId: number | null = null;

    const updateCenterShift = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        const currentShell = mainShellRef.current;
        const currentContent = mainContentInnerRef.current;

        if (!currentShell || !currentContent) {
          return;
        }

        const freeSpace = Math.max(0, currentShell.clientWidth - currentContent.offsetWidth);
        const shift = Math.min(sidebarWidth / 2, freeSpace / 2);

        currentContent.style.setProperty(
          "--flyeasy-main-content-center-shift",
          `${shift.toFixed(2)}px`
        );
      });
    };

    updateCenterShift();

    const resizeObserver = new ResizeObserver(() => {
      updateCenterShift();
    });

    resizeObserver.observe(mainShellNode);
    resizeObserver.observe(mainContentNode);
    window.addEventListener("resize", updateCenterShift);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCenterShift);

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [sidebarWidth]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }

      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }

      if (expandAnimationTimeoutRef.current !== null) {
        window.clearTimeout(expandAnimationTimeoutRef.current);
      }

    };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const updateSidebarWidth = (clientX: number) => {
      if (!dragStateRef.current) {
        return;
      }

      const nextWidth = clampSidebarWidth(
        dragStateRef.current.startWidth + (clientX - dragStateRef.current.startX)
      );

      dragStateRef.current.currentWidth = nextWidth;
      pendingDragWidthRef.current = nextWidth;

      if (dragFrameRef.current !== null || typeof window === "undefined") {
        return;
      }

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pendingWidth = pendingDragWidthRef.current;

        if (pendingWidth === null || !asideRef.current) {
          return;
        }

        asideRef.current.style.width = `${pendingWidth}px`;
        asideRef.current.style.setProperty(
          "--sidebar-expand-progress",
          String(getSidebarExpandProgress(pendingWidth))
        );
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateSidebarWidth(event.clientX);
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateSidebarWidth(event.clientX);
    };

    const handleDragEnd = () => {
      const currentWidth = dragStateRef.current?.currentWidth ?? sidebarWidth;
      const snappedWidth = getSidebarReleaseWidth(currentWidth);
      const willExpand = !isSidebarExpanded(sidebarWidth) && isSidebarExpanded(snappedWidth);

      dragStateRef.current = null;
      pendingDragWidthRef.current = null;
      setIsDragging(false);

      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }

      if (asideRef.current) {
        asideRef.current.style.width = `${snappedWidth}px`;
        asideRef.current.style.setProperty(
          "--sidebar-expand-progress",
          String(getSidebarExpandProgress(snappedWidth))
        );
      }

      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }

      if (expandAnimationTimeoutRef.current !== null) {
        window.clearTimeout(expandAnimationTimeoutRef.current);
        expandAnimationTimeoutRef.current = null;
      }

      setIsSnapAnimating(true);
      setIsSidebarExpandAnimating(willExpand);
      setSidebarWidth(snappedWidth);

      if (willExpand && typeof window !== "undefined") {
        expandAnimationTimeoutRef.current = window.setTimeout(() => {
          setIsSidebarExpandAnimating(false);
          expandAnimationTimeoutRef.current = null;
        }, 520);
      }

      snapTimeoutRef.current = window.setTimeout(() => {
        setIsSnapAnimating(false);
        snapTimeoutRef.current = null;
      }, SIDEBAR_SNAP_DURATION_MS);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("mouseup", handleDragEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("mouseup", handleDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, sidebarWidth]);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = null;
    }

    setIsSnapAnimating(false);
    dragStateRef.current = {
      currentWidth: sidebarWidth,
      startWidth: sidebarWidth,
      startX: event.clientX
    };
    setIsDragging(true);
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(237,242,247,0.98)_32%,_rgba(226,232,240,1)_100%)] px-3 py-4 text-ink sm:px-4">
      <div className="flex h-[calc(100vh-2rem)] min-h-0 overflow-hidden">
        <aside
          ref={asideRef}
          className={cn(
            "relative z-10 min-h-0 shrink-0 overflow-visible",
            isDragging
              ? "transition-none"
              : isSnapAnimating
                ? "transition-[width] duration-[360ms] ease-[cubic-bezier(0.2,1.25,0.32,1)]"
                : "transition-[width] duration-200 ease-out"
          )}
          style={sidebarVisualStyle}
        >
          <div
            ref={sidebarShellRef}
            className="flex h-full min-h-0 flex-col overflow-visible rounded-[32px] border border-[#E2E8F0] bg-white/95 px-[10px] py-[14px] shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <EdgeScrollRail
              hostRef={sidebarShellRef}
              side="left"
              thumbAriaLabel="Scroll sessions"
              viewportRef={sidebarScrollViewportRef}
            />
            <div className={cn("shrink-0", isExpanded ? "space-y-[18px]" : "space-y-4")}>
              <Link
                href="/"
                className={cn(
                  "flex items-center justify-center rounded-[22px] bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                  isExpanded
                    ? "h-16 w-full px-[10px] py-2"
                    : "h-16 w-full max-w-16 self-center px-2 py-2"
                )}
              >
                <div className="flex w-full flex-col items-center justify-center gap-[2px]">
                  <div className="text-center text-[24px] font-semibold tracking-normal">
                    {isExpanded ? "Fly Easy" : "FE"}
                  </div>
                  <div className="flex justify-center">
                    <div className="h-2 w-2 rounded-full bg-[#34D399]" />
                  </div>
                </div>
              </Link>

              <nav
                className={cn(
                  "flex flex-col",
                  isExpanded ? "w-full items-center gap-[10px]" : "items-center gap-3"
                )}
              >
                {primaryNav.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    active={isPrimaryNavItemActive(resolvedPrimaryNavPathname, item.href)}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    expanded={isExpanded}
                  />
                ))}
              </nav>
            </div>

          <SidebarSessionRail
            contentDensity={sidebarContentDensity}
            expanded={isExpanded}
            expandReveal={isSidebarExpandAnimating}
            pathname={pathname}
            scrollViewportRef={sidebarScrollViewportRef}
            sessions={sessionSummaries}
          />

            <div
              className={cn(
                "grid w-full shrink-0 place-items-center pt-3",
                isExpanded ? "gap-3" : "gap-[10px]"
              )}
            >
              <DesktopQuitButton
                className={getSidebarItemClassName(false, isExpanded, { centered: true })}
                pendingChildren={
                  <SidebarItemContent expanded={isExpanded} icon="power" label="Closing..." />
                }
              >
                <SidebarItemContent expanded={isExpanded} icon="power" label="Quit" />
              </DesktopQuitButton>
            </div>
          </div>
        </aside>

        <SidebarResizeHandle isDragging={isDragging} onPointerDown={handleResizeStart} />

        <div
          ref={(node) => {
            mainShellRef.current = node;
          }}
          className="relative min-h-0 min-w-0 flex-1"
        >
          <EdgeScrollRail
            hostRef={mainShellRef}
            contentRef={mainContentInnerRef}
            side="right"
            thumbAriaLabel="Scroll content"
            viewportRef={mainScrollViewportRef}
          />
          <main
            ref={mainScrollViewportRef}
            className={cn(
              "flyeasy-main-scroll-viewport relative h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto",
              usesFramelessMainViewport
                ? "bg-transparent px-2 py-1 sm:px-3 xl:px-4"
                : "rounded-[34px] border border-white/75 bg-white/80 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5 xl:p-6"
            )}
            data-session-scroll-viewport
          >
            <div
              ref={mainContentInnerRef}
              className={cn(
                "mx-auto flex min-h-full min-w-0 flex-col pr-3 pb-4 sm:pb-5 xl:pb-6 will-change-transform",
                isDragging ? "transition-none" : "transition-transform duration-300 ease-out",
                isSessionWorkspace ? "max-w-[94rem]" : "max-w-[88rem]"
              )}
              style={{
                transform:
                  "translateX(calc(var(--flyeasy-main-content-center-shift, 0px) * -1))"
              }}
            >
              <SessionMainNavigationViewport>{children}</SessionMainNavigationViewport>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarSessionRail({
  contentDensity,
  expanded,
  expandReveal,
  pathname,
  scrollViewportRef,
  sessions
}: {
  contentDensity: SidebarContentDensity;
  expanded: boolean;
  expandReveal: boolean;
  pathname: string;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  sessions: SidebarSessionSummary[];
}) {
  const router = useRouter();
  const { beginNavigation, pendingHref } = useSessionNavigation();
  const railRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<SidebarPreviewState | null>(null);
  const pendingSessionId = pendingHref ? getSessionIdFromPathname(pendingHref) : null;
  const liveSessions = sessions.filter((session) => session.isLiveMonitored);
  const otherSessions = sessions.filter((session) => !session.isLiveMonitored);
  const activeSessionId =
    sessions.find((session) =>
      isSidebarSessionSelected({
        href: session.href,
        pathname,
        pendingSessionId,
        sessionId: session.id
      })
    )?.id ?? null;

  const showPreview = (session: SidebarSessionSummary, anchor: HTMLElement) => {
    if (expanded || !railRef.current) {
      return;
    }

    const railRect = railRef.current.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    setPreview({
      session,
      top: anchorRect.top - railRect.top + anchorRect.height / 2
    });
  };

  const hidePreview = (sessionId?: string) => {
    setPreview((current) => {
      if (!current) {
        return null;
      }

      if (sessionId && current.session.id !== sessionId) {
        return current;
      }

      return null;
    });
  };

  const handleSessionClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (!shouldHandleClientSessionNavigation(event)) {
      return;
    }

    event.preventDefault();
    beginNavigation(href);
    router.push(href as never, { scroll: false });
  };

  useEffect(() => {
    const scrollViewport = scrollViewportRef.current;

    if (!scrollViewport || !activeSessionId) {
      return;
    }

    const activeItem = scrollViewport.querySelector<HTMLAnchorElement>(
      `[data-sidebar-session-id="${activeSessionId}"]`
    );

    if (!activeItem) {
      return;
    }

    const ensureActiveItemVisible = () => {
      const viewportRect = scrollViewport.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      if (itemRect.top < viewportRect.top || itemRect.bottom > viewportRect.bottom) {
        activeItem.scrollIntoView({
          block: "nearest",
          inline: "nearest"
        });
      }
    };

    ensureActiveItemVisible();

    if (typeof window === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      ensureActiveItemVisible();
    });

    resizeObserver.observe(scrollViewport);
    resizeObserver.observe(activeItem);
    window.addEventListener("resize", ensureActiveItemVisible);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", ensureActiveItemVisible);
    };
  }, [activeSessionId, expanded, scrollViewportRef]);

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div
        ref={railRef}
        className="relative flex min-h-0 flex-1 flex-col border-y border-[#D6E4F0] py-3"
      >
        <div
          ref={scrollViewportRef}
          className={cn(
            "flyeasy-sidebar-scroll-viewport min-h-0 flex-1 overflow-y-auto"
          )}
          onScroll={() => {
            if (!expanded) {
              hidePreview();
            }
          }}
        >
          {sessions.length === 0 ? (
            expanded ? (
              <div className="rounded-[20px] border border-dashed border-[#D6E4F0] bg-white/70 px-3 py-4 text-center text-[11px] font-medium text-slate-400">
                No sessions yet
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                Empty
              </div>
            )
          ) : expanded ? (
            <div className="flex flex-col gap-3 px-1 py-1">
              {liveSessions.length > 0 ? (
                <SidebarSessionCluster reveal={expandReveal}>
                  <ExpandedSidebarSessionStack
                    contentDensity={contentDensity}
                    onClickSession={handleSessionClick}
                    pendingSessionId={pendingSessionId}
                    pathname={pathname}
                    reveal={expandReveal}
                    sessions={liveSessions}
                  />
                </SidebarSessionCluster>
              ) : null}

              <ExpandedSidebarSessionStack
                contentDensity={contentDensity}
                onClickSession={handleSessionClick}
                pendingSessionId={pendingSessionId}
                pathname={pathname}
                reveal={expandReveal}
                sessions={otherSessions}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-1">
              {liveSessions.length > 0 ? (
                <SidebarSessionCluster condensed>
                  <CollapsedSidebarSessionStack
                    onClickSession={handleSessionClick}
                    onHidePreview={hidePreview}
                    onShowPreview={showPreview}
                    pathname={pathname}
                    pendingSessionId={pendingSessionId}
                    sessions={liveSessions}
                  />
                </SidebarSessionCluster>
              ) : null}

              <CollapsedSidebarSessionStack
                onClickSession={handleSessionClick}
                onHidePreview={hidePreview}
                onShowPreview={showPreview}
                pathname={pathname}
                pendingSessionId={pendingSessionId}
                sessions={otherSessions}
              />
            </div>
          )}
        </div>

        {!expanded && preview ? (
          <div
            className="pointer-events-none absolute left-full z-30 ml-4 w-[15.5rem]"
            style={{ top: preview.top, transform: "translateY(-50%)" }}
          >
            <SidebarSessionSummaryCard
              active={isSidebarSessionSelected({
                href: preview.session.href,
                pathname,
                pendingSessionId,
                sessionId: preview.session.id
              })}
              floatingPreview
              session={preview.session}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EdgeScrollRail({
  contentRef,
  hostRef,
  side,
  thumbAriaLabel,
  viewportRef
}: {
  contentRef?: React.RefObject<HTMLElement | null>;
  hostRef: React.RefObject<HTMLElement | null>;
  side: "left" | "right";
  thumbAriaLabel: string;
  viewportRef: React.RefObject<HTMLElement | null>;
}) {
  const dragOffsetRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState({
    thumbHeight: 0,
    thumbTop: 0,
    trackHeight: 0,
    trackTop: 0,
    visible: false
  });

  useEffect(() => {
    const hostNode = hostRef.current;
    const viewportNode = viewportRef.current;

    if (!hostNode || !viewportNode || typeof window === "undefined") {
      return;
    }

    const updateMetrics = () => {
      const currentHost = hostRef.current;
      const currentViewport = viewportRef.current;

      if (!currentHost || !currentViewport) {
        return;
      }

      const hostRect = currentHost.getBoundingClientRect();
      const viewportRect = currentViewport.getBoundingClientRect();
      const trackHeight = viewportRect.height;
      const trackTop = viewportRect.top - hostRect.top;
      const viewportHeight = currentViewport.clientHeight;
      const scrollHeight = currentViewport.scrollHeight;

      if (scrollHeight <= viewportHeight + 4 || viewportHeight <= 0) {
        setMetrics((current) =>
          current.visible
            ? {
                thumbHeight: 0,
                thumbTop: 0,
                trackHeight,
                trackTop,
                visible: false
              }
            : current
        );
        return;
      }

      const thumbHeight = Math.max(44, (viewportHeight / scrollHeight) * viewportHeight);
      const maxScrollTop = scrollHeight - viewportHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const thumbTop =
        maxScrollTop <= 0 ? 0 : (currentViewport.scrollTop / maxScrollTop) * maxThumbTop;

      setMetrics((current) => {
        if (
          current.visible &&
          Math.abs(current.thumbHeight - thumbHeight) < 0.5 &&
          Math.abs(current.thumbTop - thumbTop) < 0.5 &&
          Math.abs(current.trackHeight - trackHeight) < 0.5 &&
          Math.abs(current.trackTop - trackTop) < 0.5
        ) {
          return current;
        }

        return {
          thumbHeight,
          thumbTop,
          trackHeight,
          trackTop,
          visible: true
        };
      });
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });

    resizeObserver.observe(hostNode);
    resizeObserver.observe(viewportNode);

      const contentNode = contentRef?.current ?? viewportNode.firstElementChild;
      if (contentNode instanceof HTMLElement) {
        resizeObserver.observe(contentNode);
      }

    viewportNode.addEventListener("scroll", updateMetrics, { passive: true });
    window.addEventListener("resize", updateMetrics);

    return () => {
      resizeObserver.disconnect();
      viewportNode.removeEventListener("scroll", updateMetrics);
      window.removeEventListener("resize", updateMetrics);
    };
    }, [contentRef, hostRef, viewportRef]);

  const setScrollFromClientY = (clientY: number, offset: number) => {
    const hostNode = hostRef.current;
    const viewportNode = viewportRef.current;

    if (!hostNode || !viewportNode || !metrics.visible) {
      return;
    }

    const hostRect = hostNode.getBoundingClientRect();
    const maxThumbTop = Math.max(0, metrics.trackHeight - metrics.thumbHeight);
    const nextThumbTop = clampNumber(
      clientY - hostRect.top - metrics.trackTop - offset,
      0,
      maxThumbTop
    );
    const maxScrollTop = Math.max(0, viewportNode.scrollHeight - viewportNode.clientHeight);

    viewportNode.scrollTop =
      maxThumbTop <= 0 ? 0 : (nextThumbTop / maxThumbTop) * maxScrollTop;
  };

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const thumbRect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = event.clientY - thumbRect.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setScrollFromClientY(moveEvent.clientY, dragOffsetRef.current ?? metrics.thumbHeight / 2);
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!metrics.visible || event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    setScrollFromClientY(event.clientY, metrics.thumbHeight / 2);
  };

  if (!metrics.visible) {
    return null;
  }

  const trackAlignmentClass =
    side === "left"
      ? "left-[-4px] w-[16px]"
      : "right-[-4px] w-[16px]";
  const trackLineClass =
    side === "left"
      ? "left-[5px] top-0 bottom-0 w-[3px]"
      : "right-[5px] top-0 bottom-0 w-[3px]";
  const thumbAlignmentClass = side === "left" ? "left-0" : "right-0";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-20 w-[16px]",
        side === "left" ? "left-0" : "right-0"
      )}
    >
      <div
        className={cn("pointer-events-auto absolute", trackAlignmentClass)}
        style={{
          height: `${metrics.trackHeight}px`,
          top: `${metrics.trackTop}px`
        }}
        onPointerDown={handleTrackPointerDown}
      >
        <span
          aria-hidden
          className={cn("absolute rounded-full bg-[#8FD5C4]/75", trackLineClass)}
        />
        <button
          type="button"
          aria-label={thumbAriaLabel}
          className={cn(
            "absolute rounded-[999px] bg-sea shadow-[0_8px_18px_rgba(12,107,88,0.18)] transition-[transform,height,opacity,background-color] duration-150 ease-out hover:bg-[#0A7F68] active:bg-[#086554]",
            thumbAlignmentClass
          )}
          onPointerDown={handleThumbPointerDown}
          style={{
            height: `${metrics.thumbHeight}px`,
            top: `${metrics.thumbTop}px`,
            width: "12px"
          }}
        />
      </div>
    </div>
  );
}

function ExpandedSidebarSessionStack({
  contentDensity,
  onClickSession,
  pathname,
  pendingSessionId,
  reveal = false,
  sessions
}: {
  contentDensity: SidebarContentDensity;
  onClickSession: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
  pathname: string;
  pendingSessionId: string | null;
  reveal?: boolean;
  sessions: SidebarSessionSummary[];
}) {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0
  });
  const activeSessionId =
    sessions.find((session) =>
      isSidebarSessionSelected({
        href: session.href,
        pathname,
        pendingSessionId,
        sessionId: session.id
      })
    )?.id ?? null;

  useEffect(() => {
    const updateIndicator = () => {
      const stackNode = stackRef.current;
      const activeNode = activeSessionId ? itemRefs.current[activeSessionId] : null;

      if (!stackNode || !activeNode) {
        setIndicator((current) =>
          current.visible
            ? {
                ...current,
                visible: false
              }
            : current
        );
        return;
      }

      const stackRect = stackNode.getBoundingClientRect();
      const activeRect = activeNode.getBoundingClientRect();

      setIndicator({
        height: activeRect.height,
        visible: true,
        width: activeRect.width,
        x: activeRect.left - stackRect.left,
        y: activeRect.top - stackRect.top
      });
    };

    updateIndicator();

    if (typeof window === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateIndicator();
    });

    if (stackRef.current) {
      resizeObserver.observe(stackRef.current);
    }

    for (const node of Object.values(itemRefs.current)) {
      if (node) {
        resizeObserver.observe(node);
      }
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeSessionId, sessions]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div
      ref={stackRef}
      className="relative flex flex-col gap-3 px-0.5 py-0.5"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 rounded-[20px] bg-sea ring-1 ring-inset ring-white/12 shadow-[0_10px_20px_rgba(12,107,88,0.14)] transition-[transform,width,height,opacity] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          indicator.visible ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: `${indicator.height}px`,
          transform: `translate(${indicator.x}px, ${indicator.y}px)`,
          width: `${indicator.width}px`
        }}
      />
      {sessions.map((session, index) => {
        const active = isSidebarSessionSelected({
          href: session.href,
          pathname,
          pendingSessionId,
          sessionId: session.id
        });
        return (
          <Link
            key={session.id}
            data-sidebar-session-id={session.id}
            ref={(node) => {
              itemRefs.current[session.id] = node;
            }}
            href={session.href as never}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative z-10 block rounded-[20px]",
              reveal &&
                "motion-reduce:animate-none animate-[sidebar-expanded-card-in_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
            )}
            onClick={(event) => {
              onClickSession(event, session.href);
            }}
            style={
              reveal
                ? {
                    animationDelay: `${Math.min(index, 4) * 45}ms`
                  }
                : undefined
            }
          >
            <SidebarSessionSummaryCard
              active={active}
              density={contentDensity}
              interactive
              session={session}
            />
          </Link>
        );
      })}
    </div>
  );
}

function SidebarSessionCluster({
  children,
  condensed = false,
  reveal = false
}: {
  children: ReactNode;
  condensed?: boolean;
  reveal?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-visible rounded-[24px] border border-[#D4E3DD] bg-[#ECF4F1]",
        reveal &&
          "motion-reduce:animate-none animate-[sidebar-expanded-cluster-in_360ms_cubic-bezier(0.22,1,0.36,1)_both]",
        condensed
          ? "flex w-fit flex-col items-center gap-3 rounded-[22px] px-1.5 py-2.5"
          : "flex flex-col gap-2.5 p-3"
      )}
    >
      {children}
    </div>
  );
}

function SidebarSessionSummaryCard({
  active = false,
  className,
  density = "regular",
  floatingPreview = false,
  interactive = false,
  session
}: {
  active?: boolean;
  className?: string;
  density?: SidebarContentDensity;
  floatingPreview?: boolean;
  interactive?: boolean;
  session: SidebarSessionSummary;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border transition-[background-color,border-color,color,box-shadow,transform,padding] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "px-4 py-3.5",
        active
          ? floatingPreview
            ? "border-transparent bg-sea shadow-[0_18px_38px_rgba(15,23,42,0.14)]"
            : "border-transparent bg-transparent shadow-none"
          : "border-[#D6E4F0] bg-[#FEFEFF] shadow-[0_1px_0_rgba(255,255,255,0.6)]",
        interactive &&
          (active
            ? "group-hover:-translate-y-px group-active:translate-y-0"
            : "group-hover:-translate-y-px group-hover:border-[#BFD6CF] group-hover:shadow-[0_12px_26px_rgba(15,23,42,0.08)] group-active:translate-y-0 group-active:border-[#ABC9BE]"),
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "min-w-0 text-[13px] font-semibold leading-5",
            active ? "text-white" : "text-ink"
          )}
        >
          {session.name}
        </p>
        <p
          className={cn(
            "shrink-0 text-[13px] font-semibold leading-5",
            active ? "text-white" : "text-sea"
          )}
        >
          {session.bestFare}
        </p>
      </div>

      {session.hasCompletedRun ? (
        <div
          className="relative mt-3.5 flex flex-col gap-2.5"
        >
          <span
            aria-hidden
            className={cn(
              "absolute left-[1.03rem] top-[1.125rem] bottom-[2.85rem] w-[3px] rounded-full",
              active ? "bg-white/20" : "bg-[#D7DEE8]"
            )}
          />
          <SidebarSessionRouteDetailRow
            active={active}
            code={session.departureCode}
            dateLabel={session.departureLabel}
            density={density}
            locationName={session.departureLocationName}
            timeLabel={session.departureTimeLabel}
            type="departure"
          />

          <SidebarSessionStopoverRow
            active={active}
            durationLabel={session.totalStopoverDurationLabel}
            stopoverLabel={formatSidebarStopoverSummary(session.stopovers)}
          />

          <SidebarSessionRouteDetailRow
            active={active}
            code={session.arrivalCode}
            dateLabel={session.arrivalLabel}
            density={density}
            locationName={session.arrivalLocationName}
            timeLabel={session.arrivalTimeLabel}
            type="arrival"
          />
        </div>
      ) : (
        <div
          className={cn(
            "mt-3 rounded-[16px] border border-dashed px-3 py-4 text-center text-[12px] font-medium",
            active ? "border-white/36 text-white" : "border-[#D6E4F0] text-slate-500"
          )}
        >
          No data
        </div>
      )}
    </div>
  );
}

function SidebarSessionRouteDetailRow({
  active = false,
  code,
  dateLabel,
  density = "regular",
  locationName,
  timeLabel,
  type
}: {
  active?: boolean;
  code: string;
  dateLabel: string;
  density?: SidebarContentDensity;
  locationName: string;
  timeLabel: string;
  type: "arrival" | "departure";
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex w-[2.25rem] shrink-0 self-stretch items-start justify-center">
        <SidebarSessionTimelineMarker active={active} type={type} />
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[13px] font-semibold leading-[1.05] tracking-[0.02em]",
              active ? "text-white" : "text-ink"
            )}
          >
            {code}
          </p>
          <div
            className={cn(
              "mt-0.5 h-[1.85rem] overflow-hidden text-[12px] leading-[1.25] transition-[opacity,transform] duration-180 ease-out",
              density === "tight" ? "-translate-y-0.5 opacity-0" : "translate-y-0 opacity-100"
            )}
          >
            <p className={cn(active ? "text-white" : "text-slate-600")}>{locationName}</p>
          </div>
        </div>

        <div className="min-w-0 shrink-0 text-right">
          <p
            className={cn(
              "whitespace-nowrap text-[12px] font-semibold leading-[1.15]",
              active ? "text-white" : "text-ink"
            )}
          >
            {dateLabel}
          </p>
          <div
            className={cn(
              "mt-0.5 h-[0.8rem] overflow-hidden text-[11px] leading-[1.05] transition-[opacity,transform] duration-180 ease-out",
              density === "tight" ? "-translate-y-0.5 opacity-0" : "translate-y-0 opacity-100"
            )}
          >
            <p className={cn("whitespace-nowrap", active ? "text-white" : "text-slate-400")}>
              {timeLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarSessionStopoverRow({
  active = false,
  durationLabel,
  stopoverLabel
}: {
  active?: boolean;
  durationLabel: string | null;
  stopoverLabel: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex w-[2.25rem] shrink-0 self-stretch items-center justify-center">
        <span
          aria-hidden
          className={cn(
            "relative z-[1] h-[10px] w-[10px] rounded-full ring-4",
            active ? "bg-white ring-[#0D7B66]" : "bg-[#7D8698] ring-[#FEFEFF]"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5",
            active
              ? "border-white/18 bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              : "border-[#DCE8E2] bg-[#F1F8F6]"
          )}
        >
          <p
            className={cn(
              "min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.12em] leading-[1.1]",
              active ? "text-white" : "text-ink"
            )}
          >
            {stopoverLabel}
          </p>
          {durationLabel ? (
            <p
              className={cn(
                "shrink-0 text-[12px] font-semibold leading-[1.1]",
                active ? "text-white" : "text-sea"
              )}
            >
              {durationLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SidebarSessionTimelineMarker({
  active = false,
  type
}: {
  active?: boolean;
  type: "arrival" | "departure";
}) {
  return (
    <span
      className={cn(
        "relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_1px_0_rgba(255,255,255,0.5)] transition-[background-color,border-color,color,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        active
          ? "border-white/20 bg-white text-sea shadow-[0_8px_20px_rgba(11,122,102,0.14)]"
          : "border-[#D7E3DD] bg-[#EEF7F3] text-sea"
      )}
    >
      {type === "departure" ? (
        <AirplaneTakeoffIcon
          aria-hidden
          size={18}
          weight="bold"
          className="translate-y-[1px] translate-x-[0.5px]"
        />
      ) : (
        <AirplaneLandingIcon
          aria-hidden
          size={18}
          weight="bold"
          className="-translate-y-[0.5px] translate-x-[0.5px]"
        />
      )}
    </span>
  );
}

const CollapsedSidebarSessionItem = forwardRef<
  HTMLAnchorElement,
  {
    active: boolean;
    onClickSession: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
    onHidePreview: () => void;
    onShowPreview: (anchor: HTMLElement) => void;
    session: SidebarSessionSummary;
  }
>(function CollapsedSidebarSessionItem(
  {
    active,
    onClickSession,
    onHidePreview,
    onShowPreview,
    session
  },
  ref
) {
  return (
    <div
      className="relative flex h-10"
      style={{
        width: COLLAPSED_SIDEBAR_SESSION_WIDTH
      }}
    >
      <Link
        ref={ref}
        href={session.href as never}
        data-sidebar-session-id={session.id}
        aria-current={active ? "page" : undefined}
        aria-label={`Open session ${session.name}`}
        className={getSidebarSessionIconClassName(active)}
        style={{
          left: 0,
          width: COLLAPSED_SIDEBAR_SESSION_WIDTH
        }}
        onClick={(event) => {
          onClickSession(event, session.href);
        }}
        onBlur={onHidePreview}
        onFocus={(event) => {
          onShowPreview(event.currentTarget);
        }}
        onMouseEnter={(event) => {
          onShowPreview(event.currentTarget);
        }}
        onMouseLeave={onHidePreview}
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center">
          <CardsThreeIcon aria-hidden size={18} weight="regular" />
        </span>
        <span
          className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden pr-3"
          style={{
            opacity: "clamp(0, calc((var(--sidebar-expand-progress, 0) - 0.08) * 1.45), 1)",
            transform:
              "translateX(calc((1 - var(--sidebar-expand-progress, 0)) * -0.45rem))"
          }}
        >
          <span className="min-w-0 truncate text-[12px] font-semibold leading-none">
            {session.name}
          </span>
          <span className="shrink-0 text-[11px] font-semibold leading-none">
            {session.bestFare}
          </span>
        </span>
      </Link>
    </div>
  );
});

function CollapsedSidebarSessionStack({
  onClickSession,
  onHidePreview,
  onShowPreview,
  pathname,
  pendingSessionId,
  sessions
}: {
  onClickSession: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
  onHidePreview: (sessionId?: string) => void;
  onShowPreview: (session: SidebarSessionSummary, anchor: HTMLElement) => void;
  pathname: string;
  pendingSessionId: string | null;
  sessions: SidebarSessionSummary[];
}) {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0
  });
  const activeSessionId =
    sessions.find((session) =>
      isSidebarSessionSelected({
        href: session.href,
        pathname,
        pendingSessionId,
        sessionId: session.id
      })
    )?.id ?? null;

  useEffect(() => {
    const updateIndicator = () => {
      const stackNode = stackRef.current;
      const activeNode = activeSessionId ? itemRefs.current[activeSessionId] : null;

      if (!stackNode || !activeNode) {
        setIndicator((current) =>
          current.visible
            ? {
                ...current,
                visible: false
              }
            : current
        );
        return;
      }

      const stackRect = stackNode.getBoundingClientRect();
      const activeRect = activeNode.getBoundingClientRect();

      setIndicator({
        height: activeRect.height,
        visible: true,
        width: activeRect.width,
        x: activeRect.left - stackRect.left,
        y: activeRect.top - stackRect.top
      });
    };

    updateIndicator();

    if (typeof window === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateIndicator();
    });

    if (stackRef.current) {
      resizeObserver.observe(stackRef.current);
    }

    for (const node of Object.values(itemRefs.current)) {
      if (node) {
        resizeObserver.observe(node);
      }
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeSessionId, sessions]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div
      ref={stackRef}
      className="relative flex flex-col items-center gap-3 px-0.5 py-0.5"
      style={{
        width: COLLAPSED_SIDEBAR_SESSION_WIDTH
      }}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 rounded-[16px] bg-sea ring-1 ring-inset ring-white/12 shadow-[0_8px_18px_rgba(12,107,88,0.16)] transition-[transform,width,height,opacity] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          indicator.visible ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: `${indicator.height}px`,
          transform: `translate(${indicator.x}px, ${indicator.y}px)`,
          width: `${indicator.width}px`
        }}
      />
      {sessions.map((session) => (
        <CollapsedSidebarSessionItem
          key={session.id}
          ref={(node) => {
            itemRefs.current[session.id] = node;
          }}
          active={isSidebarSessionSelected({
            href: session.href,
            pathname,
            pendingSessionId,
            sessionId: session.id
          })}
          onClickSession={onClickSession}
          onHidePreview={() => onHidePreview(session.id)}
          onShowPreview={(anchor) => onShowPreview(session, anchor)}
          session={session}
        />
      ))}
    </div>
  );
}

function SidebarNavItem({
  active,
  href,
  icon,
  label,
  expanded
}: {
  active: boolean;
  href: string;
  expanded: boolean;
  icon: "gear" | "house" | "plus";
  label: string;
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? "page" : undefined}
      className={getSidebarItemClassName(active, expanded)}
    >
      <SidebarItemContent active={active} expanded={expanded} icon={icon} label={label} />
    </Link>
  );
}

function shouldHandleClientSessionNavigation(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented) {
    return false;
  }

  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function SidebarItemContent({
  active = false,
  expanded,
  icon,
  label
}: {
  active?: boolean;
  expanded: boolean;
  icon: "gear" | "house" | "plus" | "power";
  label: string;
}) {
  return (
    <>
      <span className={getSidebarIconClassName(active, expanded)}>
        <SidebarIcon icon={icon} />
      </span>
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out",
            expanded ? "max-w-[9.5rem] translate-x-0 opacity-100" : "-translate-x-1 max-w-0 opacity-0"
          )}
        >
          <span className="block truncate text-[14px] font-semibold tracking-normal">{label}</span>
      </span>
    </>
  );
}

function getSidebarItemClassName(
  active: boolean,
  expanded: boolean,
  options?: { centered?: boolean }
) {
  const centered = options?.centered ?? false;

  return cn(
    "group flex h-10 items-center overflow-visible rounded-[16px] border transition duration-150 focus-visible:outline-none focus-visible:ring-0",
    expanded
      ? centered
        ? "w-fit justify-start gap-2 pr-3"
        : "w-full justify-start gap-2 pr-3"
      : "w-10 justify-center",
    active
      ? "border-[#D5E8E2] bg-[#E6F4EF] text-ink hover:border-[#CDE7DE] hover:bg-[#E3F4EF] active:border-[#BFDACF] active:bg-[#DCEFE8] focus-visible:border-[#6EE7B7] focus-visible:border-2"
      : "border-line bg-white text-slate-500 hover:border-[#C7D7D2] hover:bg-white active:border-[#CBD5E1] active:bg-[#F8FAFC] focus-visible:border-[#6EE7B7] focus-visible:border-2"
  );
}

function isPrimaryNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getSidebarIconClassName(active: boolean, expanded: boolean) {
  return cn(
    getIconButtonClassName({ tone: active ? "primary" : "secondary" }),
    "relative z-10 shadow-[0_1px_0_rgba(255,255,255,0.18)]",
    expanded && "-ml-px",
    active
      ? "border-sea bg-sea text-white group-hover:bg-[#0A5C4C] group-active:border-[#08463A] group-active:bg-[#08463A] group-focus-visible:border-[#6EE7B7] group-focus-visible:border-[3px]"
      : "border-line bg-white text-slate-700 group-hover:border-sea group-hover:bg-[#F8FAFC] group-active:border-slate-400 group-active:bg-slate-200 group-active:text-ink group-focus-visible:border-sea group-focus-visible:border-2"
  );
}

function getSidebarSessionIconClassName(active: boolean) {
  if (active) {
    return cn(
      "absolute top-0 z-10 inline-flex h-10 shrink-0 items-center justify-start overflow-hidden rounded-[16px] border border-transparent bg-transparent text-white transition-[color,border-color,background-color,width] duration-200 ease-out focus-visible:outline-none focus-visible:ring-0",
      "hover:border-transparent hover:bg-transparent hover:text-white active:border-transparent active:bg-transparent active:text-white focus-visible:border-white/45 focus-visible:border-2"
    );
  }

  return cn(
    "absolute top-0 z-10 inline-flex h-10 shrink-0 items-center justify-start overflow-hidden rounded-[16px] border bg-white text-slate-700 shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-[color,border-color,background-color,box-shadow,width] duration-150 ease-out focus-visible:outline-none focus-visible:ring-0",
    "border-line hover:border-sea hover:bg-[#F8FAFC] hover:text-sea active:border-slate-400 active:bg-slate-200 active:text-ink focus-visible:border-sea focus-visible:border-2"
  );
}

function SidebarResizeHandle({
  isDragging,
  onPointerDown
}: {
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      className="group flex h-full w-8 shrink-0 cursor-col-resize items-center justify-center bg-transparent touch-none"
      onPointerDown={onPointerDown}
    >
      <span
        className={cn(
          "rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.4)] transition-all duration-150 ease-out",
          isDragging
            ? "h-52 w-1.5 bg-sea shadow-[0_0_18px_rgba(14,116,144,0.24)]"
            : "h-48 w-[2px] bg-[#64748B] group-hover:h-52 group-hover:w-[4px] group-hover:bg-[#7DD3C2] group-hover:shadow-[0_0_14px_rgba(125,211,194,0.2)] group-active:h-52 group-active:w-[5px] group-active:bg-sea group-active:shadow-[0_0_18px_rgba(14,116,144,0.24)]"
        )}
      />
    </div>
  );
}

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_DIMENSIONS.maxWidth, Math.max(SIDEBAR_DIMENSIONS.minWidth, value));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNearestSidebarSnapWidth(width: number, snapWidths: readonly number[]) {
  const [firstWidth, ...remainingWidths] = snapWidths;

  if (typeof firstWidth !== "number") {
    return width;
  }

  return remainingWidths.reduce((closestWidth, candidateWidth) => {
    return Math.abs(candidateWidth - width) < Math.abs(closestWidth - width)
      ? candidateWidth
      : closestWidth;
  }, firstWidth);
}

function getSidebarReleaseWidth(width: number) {
  if (!isSidebarExpanded(width)) {
    return SIDEBAR_DIMENSIONS.collapsedWidth;
  }

  return SIDEBAR_DIMENSIONS.expandedWidth;
}

function getSidebarExpandProgress(width: number) {
  const progress =
    (width - SIDEBAR_DIMENSIONS.collapsedWidth) /
    (SIDEBAR_DIMENSIONS.transitionThreshold - SIDEBAR_DIMENSIONS.collapsedWidth);

  return Math.max(0, Math.min(1, progress));
}

function isSidebarExpanded(width: number) {
  return width >= SIDEBAR_DIMENSIONS.transitionThreshold;
}

function isSidebarSessionCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSidebarSessionSelected({
  href,
  pathname,
  pendingSessionId,
  sessionId
}: {
  href: string;
  pathname: string;
  pendingSessionId: string | null;
  sessionId: string;
}) {
  if (pendingSessionId) {
    return pendingSessionId === sessionId;
  }

  return isSidebarSessionCurrent(pathname, href);
}

function toSidebarSessionSummary(session: SessionListItem): SidebarSessionSummary {
  const firstRouteRow = session.routeRows[0];
  const lastRouteRow = session.routeRows.at(-1);
  const stopovers = getSidebarSessionStopovers(session.routeRows);
  const hasCompletedRun = Boolean(session.lastRunFinishedAt);

  return {
    arrivalCode: hasCompletedRun ? lastRouteRow?.endCode ?? "TBD" : "No data",
    arrivalLabel: hasCompletedRun ? lastRouteRow?.endDateLabel ?? "TBD" : "No data",
    arrivalLocationName: hasCompletedRun
      ? resolveSidebarLocationName(lastRouteRow?.endCode ?? null)
      : "No data",
    arrivalTimeLabel: hasCompletedRun ? lastRouteRow?.endTimeLabel ?? "Time pending" : "No data",
    bestFare: session.bestFare,
    departureCode: hasCompletedRun ? firstRouteRow?.startCode ?? "TBD" : "No data",
    departureLabel: hasCompletedRun ? firstRouteRow?.startDateLabel ?? "TBD" : "No data",
    departureLocationName: hasCompletedRun
      ? resolveSidebarLocationName(firstRouteRow?.startCode ?? null)
      : "No data",
    departureTimeLabel: hasCompletedRun
      ? firstRouteRow?.startTimeLabel ?? "Time pending"
      : "No data",
    hasCompletedRun,
    href: `/sessions/${session.id}`,
    id: session.id,
    isLiveMonitored:
      session.monitoringState === "enabled" && session.lifecycleState !== "archived",
    name: session.name,
    stopovers: hasCompletedRun
      ? stopovers.length > 0
        ? stopovers
        : [{ code: "Direct" }]
      : [],
    totalStopoverDurationLabel: hasCompletedRun
      ? getSidebarSessionStopoverDurationLabel(session.routeRows)
      : null
  };
}

function getSidebarSessionStopovers(routeRows: SessionListItem["routeRows"]): SidebarSessionStopover[] {
  const stopovers: SidebarSessionStopover[] = [];
  const seenCodes = new Set<string>();

  for (const row of routeRows.slice(0, -1)) {
    if (seenCodes.has(row.endCode)) {
      continue;
    }

    seenCodes.add(row.endCode);
    stopovers.push({ code: row.endCode });
  }

  return stopovers;
}

function getSidebarSessionStopoverDurationLabel(routeRows: SessionListItem["routeRows"]) {
  const totalMinutes = routeRows
    .slice(0, -1)
    .map((row) => parseSidebarDurationLabelToMinutes(row.stayDurationLabel))
    .reduce((sum, value) => sum + value, 0);

  if (totalMinutes <= 0) {
    return null;
  }

  if (totalMinutes >= 1440) {
    const days = Math.max(1, Math.round(totalMinutes / 1440));
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function parseSidebarDurationLabelToMinutes(label: string | null) {
  if (!label) {
    return 0;
  }

  const dayMatch = label.match(/(\d+)\s*day/i);

  if (dayMatch) {
    return Number(dayMatch[1]) * 1440;
  }

  const hourMatch = label.match(/(\d+)\s*h/i);
  const minuteMatch = label.match(/(\d+)\s*m/i);

  return Number(hourMatch?.[1] ?? 0) * 60 + Number(minuteMatch?.[1] ?? 0);
}

function resolveSidebarLocationName(code: string | null) {
  if (!code) {
    return "Location pending";
  }

  const airport = resolveAirportInput(code);

  if (airport) {
    return airport.displayName;
  }

  const city = resolveCityInput(code);

  if (city) {
    return city.displayName;
  }

  return code;
}

function formatSidebarStopoverSummary(stopovers: SidebarSessionStopover[]) {
  if (stopovers.length === 0) {
    return "Direct";
  }

  return stopovers.map((stopover) => stopover.code).join(" · ");
}

function SidebarIcon({
  icon
}: {
  icon: "gear" | "house" | "plus" | "power";
}) {
  if (icon === "house") {
    return <HouseIcon aria-hidden size={20} weight="regular" />;
  }

  if (icon === "plus") {
    return <PlusIcon aria-hidden size={20} weight="regular" />;
  }

  if (icon === "gear") {
    return <GearSixIcon aria-hidden size={20} weight="regular" />;
  }

  return <PowerIcon aria-hidden size={20} weight="regular" />;
}
