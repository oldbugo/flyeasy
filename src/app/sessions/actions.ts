"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { refreshAiStrategyProposals, setAiProposalStatus } from "@/lib/ai/strategy-proposals";
import { createId } from "@/lib/db/ids";
import { getDb } from "@/lib/db/client";
import { itineraryCandidates, sessionShortlistEntries } from "@/lib/db/schema/candidate";
import { searchRuns } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import { createRunFromSession } from "@/lib/runs/create-run-from-session";
import { createBaselineExperimentSuite } from "@/lib/runs/strategy-experiments";
import {
  parseStrategySelectionInputsFromFormData,
  parseStrategyExperimentSettingsFromFormData,
  saveSessionStrategySelections
} from "@/lib/search-strategies/session-strategies";
import { stopRun } from "@/lib/runs/deterministic-engine";
import { computeNextRefreshFromLastRun } from "@/lib/monitoring/refresh";
import { parseCreateSessionForm, parseUpdateSessionForm } from "@/lib/sessions/form-schema";
import { dispatchTripcomRunQueue, resumeTripcomRun, startTripcomBaselineRun } from "@/lib/tripcom/automation";
import { and, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";

function nowIso() {
  return new Date().toISOString();
}

function getFirstValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Review the session details and try again.";
}

function getSessionActiveRuns(sessionId: string) {
  const db = getDb();
  const activeRuns = db
    .select({
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status
    })
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.sessionId, sessionId),
        inArray(searchRuns.status, ["queued", "running", "blocked", "paused"])
      )
    )
    .all();

  const statusOrder: Record<string, number> = {
    running: 0,
    blocked: 1,
    paused: 2,
    queued: 3
  };

  return activeRuns.sort((left, right) => {
    const statusDelta =
      (statusOrder[left.status] ?? Number.MAX_SAFE_INTEGER) -
      (statusOrder[right.status] ?? Number.MAX_SAFE_INTEGER);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return String(left.startedAt).localeCompare(String(right.startedAt));
  });
}

function revalidateSessionRunPaths(sessionId: string, runIds: string[] = []) {
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  revalidatePath(`/sessions/${sessionId}/strategy`);

  for (const runId of runIds) {
    revalidatePath(`/sessions/${sessionId}/runs/${runId}`);
  }
}

