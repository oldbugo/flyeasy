import type { ReactNode } from "react";

import { Panel, cn } from "@/components/shared/ui";
import type { JourneyPreviewRow, JourneyPreviewTone } from "@/lib/journeys/route-preview";

const toneClasses: Record<
  JourneyPreviewTone,
  {
    band: string;
    bandBorder: string;
    bandText: string;
    chip: string;
    code: string;
    date: string;
    endpoint: string;
    line: string;
    time: string;
  }
> = {
  default: {
    band: "bg-slate-100",
    bandBorder: "border-slate-200",
    bandText: "text-slate-600",
    chip: "border-slate-900 text-slate-900",
    code: "text-ink",
    date: "text-slate-700",
    endpoint: "border-slate-900 bg-white",
    line: "bg-slate-900",
    time: "text-slate-500"
  },
  info: {
    band: "bg-[#D7EBFD]",
    bandBorder: "border-[#A8CCE8]",
    bandText: "text-[#285D90]",
    chip: "border-sky-400 text-sky-900",
    code: "text-[#1C5F92]",
    date: "text-[#1E6BA5]",
    endpoint: "border-[#8EC0E6] bg-white",
    line: "bg-[#7DC5F7]",
    time: "text-[#3376A8]"
  },
  success: {
    band: "bg-[#DCEFE5]",
    bandBorder: "border-[#A8D0BF]",
    bandText: "text-[#2A6C54]",
    chip: "border-emerald-400 text-emerald-900",
    code: "text-[#1E6B4D]",
    date: "text-[#2B7A5B]",
    endpoint: "border-[#82C7A8] bg-white",
    line: "bg-[#56B886]",
    time: "text-[#3B7E64]"
  },
  warning: {
    band: "bg-[#FFE4D4]",
    bandBorder: "border-[#F2BA98]",
    bandText: "text-[#AF5A28]",
    chip: "border-amber-400 text-amber-900",
    code: "text-[#9F4C1B]",
    date: "text-[#B35A1F]",
    endpoint: "border-[#F19C69] bg-white",
    line: "bg-[#F2A36D]",
    time: "text-[#B26533]"
  }
};

export type JourneyPreviewEndpointTarget = {
  code: string;
  dateLabel: string;
  position: "start" | "end";
  rowIndex: number;
  timeLabel: string;
  tone: JourneyPreviewTone;
};

type JourneyPreviewCardProps = {
  articleClassName?: string;
  bodyClassName?: string;
  footerActions: ReactNode;
  footerClassName?: string;
  footerLeading: ReactNode;
  headerMeta?: ReactNode;
  routeRows: JourneyPreviewRow[];
  title: ReactNode;
  value: ReactNode;
};

