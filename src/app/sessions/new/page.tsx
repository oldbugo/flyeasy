import { SessionForm } from "@/components/sessions/session-form";

import { createSessionAction } from "../actions";

type NewSessionPageProps = {
  searchParams?: Promise<{
    formError?: string | string[];
  }>;
};

export default async function NewSessionPage({ searchParams }: NewSessionPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const formError = Array.isArray(resolvedSearchParams?.formError)
    ? resolvedSearchParams?.formError[0]
    : resolvedSearchParams?.formError;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
          Session Draft
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          Create a new trip hunt
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Capture the route rules, date flexibility, stopover intent, and
          monitoring preferences that should define this hunt before any real
          search runs begin.
        </p>
      </section>

      <SessionForm
        action={createSessionAction}
        formError={formError}
        submitLabel="Create session"
      />
    </div>
  );
}
