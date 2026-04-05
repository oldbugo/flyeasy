import Link from "next/link";
import { notFound } from "next/navigation";

import {
  rerunSessionAction,
  startBaselineRunAction
} from "@/app/sessions/actions";
import { AiInfluencePanel } from "@/components/ai/ai-influence-panel";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { BaselineExperimentBoard } from "@/components/insights/baseline-experiment-board";
import { SearchOutcomeSummary } from "@/components/insights/search-outcome-insights";
import { RoutePlaceholder } from "@/components/shared/route-placeholder";
import { MetricCard, Panel, getButtonClassName } from "@/components/shared/ui";
import { SessionRouteShell } from "@/components/sessions/session-route-shell";
import {
  buildCandidateRecommendationGroups,
  isMultiCityCandidate
} from "@/lib/candidates/result-groups";
import { listLatestAiInfluenceForSession } from "@/lib/db/queries/ai";
import { listCandidatesForSession } from "@/lib/db/queries/candidates";
import { getSessionHistorySnapshot } from "@/lib/db/queries/history";
import { getSessionById } from "@/lib/db/queries/sessions";
import { formatIsoDateTime, formatMoney } from "@/lib/formatting";

type SessionOverviewPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    recommendationView?: string | string[];
  }>;
};

export default async function SessionOverviewPage({
  params,
  searchParams
}: SessionOverviewPageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [record, candidates, aiInfluence, historySnapshot] = await Promise.all([
    getSessionById(sessionId),
    listCandidatesForSession(sessionId),
    listLatestAiInfluenceForSession(sessionId),
    getSessionHistorySnapshot(sessionId)
  ]);

  if (!record) {
    notFound();
  }

  const { baselineExperiment, currentBestCandidate, latestStrategyEvidence, session } = record;
  const resultsIsRunning = record.hasRunnableActiveRun;
  const groupedResults = buildCandidateRecommendationGroups(candidates);
  const latestRun = historySnapshot.runs[0] ?? null;
  const recommendationView =
    (Array.isArray(resolvedSearchParams?.recommendationView)
      ? resolvedSearchParams?.recommendationView[0]
      : resolvedSearchParams?.recommendationView) === "multi_city"
      ? "multi_city"
      : "round_trip";
  const roundTripRecommendations = groupedResults.recommendationGroups.filter(
    (group) => !isMultiCityCandidate(group.representative)
  );
  const multiCityRecommendations = groupedResults.recommendationGroups.filter((group) =>
    isMultiCityCandidate(group.representative)
  );
  const activeRecommendationGroups =
    recommendationView === "multi_city" ? multiCityRecommendations : roundTripRecommendations;
  const topRecommendations = activeRecommendationGroups.slice(0, 2);

  return (
    <SessionRouteShell
      activeRun={record.currentActiveRun}
      activeRunCount={record.activeRunCount}
      badges={[
        {
          label: "Latest fare",
          value: currentBestCandidate
            ? formatMoney(
                currentBestCandidate.displayedDisplayCurrency,
                currentBestCandidate.displayedDisplayAmount
              )
            : "No fare yet"
        },
        {
          label: "Latest run",
          value: latestRun ? latestRun.status : "No run yet"
        }
      ]}
      currentTab="overview"
      description="Overview keeps the latest search outcome front and center, with rerun controls and recent monitoring context nearby."
      isArchived={session.lifecycleState === "archived"}
      monitoringEnabled={session.monitoringState === "enabled"}
      returnTo={`/sessions/${session.id}`}
      resultsIsRunning={resultsIsRunning}
      sessionId={session.id}
      sessionName={session.name}
      title="Overview"
    >
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Latest outcome
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {latestRun
              ? latestRun.summaryText ?? "Latest run completed without a summary."
              : "No search has been run for this session yet."}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {latestRun
              ? `Started ${formatIsoDateTime(latestRun.startedAt)}. Candidates found: ${latestRun.totalCandidatesFound}.`
              : "Start the first baseline run to populate the overview with real itinerary results."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {latestRun ? (
            <form action={rerunSessionAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                type="submit"
                className={getButtonClassName({ size: "sm", tone: "secondary" })}
              >
                Rerun now
              </button>
            </form>
          ) : (
            <form action={startBaselineRunAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                type="submit"
                className={getButtonClassName({ size: "sm", tone: "primary" })}
              >
                Start baseline run
              </button>
            </form>
          )}
        </div>
      </Panel>

      <SearchOutcomeSummary evidence={latestStrategyEvidence} />

      {baselineExperiment.recentRuns.length > 0 || baselineExperiment.latestSuite ? (
        <BaselineExperimentBoard compact summary={baselineExperiment} />
      ) : null}

      <AiInfluencePanel items={aiInfluence} />

      {roundTripRecommendations.length > 0 || multiCityRecommendations.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Top recommendations</h2>
            <p className="text-sm text-slate-500">
              Showing {topRecommendations.length} of {activeRecommendationGroups.length}{" "}
              {recommendationView === "multi_city" ? "multi-city" : "round-trip"} grouped results
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-2 rounded-full border border-line bg-white p-1.5 shadow-sm">
            <Link
              href={`/sessions/${session.id}`}
              className={getButtonClassName({
                active: recommendationView === "round_trip",
                size: "sm",
                tone: recommendationView === "round_trip" ? "primary" : "secondary"
              })}
            >
              Top recommendations
            </Link>
            <Link
              href={`/sessions/${session.id}?recommendationView=multi_city`}
              className={getButtonClassName({
                active: recommendationView === "multi_city",
                size: "sm",
                tone: recommendationView === "multi_city" ? "primary" : "secondary"
              })}
            >
              Top multi-city trips
            </Link>
          </div>
          {topRecommendations.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {topRecommendations.map((group) => {
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
                  runId={candidate.runId}
                  sessionId={session.id}
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
                      departDate: outboundLeg?.departureAt ?? null,
                      returnDate: returnLeg?.departureAt ?? null
                    };
                  })}
                  variantGroupCount={group.variants.length}
                />
              );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-line bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
              {recommendationView === "multi_city"
                ? "No multi-city recommendations have been recorded yet. Enable a multi-city strategy and rerun the session to populate this tab."
                : "No round-trip recommendations have been recorded yet."}
            </div>
          )}
        </section>
      ) : (
        <RoutePlaceholder
          eyebrow="Overview"
          title="Latest search outcome will show here"
          description="The overview stays focused on the most recent results. Run a search to populate it."
        />
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <MetricCard
          description={
            latestRun
              ? `Last run started ${formatIsoDateTime(latestRun.startedAt)}`
              : "No run has been created for this session yet."
          }
          label="Latest run status"
          value={latestRun?.status ?? "none"}
        />
        <MetricCard
          description="Recent displayed-price observations available in history."
          label="Recent prices"
          value={historySnapshot.recentPrices.length}
        />
        <MetricCard
          description="Route families you kept for later comparison across reruns."
          label="Shortlisted families"
          value={historySnapshot.shortlistCount}
        />
      </section>
    </SessionRouteShell>
  );
}
