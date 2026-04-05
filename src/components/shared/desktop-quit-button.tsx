"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

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
  const hasWindow = typeof window !== "undefined";
  const inElectron =
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("electron");
  const hasBridge = hasWindow && typeof window.flyeasyDesktop?.quitApp === "function";
  const available = inElectron || hasBridge;

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
