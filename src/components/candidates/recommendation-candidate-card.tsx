"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { JourneyPreviewRoutes } from "@/components/shared/journey-preview-card";
import { Panel, cn, getPillClassName } from "@/components/shared/ui";
import type {
  CandidateRecommendationGroup,
  CandidateResult
} from "@/lib/candidates/result-groups";
import {
  buildJourneyPreviewRows,
  type JourneyPreviewRow
} from "@/lib/journeys/route-preview";
import { formatMoney } from "@/lib/formatting";

type PopupAnchorRect = {
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type RecommendationDateTarget = {
  position: "start" | "end";
  rowIndex: number;
};

type RecommendationPopoverState =
  | {
      anchorRect: PopupAnchorRect;
      kind: "date";
      target: RecommendationDateTarget;
    }
  | null;

type RecommendationCandidateCardProps = {
  group: CandidateRecommendationGroup;
  stopDurationMinDays?: number | null;
};

type TripDateOption = {
  key: string;
  label: string;
};

function formatCompactDate(value: string | null | undefined) {
  if (!value) {
    return "Date pending";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function formatPresentedDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    weekday: "short"
  }).format(new Date(value));
}

function formatCalendarMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function buildCalendarDays(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthIndex = month - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const leadingBlankCount = firstDay.getDay();
  const cells: Array<{ dateKey: string | null; dayNumber: number | null }> = [];

  for (let index = 0; index < leadingBlankCount; index += 1) {
    cells.push({ dateKey: null, dayNumber: null });
  }

  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    const dateKey = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${dayNumber
      .toString()
      .padStart(2, "0")}`;
    cells.push({ dateKey, dayNumber });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, dayNumber: null });
  }

  return cells;
}

function getDateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function getOutboundDepartureAt(candidate: CandidateResult) {
  return candidate.legs.find((leg) => leg.segmentGroup === "outbound")?.departureAt ?? null;
}

function getReturnDepartureAt(candidate: CandidateResult) {
  return candidate.legs.find((leg) => leg.segmentGroup === "return")?.departureAt ?? null;
}

function getEndpointDateValue(
  candidate: CandidateResult,
  target: RecommendationDateTarget
) {
  const leg = candidate.legs[target.rowIndex];

  if (!leg) {
    return null;
  }

  return target.position === "start" ? leg.departureAt : leg.arrivalAt;
}

function getEndpointDateKey(
  candidate: CandidateResult,
  target: RecommendationDateTarget
) {
  return getDateKey(getEndpointDateValue(candidate, target));
}

function getEndpointTargets(candidate: CandidateResult): RecommendationDateTarget[] {
  return candidate.legs.flatMap((_, rowIndex) => [
    {
      position: "start" as const,
      rowIndex
    },
    {
      position: "end" as const,
      rowIndex
    }
  ]);
}

function buildDateOptions(
  variants: CandidateResult[],
  target: RecommendationDateTarget
) {
  const options = new Map<string, TripDateOption>();

  for (const variant of variants) {
    const value = getEndpointDateValue(variant, target);
    const key = getDateKey(value);

    if (!value || !key || options.has(key)) {
      continue;
    }

    options.set(key, {
      key,
      label: formatPresentedDate(value)
    });
  }

  return [...options.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function getVariantMatchState(
  variants: CandidateResult[],
  activeCandidate: CandidateResult,
  target: RecommendationDateTarget,
  nextDateKey: string
) {
  const hasLinkedMatch = variants.some((variant) => {
    if (getEndpointDateKey(variant, target) !== nextDateKey) {
      return false;
    }

    return getEndpointTargets(activeCandidate).every((otherTarget) => {
      if (
        otherTarget.rowIndex === target.rowIndex &&
        otherTarget.position === target.position
      ) {
        return true;
      }

      return (
        getEndpointDateKey(variant, otherTarget) ===
        getEndpointDateKey(activeCandidate, otherTarget)
      );
    });
  });

  return hasLinkedMatch ? "linked" : "requires_pair_change";
}

function pickPreferredVariant(candidates: CandidateResult[]) {
  return [...candidates].sort((left, right) => {
    const priceDifference = left.displayedDisplayAmount - right.displayedDisplayAmount;

    if (priceDifference !== 0) {
      return priceDifference;
    }

    const travelDifference =
      (left.totalTravelMinutes ?? Number.MAX_SAFE_INTEGER) -
      (right.totalTravelMinutes ?? Number.MAX_SAFE_INTEGER);

    if (travelDifference !== 0) {
      return travelDifference;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

function getNextVariantForDateSelection(
  variants: CandidateResult[],
  activeCandidate: CandidateResult,
  target: RecommendationDateTarget,
  nextDateKey: string
) {
  const exactMatches = variants.filter((variant) => {
    if (getEndpointDateKey(variant, target) !== nextDateKey) {
      return false;
    }

    return getEndpointTargets(activeCandidate).every((otherTarget) => {
      if (
        otherTarget.rowIndex === target.rowIndex &&
        otherTarget.position === target.position
      ) {
        return true;
      }

      return (
        getEndpointDateKey(variant, otherTarget) ===
        getEndpointDateKey(activeCandidate, otherTarget)
      );
    });
  });

  if (exactMatches.length > 0) {
    return pickPreferredVariant(exactMatches);
  }

  const dateMatches = variants.filter(
    (variant) => getEndpointDateKey(variant, target) === nextDateKey
  );

  return pickPreferredVariant(dateMatches);
}

function getDatePopoverTitle(
  routeRows: JourneyPreviewRow[],
  target: RecommendationDateTarget
) {
  if (target.position === "start" && target.rowIndex === 0) {
    return "Departure date";
  }

  if (target.position === "end" && target.rowIndex === routeRows.length - 1) {
    return "Return date";
  }

  const routeRow = routeRows[target.rowIndex];
  const code = target.position === "start" ? routeRow?.startCode : routeRow?.endCode;

  return `${code ?? "Stopover"} ${target.position === "start" ? "departure" : "arrival"} date`;
}

export function RecommendationCandidateCard({
  group,
  stopDurationMinDays: _stopDurationMinDays
}: RecommendationCandidateCardProps) {
  const [activeCandidateId, setActiveCandidateId] = useState(group.representative.id);
  const [activePopover, setActivePopover] = useState<RecommendationPopoverState>(null);
  const activeCandidate =
    group.variants.find((variant) => variant.id === activeCandidateId) ?? group.representative;
  const routeRows = buildJourneyPreviewRows({
    departureStartDate: activeCandidate.legs[0]?.departureAt ?? new Date().toISOString(),
    fallbackDestinationLabel: activeCandidate.outboundDestinationCity,
    legs: activeCandidate.legs.map((leg) => ({
      arrivalAt: leg.arrivalAt,
      departureAt: leg.departureAt,
      destinationAirport: leg.destinationAirport,
      originAirport: leg.originAirport
    })),
    originAirport: activeCandidate.legs[0]?.originAirport ?? "Origin"
  });
  const selectedEndpointKey =
    activePopover?.kind === "date"
      ? `${activePopover.target.rowIndex}:${activePopover.target.position}`
      : null;

  return (
    <Panel as="article" className="overflow-hidden">
      <div className="px-6 pb-6 pt-6">
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-semibold tracking-tight text-ink">
                {formatMoney(
                  activeCandidate.displayedDisplayCurrency,
                  activeCandidate.displayedDisplayAmount
                )}
              </h2>
              {activeCandidate.isCurrentBest ? (
                <span className={getPillClassName("success")}>Current best</span>
              ) : null}
            </div>
          </div>
        </div>

        <JourneyPreviewRoutes
          className="mt-6"
          getEndpointAriaLabel={(target) => {
            const optionCount = buildDateOptions(group.variants, {
              position: target.position,
              rowIndex: target.rowIndex
            }).length;

            if (optionCount <= 1) {
              return `View ${target.code} ${target.position === "start" ? "departure" : "arrival"} date`;
            }

            if (target.position === "start" && target.rowIndex === 0) {
              return "Change departure date";
            }

            if (target.position === "end" && target.rowIndex === routeRows.length - 1) {
              return "Change return date";
            }

            return `Change ${target.code} ${target.position === "start" ? "departure" : "arrival"} date`;
          }}
          isEndpointInteractive={() => true}
          onEndpointClick={(target, anchorRect) => {
            const dateTarget = {
              position: target.position,
              rowIndex: target.rowIndex
            } satisfies RecommendationDateTarget;

            setActivePopover((current) =>
              current?.kind === "date" &&
              current.target.position === dateTarget.position &&
              current.target.rowIndex === dateTarget.rowIndex
                ? null
                : {
                    anchorRect: {
                      height: anchorRect.height,
                      left: anchorRect.left,
                      right: anchorRect.right,
                      top: anchorRect.top,
                      width: anchorRect.width
                    },
                    kind: "date",
                    target: dateTarget
                  }
            );
          }}
          routeRows={routeRows}
          selectedEndpointKey={selectedEndpointKey}
        />
      </div>

      {activePopover
        ? createPortal(
            <>
              <button
                aria-label="Close recommendation selector"
                className="fixed inset-0 z-30 cursor-default"
                type="button"
                onClick={() => setActivePopover(null)}
              />
              <RecommendationDateCalendar
                key={`${activePopover.target.rowIndex}:${activePopover.target.position}`}
                activeCandidate={activeCandidate}
                activeDateKey={getEndpointDateKey(activeCandidate, activePopover.target)}
                anchorRect={activePopover.anchorRect}
                onClose={() => setActivePopover(null)}
                onSelectDate={(nextDateKey) => {
                  const nextVariant = getNextVariantForDateSelection(
                    group.variants,
                    activeCandidate,
                    activePopover.target,
                    nextDateKey
                  );

                  if (nextVariant) {
                    setActiveCandidateId(nextVariant.id);
                  }
                }}
                options={buildDateOptions(group.variants, activePopover.target)}
                routeRows={routeRows}
                target={activePopover.target}
                variants={group.variants}
              />
            </>,
            document.body
          )
        : null}
    </Panel>
  );
}

function RecommendationDateCalendar({
  activeCandidate,
  activeDateKey,
  anchorRect,
  onClose,
  onSelectDate,
  options,
  routeRows,
  target,
  variants
}: {
  activeCandidate: CandidateResult;
  activeDateKey: string | null;
  anchorRect: PopupAnchorRect;
  onClose: () => void;
  onSelectDate: (nextDateKey: string) => void;
  options: TripDateOption[];
  routeRows: JourneyPreviewRow[];
  target: RecommendationDateTarget;
  variants: CandidateResult[];
}) {
  const activeOption =
    options.find((option) => option.key === activeDateKey) ?? options[0] ?? null;
  const availableMonthKeys = [...new Set(options.map((option) => getMonthKey(option.key)))];
  const activeMonthKey = activeOption ? getMonthKey(activeOption.key) : null;
  const [visibleMonthKey, setVisibleMonthKey] = useState(activeMonthKey);
  const [popoverHeight, setPopoverHeight] = useState<number | null>(null);
  const presentedMonthKey =
    visibleMonthKey && availableMonthKeys.includes(visibleMonthKey)
      ? visibleMonthKey
      : activeMonthKey ?? availableMonthKeys[0] ?? null;

  if (!activeOption || !presentedMonthKey) {
    return null;
  }

  const currentMonthIndex = Math.max(0, availableMonthKeys.indexOf(presentedMonthKey));
  const optionMap = new Map(options.map((option) => [option.key, option]));
  const calendarDays = buildCalendarDays(presentedMonthKey);
  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const popupPosition = resolvePopupPosition({
    anchorRect,
    popoverHeight,
    popoverWidth: 300
  });

  return (
    <div
      ref={(node) => {
        const nextHeight = node?.getBoundingClientRect().height ?? null;

        if (nextHeight !== null && nextHeight !== popoverHeight) {
          setPopoverHeight(nextHeight);
        }
      }}
      className="fixed z-40 w-[18.75rem] rounded-[22px] border border-[#DDE6F0] bg-[linear-gradient(180deg,#FBFCFE_0%,#F5F8FC_100%)] px-3 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.92)]"
      role="dialog"
      style={{
        left: popupPosition.left,
        top: popupPosition.top,
        visibility: popoverHeight === null ? "hidden" : "visible"
      }}
    >
      <span
        className="absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-[#DDE6F0] bg-[#F5F8FC]"
        style={{ left: popupPosition.arrowLeft }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {getDatePopoverTitle(routeRows, target)}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <SliderStepButton
              direction="previous"
              disabled={currentMonthIndex === 0}
              onClick={() =>
                setVisibleMonthKey(
                  availableMonthKeys[currentMonthIndex - 1] ?? presentedMonthKey
                )
              }
            />
            <p className="min-w-[9.5rem] text-center text-base font-semibold tracking-tight text-ink">
              {formatCalendarMonth(presentedMonthKey)}
            </p>
            <SliderStepButton
              direction="next"
              disabled={currentMonthIndex === availableMonthKeys.length - 1}
              onClick={() =>
                setVisibleMonthKey(
                  availableMonthKeys[currentMonthIndex + 1] ?? presentedMonthKey
                )
              }
            />
          </div>
        </div>

        <button
          type="button"
          className="rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-400 hover:text-ink"
          onClick={onClose}
        >
          Done
        </button>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
            >
              {label}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            if (!day.dateKey || day.dayNumber === null) {
              return <div key={`blank-${presentedMonthKey}-${index}`} className="aspect-square" />;
            }

            const option = optionMap.get(day.dateKey);
            const isActive = option?.key === activeOption.key;
            const tone = option
              ? getVariantMatchState(variants, activeCandidate, target, option.key)
              : null;

            return (
              <button
                key={day.dateKey}
                disabled={!option}
                type="button"
                className={cn(
                  "aspect-square rounded-[10px] border text-[13px] font-semibold transition",
                  isActive
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_0_0_2px_rgba(16,185,129,0.08)]"
                    : option && tone === "linked"
                      ? "border-sky-300 bg-sky-50 text-[#315A8D] hover:border-sky-400"
                      : option && tone === "requires_pair_change"
                        ? "border-[#F0A36A] bg-[#FFF4EA] text-[#B65A1A] hover:border-[#DA7A38]"
                        : "border-line bg-white text-slate-300"
                )}
                onClick={() => {
                  if (option) {
                    onSelectDate(option.key);
                  }
                }}
              >
                {day.dayNumber}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-sm font-medium text-slate-600">{activeOption.label}</p>

        {options.length <= 1 ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            No alternate dates are available for this stop in the current recommendation set yet.
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Current date
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7FB8F1]" />
            Works with the current itinerary dates
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0A36A]" />
            Needs another itinerary date to shift too
          </span>
        </div>
      </div>
    </div>
  );
}

function resolvePopupPosition({
  anchorRect,
  popoverHeight,
  popoverWidth
}: {
  anchorRect: PopupAnchorRect;
  popoverHeight: number | null;
  popoverWidth: number;
}) {
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const rawLeft = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
  const left = Math.min(
    Math.max(16, rawLeft),
    Math.max(16, viewportWidth - popoverWidth - 16)
  );
  const arrowLeft = Math.min(
    Math.max(24, anchorRect.left + anchorRect.width / 2 - left - 6),
    popoverWidth - 24
  );
  const top = Math.max(16, anchorRect.top - (popoverHeight ?? 0) - 12);

  return {
    arrowLeft,
    left,
    top
  };
}

function SliderStepButton({
  direction,
  disabled,
  onClick
}: {
  direction: "next" | "previous";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={direction === "previous" ? "Previous month" : "Next month"}
      disabled={disabled}
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white text-sm font-semibold text-ink transition",
        disabled
          ? "cursor-not-allowed border-line/70 text-slate-300"
          : "border-line hover:border-sea hover:text-sea"
      )}
      onClick={onClick}
    >
      {direction === "previous" ? "<" : ">"}
    </button>
  );
}
