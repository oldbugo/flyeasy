"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { useSessionNavigation } from "@/components/sessions/session-navigation-feedback";
import { cn } from "@/components/shared/ui";

type SessionTabNavigationProps = {
  resultsIsRunning?: boolean;
  sessionId: string;
};

const sessionTabs = [
  { hrefSuffix: "", id: "overview", label: "Overview" },
  { hrefSuffix: "/results", id: "results", label: "Results" },
  { hrefSuffix: "/history", id: "history", label: "History" },
  { hrefSuffix: "/strategy", id: "strategy", label: "Search strategy" },
  { hrefSuffix: "/settings", id: "settings", label: "Session setting" }
] as const;

export function SessionTabNavigation({
  resultsIsRunning = false,
  sessionId
}: SessionTabNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const { beginNavigation, pendingHref } = useSessionNavigation();
  const [indicator, setIndicator] = useState({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0
  });
  const resolvedTabId = resolveSessionTabId(pathname, sessionId);
  const pendingTabId =
    pendingHref?.startsWith(`/sessions/${sessionId}`)
      ? resolveSessionTabId(pendingHref, sessionId)
      : null;
  const activeTabId =
    pendingTabId && pendingTabId !== resolvedTabId ? pendingTabId : resolvedTabId;

  useEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current;
      const activeNode = itemRefs.current[activeTabId];
      if (!nav || !activeNode) {
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

      const navRect = nav.getBoundingClientRect();
      const activeRect = activeNode.getBoundingClientRect();
      setIndicator({
        height: activeRect.height,
        visible: true,
        width: activeRect.width,
        x: activeRect.left - navRect.left,
        y: activeRect.top - navRect.top
      });
    };

    updateIndicator();

    if (typeof window === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateIndicator();
    });

    if (navRef.current) {
      resizeObserver.observe(navRef.current);
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
  }, [activeTabId]);

  return (
    <nav
      ref={navRef}
      className="relative flex max-w-full flex-wrap justify-center gap-1"
    >
      <span
        aria-hidden
        className={cn(
          "flyeasy-liquid-tab-indicator",
          indicator.visible ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: `${indicator.height}px`,
          transform: `translate(${indicator.x}px, ${indicator.y}px)`,
          width: `${indicator.width}px`
        }}
      />
      {sessionTabs.map((tab) => {
        const href = `/sessions/${sessionId}${tab.hrefSuffix}`;
        const isActive = activeTabId === tab.id;

        return (
          <Link
            key={tab.id}
            ref={(node) => {
              itemRefs.current[tab.id] = node;
            }}
            href={href as never}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            data-session-tab-id={tab.id}
            className={cn(
              "flyeasy-liquid-tab relative z-10",
              isActive
                ? "flyeasy-liquid-tab-active"
                : "flyeasy-liquid-tab-inactive"
            )}
            onClick={(event) => {
              if (!shouldHandleClientTabNavigation(event)) {
                return;
              }

              event.preventDefault();
              beginNavigation(href, { alignViewportToTabAnchor: true });
              router.push(href as never, { scroll: false });
            }}
          >
            <span>{tab.label}</span>
            {tab.id === "results" && resultsIsRunning ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-r-current" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function shouldHandleClientTabNavigation(event: MouseEvent<HTMLAnchorElement>) {
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

function resolveSessionTabId(pathname: string, sessionId: string) {
  const sessionBasePath = `/sessions/${sessionId}`;

  if (pathname === `${sessionBasePath}/results` || pathname.startsWith(`${sessionBasePath}/candidates/`)) {
    return "results";
  }

  if (pathname === `${sessionBasePath}/history` || pathname.startsWith(`${sessionBasePath}/runs/`)) {
    return "history";
  }

  if (pathname === `${sessionBasePath}/settings`) {
    return "settings";
  }

  if (pathname === `${sessionBasePath}/strategy`) {
    return "strategy";
  }

  return "overview";
}
