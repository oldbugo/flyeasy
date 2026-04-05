import {
  refreshAiStrategyProposalsAction,
  setAiProposalStatusAction
} from "@/app/sessions/actions";

type StrategyProposalListProps = {
  proposals: Array<{
    id: string;
    rationale: string;
    status: string;
    summary: string;
    title: string;
    validationNotes: string | null;
    validationStatus: string;
  }>;
  returnTo: string;
  sessionId: string;
};

function badgeClass(status: string) {
  if (status === "accepted") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "dismissed") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-sky-100 text-sky-800";
}

export function StrategyProposalList({
  proposals,
  returnTo,
  sessionId
}: StrategyProposalListProps) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            System suggestions
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
            Deterministic suggestions, explicit acceptance
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            These deterministic suggestions stay inside the current session rules. Nothing is added
            to a run unless you accept it first.
          </p>
        </div>
        <form action={refreshAiStrategyProposalsAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
          >
            Refresh system suggestions
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {proposals.length > 0 ? (
          proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-[24px] bg-mist px-5 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-ink">{proposal.title}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(proposal.status)}`}>
                  {proposal.status}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    proposal.validationStatus === "valid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {proposal.validationStatus}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{proposal.summary}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{proposal.rationale}</p>
              {proposal.validationNotes ? (
                <p className="mt-3 text-sm leading-7 text-amber-800">{proposal.validationNotes}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {proposal.validationStatus === "valid" ? (
                  <>
                    {proposal.status !== "accepted" ? (
                      <form action={setAiProposalStatusAction}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="status" value="accepted" />
                        <button
                          type="submit"
                          className="rounded-full bg-sea px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        >
                          Accept suggestion
                        </button>
                      </form>
                    ) : null}
                    {proposal.status !== "dismissed" ? (
                      <form action={setAiProposalStatusAction}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button
                          type="submit"
                          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
                        >
                          Dismiss suggestion
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : (
                  <form action={setAiProposalStatusAction}>
                    <input type="hidden" name="proposalId" value={proposal.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Clear invalid suggestion
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-600">
            No extra system suggestions are needed for the current session rules. The compiled
            search program already covers the available deterministic expansion paths.
          </p>
        )}
      </div>
    </section>
  );
}
