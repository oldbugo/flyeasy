"use client";

import { CardsThreeIcon } from "@phosphor-icons/react/dist/csr/CardsThree";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { PowerIcon } from "@phosphor-icons/react/dist/csr/Power";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { DesktopQuitButton } from "@/components/shared/desktop-quit-button";
import { cn, getIconButtonClassName, getPillClassName } from "@/components/shared/ui";
import { primaryNav } from "@/lib/app-shell/navigation";
import type { SessionListItem } from "@/lib/db/queries/sessions";

type AppShellProps = {
  children: ReactNode;
  sessions: SessionListItem[];
};

type SidebarPreviewState = {
  session: SidebarSessionSummary;
  top: number;
};

type SidebarSessionSummary = {
  arrivalLabel: string;
  bestFare: string;
  departureLabel: string;
  href: string;
  id: string;
  isLiveMonitored: boolean;
  name: string;
  stopoverCodes: string[];
};

const SIDEBAR_OVERSHOOT_MULTIPLIER = 1.1;
const SIDEBAR_SNAP_WIDTHS = [84, 204, 300] as const;
const SIDEBAR_DIMENSIONS = {
  minWidth: 72,
  collapsedWidth: SIDEBAR_SNAP_WIDTHS[0],
  defaultWidth: SIDEBAR_SNAP_WIDTHS[1],
  expandedWidth: SIDEBAR_SNAP_WIDTHS[2],
  maxWidth: Math.round(SIDEBAR_SNAP_WIDTHS[2] * SIDEBAR_OVERSHOOT_MULTIPLIER),
  transitionThreshold: 150
} as const;
const SIDEBAR_STORAGE_KEY = "flyeasy.sidebar.width";
const SIDEBAR_SNAP_DURATION_MS = 360;

