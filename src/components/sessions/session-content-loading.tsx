"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { SessionLoadingVariant } from "@/components/sessions/session-loading-descriptor";
import { Panel, cn } from "@/components/shared/ui";

type SessionContentLoadingProps = {
  description: string;
  steps: string[];
  surface?: "panel" | "plain";
  title: string;
  variant?: SessionLoadingVariant;
};

type LoadingShape = {
  borderRadius?: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

type LoadingBlueprintItem = {
  borderRadius?: number;
  height: number;
  left: number;
  width: number;
};

type LoadingBlueprint = {
  gapAfter: number;
  height: number;
  items: LoadingBlueprintItem[];
};

type CanvasSize = {
  height: number;
  width: number;
};

const defaultCanvasSize: CanvasSize = {
  height: 420,
  width: 920
};

export function SessionContentLoading({
  description,
  steps,
  surface = "panel",
  title,
  variant = "overview"
}: SessionContentLoadingProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(defaultCanvasSize);
  const accessibleCopy = [title, description, ...steps].filter(Boolean).join(". ");
  const shapes = useMemo(
    () => buildLoadingShapes(canvasSize, variant),
    [canvasSize, variant]
  );

  useEffect(() => {
    const node = canvasRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);

      setCanvasSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {
              height: nextHeight,
              width: nextWidth
            }
      );
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="session-content-loading"
      role="status"
    >
      <span className="sr-only">{accessibleCopy}</span>

      {surface === "panel" ? (
        <Panel className="relative h-full min-h-0 overflow-hidden border-[#E1E7EF] bg-[linear-gradient(180deg,#FBFCFE_0%,#F5F7FA_100%)] shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),rgba(255,255,255,0)_48%)]" />
          <div ref={canvasRef} className="relative h-full min-h-0 px-5 py-5 md:px-7 md:py-7">
            {shapes.map((shape, index) => (
              <LoadingShapeBlock key={`${variant}-${index}`} shape={shape} />
            ))}
          </div>
        </Panel>
      ) : (
        <div ref={canvasRef} className="relative h-full min-h-0 px-5 py-5 md:px-7 md:py-7">
          {shapes.map((shape, index) => (
            <LoadingShapeBlock key={`${variant}-${index}`} shape={shape} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildLoadingShapes(
  rawCanvasSize: CanvasSize,
  variant: SessionLoadingVariant
): LoadingShape[] {
  const width = Math.max(rawCanvasSize.width, 280);
  const height = Math.max(rawCanvasSize.height, 220);
  const isWide = width >= 700;
  const isDenseVariant =
    variant === "results" || variant === "candidate" || variant === "history";
  const horizontalGap = isWide ? 36 : 0;
  const sideClusterWidth = isWide ? 176 : 0;
  const contentWidth = Math.max(180, width - sideClusterWidth - horizontalGap);
  const shapes: LoadingShape[] = [];

  const addShape = (
    left: number,
    top: number,
    shapeWidth: number,
    shapeHeight: number,
    borderRadius = getDefaultBorderRadius(shapeHeight)
  ) => {
    if (shapeWidth <= 0 || shapeHeight <= 0) {
      return;
    }

    if (left + shapeWidth > width || top + shapeHeight > height) {
      return;
    }

    shapes.push({
      borderRadius,
      height: shapeHeight,
      left,
      top,
      width: shapeWidth
    });
  };

  const smallLineHeight = 10;
  const titleHeight = 38;
  const pillHeight = 36;
  const contentRowHeight = 12;
  const contentRowGap = 18;
  const titleWidth = Math.min(232, contentWidth);
  const topMetaWidth = Math.min(124, contentWidth);
  const leadLineWidth = Math.min(520, contentWidth);
  const secondaryLineWidth = Math.min(486, contentWidth);

  addShape(0, 0, topMetaWidth, smallLineHeight);
  addShape(0, 24, titleWidth, titleHeight, 12);

  const contentStartTop = 114;
  addShape(0, contentStartTop, leadLineWidth, contentRowHeight);
  addShape(0, contentStartTop + contentRowHeight + contentRowGap, secondaryLineWidth, contentRowHeight);

  let reservedBottomHeight = 0;

  if (isWide && height >= 240) {
    const primaryActionWidth = 172;
    const secondaryActionWidth = 112;
    const actionGap = 12;
    const rightColumnLeft = width - sideClusterWidth;
    const primaryActionTop = height - pillHeight - 8;
    const secondaryActionTop = primaryActionTop - actionGap - 28;

    addShape(rightColumnLeft, secondaryActionTop, secondaryActionWidth, 28, 10);
    addShape(rightColumnLeft, primaryActionTop, primaryActionWidth, pillHeight, 12);
    reservedBottomHeight = height - secondaryActionTop + 4;
  }

  const contentTop = contentStartTop + contentRowHeight * 2 + contentRowGap + 20;
  const contentBottom = height - Math.max(28, reservedBottomHeight);
  const bodyBlueprints = createBodyBlueprints(contentWidth, isDenseVariant);
  let rowTop = contentTop;
  let blueprintIndex = 0;

  while (rowTop < contentBottom && blueprintIndex < bodyBlueprints.length) {
    const blueprint = bodyBlueprints[blueprintIndex];

    if (rowTop + blueprint.height > contentBottom) {
      break;
    }

    for (const item of blueprint.items) {
      addShape(item.left, rowTop, item.width, item.height, item.borderRadius);
    }

    rowTop += blueprint.height + blueprint.gapAfter;
    blueprintIndex += 1;
  }

  return shapes;
}

function createBodyBlueprints(contentWidth: number, isDenseVariant: boolean) {
  const splitLeftWidth = Math.min(232, contentWidth);
  const splitRightWidth = Math.min(168, Math.max(0, contentWidth - splitLeftWidth - 18));
  const baseBlueprints: LoadingBlueprint[] = [
    {
      gapAfter: 22,
      height: 26,
      items: [
        {
          height: 26,
          left: 0,
          width: Math.min(348, contentWidth)
        }
      ]
    },
    {
      gapAfter: 18,
      height: splitRightWidth > 96 ? 18 : 12,
      items:
        splitRightWidth > 96
          ? [
              {
                borderRadius: 10,
                height: 18,
                left: 0,
                width: splitLeftWidth
              },
              {
                borderRadius: 10,
                height: 18,
                left: splitLeftWidth + 18,
                width: splitRightWidth
              }
            ]
          : [
              {
                height: 12,
                left: 0,
                width: Math.min(360, contentWidth)
              }
            ]
    },
    {
      gapAfter: 20,
      height: 12,
      items: [
        {
          height: 12,
          left: 0,
          width: Math.min(516, contentWidth)
        }
      ]
    },
    {
      gapAfter: 22,
      height: 22,
      items: [
        {
          height: 22,
          left: 0,
          width: Math.min(404, contentWidth)
        }
      ]
    },
    {
      gapAfter: 18,
      height: 12,
      items: [
        {
          height: 12,
          left: 0,
          width: Math.min(296, contentWidth)
        }
      ]
    }
  ];

  const blueprints = [...baseBlueprints];

  if (isDenseVariant) {
    blueprints.push(
      {
        gapAfter: 20,
        height: 18,
        items: [
          {
            borderRadius: 10,
            height: 18,
            left: 0,
            width: Math.min(278, contentWidth)
          }
        ]
      },
      {
        gapAfter: 18,
        height: 12,
        items: [
          {
            height: 12,
            left: 0,
            width: Math.min(442, contentWidth)
          }
        ]
      }
    );
  }

  return blueprints;
}

function getDefaultBorderRadius(shapeHeight: number) {
  if (shapeHeight <= 12) {
    return 999;
  }

  if (shapeHeight <= 22) {
    return 10;
  }

  if (shapeHeight <= 36) {
    return 12;
  }

  return 10;
}

function LoadingShapeBlock({ shape }: { shape: LoadingShape }) {
  const style: CSSProperties = {
    borderRadius: shape.borderRadius ?? 999,
    height: `${shape.height}px`,
    left: `${shape.left}px`,
    top: `${shape.top}px`,
    width: `${shape.width}px`
  };

  return <div className={cn("loading-wave absolute")} style={style} />;
}
