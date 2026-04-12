"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  useOptionalSessionStickyActions
} from "@/components/sessions/session-sticky-actions";
import { SessionTabNavigation } from "@/components/sessions/session-tab-navigation";
import { cn } from "@/components/shared/ui";

type SessionStickyControlBarProps = {
  className?: string;
  resultsIsRunning?: boolean;
  sessionId: string;
};

type RenderedAction = {
  formId: string;
  label: string;
  saveState: "dirty" | "saved" | "saving";
};

type SaveCapsulePhase = "enter" | "exit" | "hidden" | "visible";

export function SessionStickyControlBar({
  className,
  resultsIsRunning = false,
  sessionId
}: SessionStickyControlBarProps) {
  const enterTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const stickyActions = useOptionalSessionStickyActions();
  const stickyAction = stickyActions?.stickyAction ?? null;
  const saveState = stickyAction
    ? stickyAction.isSubmitting
      ? "saving"
      : stickyAction.isSaved
        ? "saved"
        : "dirty"
    : null;
  const showSaveAction = Boolean(
    stickyAction && (stickyAction.isDirty || stickyAction.isSubmitting || stickyAction.isSaved)
  );
  const nextAction = useMemo<RenderedAction | null>(
    () =>
      showSaveAction && stickyAction && saveState
        ? {
            formId: stickyAction.formId,
            label: stickyAction.label,
            saveState
          }
        : null,
    [saveState, showSaveAction, stickyAction]
  );

  const [renderedAction, setRenderedAction] = useState<RenderedAction | null>(nextAction);
  const [saveCapsulePhase, setSaveCapsulePhase] = useState<SaveCapsulePhase>(
    nextAction ? "visible" : "hidden"
  );

  useEffect(() => {
    const clearTimers = () => {
      if (enterTimerRef.current) {
        window.clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };

    if (nextAction) {
      clearTimers();

      requestAnimationFrame(() => {
        setRenderedAction((current) => {
          if (
            current &&
            current.formId === nextAction.formId &&
            current.label === nextAction.label &&
            current.saveState === nextAction.saveState
          ) {
            return current;
          }

          return nextAction;
        });

        setSaveCapsulePhase((current) =>
          current === "hidden" || current === "exit" ? "enter" : "visible"
        );
      });

      return;
    }

    if (renderedAction && saveCapsulePhase !== "hidden" && saveCapsulePhase !== "exit") {
      clearTimers();
      requestAnimationFrame(() => {
        setSaveCapsulePhase("exit");
      });
    }

    return clearTimers;
  }, [nextAction, renderedAction, saveCapsulePhase]);

  useEffect(() => {
    if (saveCapsulePhase === "enter") {
      enterTimerRef.current = window.setTimeout(() => {
        setSaveCapsulePhase("visible");
        enterTimerRef.current = null;
      }, 360);
    }

    if (saveCapsulePhase === "exit") {
      exitTimerRef.current = window.setTimeout(() => {
        setRenderedAction(null);
        setSaveCapsulePhase("hidden");
        exitTimerRef.current = null;
      }, 320);
    }

    return () => {
      if (saveCapsulePhase === "enter" && enterTimerRef.current) {
        window.clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }

      if (saveCapsulePhase === "exit" && exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [saveCapsulePhase]);

  const displayedAction = nextAction ?? renderedAction;
  const saveButtonLabel =
    displayedAction?.saveState === "saving"
      ? "Saving..."
      : displayedAction?.saveState === "saved"
        ? "Changes saved"
        : "Save Changes";

  return (
    <div className={cn("sticky top-3 z-20 pb-2", className)} data-session-sticky-bar>
      <div
        className={cn(
          "flyeasy-sticky-control-group",
          displayedAction && "flyeasy-sticky-control-group-has-save",
          saveCapsulePhase === "enter" && "flyeasy-sticky-control-group-enter",
          saveCapsulePhase === "exit" && "flyeasy-sticky-control-group-exit"
        )}
      >
        <div
          className={cn(
            "flyeasy-liquid-shell flyeasy-tab-shell w-fit max-w-full px-1.5 py-1.5",
            saveCapsulePhase === "enter" && "flyeasy-tabs-shell-stretch",
            saveCapsulePhase === "visible" && displayedAction && "flyeasy-tabs-shell-offset",
            saveCapsulePhase === "exit" && "flyeasy-tabs-shell-offset"
          )}
        >
          <SessionTabNavigation
            resultsIsRunning={resultsIsRunning}
            sessionId={sessionId}
          />
        </div>

        {displayedAction && saveCapsulePhase !== "hidden" ? (
          <div
            className={cn(
              "flyeasy-save-shell-wrap",
              saveCapsulePhase === "enter" && "flyeasy-save-shell-enter",
              saveCapsulePhase === "visible" && "flyeasy-save-shell-visible",
              saveCapsulePhase === "exit" && "flyeasy-save-shell-exit"
            )}
          >
            <div className="flyeasy-liquid-shell flyeasy-liquid-save-shell">
              <button
                type="submit"
                form={displayedAction.formId}
                data-testid="sticky-save-action"
                data-save-state={displayedAction.saveState}
                aria-label={displayedAction.label}
                className="flyeasy-liquid-save-button"
                disabled={displayedAction.saveState === "saving"}
                aria-live="polite"
              >
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-2",
                    saveCapsulePhase === "enter" && "flyeasy-save-label-enter"
                  )}
                >
                  {displayedAction.saveState === "saving" ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-r-white" />
                  ) : null}
                  <span>{saveButtonLabel}</span>
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
