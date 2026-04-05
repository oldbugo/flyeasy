import type { StrategyPlan } from "@/lib/search-strategies/types";

type CompiledStrategyProgramProps = {
  plans: StrategyPlan[];
};

function formatCost(value: number) {
  return value > 0 ? String(value) : "analysis only";
}

export function CompiledStrategyProgram({ plans }: CompiledStrategyProgramProps) {
  const totalEstimatedCost = plans.reduce(
    (total, plan) => total + Math.max(0, Number(plan.estimatedSearchCost ?? 0)),
    0
  );

  return (
    <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Compiled search program
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
            What the current session will run
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This is the deterministic program compiled from the currently enabled strategy
            clusters. It shows the actual execution order, not just the strategy cards.
          </p>
        </div>
        <div className="rounded-[24px] bg-mist px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Estimated live query cost
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">{totalEstimatedCost}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {plans.map((plan, index) => (
          <article key={`${plan.strategyType}-${index}`} className="rounded-[24px] bg-mist px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                Step {index + 1}
              </span>
              <h3 className="text-base font-semibold text-ink">{plan.strategyType}</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                cost {formatCost(plan.estimatedSearchCost)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{plan.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
