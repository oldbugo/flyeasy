"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatRelativeCountdown,
  formatRelativePast
} from "@/lib/time/formatting";

type SessionCardStatusProps = {
  isActiveRefresh: boolean;
  isLive: boolean;
  lastRunFinishedAt: string | null;
  nextRefreshAt: string | null;
  primaryStatusText: string;
  refreshIntervalHours: number;
  secondaryStatusText: string;
};

function formatCadence(refreshIntervalHours: number) {
  return `Every ${refreshIntervalHours}h`;
}

function formatNextRefreshAt(nextRefreshAt: string | null) {
  if (!nextRefreshAt) {
    return null;
  }

  const date = new Date(nextRefreshAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

export function SessionCardStatus({
  isActiveRefresh,
  isLive,
  lastRunFinishedAt,
  nextRefreshAt,
  primaryStatusText,
  refreshIntervalHours,
  secondaryStatusText
}: SessionCardStatusProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const livePrimary = useMemo(() => {
    if (!isLive || isActiveRefresh) {
      return primaryStatusText;
    }

    return formatRelativeCountdown(nextRefreshAt, now);
  }, [isActiveRefresh, isLive, nextRefreshAt, now, primaryStatusText]);

  const liveSecondary = useMemo(() => {
    if (!isLive || isActiveRefresh) {
      return secondaryStatusText;
    }

    const checkedLabel = formatRelativePast(lastRunFinishedAt, now);
    const exactNext = formatNextRefreshAt(nextRefreshAt);
    const exactNextSuffix = exactNext ? ` Next at ${exactNext}.` : "";

    return `${checkedLabel}. ${formatCadence(refreshIntervalHours)}.${exactNextSuffix}`;
  }, [
    isActiveRefresh,
    isLive,
    lastRunFinishedAt,
    nextRefreshAt,
    now,
    refreshIntervalHours,
    secondaryStatusText
  ]);

  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-slate-500">{livePrimary}</p>
      <p className="truncate text-lg font-medium tracking-tight text-ink">{liveSecondary}</p>
    </div>
  );
}
