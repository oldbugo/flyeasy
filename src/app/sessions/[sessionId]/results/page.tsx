import { notFound } from "next/navigation";

import { AiInfluencePanel } from "@/components/ai/ai-influence-panel";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { CandidateShortlistAction } from "@/components/candidates/candidate-shortlist-action";
import { BaselineExperimentBoard } from "@/components/insights/baseline-experiment-board";
import { SearchOutcomeDetails } from "@/components/insights/search-outcome-insights";
import { LiveResultsBoard } from "@/components/results/live-results-board";
import { RoutePlaceholder } from "@/components/shared/route-placeholder";
import { MetricCard, Panel } from "@/components/shared/ui";
import { SessionPageHeader } from "@/components/sessions/session-route-shell";
import { buildCandidateRecommendationGroups } from "@/lib/candidates/result-groups";
import { listLatestAiInfluenceForSession } from "@/lib/db/queries/ai";
import { listCandidatesForSession } from "@/lib/db/queries/candidates";
import { getSessionById } from "@/lib/db/queries/sessions";
import { formatIsoDate, formatMoney } from "@/lib/formatting";
import { getRunProgress } from "@/lib/runs/deterministic-engine";

type ResultsPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = await params;
  const [record, candidates, aiInfluence] = await Promise.all([
    getSessionById(sessionId),
    listCandidatesForSession(sessionId),
    listLatestAiInfluenceForSession(sessionId)
  ]);

  if (!record) {
    notFound();
  }

  const { baselineExperiment, currentBestCandidate, latestStrategyEvidence, session } = record;
  const latestRunProgress = record.latestRun ? await getRunProgress(record.latestRun.id) : null;
  const groupedResults = buildCandidateRecommendationGroups(candidates);
  const shortlistedCount = groupedResults.recommendationGroups.filter(
    (group) => group.representative.isShortlisted
  ).length;
  const directCount = groupedResults.recommendationGroups.filter(
    (group) => group.representative.stopCount === 0
  ).length;

  return (
    <div className="space-y-8">
      <SessionPageHeader
        badges={[
          { label: "Monitoring", value: session.monitoringState },
          {
            label: "Best current fare",
            value: currentBestCandidate
              ? formatMoney(
                  currentBestCandidate.displayedDisplayCurrency,
                  currentBestCandidate.displayedDisplayAmount
                )
              : "No fare yet"
          }
        ]}
        description="Results is the full information surface for the latest run: live progress, ranked itineraries, detailed search insights, grouped variants, stop patterns, and shortlist state."
        eyebrow="Results"
        title="Results"
      />
      {record.latestRun ? (
        <div className="space-y-6">
          <LiveResultsBoard
            initialPayload={{
              progress: latestRunProgress,
              runId: record.latestRun.id,
              status: record.latestRun.status
            }}
            sessionId={session.id}
            stopDurationMinDays={session.stopDurationMinDays}
          />

          <AiInfluencePanel items={aiInfluence} />

          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              description="Grouped recommendations from the newest persisted run, with exact duplicates removed."
              label="Latest run candidates"
              value={groupedResults.recommendationGroups.length}
            />
            <MetricCard
              description="Use shortlist to keep the grouped route patterns you want to revisit across reruns."
              label="Shortlisted"
              value={shortlistedCount}
            />
            <MetricCard
              description="Direct candidates are still shown for context even when the session prefers stopovers."
              label="Direct options"
              value={directCount}
            />
          </section>

          <SearchOutcomeDetails
            evidence={latestStrategyEvidence}
            latestRunStatus={record.latestRun?.status ?? null}
          />

          {baselineExperiment.recentRuns.length > 0 || baselineExperiment.latestSuite ? (
            <BaselineExperimentBoard summary={baselineExperiment} />
          ) : null}

          {groupedResults.duplicateCount > 0 ? (
            <Panel as="div" className="px-6 py-4 text-sm text-slate-600">
              Removed {groupedResults.duplicateCount} exact duplicate cards before rendering grouped recommendations.
            </Panel>
          ) : null}

          {candidates.length > 0 ? (
            <section className="grid gap-6 lg:grid-cols-2">
              {groupedResults.recommendationGroups.map((group) => (
                (() => {
                  const candidate = group.representative;

                  return (
                    <CandidateCard
                      key={group.groupKey}
                      bookingType={candidate.bookingType}
                      candidateId={candidate.id}
                      currency={candidate.displayedDisplayCurrency}
                      fare={candidate.displayedDisplayAmount}
                      href={`/sessions/${session.id}/candidates/${candidate.id}`}
                      isCurrentBest={candidate.isCurrentBest}
                      isShortlisted={candidate.isShortlisted}
                      intentionalStopCount={candidate.intentionalStopCount}
                      legs={candidate.legs}
                      outboundDestinationCity={candidate.outboundDestinationCity}
                      riskNotes={candidate.riskNotes}
                      secondaryAction={
                        <CandidateShortlistAction
                          candidateId={candidate.id}
                          isShortlisted={candidate.isShortlisted}
                          sessionId={session.id}
                        />
                      }
                      stopDurationMinDays={session.stopDurationMinDays}
                      stopovers={candidate.stopovers}
                      status={candidate.latestVerificationStatus}
                      stopCount={candidate.stopCount}
                      stitchedRiskLevel={candidate.stitchedRiskLevel}
                      totalTravelMinutes={candidate.totalTravelMinutes}
                      variantDateRanges={group.variants.slice(0, 5).map((variant) => {
                        const outboundLeg = variant.legs.find((leg) => leg.segmentGroup === "outbound");
                        const returnLeg = variant.legs.find((leg) => leg.segmentGroup === "return");
                        const days =
                          outboundLeg?.departureAt && returnLeg?.departureAt
                            ? Math.round(
                                (new Date(returnLeg.departureAt).getTime() -
                                  new Date(outboundLeg.departureAt).getTime()) /
                                  (24 * 60 * 60 * 1000)
                              )
                            : null;

                        return {
                          candidateId: variant.id,
                          days,
                          departDate: outboundLeg ? formatIsoDate(outboundLeg.departureAt) : null,
                          returnDate: returnLeg ? formatIsoDate(returnLeg.departureAt) : null
                        };
                      })}
                      variantGroupCount={group.variants.length}
                    />
                  );
                })()
              ))}
            </section>
          ) : (
            <RoutePlaceholder
              eyebrow="Results shell"
              title="Candidate list and ranking surface"
              description="No candidates have been persisted for the latest run yet. The live search timeline above will populate as results arrive."
            />
          )}
        </div>
      ) : (
        <RoutePlaceholder
          eyebrow="Results shell"
          title="Candidate list and ranking surface"
          description="No candidates have been persisted for this session yet. Start a baseline run to populate the results overview."
        />
      )}
    </div>
  );
}
