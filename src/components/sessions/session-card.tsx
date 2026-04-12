import Link from "next/link";

import {
  getButtonClassName,
  getPillClassName
} from "@/components/shared/ui";
import { JourneyPreviewCard } from "@/components/shared/journey-preview-card";
import { cn } from "@/components/shared/ui";
import type {
  SessionCardRouteRow,
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
    article: "h-full flex flex-col overflow-hidden border-sea/20",
    badgeTone: "success",
    footer: "border-t border-line/80 bg-[var(--surface-subtle)]",
    surface: "flex-1 bg-white"
  },
  standard: {
    article: "h-full flex flex-col overflow-hidden",
    badgeTone: "info",
    footer: "border-t border-line/80 bg-slate-50/85",
    surface: "flex-1 bg-white"
  },
  muted: {
    article: "h-full flex flex-col overflow-hidden border-dashed bg-slate-50/80",
    badgeTone: "neutral",
    footer: "border-t border-line/80 bg-white/80",
    surface: "flex-1 bg-slate-50"
  }
} as const;

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
    <JourneyPreviewCard
      articleClassName={classes.article}
      bodyClassName={classes.surface}
      footerActions={
        <Link
          href={href as never}
          className={cn(
            "whitespace-nowrap",
            getButtonClassName({
              size: "md",
              tone: variant === "muted" ? "secondary" : "primary"
            })
          )}
        >
          Open Session
        </Link>
      }
      footerClassName={classes.footer}
      footerLeading={
        <>
          <div className={cn(getPillClassName(classes.badgeTone), "px-4 py-2 text-[12px]")}>
            {stateLabel}
          </div>
          <p className="text-sm font-semibold text-slate-500">{footerSummary}</p>
          {footerMessage ? (
            <p className="min-w-0 flex-1 text-sm text-slate-600">{footerMessage}</p>
          ) : null}
        </>
      }
      routeRows={routeRows}
      title={name}
      value={<p className="text-4xl font-semibold tracking-tight text-ink">{bestFare}</p>}
    />
  );
}
