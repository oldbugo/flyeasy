import { redirect } from "next/navigation";

type SessionReviewPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionReviewPage({ params }: SessionReviewPageProps) {
  const { sessionId } = await params;

  redirect(`/sessions/${sessionId}`);
}
