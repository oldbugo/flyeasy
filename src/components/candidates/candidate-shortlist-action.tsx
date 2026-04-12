import {
  clearShortlistStatusAction,
  setShortlistStatusAction
} from "@/app/sessions/actions";
import { getButtonClassName } from "@/components/shared/ui";

type CandidateShortlistActionProps = {
  candidateId: string;
  isShortlisted: boolean;
  sessionId: string;
};

export function CandidateShortlistAction({
  candidateId,
  isShortlisted,
  sessionId
}: CandidateShortlistActionProps) {
  const returnTo = `/sessions/${sessionId}/results`;

  if (isShortlisted) {
    return (
      <form action={clearShortlistStatusAction}>
        <input type="hidden" name="candidateId" value={candidateId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-[10px] border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold tracking-[-0.01em] text-amber-800 transition hover:border-amber-500 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2"
        >
          Remove shortlist
        </button>
      </form>
    );
  }

  return (
    <form action={setShortlistStatusAction}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="status" value="shortlisted" />
      <button
        type="submit"
        className={getButtonClassName({ size: "md", tone: "secondary" })}
      >
        Shortlist
      </button>
    </form>
  );
}