export async function createSessionAction(formData: FormData) {
  let values;
  try {
    values = parseCreateSessionForm(formData);
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/sessions/new?formError=${encodeURIComponent(getFirstValidationMessage(error))}` as never);
    }

    throw error;
  }
  const db = getDb();
  const sessionId = createId("session");
  const createdAt = nowIso();

  db.insert(sessions)
    .values({
      id: sessionId,
      name: values.name,
      lifecycleState: "draft",
      monitoringState: "disabled",
      isLive: false,
      originAirport: values.originAirport,
      outboundDestinationCity: values.outboundDestinationCity,
      returnDestinationAirport: values.returnDestinationAirport,
      returnOriginMode: values.returnOriginMode,
      returnOriginCity: values.returnOriginCity ?? null,
      departureStartDate: values.departureStartDate,
      departureEndDate: values.latestReturnDate,
      durationMinDays: values.durationMinDays ?? null,
      durationMaxDays: values.durationMaxDays ?? null,
      returnStartDate: null,
      returnEndDate: values.latestReturnDate,
      layoverScope: "mainland_china",
      maxStops: values.maxStops,
      stopDurationMinDays: values.stopDurationMinDays,
      stopDurationMaxDays: values.stopDurationMaxDays,
      bookingMode: values.bookingMode,
      requireIncludedCheckedBaggage: values.requireIncludedCheckedBaggage,
      restrictToChineseAirlines: values.restrictToChineseAirlines,
      searchIntensity: values.searchIntensity,
      cabinPolicy: "any",
      notes: values.notes ?? null,
      refreshIntervalHours: values.refreshIntervalHours,
      nextRefreshAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastSuccessfulRunId: null,
      currentBestCandidateId: null,
      createdAt,
      updatedAt: createdAt
    })
    .run();

  revalidatePath("/");
  redirect(`/sessions/${sessionId}`);
}

export async function updateSessionAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  let values;
  try {
    values = parseUpdateSessionForm(formData);
  } catch (error) {
    if (error instanceof ZodError) {
      const sessionId = String(formData.get("sessionId") ?? "");
      const target =
        returnTo || (sessionId ? `/sessions/${sessionId}/settings` : "/");
      redirect(`${target}?formError=${encodeURIComponent(getFirstValidationMessage(error))}` as never);
    }

    throw error;
  }
  const db = getDb();
  const updatedAt = nowIso();
  const existingSession = db
    .select({
      lastRunFinishedAt: sessions.lastRunFinishedAt,
      lastRunStartedAt: sessions.lastRunStartedAt,
      monitoringState: sessions.monitoringState
    })
    .from(sessions)
    .where(eq(sessions.id, values.sessionId))
    .get();
  const nextRefreshAt =
    existingSession?.monitoringState === "enabled"
      ? computeNextRefreshFromLastRun({
          fallbackIso: updatedAt,
          lastRunFinishedAt: existingSession.lastRunFinishedAt,
          lastRunStartedAt: existingSession.lastRunStartedAt,
          refreshIntervalHours: values.refreshIntervalHours
        })
      : null;

  db.update(sessions)
    .set({
      name: values.name,
      originAirport: values.originAirport,
      outboundDestinationCity: values.outboundDestinationCity,
      returnDestinationAirport: values.returnDestinationAirport,
      returnOriginMode: values.returnOriginMode,
      returnOriginCity: values.returnOriginCity ?? null,
      departureStartDate: values.departureStartDate,
      departureEndDate: values.latestReturnDate,
      durationMinDays: values.durationMinDays ?? null,
      durationMaxDays: values.durationMaxDays ?? null,
      returnStartDate: null,
      returnEndDate: values.latestReturnDate,
      maxStops: values.maxStops,
      stopDurationMinDays: values.stopDurationMinDays,
      stopDurationMaxDays: values.stopDurationMaxDays,
      bookingMode: values.bookingMode,
      requireIncludedCheckedBaggage: values.requireIncludedCheckedBaggage,
      restrictToChineseAirlines: values.restrictToChineseAirlines,
      searchIntensity: values.searchIntensity,
      notes: values.notes ?? null,
      refreshIntervalHours: values.refreshIntervalHours,
      nextRefreshAt,
      updatedAt
    })
    .where(eq(sessions.id, values.sessionId))
    .run();

  revalidatePath("/");
  revalidatePath(`/sessions/${values.sessionId}`);
  revalidatePath(`/sessions/${values.sessionId}/settings`);
  redirect((returnTo || `/sessions/${values.sessionId}/settings`) as never);
}

export async function forkSessionFromUpdateAction(formData: FormData) {
  let values;
  try {
    values = parseUpdateSessionForm(formData);
  } catch (error) {
    if (error instanceof ZodError) {
      const sessionId = String(formData.get("sessionId") ?? "");
      const target = sessionId ? `/sessions/${sessionId}/settings` : "/";
      redirect(`${target}?formError=${encodeURIComponent(getFirstValidationMessage(error))}` as never);
    }

    throw error;
  }
  const db = getDb();
  const sourceSession = db.select().from(sessions).where(eq(sessions.id, values.sessionId)).get();

  if (!sourceSession) {
    redirect("/");
  }

  const forkedSessionId = createId("session");
  const createdAt = nowIso();

  db.insert(sessions)
    .values({
      id: forkedSessionId,
      name: values.name === sourceSession.name ? `${values.name} Fork` : values.name,
      lifecycleState: "draft",
      monitoringState: "disabled",
      isLive: false,
      originAirport: values.originAirport,
      outboundDestinationCity: values.outboundDestinationCity,
      returnDestinationAirport: values.returnDestinationAirport,
      returnOriginMode: values.returnOriginMode,
      returnOriginCity: values.returnOriginCity ?? null,
      departureStartDate: values.departureStartDate,
      departureEndDate: values.latestReturnDate,
      durationMinDays: values.durationMinDays ?? null,
      durationMaxDays: values.durationMaxDays ?? null,
      returnStartDate: null,
      returnEndDate: values.latestReturnDate,
      layoverScope: sourceSession.layoverScope,
      maxStops: values.maxStops,
      stopDurationMinDays: values.stopDurationMinDays,
      stopDurationMaxDays: values.stopDurationMaxDays,
      bookingMode: values.bookingMode,
      requireIncludedCheckedBaggage: values.requireIncludedCheckedBaggage,
      restrictToChineseAirlines: values.restrictToChineseAirlines,
      searchIntensity: values.searchIntensity,
      cabinPolicy: sourceSession.cabinPolicy,
      notes: values.notes ?? null,
      refreshIntervalHours: values.refreshIntervalHours,
      nextRefreshAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastSuccessfulRunId: null,
      currentBestCandidateId: null,
      createdAt,
      updatedAt: createdAt
    })
    .run();

  revalidatePath("/");
  redirect(`/sessions/${forkedSessionId}`);
}

export async function duplicateSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const db = getDb();
  const sourceSession = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!sourceSession) {
    redirect("/");
  }

  const duplicateId = createId("session");
  const createdAt = nowIso();

  db.insert(sessions)
    .values({
      ...sourceSession,
      id: duplicateId,
      name: `${sourceSession.name} Copy`,
      lifecycleState: "draft",
      monitoringState: "disabled",
      isLive: false,
      nextRefreshAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastSuccessfulRunId: null,
      currentBestCandidateId: null,
      createdAt,
      updatedAt: createdAt
    })
    .run();

  revalidatePath("/");
  redirect(`/sessions/${duplicateId}`);
}

export async function deleteSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!sessionId) {
    redirect("/");
  }

  const activeRuns = getSessionActiveRuns(sessionId);

  for (const run of activeRuns) {
    await stopRun(run.id);
  }

  const db = getDb();
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();

  dispatchTripcomRunQueue();

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  revalidatePath(`/sessions/${sessionId}/strategy`);
  redirect("/");
}

export async function archiveOrRestoreSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const intent = String(formData.get("intent") ?? "archive");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}`);
  const db = getDb();
  const updatedAt = nowIso();

  db.update(sessions)
    .set({
      lifecycleState: intent === "restore" ? "not_live" : "archived",
      monitoringState: "disabled",
      isLive: false,
      nextRefreshAt: null,
      updatedAt
    })
    .where(eq(sessions.id, sessionId))
    .run();

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  redirect(returnTo as never);
}

