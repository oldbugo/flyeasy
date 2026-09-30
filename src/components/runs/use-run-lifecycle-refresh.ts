"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const terminalRunStatuses = new Set(["cancelled", "completed", "failed"]);

export function isTerminalRunStatus(status: string | null | undefined) {
  return Boolean(status && terminalRunStatuses.has(status));
}

export function useRunLifecycleRefresh(status: string | null | undefined) {
  const router = useRouter();
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    if (!isTerminalRunStatus(previousStatus) && isTerminalRunStatus(status)) {
      router.refresh();
    }
  }, [router, status]);
}
