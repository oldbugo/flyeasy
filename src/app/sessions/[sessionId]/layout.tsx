import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { SessionWorkspaceShell } from "@/components/sessions/session-route-shell";
import { getSessionShellById } from "@/lib/db/queries/session-shell";

type SessionLayoutProps = {
  children: ReactNode;
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionLayout({
  children,
  params
}: SessionLayoutProps) {
  const { sessionId } = await params;
  const record = await getSessionShellById(sessionId);

  if (!record) {
    notFound();
  }

  return (
    <SessionWorkspaceShell
      activeRun={record.currentActiveRun}
      activeRunCount={record.activeRunCount}
      currentBestFare={record.currentBestFare}
      isArchived={record.session.lifecycleState === "archived"}
      isLive={record.session.isLive}
      monitoringEnabled={record.session.monitoringState === "enabled"}
      sessionTripSummary={{
        departureStartDate: record.session.departureStartDate,
        durationMaxDays: record.session.durationMaxDays,
        durationMinDays: record.session.durationMinDays,
        originAirport: record.session.originAirport,
        outboundDestinationCity: record.session.outboundDestinationCity,
        returnDestinationAirport: record.session.returnDestinationAirport,
        returnEndDate: record.session.returnEndDate
      }}
      resultsIsRunning={record.hasRunnableActiveRun}
      sessionId={record.session.id}
      sessionName={record.session.name}
    >
      {children}
    </SessionWorkspaceShell>
  );
}
