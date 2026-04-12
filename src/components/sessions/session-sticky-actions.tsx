"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

type StickyActionRegistration = {
  formId: string;
  label: string;
  ownerId: string;
};

type StickyActionRegistrationInput = {
  formId: string;
  label: string;
};

type StickyActionState = StickyActionRegistration & {
  isDirty: boolean;
  isSaved: boolean;
  isSubmitting: boolean;
  hasPendingSubmission: boolean;
};

type SessionStickyActionsContextValue = {
  registerStickyAction: (registration: StickyActionRegistration) => void;
  setStickyActionDirty: (formId: string, isDirty: boolean) => void;
  setStickyActionSubmitting: (formId: string, isSubmitting: boolean) => void;
  showStickyActionSaved: (formId: string) => void;
  stickyAction: StickyActionState | null;
  unregisterStickyAction: (formId: string, ownerId: string) => void;
};

const SessionStickyActionsContext =
  createContext<SessionStickyActionsContextValue | null>(null);

export function SessionStickyActionsProvider({
  children
}: {
  children: ReactNode;
}) {
  const [stickyAction, setStickyAction] = useState<StickyActionState | null>(null);

  const registerStickyAction = useCallback((registration: StickyActionRegistration) => {
    setStickyAction((current) => {
      if (
        current?.formId === registration.formId &&
        current.ownerId === registration.ownerId
      ) {
        return {
          ...current,
          label: registration.label
        };
      }

      return {
        ...registration,
        hasPendingSubmission: false,
        isDirty: false,
        isSaved: false,
        isSubmitting: false
      };
    });
  }, []);

  const setStickyActionDirty = useCallback((formId: string, isDirty: boolean) => {
    setStickyAction((current) => {
      if (current?.formId !== formId) {
        return current;
      }

      if (isDirty) {
        return {
          ...current,
          isDirty: true,
          isSaved: false
        };
      }

      const shouldShowSavedFeedback = current.hasPendingSubmission;

      return {
        ...current,
        hasPendingSubmission: false,
        isDirty: false,
        isSaved: shouldShowSavedFeedback,
        isSubmitting: shouldShowSavedFeedback ? false : current.isSubmitting
      };
    });
  }, []);

  const setStickyActionSubmitting = useCallback((formId: string, isSubmitting: boolean) => {
    setStickyAction((current) => {
      if (current?.formId !== formId) {
        return current;
      }

      if (isSubmitting) {
        return {
          ...current,
          hasPendingSubmission: true,
          isSaved: false,
          isSubmitting: true
        };
      }

      const shouldShowSavedFeedback =
        current.hasPendingSubmission && !current.isDirty;

      return {
        ...current,
        hasPendingSubmission: false,
        isSaved: shouldShowSavedFeedback || current.isSaved,
        isSubmitting: false
      };
    });
  }, []);

  const showStickyActionSaved = useCallback((formId: string) => {
    setStickyAction((current) =>
      current?.formId === formId
        ? {
            ...current,
            hasPendingSubmission: false,
            isDirty: false,
            isSaved: true,
            isSubmitting: false
          }
        : current
    );
  }, []);

  const unregisterStickyAction = useCallback((formId: string, ownerId: string) => {
    setStickyAction((current) =>
      current?.formId === formId && current.ownerId === ownerId ? null : current
    );
  }, []);

  const value = useMemo<SessionStickyActionsContextValue>(
    () => ({
      registerStickyAction,
      setStickyActionDirty,
      setStickyActionSubmitting,
      showStickyActionSaved,
      stickyAction,
      unregisterStickyAction
    }),
    [
      registerStickyAction,
      setStickyActionDirty,
      setStickyActionSubmitting,
      showStickyActionSaved,
      stickyAction,
      unregisterStickyAction
    ]
  );

  useEffect(() => {
    if (!stickyAction?.isSaved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStickyAction((current) =>
        current?.formId === stickyAction.formId && current.isSaved
          ? {
              ...current,
              isSaved: false
            }
          : current
      );
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stickyAction?.formId, stickyAction?.isSaved]);

  return (
    <SessionStickyActionsContext.Provider value={value}>
      {children}
    </SessionStickyActionsContext.Provider>
  );
}

export function useOptionalSessionStickyActions() {
  return useContext(SessionStickyActionsContext);
}

function clearSavedStateSearchParam() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has("saved")) {
    return;
  }

  url.searchParams.delete("saved");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export function serializeTrackedFormData(form: HTMLFormElement) {
  const entries = Array.from(new FormData(form).entries())
    .map(([name, value]) => [
      name,
      typeof value === "string" ? value : value.name
    ] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      leftName === rightName
        ? leftValue.localeCompare(rightValue)
        : leftName.localeCompare(rightName)
    );

  return JSON.stringify(entries);
}

export function SessionStickySaveTracker({
  formId,
  label,
  showSavedState = false
}: StickyActionRegistrationInput & { showSavedState?: boolean }) {
  const stickyActions = useOptionalSessionStickyActions();
  const registerStickyAction = stickyActions?.registerStickyAction;
  const setStickyActionDirty = stickyActions?.setStickyActionDirty;
  const setStickyActionSubmitting = stickyActions?.setStickyActionSubmitting;
  const showStickyActionSaved = stickyActions?.showStickyActionSaved;
  const unregisterStickyAction = stickyActions?.unregisterStickyAction;
  const initialSnapshotRef = useRef<string | null>(null);
  const ownerId = useId();

  useEffect(() => {
    if (
      !registerStickyAction ||
      !setStickyActionDirty ||
      !setStickyActionSubmitting ||
      !showStickyActionSaved ||
      !unregisterStickyAction
    ) {
      return;
    }

    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    registerStickyAction({ formId, label, ownerId });
    initialSnapshotRef.current = serializeTrackedFormData(form);
    setStickyActionDirty(formId, false);
    setStickyActionSubmitting(formId, false);
    if (showSavedState) {
      showStickyActionSaved(formId);
      clearSavedStateSearchParam();
    }

    const syncDirtyState = () => {
      const initialSnapshot = initialSnapshotRef.current;
      if (!initialSnapshot) {
        return;
      }

      setStickyActionDirty(
        formId,
        serializeTrackedFormData(form) !== initialSnapshot
      );
    };

    const handleSubmit = () => {
      setStickyActionSubmitting(formId, true);
    };

    form.addEventListener("input", syncDirtyState);
    form.addEventListener("change", syncDirtyState);
    form.addEventListener("submit", handleSubmit);

    return () => {
      form.removeEventListener("input", syncDirtyState);
      form.removeEventListener("change", syncDirtyState);
      form.removeEventListener("submit", handleSubmit);
      unregisterStickyAction(formId, ownerId);
    };
  }, [
    formId,
    label,
    ownerId,
    registerStickyAction,
    setStickyActionDirty,
    setStickyActionSubmitting,
    showSavedState,
    showStickyActionSaved,
    unregisterStickyAction
  ]);

  return null;
}
