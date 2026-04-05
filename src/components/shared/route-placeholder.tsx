import { Panel } from "@/components/shared/ui";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description
}: RoutePlaceholderProps) {
  return (
    <Panel className="p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
        {description}
      </p>
    </Panel>
  );
}
