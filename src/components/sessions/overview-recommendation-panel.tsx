"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Panel, cn, getButtonClassName } from "@/components/shared/ui";
import type { RecommendationFilter } from "@/lib/candidates/result-groups";

type OverviewRecommendationPanelProps = {
  activeFilter: RecommendationFilter;
  children: ReactNode;
  counts: Record<RecommendationFilter, number>;
};

export function OverviewRecommendationPanel({
  activeFilter,
  children,
  counts
}: OverviewRecommendationPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingFilter, setPendingFilter] = useState<RecommendationFilter | null>(null);
  const resolvedPendingFilter =
    pendingFilter && pendingFilter !== activeFilter ? pendingFilter : null;
  const presentedFilter = resolvedPendingFilter ?? activeFilter;
  const isLoading = resolvedPendingFilter !== null;
  const summaryText = useMemo(() => {
    if (isLoading) {
      if (presentedFilter === "only_multi_city") {
        return "Loading significant multi-city trips...";
      }

      if (presentedFilter === "exclude_multi_city") {
        return "Loading significant trips without multi-city...";
      }

      return "Loading significant trip recommendations...";
    }

    if (counts[activeFilter] === 0) {
      if (activeFilter === "only_multi_city") {
        return "No significant multi-city trips recorded yet";
      }

      if (activeFilter === "exclude_multi_city") {
        return "No significant non-multi-city trips recorded yet";
      }

      return "No significant trip recommendations recorded yet";
    }

    if (activeFilter === "only_multi_city") {
      return `Showing ${counts.only_multi_city} significant multi-city grouped trips`;
    }

    if (activeFilter === "exclude_multi_city") {
      return `Showing ${counts.exclude_multi_city} significant grouped trips without multi-city`;
    }

    return `Showing ${counts.all} significant grouped trips`;
  }, [activeFilter, counts, isLoading, presentedFilter]);

  const tabs: Array<{
    id: RecommendationFilter;
    label: string;
  }> = [
    {
      id: "all",
      label: "All trips"
    },
    {
      id: "exclude_multi_city",
      label: "No multi-city"
    },
    {
      id: "only_multi_city",
      label: "Only multi-city"
    }
  ];

  return (
    <Panel className="p-6 md:p-7">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Recommendations
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Best options from the current session
            </h2>
          </div>

          <p className="text-sm text-slate-500">{summaryText}</p>
        </div>

        <div className="inline-flex flex-wrap gap-2 rounded-[18px] border border-line bg-[var(--surface-subtle)] p-1.5">
          {tabs.map((tab) => {
            const isActive = presentedFilter === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={getButtonClassName({
                  active: isActive,
                  size: "sm",
                  tone: isActive ? "primary" : "secondary"
                })}
                onClick={() => {
                  if (!isLoading && tab.id === activeFilter) {
                    return;
                  }

                  setPendingFilter(tab.id);

                  const nextSearchParams = new URLSearchParams(searchParams.toString());

                  if (tab.id === "all") {
                    nextSearchParams.delete("recommendationFilter");
                  } else {
                    nextSearchParams.set("recommendationFilter", tab.id);
                  }

                  const queryString = nextSearchParams.toString();
                  const href = queryString ? `${pathname}?${queryString}` : pathname;

                  router.push(href as never, { scroll: false });
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          aria-busy={isLoading}
          className="rounded-[26px] border border-[#E1E7EF] bg-[linear-gradient(180deg,#FBFCFE_0%,#F7FAFD_100%)] p-4 md:p-5"
        >
          {isLoading ? <RecommendationPanelLoading /> : children}
        </div>
      </div>
    </Panel>
  );
}

function RecommendationPanelLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[28px] border border-[#E1E7EF] bg-white px-5 py-5 shadow-sm md:px-6 md:py-6"
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="loading-wave h-10 w-40 rounded-[12px]" />
                <div className="loading-wave h-4 w-36 rounded-full" />
                <div className="loading-wave h-4 w-56 rounded-full" />
              </div>

              <div className="loading-wave h-16 w-20 rounded-[18px]" />
            </div>

            <div className="grid gap-4">
              <RecommendationCardSkeleton titleWidthClassName="w-24" />
              <RecommendationCardSkeleton titleWidthClassName="w-20" />
            </div>

            <div className="space-y-3">
              <div className="loading-wave h-4 w-full rounded-full" />
              <div className="loading-wave h-4 w-10/12 rounded-full" />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="loading-wave h-10 w-36 rounded-[10px]" />
              <div className="loading-wave h-10 w-28 rounded-[10px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationCardSkeleton({
  titleWidthClassName
}: {
  titleWidthClassName: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#E6ECF3] bg-[var(--surface-subtle)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className={cn("loading-wave h-4 rounded-full", titleWidthClassName)} />
          <div className="loading-wave h-5 w-28 rounded-full" />
        </div>
        <div className="loading-wave h-4 w-24 rounded-full" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-2">
          <div className="loading-wave h-8 w-20 rounded-[10px]" />
          <div className="loading-wave h-4 w-14 rounded-full" />
        </div>
        <div className="space-y-2 md:pt-2">
          <div className="loading-wave h-3 w-24 rounded-full" />
          <div className="loading-wave h-3 w-28 rounded-full" />
        </div>
        <div className="space-y-2 md:text-right">
          <div className="loading-wave h-8 w-20 rounded-[10px] md:ml-auto" />
          <div className="loading-wave h-4 w-14 rounded-full md:ml-auto" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="loading-wave h-3 w-full rounded-full" />
        <div className="loading-wave h-3 w-9/12 rounded-full" />
      </div>
    </div>
  );
}
