import Link from "next/link";

import {
  Panel,
  cn,
  getButtonClassName,
  getPillClassName
} from "@/components/shared/ui";
import type {
  SessionCardRouteRow,
  SessionCardRouteTone
} from "@/lib/db/queries/sessions";

type SessionCardProps = {
  bestFare: string;
  href: string;
  name: string;
  primaryStatusText: string;
  routeRows: SessionCardRouteRow[];
  secondaryStatusText: string;
  stateLabel: string;
  variant?: "featured" | "standard" | "muted";
};

const variantClasses = {
  featured: {
    article: "overflow-hidden border-sea/20",
    badgeTone: "success",
    footer: "border-t border-line/80 bg-[var(--surface-subtle)]",
    surface: "bg-white"
  },
  standard: {
    article: "overflow-hidden",
    badgeTone: "info",
    footer: "border-t border-line/80 bg-slate-50/85",
    surface: "bg-white"
  },
  muted: {
    article: "overflow-hidden border-dashed bg-slate-50/80",
    badgeTone: "neutral",
    footer: "border-t border-line/80 bg-white/80",
    surface: "bg-slate-50"
  }
} as const;

const toneClasses: Record<
  SessionCardRouteTone,
  {
    band: string;
    bandText: string;
    chip: string;
    code: string;
    date: string;
    endpoint: string;
    line: string;
  }
> = {
  default: {
    band: "bg-slate-100",
    bandText: "text-slate-600",
    chip: "border-slate-900 text-slate-900",
    code: "text-ink",
    date: "text-slate-700",
    endpoint: "border-slate-900 bg-white",
    line: "bg-slate-900"
  },
  info: {
    band: "bg-sky-50",
    bandText: "text-sky-800",
    chip: "border-sky-300 text-sky-900",
    code: "text-sky-800",
    date: "text-sky-700",
    endpoint: "border-sky-200 bg-sky-50/80",
    line: "bg-sky-300"
  },
  success: {
    band: "bg-emerald-50",
    bandText: "text-emerald-800",
    chip: "border-emerald-300 text-emerald-900",
    code: "text-emerald-800",
    date: "text-emerald-700",
    endpoint: "border-emerald-200 bg-emerald-50/80",
    line: "bg-emerald-300"
  },
  warning: {
    band: "bg-amber-50",
    bandText: "text-amber-800",
    chip: "border-amber-300 text-amber-900",
    code: "text-amber-800",
    date: "text-amber-700",
    endpoint: "border-amber-200 bg-amber-50/80",
    line: "bg-amber-300"
  }
};

function RouteEndpoint({
  code,
  label,
  tone
}: {
  code: string;
  label: string;
  tone: SessionCardRouteTone;
}) {
  const classes = toneClasses[tone];

  return (
    <div
      className={cn(
        "flex w-[72px] shrink-0 flex-col items-center rounded-[22px] border px-2 py-3 text-center sm:w-[92px] sm:px-3 sm:py-4",
        classes.endpoint
      )}
    >
      <p className={cn("text-xl font-semibold tracking-tight sm:text-2xl", classes.code)}>
        {code}
      </p>
      <p className={cn("mt-1 text-[11px] font-semibold sm:mt-2 sm:text-sm", classes.date)}>
        {label}
      </p>
    </div>
  );
}

function RouteTrack({
  durationLabel,
  tone
}: {
  durationLabel: string;
  tone: SessionCardRouteTone;
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

function RouteRow({ row }: { row: SessionCardRouteRow }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
        <RouteEndpoint
          code={row.startCode}
          label={row.startDateLabel}
          tone={row.startTone}
        />
        <RouteTrack durationLabel={row.durationLabel} tone={row.startTone} />
        <RouteEndpoint code={row.endCode} label={row.endDateLabel} tone={row.endTone} />
      </div>

      {row.stayDurationLabel ? (
        <div
          className={cn(
            "rounded-full px-4 py-1.5 text-center text-xs font-semibold tracking-[0.08em] sm:text-sm",
            toneClasses[row.endTone].band,
            toneClasses[row.endTone].bandText
          )}
        >
          {row.stayDurationLabel}
        </div>
      ) : null}
    </div>
  );
}

export function SessionCard({
  bestFare,
  href,
  name,
  primaryStatusText,
  routeRows,
  secondaryStatusText,
  stateLabel,
  variant = "standard"
}: SessionCardProps) {
  const classes = variantClasses[variant];
  const footerSummary = variant === "muted" ? "Stored" : primaryStatusText;
  const footerMessage = variant === "muted" ? secondaryStatusText : null;

  return (
    <Panel as="article" className={classes.article}>
      <div className={cn("px-6 pb-5 pt-5", classes.surface)}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="max-w-[58%] text-2xl font-semibold tracking-tight text-ink">
            {name}
          </h2>
          <p className="text-4xl font-semibold tracking-tight text-ink">{bestFare}</p>
        </div>

        <div className="mt-5 space-y-3">
          {routeRows.map((row, index) => (
            <RouteRow
              key={`${row.startCode}-${row.endCode}-${row.startDateLabel}-${index}`}
              row={row}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
          classes.footer
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className={cn(getPillClassName(classes.badgeTone), "px-4 py-2 text-[12px]")}>
            {stateLabel}
          </div>
          <p className="text-sm font-semibold text-slate-500">{footerSummary}</p>
          {footerMessage ? (
            <p className="min-w-0 flex-1 text-sm text-slate-600">{footerMessage}</p>
          ) : null}
        </div>

        <Link
          href={href as never}
          className={cn(
            "shrink-0 whitespace-nowrap",
            getButtonClassName({
              size: "md",
              tone: variant === "muted" ? "secondary" : "primary"
            })
          )}
        >
          Open Session
        </Link>
      </div>
    </Panel>
  );
}
