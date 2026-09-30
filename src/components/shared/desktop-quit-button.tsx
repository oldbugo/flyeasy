"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore, useTransition } from "react";

import { getButtonClassName } from "@/components/shared/ui";

declare global {
  interface Window {
    flyeasyDesktop?: {
      captureUi?: () => Promise<{ ok: boolean }>;
      quitApp?: () => Promise<{ ok: boolean }>;
      runtime?: string;
    };
  }
}

function isDesktopRuntime() {
  const inElectron = navigator.userAgent.toLowerCase().includes("electron");
  const hasBridge = typeof window.flyeasyDesktop?.quitApp === "function";

  return inElectron || hasBridge;
}

const subscribeToNothing = () => () => {};

type DesktopQuitButtonProps = {
  className?: string;
  children?: ReactNode;
  pendingChildren?: ReactNode;
};

export function DesktopQuitButton({
  children,
  className,
  pendingChildren
}: DesktopQuitButtonProps) {
  const [isPending, startTransition] = useTransition();
  // The server cannot see Electron, so it renders nothing; the server snapshot
  // keeps the first client render identical and the button appears right after.
  const available = useSyncExternalStore(subscribeToNothing, isDesktopRuntime, () => false);

  if (!available) {
    return null;
  }

  return (
    <button
      type="button"
      className={`${className ?? getButtonClassName({ size: "sm", tone: "danger" })} disabled:cursor-wait disabled:opacity-60`}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          if (window.flyeasyDesktop?.quitApp) {
            await window.flyeasyDesktop.quitApp();
            return;
          }

          window.close();
        });
      }}
    >
      {isPending ? pendingChildren ?? "Closing..." : children ?? "Quit app"}
    </button>
  );
}
