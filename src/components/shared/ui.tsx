import type { ReactNode } from "react";

type SurfaceTone = "default" | "hero" | "subtle";
type ButtonTone = "primary" | "secondary" | "danger";
type IconButtonTone = "primary" | "secondary";
type PillTone = "neutral" | "success" | "warning" | "info" | "danger";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getButtonClassName({
  active = false,
  size = "md",
  tone = "secondary"
}: {
  active?: boolean;
  size?: "sm" | "md";
  tone?: ButtonTone;
}) {
  const sizeClassName =
    size === "sm" ? "px-4 py-2 text-sm" : "px-5 py-3 text-sm";
  const interactiveClassName =
    "inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold tracking-[-0.01em] transition duration-150 focus-visible:outline-none focus-visible:ring-0";

  if (active || tone === "primary") {
    return cn(
      interactiveClassName,
      sizeClassName,
      "border-sea bg-sea text-white hover:bg-[#0A5C4C] active:border-[#08463A] active:bg-[#08463A] focus-visible:border-[#6EE7B7] focus-visible:border-[3px]"
    );
  }

  if (tone === "danger") {
    return cn(
      interactiveClassName,
      sizeClassName,
      "border-[#FCA5A5] bg-[#FFF1F2] text-[#BE123C] hover:border-[#FB7185] hover:bg-[#FFE4E6] hover:text-[#9F1239] active:border-[#F43F5E] active:bg-[#FECDD3] active:text-[#881337] focus-visible:border-[#BE123C] focus-visible:border-2"
    );
  }

  return cn(
    interactiveClassName,
    sizeClassName,
    "border-line bg-white text-slate-700 hover:border-sea hover:bg-[#F8FAFC] hover:text-sea active:border-slate-400 active:bg-slate-200 active:text-ink focus-visible:border-sea focus-visible:border-2"
  );
}

export function getIconButtonClassName({
  tone = "secondary"
}: {
  tone?: IconButtonTone;
}) {
  const baseClassName =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border transition duration-150 focus-visible:outline-none focus-visible:ring-0";

  if (tone === "primary") {
    return cn(
      baseClassName,
      "border-sea bg-sea text-white hover:bg-[#0A5C4C] active:border-[#08463A] active:bg-[#08463A] focus-visible:border-[#6EE7B7] focus-visible:border-[3px]"
    );
  }

  return cn(
    baseClassName,
    "border-line bg-white text-slate-700 hover:border-sea hover:bg-[#F8FAFC] hover:text-sea active:border-slate-400 active:bg-slate-200 active:text-ink focus-visible:border-sea focus-visible:border-2"
  );
}

export function getPillClassName(tone: PillTone = "neutral") {
  const baseClassName =
    "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]";

  switch (tone) {
    case "success":
      return cn(baseClassName, "border-emerald-200 bg-emerald-50 text-emerald-800");
    case "warning":
      return cn(baseClassName, "border-amber-200 bg-amber-50 text-amber-800");
    case "info":
      return cn(baseClassName, "border-sky-200 bg-sky-50 text-sky-800");
    case "danger":
      return cn(baseClassName, "border-rose-200 bg-rose-50 text-rose-700");
    default:
      return cn(baseClassName, "border-slate-200 bg-slate-100 text-slate-700");
  }
}

export function Panel({
  as: Element = "section",
  children,
  className,
  tone = "default"
}: {
  as?: "article" | "div" | "section";
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
}) {
  const toneClassName =
    tone === "hero"
      ? "border border-slate-900/10 bg-ink text-white shadow-sm"
      : tone === "subtle"
        ? "border border-white/70 bg-[var(--surface-subtle)] shadow-sm"
        : "border border-line bg-white shadow-sm";

  return (
    <Element className={cn("rounded-[30px]", toneClassName, className)}>
      {children}
    </Element>
  );
}

export function StatBadge({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-mist px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink">{value}</div>
    </div>
  );
}

export function MetricCard({
  description,
  label,
  value
}: {
  description: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <Panel className="p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
        {label}
      </p>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
    </Panel>
  );
}
