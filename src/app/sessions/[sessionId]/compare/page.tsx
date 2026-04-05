import { redirect } from "next/navigation";

type ComparePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ComparePage({ params }: ComparePageProps) {
  const { sessionId } = await params;

  redirect(`/sessions/${sessionId}/results`);
}