export async function toggleMonitoringSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const intent = String(formData.get("intent") ?? "enable");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}`);
  const db = getDb();
  const updatedAt = nowIso();
  const enable = intent === "enable";
  const session = db
    .select({
      lastRunFinishedAt: sessions.lastRunFinishedAt,
      lastRunStartedAt: sessions.lastRunStartedAt,
      refreshIntervalHours: sessions.refreshIntervalHours
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
  const nextRefreshAt =
    enable && session
      ? computeNextRefreshFromLastRun({
          fallbackIso: updatedAt,
          lastRunFinishedAt: session.lastRunFinishedAt,
          lastRunStartedAt: session.lastRunStartedAt,
          refreshIntervalHours: session.refreshIntervalHours
        })
      : null;

  db.update(sessions)
    .set({
      monitoringState: enable ? "enabled" : "disabled",
      lifecycleState: enable ? "live_idle" : "not_live",
      isLive: enable,
      nextRefreshAt,
      updatedAt
    })
    .where(eq(sessions.id, sessionId))
    .run();

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  redirect(returnTo as never);
}

export async function startBaselineRunAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const experimentSuite = await createBaselineExperimentSuite(sessionId);
  const createdRun = experimentSuite ? null : await createRunFromSession(sessionId);

  if (!createdRun && !experimentSuite) {
    redirect("/");
  }

  if (experimentSuite) {
    dispatchTripcomRunQueue();
  } else if (createdRun) {
    startTripcomBaselineRun(createdRun.runId);
  }

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  redirect(`/sessions/${sessionId}/results`);
}

export async function stopRunAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!runId || !sessionId) {
    redirect("/");
  }

  await stopRun(runId);
  dispatchTripcomRunQueue();

  revalidateSessionRunPaths(sessionId, [runId]);
  redirect(`/sessions/${sessionId}/runs/${runId}`);
}

export async function stopCurrentSessionRunAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}/results`);

  if (!sessionId) {
    redirect("/");
  }

  const currentRun = getSessionActiveRuns(sessionId)[0] ?? null;

  if (!currentRun) {
    redirect(returnTo as never);
  }

  await stopRun(currentRun.id);
  dispatchTripcomRunQueue();

  revalidateSessionRunPaths(sessionId, [currentRun.id]);
  redirect(returnTo as never);
}

export async function stopAndClearSessionQueueAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}/results`);

  if (!sessionId) {
    redirect("/");
  }

  const activeRuns = getSessionActiveRuns(sessionId);

  for (const run of activeRuns) {
    await stopRun(run.id);
  }

  dispatchTripcomRunQueue();

  revalidateSessionRunPaths(
    sessionId,
    activeRuns.map((run) => run.id)
  );
  redirect(returnTo as never);
}

export async function setShortlistStatusAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const status = String(formData.get("status") ?? "shortlisted");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}/results`);

  if (!sessionId || !candidateId) {
    redirect("/");
  }

  const db = getDb();
  const candidate = db
    .select({
      candidateFamilyId: itineraryCandidates.candidateFamilyId
    })
    .from(itineraryCandidates)
    .where(eq(itineraryCandidates.id, candidateId))
    .get();

  if (!candidate) {
    redirect(returnTo as never);
  }

  const timestamp = nowIso();
  const existing = db
    .select()
    .from(sessionShortlistEntries)
    .where(
      and(
        eq(sessionShortlistEntries.sessionId, sessionId),
        eq(sessionShortlistEntries.candidateFamilyId, candidate.candidateFamilyId)
      )
    )
    .get();

  if (existing) {
    db.update(sessionShortlistEntries)
      .set({
        itineraryCandidateId: candidateId,
        status: status as "shortlisted" | "top_pick" | "dismissed",
        updatedAt: timestamp
      })
      .where(eq(sessionShortlistEntries.id, existing.id))
      .run();
  } else {
    db.insert(sessionShortlistEntries)
      .values({
        id: createId("shortlist"),
        sessionId,
        candidateFamilyId: candidate.candidateFamilyId,
        itineraryCandidateId: candidateId,
        status: status as "shortlisted" | "top_pick" | "dismissed",
        userNote: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .run();
  }

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  revalidatePath(`/sessions/${sessionId}/candidates/${candidateId}`);
  redirect(returnTo as never);
}

export async function clearShortlistStatusAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}/results`);

  if (!sessionId || !candidateId) {
    redirect("/");
  }

  const db = getDb();
  const candidate = db
    .select({
      candidateFamilyId: itineraryCandidates.candidateFamilyId
    })
    .from(itineraryCandidates)
    .where(eq(itineraryCandidates.id, candidateId))
    .get();

  if (!candidate) {
    redirect(returnTo as never);
  }

  db.delete(sessionShortlistEntries)
    .where(
      and(
        eq(sessionShortlistEntries.sessionId, sessionId),
        eq(sessionShortlistEntries.candidateFamilyId, candidate.candidateFamilyId)
      )
    )
    .run();

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  revalidatePath(`/sessions/${sessionId}/candidates/${candidateId}`);
  redirect(returnTo as never);
}

export async function rerunSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const experimentSuite = await createBaselineExperimentSuite(sessionId);
  const createdRun = experimentSuite ? null : await createRunFromSession(sessionId);

  if (!createdRun && !experimentSuite) {
    redirect("/");
  }

  if (experimentSuite) {
    for (const run of experimentSuite.runs) {
      startTripcomBaselineRun(run.runId);
    }
  } else if (createdRun) {
    startTripcomBaselineRun(createdRun.runId);
  }

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  redirect(`/sessions/${sessionId}/results`);
}

export async function resumeBlockedRunAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!runId || !sessionId) {
    redirect("/");
  }

  resumeTripcomRun(runId);

  revalidatePath("/");
  revalidatePath(`/settings`);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/results`);
  revalidatePath(`/sessions/${sessionId}/history`);
  revalidatePath(`/sessions/${sessionId}/runs/${runId}`);
  redirect(`/sessions/${sessionId}/results`);
}

export async function refreshAiStrategyProposalsAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}`);

  if (!sessionId) {
    redirect("/");
  }

  await refreshAiStrategyProposals(sessionId);

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  revalidatePath(returnTo);
  redirect(returnTo as never);
}

export async function setAiProposalStatusAction(formData: FormData) {
  const proposalId = String(formData.get("proposalId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const status = String(formData.get("status") ?? "dismissed") as "accepted" | "dismissed" | "proposed";
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}`);

  if (!proposalId || !sessionId) {
    redirect("/");
  }

  await setAiProposalStatus(proposalId, status);

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/settings`);
  revalidatePath(returnTo);
  redirect(returnTo as never);
}

export async function saveSessionStrategiesAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/sessions/${sessionId}/strategy`);

  if (!sessionId) {
    redirect("/");
  }

  const inputs = parseStrategySelectionInputsFromFormData(formData);
  const experimentSettings = parseStrategyExperimentSettingsFromFormData(formData);
  saveSessionStrategySelections(sessionId, inputs);
  const db = getDb();
  db.update(sessions)
    .set({
      strategyExperimentMode: experimentSettings.mode,
      strategyExperimentSampleSize: experimentSettings.sampleSize,
      updatedAt: nowIso()
    })
    .where(eq(sessions.id, sessionId))
    .run();

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/strategy`);
  revalidatePath(returnTo);
  redirect(returnTo as never);
}
