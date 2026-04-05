import { Panel, getPillClassName } from "@/components/shared/ui";

type AiInfluencePanelProps = {
  items: Array<{
    id: string;
    rationale: string;
    strategyType: string;
    summary: string;
    title: string;
  }>;
};

export function AiInfluencePanel({ items }: AiInfluencePanelProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Panel className="p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
        Suggestion influence
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
        Accepted suggestions used in the latest run
      </h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Panel key={item.id} as="article" className="p-5" tone="subtle">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold text-ink">{item.title}</h3>
              <span className={getPillClassName("info")}>
                {item.strategyType}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{item.summary}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.rationale}</p>
          </Panel>
        ))}
      </div>
    </Panel>
  );
}
