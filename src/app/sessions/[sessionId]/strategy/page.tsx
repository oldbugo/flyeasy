import { notFound } from "next/navigation";

import { StrategyProposalList } from "@/components/ai/strategy-proposal-list";
import { CompiledStrategyProgram } from "@/components/sessions/compiled-strategy-program";
import { SessionRouteShell } from "@/components/sessions/session-route-shell";
import { SessionStrategyForm } from "@/components/sessions/session-strategy-form";
import { getSessionById } from "@/lib/db/queries/sessions";
import { planStrategiesForSession } from "@/lib/runs/plan-strategies";

type SessionStrategyPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionStrategyPage({ params }: SessionStrategyPageProps) {
  const { sessionId } = await params;
  const record = await getSessionById(sessionId);

  if (!record) {
    notFound();
  }

  const { aiProposals, currentBestCandidate, session, strategySelections } = record;
  const plannedStrategies = planStrategiesForSession(session, strategySelections);
  const resultsIsRunning = record.hasRunnableActiveRun;
  const enabledBundleCount = strategySelections.filter(
    (selection) => selection.isRequired || selection.enabled
  ).length;

  return (
    <SessionRouteShell
      activeRun={record.currentActiveRun}
      activeRunCount={record.activeRunCount}
      badges={[
        { label: "Enabled strategies", value: String(enabledBundleCount) },
        {
          label: "Best current fare",
          value: currentBestCandidate
            ? `${currentBestCandidate.displayedDisplayCurrency} ${currentBestCandidate.displayedDisplayAmount.toLocaleString("en-AU", {
                maximumFractionDigits: 0
              })}`
            : "No fare yet"
        }
      ]}
      currentTab="strategy"
      description="Search strategy stays focused on planning: what each strategy does, what evidence it expects, and which bounded controls you can safely tune for this session."
      isArchived={session.lifecycleState === "archived"}
      monitoringEnabled={session.monitoringState === "enabled"}
      returnTo={`/sessions/${session.id}/strategy`}
      resultsIsRunning={resultsIsRunning}
      sessionId={session.id}
      sessionName={session.name}
      title="Search strategy"
    >
      <SessionStrategyForm
        returnTo={`/sessions/${session.id}/strategy`}
        searchIntensity={session.searchIntensity}
        selections={strategySelections}
        sessionId={session.id}
        strategyExperimentMode={session.strategyExperimentMode}
        strategyExperimentSampleSize={session.strategyExperimentSampleSize}
        sessionMaxStops={session.maxStops}
        sessionReturnOriginMode={session.returnOriginMode}
      />

      <CompiledStrategyProgram plans={plannedStrategies} />

      <StrategyProposalList
        proposals={aiProposals}
        returnTo={`/sessions/${session.id}/strategy`}
        sessionId={session.id}
      />
    </SessionRouteShell>
  );
}
