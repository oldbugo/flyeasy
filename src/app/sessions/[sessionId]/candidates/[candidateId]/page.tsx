import { notFound } from "next/navigation";

import {
  clearShortlistStatusAction,
  setShortlistStatusAction
} from "@/app/sessions/actions";
import { CandidateFlightVisualSection } from "@/components/candidates/candidate-flight-visual-section";
import { SessionPageHeader } from "@/components/sessions/session-route-shell";
import { getCandidateById } from "@/lib/db/queries/candidates";
import { getSessionById } from "@/lib/db/queries/sessions";
import {
  formatDurationMinutes,
  formatIsoDateTime,
  formatMoney,
  formatStopSummary,
  isDisplayedIntentionalStopover,
  resolveDisplayedIntentionalStopCount,
  resolveDisplayedStopCount
} from "@/lib/formatting";

type CandidatePageProps = {
  params: Promise<{
    candidateId: string;
    sessionId: string;
  }>;
};

export default async function CandidatePage({ params }: CandidatePageProps) {
  const { candidateId, sessionId } = await params;
  const [record, candidateRecord] = await Promise.all([
    getSessionById(sessionId),
    getCandidateById(candidateId, sessionId)
  ]);

  if (!record || !candidateRecord) {
    notFound();
  }

  const { session } = record;
  const { candidate, family, legs, observations, shortlistEntry, stopovers } = candidateRecord;
  const displayedIntentionalStopCount = resolveDisplayedIntentionalStopCount({
    stopDurationMinDays: session.stopDurationMinDays,
    stopovers,
    storedIntentionalStopCount: candidate.intentionalStopCount
  });
  const displayedStopCount = resolveDisplayedStopCount({
    extractedStopoverCount: stopovers.length,
    intentionalStopCount: displayedIntentionalStopCount,
    storedStopCount: candidate.stopCount
  });

  return (
    <div className="space-y-8">
      <SessionPageHeader
        badges={[
          { label: "Booking mode", value: candidate.bookingType },
          { label: "Travel time", value: formatDurationMinutes(candidate.totalTravelMinutes) }
        ]}
        description="This is the manual booking handoff view for one result. It keeps route shape, fare observations, and shortlist intent visible without automating Trip.com checkout."
        eyebrow="Candidate detail"
        title="Candidate detail"
      />
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="space-y-6">
          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Candidate summary
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {formatMoney(candidate.displayedDisplayCurrency, candidate.displayedDisplayAmount)}
            </h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-mist px-4 py-2">
                {formatStopSummary(displayedStopCount, displayedIntentionalStopCount)}
              </span>
              <span className="rounded-full bg-mist px-4 py-2">
                {candidate.fareClassSummary ?? "Unknown cabin"}
              </span>
              <span className="rounded-full bg-mist px-4 py-2">
                {candidate.latestVerificationStatus}
              </span>
              {candidate.stitchedRiskLevel ? (
                <span className="rounded-full bg-mist px-4 py-2">
                  {candidate.stitchedRiskLevel} stitched risk
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {candidate.riskNotes ?? "No risk notes recorded yet."}
            </p>

            <CandidateFlightVisualSection
              className="mt-6"
              legs={legs}
              stopDurationMinDays={session.stopDurationMinDays}
              stopovers={stopovers}
            />

            <div className="mt-6 flex flex-wrap gap-3">
              {shortlistEntry ? (
                <form action={clearShortlistStatusAction}>
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/sessions/${session.id}/candidates/${candidate.id}`}
                  />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-500 hover:text-amber-800"
                  >
                    Remove shortlist
                  </button>
                </form>
              ) : (
                <form action={setShortlistStatusAction}>
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/sessions/${session.id}/candidates/${candidate.id}`}
                  />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="status" value="top_pick" />
                  <button
                    type="submit"
                    className="rounded-full bg-sea px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  >
                    Mark as top pick
                  </button>
                </form>
              )}

              <a
                href={candidate.tripcomResumeUrl ?? "https://au.trip.com/flights/"}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
              >
                Open Trip.com
              </a>
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Raw leg structure
            </p>
            <div className="mt-4 space-y-3">
              {legs.map((leg) => (
                <div key={leg.id} className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold capitalize text-ink">
                    {leg.segmentGroup} | {leg.originAirport} to {leg.destinationAirport}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatIsoDateTime(leg.departureAt)} to {formatIsoDateTime(leg.arrivalAt)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {leg.flightNumber ?? leg.carrierCode ?? "Carrier pending"} |{" "}
                    {leg.fareBrand ?? "No fare brand"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Price observations
            </p>
            <div className="mt-4 space-y-3">
              {observations.map((observation) => (
                <div key={observation.id} className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">
                    {formatMoney(observation.displayCurrency, observation.displayAmount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{observation.priceKind}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatIsoDateTime(observation.observedAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </article>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Trust and handoff
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Family key: {family?.familyKey ?? "Unknown"}</p>
              <p>Shortlist state: {shortlistEntry?.status ?? "Not shortlisted"}</p>
              <p>Current best flag: {candidate.isCurrentBest ? "Yes" : "No"}</p>
              <p>Return origin: {candidate.returnOriginCity ?? "Not set"}</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Stopovers
            </p>
            {stopovers.length > 0 ? (
              <div className="mt-4 space-y-3">
                {stopovers.map((stopover) => (
                  <div
                    key={stopover.id}
                    className="rounded-[20px] bg-mist px-4 py-4 text-sm text-slate-600"
                  >
                    <p className="font-semibold text-ink">{stopover.cityCode}</p>
                    <p className="mt-2">
                      {stopover.durationMinutes} minutes |{" "}
                      {isDisplayedIntentionalStopover(stopover, session.stopDurationMinDays)
                        ? "intentional"
                        : "incidental"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                This candidate has no extracted stopovers.
              </p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
