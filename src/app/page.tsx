import Link from "next/link";

import { Panel } from "@/components/shared/ui";
import { SessionCard } from "@/components/sessions/session-card";
import { listSessionsForDashboard } from "@/lib/db/queries/sessions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessions = await listSessionsForDashboard();
  const groupedSessions = {
    archived: sessions.filter((session) => session.lifecycleState === "archived"),
    live: sessions.filter((session) => session.isLive && session.lifecycleState !== "archived"),
    notLive: sessions.filter(
      (session) => !session.isLive && session.lifecycleState !== "archived"
    )
  };
  const sections = [
    { label: "Live hunts", items: groupedSessions.live },
    { label: "Not live", items: groupedSessions.notLive },
    { label: "Archived", items: groupedSessions.archived }
  ];

  return (
    <div className="space-y-8">
      <Panel className="px-8 py-10 text-white" tone="hero">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
          Sessions
        </p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight">
              Start the desktop foundation before the automation gets clever.
            </h1>
            <p className="mt-3 text-base leading-7 text-white/75">
              This bootstrap aligns the repo with the implementation plan:
              Electron shell, local Next.js UI, route scaffolding, and the first
              database and automation boundaries.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/sessions/new"
              className="inline-flex items-center justify-center rounded-[10px] bg-white px-[18px] py-[12px] text-sm font-semibold tracking-[-0.01em] text-ink transition hover:bg-[#F8FAFC] active:bg-slate-200"
            >
              New session
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-[10px] bg-white px-[18px] py-[12px] text-sm font-semibold tracking-[-0.01em] text-ink transition hover:bg-[#F8FAFC] active:bg-slate-200"
            >
              Settings
            </Link>
          </div>
        </div>
      </Panel>

      {sections.map(({ label, items }) => (
        <section key={label} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{label}</h2>
            <span className="text-sm text-slate-500">{items.length} sessions</span>
          </div>

          {items.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {items.map((session) => (
                <SessionCard
                  key={session.id}
                  {...session}
                  href={`/sessions/${session.id}`}
                  variant={
                    label === "Live hunts"
                      ? "featured"
                      : label === "Archived"
                        ? "muted"
                        : "standard"
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-line bg-white p-6 text-sm text-slate-500">
              No sessions in this group yet.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
