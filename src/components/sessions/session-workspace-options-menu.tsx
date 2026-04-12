"use client";

import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { useEffect, useId, useRef, useState } from "react";

import {
  archiveOrRestoreSessionAction,
  duplicateSessionAction,
  toggleMonitoringSessionAction
} from "@/app/sessions/actions";
import {
  Panel,
  cn,
  getButtonClassName,
  getIconButtonClassName
} from "@/components/shared/ui";

type SessionWorkspaceOptionsMenuProps = {
  className?: string;
  isArchived?: boolean;
  label?: string;
  monitoringEnabled?: boolean;
  sessionId: string;
  triggerVariant?: "icon" | "tab";
};

export function SessionWorkspaceOptionsMenu({
  className,
  isArchived = false,
  label = "Session options",
  monitoringEnabled = false,
  sessionId,
  triggerVariant = "icon"
}: SessionWorkspaceOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          triggerVariant === "icon"
            ? cn(
                getIconButtonClassName({ tone: isOpen ? "primary" : "secondary" }),
                "shadow-sm"
              )
            : cn(
                "flyeasy-liquid-tab relative z-10",
                isOpen ? "flyeasy-liquid-tab-active" : "flyeasy-liquid-tab-inactive"
              ),
          className
        )}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        {triggerVariant === "icon" ? (
          <>
            <GearSixIcon aria-hidden size={18} weight="regular" />
            <span className="sr-only">{label}</span>
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>

      {isOpen ? (
        <Panel
          as="div"
          className="absolute right-0 top-full z-20 mt-3 min-w-[15rem] !rounded-[10px] border-[#DCE5EE] p-2 shadow-[0_18px_36px_rgba(15,23,42,0.14)]"
        >
          <div id={menuId} role="menu" className="grid gap-2">
            <form
              action={duplicateSessionAction}
              onSubmit={() => {
                setIsOpen(false);
              }}
            >
              <input type="hidden" name="sessionId" value={sessionId} />
              <button
                type="submit"
                role="menuitem"
                className={cn(
                  getButtonClassName({ size: "sm", tone: "secondary" }),
                  "w-full justify-start rounded-[10px]"
                )}
              >
                Duplicate session
              </button>
            </form>

            <form
              action={toggleMonitoringSessionAction}
              onSubmit={() => {
                setIsOpen(false);
              }}
            >
              <input type="hidden" name="sessionId" value={sessionId} />
              <input
                type="hidden"
                name="intent"
                value={monitoringEnabled ? "disable" : "enable"}
              />
              <button
                type="submit"
                role="menuitem"
                className={cn(
                  getButtonClassName({ size: "sm", tone: "secondary" }),
                  "w-full justify-start rounded-[10px]"
                )}
              >
                {monitoringEnabled ? "Disable monitoring" : "Enable monitoring"}
              </button>
            </form>

            <form
              action={archiveOrRestoreSessionAction}
              onSubmit={() => {
                setIsOpen(false);
              }}
            >
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="intent" value={isArchived ? "restore" : "archive"} />
              <button
                type="submit"
                role="menuitem"
                className={cn(
                  getButtonClassName({
                    size: "sm",
                    tone: isArchived ? "secondary" : "danger"
                  }),
                  "w-full justify-start rounded-[10px]"
                )}
              >
                {isArchived ? "Restore session" : "Archive session"}
              </button>
            </form>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