export function JourneyPreviewCard({
  articleClassName,
  bodyClassName,
  footerActions,
  footerClassName,
  footerLeading,
  headerMeta,
  routeRows,
  title,
  value
}: JourneyPreviewCardProps) {
  return (
    <Panel as="article" className={cn("overflow-hidden", articleClassName)}>
      <div className={cn("bg-white px-6 pb-5 pt-5", bodyClassName)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
            {headerMeta ? <div className="mt-2">{headerMeta}</div> : null}
          </div>
          <div className="shrink-0 text-right">{value}</div>
        </div>

        <JourneyPreviewRoutes className="mt-5" routeRows={routeRows} />
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 border-t border-line/80 bg-slate-50/85 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
          footerClassName
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{footerLeading}</div>
        <div className="flex shrink-0 flex-wrap gap-3">{footerActions}</div>
      </div>
    </Panel>
  );
}

export function JourneyPreviewRoutes({
  className,
  getEndpointAriaLabel,
  isEndpointInteractive,
  onEndpointClick,
  selectedEndpointKey,
  routeRows
}: {
  className?: string;
  getEndpointAriaLabel?: (target: JourneyPreviewEndpointTarget) => string;
  isEndpointInteractive?: (target: JourneyPreviewEndpointTarget) => boolean;
  onEndpointClick?: (target: JourneyPreviewEndpointTarget, anchorRect: DOMRect) => void;
  selectedEndpointKey?: string | null;
  routeRows: JourneyPreviewRow[];
}) {
  return (
    <div className={cn("space-y-0", className)}>
      {routeRows.map((row, index) => {
        const startTarget: JourneyPreviewEndpointTarget = {
          code: row.startCode,
          dateLabel: row.startDateLabel,
          position: "start",
          rowIndex: index,
          timeLabel: row.startTimeLabel,
          tone: row.startTone
        };
        const endTarget: JourneyPreviewEndpointTarget = {
          code: row.endCode,
          dateLabel: row.endDateLabel,
          position: "end",
          rowIndex: index,
          timeLabel: row.endTimeLabel,
          tone: row.endTone
        };

        const overlapPreviousStay = index > 0 && routeRows[index - 1]?.stayDurationLabel;

        return (
          <div
            key={`${row.startCode}-${row.endCode}-${row.startDateLabel}-${index}`}
            style={overlapPreviousStay ? { marginTop: "-6rem" } : undefined}
          >
            <JourneyPreviewRouteRow
              endTarget={endTarget}
              getEndpointAriaLabel={getEndpointAriaLabel}
              isEndpointInteractive={isEndpointInteractive}
              onEndpointClick={onEndpointClick}
              row={row}
              selectedEndpointKey={selectedEndpointKey}
              startTarget={startTarget}
            />
          </div>
        );
      })}
    </div>
  );
}

function JourneyPreviewRouteRow({
  endTarget,
  getEndpointAriaLabel,
  isEndpointInteractive,
  onEndpointClick,
  row,
  selectedEndpointKey,
  startTarget
}: {
  endTarget: JourneyPreviewEndpointTarget;
  getEndpointAriaLabel?: (target: JourneyPreviewEndpointTarget) => string;
  isEndpointInteractive?: (target: JourneyPreviewEndpointTarget) => boolean;
  onEndpointClick?: (target: JourneyPreviewEndpointTarget, anchorRect: DOMRect) => void;
  row: JourneyPreviewRow;
  selectedEndpointKey?: string | null;
  startTarget: JourneyPreviewEndpointTarget;
}) {
  const startKey = `${startTarget.rowIndex}:${startTarget.position}`;
  const endKey = `${endTarget.rowIndex}:${endTarget.position}`;

  return (
    <div className="relative">
      <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
        <JourneyPreviewEndpoint
          code={row.startCode}
          label={row.startDateLabel}
          timeLabel={row.startTimeLabel}
          tone={row.startTone}
          ariaLabel={getEndpointAriaLabel?.(startTarget)}
          interactive={isEndpointInteractive?.(startTarget) ?? false}
          onClick={
            isEndpointInteractive?.(startTarget) && onEndpointClick
              ? (anchorEl) => onEndpointClick(startTarget, anchorEl.getBoundingClientRect())
              : undefined
          }
          selected={selectedEndpointKey === startKey}
        />
        <JourneyPreviewTrack durationLabel={row.durationLabel} tone={row.startTone} />
        <JourneyPreviewEndpoint
          code={row.endCode}
          label={row.endDateLabel}
          timeLabel={row.endTimeLabel}
          tone={row.endTone}
          ariaLabel={getEndpointAriaLabel?.(endTarget)}
          interactive={isEndpointInteractive?.(endTarget) ?? false}
          onClick={
            isEndpointInteractive?.(endTarget) && onEndpointClick
              ? (anchorEl) => onEndpointClick(endTarget, anchorEl.getBoundingClientRect())
              : undefined
          }
          selected={selectedEndpointKey === endKey}
        />
      </div>

      {row.stayDurationLabel ? (
        <JourneyPreviewStayBand label={row.stayDurationLabel} tone={row.endTone} />
      ) : null}
    </div>
  );
}

function JourneyPreviewStayBand({
  label,
  tone
}: {
  label: string;
  tone: JourneyPreviewTone;
}) {
  const classes = toneClasses[tone];
  const bandInset = "4rem";

  return (
    <div
      className="relative px-2 sm:px-3"
      style={{
        marginTop: "-5rem",
        paddingBottom: bandInset,
        paddingTop: bandInset
      }}
    >
      <div
        className={cn(
          "absolute -left-10 -right-10 rounded-[30px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] sm:-left-12 sm:-right-12",
          classes.band,
          classes.bandBorder
        )}
        style={{ bottom: bandInset, top: bandInset }}
      />
      <div
        className={cn(
          "relative flex min-h-[4.5rem] items-center justify-center text-center text-[1.65rem] font-semibold leading-none tracking-[-0.04em] sm:min-h-[4.75rem]",
          classes.bandText
        )}
      >
        {label}
      </div>
    </div>
  );
}

function JourneyPreviewEndpoint({
  ariaLabel,
  code,
  interactive = false,
  label,
  onClick,
  selected = false,
  timeLabel,
  tone
}: {
  ariaLabel?: string;
  code: string;
  interactive?: boolean;
  label: string;
  onClick?: (anchorEl: HTMLElement) => void;
  selected?: boolean;
  timeLabel: string;
  tone: JourneyPreviewTone;
}) {
  const classes = toneClasses[tone];
  const content = (
    <>
      <p className={cn("text-[2rem] font-semibold leading-none tracking-[-0.05em]", classes.code)}>
        {code}
      </p>
      <p className={cn("mt-3 text-sm font-semibold leading-5", classes.date)}>{label}</p>
      <p className={cn("mt-1 text-xs font-medium leading-5", classes.time)}>{timeLabel}</p>
    </>
  );

  const className = cn(
    "relative z-20 flex w-[116px] shrink-0 flex-col items-start rounded-[24px] border px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] transition duration-150 sm:w-[128px]",
    classes.endpoint,
    selected && "border-sea/70 shadow-[0_0_0_2px_rgba(12,107,88,0.16),inset_0_1px_0_rgba(255,255,255,0.72)]",
    interactive &&
      "cursor-pointer hover:-translate-y-[1px] hover:border-sea/40 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/25"
  );

  if (interactive && onClick) {
    return (
      <button
        aria-label={ariaLabel}
        type="button"
        className={className}
        onClick={(event) => onClick(event.currentTarget)}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function JourneyPreviewTrack({
  durationLabel,
  tone
}: {
  durationLabel: string;
  tone: JourneyPreviewTone;
}) {
  const classes = toneClasses[tone];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
      <div className={cn("h-[3px] rounded-full", classes.line)} />
      <div
        className={cn(
          "rounded-full border bg-white px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] sm:px-3",
          classes.chip
        )}
      >
        {durationLabel}
      </div>
      <div className={cn("h-[3px] rounded-full", classes.line)} />
    </div>
  );
}
