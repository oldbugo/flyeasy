import { notFound } from "next/navigation";

import { StrategyProposalList } from "@/components/ai/strategy-proposal-list";
import { CompiledStrategyProgram } from "@/components/sessions/compiled-strategy-program";
import { SessionPageHeader } from "@/components/sessions/session-route-shell";
import { SessionStrategyForm } from "@/components/sessions/session-strategy-form";
import { getSessionById } from "@/lib/db/queries/sessions";
import { planStrategiesForSession } from "@/lib/runs/plan-strategies";

type SessionStrategyPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    saved?: string | string[];
  }>;
};

export default async function SessionStrategyPage({
  params,
  searchParams
}: SessionStrategyPageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showSavedState =
    (Array.isArray(resolvedSearchParams?.saved)
      ? resolvedSearchParams?.saved[0]
      : resolvedSearchParams?.saved) === "1";
  const record = await getSessionById(sessionId);

  if (!record) {
    notFound();
  }

  const { aiProposals, currentBestCandidate, session, strategySelections } = record;
  const plannedStrategies = planStrategiesForSession(session, strategySelections);
  const formId = `session-strategy-form-${session.id}`;
  const enabledBundleCount = strategySelections.filter(
    (selection) => selection.isRequired || selection.enabled
  ).length;

  return (
    <div className="space-y-8">
      <SessionPageHeader
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
        description="Search strategy stays focused on planning: what each strategy does, what evidence it expects, and which bounded controls you can safely tune for this session."
        eyebrow="Search strategy"
        title="Search strategy"
      />
      <SessionStrategyForm
        formId={formId}
        returnTo={`/sessions/${session.id}/strategy?saved=1`}
        searchIntensity={session.searchIntensity}
        selections={strategySelections}
        sessionId={session.id}
        strategyExperimentMode={session.strategyExperimentMode}
        strategyExperimentSampleSize={session.strategyExperimentSampleSize}
        sessionMaxStops={session.maxStops}
        sessionReturnOriginMode={session.returnOriginMode}
        showSavedState={showSavedState}
      />

      <CompiledStrategyProgram plans={plannedStrategies} />

      <StrategyProposalList
        proposals={aiProposals}
        returnTo={`/sessions/${session.id}/strategy`}
        sessionId={session.id}
      />
    </div>
  );
}