export function AppShell({ children, sessions }: AppShellProps) {
  const pathname = usePathname();
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapAnimating, setIsSnapAnimating] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DIMENSIONS.defaultWidth);
  const asideRef = useRef<HTMLElement | null>(null);
  const hasLoadedStoredWidthRef = useRef(false);
  const dragStateRef = useRef<{ currentWidth: number; startWidth: number; startX: number } | null>(
    null
  );
  const snapTimeoutRef = useRef<number | null>(null);
  const isExpanded = isSidebarExpanded(sidebarWidth);
  const sessionSummaries = sessions.map(toSidebarSessionSummary);

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
      setSidebarWidth(clampSidebarWidth(parsed));
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
    return () => {
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
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

      if (asideRef.current) {
        asideRef.current.style.width = `${nextWidth}px`;
      }

      flushSync(() => {
        setSidebarWidth(nextWidth);
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

      dragStateRef.current = null;
      setIsDragging(false);

      if (asideRef.current) {
        asideRef.current.style.width = `${snappedWidth}px`;
      }

      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }

      setIsSnapAnimating(true);
      setSidebarWidth(snappedWidth);
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
          style={{ width: sidebarWidth }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-visible rounded-[32px] border border-white/70 bg-white/85 px-[10px] py-[14px] shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur">
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
                    active={item.matchPrefixes.some((prefix) =>
                      prefix === "/"
                        ? pathname === "/" || pathname.startsWith("/sessions")
                        : pathname.startsWith(prefix)
                    )}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    expanded={isExpanded}
                  />
                ))}
              </nav>
            </div>

            <SidebarSessionRail expanded={isExpanded} pathname={pathname} sessions={sessionSummaries} />

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

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[34px] border border-white/75 bg-white/80 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5 xl:p-6">
          <div className="mx-auto h-full max-w-[88rem] overflow-y-auto pr-1">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarSessionRail({
  expanded,
  pathname,
  sessions
}: {
  expanded: boolean;
  pathname: string;
  sessions: SidebarSessionSummary[];
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<SidebarPreviewState | null>(null);
  const liveSessions = sessions.filter((session) => session.isLiveMonitored);
  const otherSessions = sessions.filter((session) => !session.isLiveMonitored);

  useEffect(() => {
    if (expanded) {
      setPreview(null);
    }
  }, [expanded]);

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

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div
        ref={railRef}
        className="relative flex min-h-0 flex-1 flex-col border-y border-[#D6E4F0] py-3"
      >
        <div
          className={cn(
            "min-h-0 flex-1",
            expanded ? "overflow-y-auto pr-1" : "overflow-y-auto"
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
            <div className="flex flex-col gap-3">
              {liveSessions.length > 0 ? (
                <SidebarSessionCluster>
                  {liveSessions.map((session) => (
                    <Link
                      key={session.id}
                      href={session.href as never}
                      aria-current={isSidebarSessionCurrent(pathname, session.href) ? "page" : undefined}
                      className="group block"
                    >
                      <SidebarSessionSummaryCard
                        active={isSidebarSessionCurrent(pathname, session.href)}
                        interactive
                        session={session}
                      />
                    </Link>
                  ))}
                </SidebarSessionCluster>
              ) : null}

              {otherSessions.map((session) => (
                <Link
                  key={session.id}
                  href={session.href as never}
                  aria-current={isSidebarSessionCurrent(pathname, session.href) ? "page" : undefined}
                  className="group block"
                >
                  <SidebarSessionSummaryCard
                    active={isSidebarSessionCurrent(pathname, session.href)}
                    interactive
                    session={session}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-1">
              {liveSessions.length > 0 ? (
                <SidebarSessionCluster condensed>
                  {liveSessions.map((session) => (
                    <CollapsedSidebarSessionItem
                      key={session.id}
                      active={isSidebarSessionCurrent(pathname, session.href)}
                      onHidePreview={() => hidePreview(session.id)}
                      onShowPreview={(anchor) => showPreview(session, anchor)}
                      session={session}
                    />
                  ))}
                </SidebarSessionCluster>
              ) : null}

              {otherSessions.map((session) => (
                <CollapsedSidebarSessionItem
                  key={session.id}
                  active={isSidebarSessionCurrent(pathname, session.href)}
                  onHidePreview={() => hidePreview(session.id)}
                  onShowPreview={(anchor) => showPreview(session, anchor)}
                  session={session}
                />
              ))}
            </div>
          )}
        </div>

        {!expanded && preview ? (
          <div
            className="pointer-events-none absolute left-full z-30 ml-4 w-[15.5rem]"
            style={{ top: preview.top, transform: "translateY(-50%)" }}
          >
            <SidebarSessionSummaryCard
              active={isSidebarSessionCurrent(pathname, preview.session.href)}
              className="shadow-[0_18px_38px_rgba(15,23,42,0.14)]"
              session={preview.session}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidebarSessionCluster({
  children,
  condensed = false
}: {
  children: ReactNode;
  condensed?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[#C1DED4] bg-[#E3F4EF]",
        condensed
          ? "mx-auto flex w-fit flex-col items-center gap-3 p-2.5"
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
  interactive = false,
  session
}: {
  active?: boolean;
  className?: string;
  interactive?: boolean;
  session: SidebarSessionSummary;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border bg-white px-3.5 py-3 shadow-[0_1px_0_rgba(255,255,255,0.6)]",
        active
          ? "border-[#95D4C0] bg-[#F8FCFA]"
          : "border-[#D6E4F0]",
        interactive &&
          "transition duration-150 group-hover:-translate-y-px group-hover:border-[#BFD6CF] group-hover:shadow-[0_12px_26px_rgba(15,23,42,0.08)] group-active:translate-y-0 group-active:border-[#ABC9BE]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[13px] font-semibold leading-5 text-ink">{session.name}</p>
        <p className="shrink-0 text-[13px] font-semibold leading-5 text-sea">{session.bestFare}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SidebarSessionMetric label="Depart" value={session.departureLabel} />
        <SidebarSessionMetric label="Arrive" value={session.arrivalLabel} />
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Stopovers
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {session.stopoverCodes.map((code) => (
            <span
              key={`${session.id}-${code}`}
              className={cn(
                getPillClassName(code === "Direct" ? "neutral" : "info"),
                "px-2.5 py-1 text-[10px] tracking-[0.14em]"
              )}
            >
              {code}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarSessionMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] bg-[#F8FAFC] px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function CollapsedSidebarSessionItem({
  active,
  onHidePreview,
  onShowPreview,
  session
}: {
  active: boolean;
  onHidePreview: () => void;
  onShowPreview: (anchor: HTMLElement) => void;
  session: SidebarSessionSummary;
}) {
  return (
    <div className="relative flex justify-center">
      <Link
        href={session.href as never}
        aria-current={active ? "page" : undefined}
        aria-label={`Open session ${session.name}`}
        className={getSidebarSessionIconClassName(active)}
        onBlur={onHidePreview}
        onFocus={(event) => {
          onShowPreview(event.currentTarget);
        }}
        onMouseEnter={(event) => {
          onShowPreview(event.currentTarget);
        }}
        onMouseLeave={onHidePreview}
      >
        <CardsThreeIcon aria-hidden size={18} weight="regular" />
      </Link>
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
  icon: "gear" | "house";
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

function SidebarItemContent({
  active = false,
  expanded,
  icon,
  label
}: {
  active?: boolean;
  expanded: boolean;
  icon: "gear" | "house" | "power";
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
          expanded ? "max-w-[7rem] translate-x-0 opacity-100" : "-translate-x-1 max-w-0 opacity-0"
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
  return cn(
    getIconButtonClassName({ tone: "secondary" }),
    active && "border-[#95D4C0] bg-[#F2FBF7] text-sea shadow-[0_0_0_2px_rgba(125,211,194,0.18)]"
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

  return getNearestSidebarSnapWidth(width, SIDEBAR_SNAP_WIDTHS.slice(1));
}

function isSidebarExpanded(width: number) {
  return width >= SIDEBAR_DIMENSIONS.transitionThreshold;
}

function isSidebarSessionCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function toSidebarSessionSummary(session: SessionListItem): SidebarSessionSummary {
  const firstRouteRow = session.routeRows[0];
  const lastRouteRow = session.routeRows.at(-1);
  const stopoverCodes = [...new Set(session.routeRows.slice(0, -1).map((row) => row.endCode))];

  return {
    arrivalLabel: lastRouteRow?.endDateLabel ?? "TBD",
    bestFare: session.bestFare,
    departureLabel: firstRouteRow?.startDateLabel ?? "TBD",
    href: `/sessions/${session.id}`,
    id: session.id,
    isLiveMonitored:
      session.monitoringState === "enabled" && session.lifecycleState !== "archived",
    name: session.name,
    stopoverCodes: stopoverCodes.length > 0 ? stopoverCodes : ["Direct"]
  };
}

function SidebarIcon({
  icon
}: {
  icon: "gear" | "house" | "power";
}) {
  if (icon === "house") {
    return <HouseIcon aria-hidden size={20} weight="regular" />;
  }

  if (icon === "gear") {
    return <GearSixIcon aria-hidden size={20} weight="regular" />;
  }

  return <PowerIcon aria-hidden size={20} weight="regular" />;
}
