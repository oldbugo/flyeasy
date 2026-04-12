"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  type ChartConfiguration,
  type TooltipItem
} from "chart.js/auto";

import type { SessionRunTrendPoint } from "@/lib/db/queries/history";
import { formatIsoDate, formatIsoDateTime, formatMoney } from "@/lib/formatting";

type SessionRunTrendChartProps = {
  points: SessionRunTrendPoint[];
};

export function SessionRunTrendChart({ points }: SessionRunTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (points.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    chartRef.current?.destroy();

    const gradient = context.createLinearGradient(0, 0, 0, canvas.clientHeight || 320);
    gradient.addColorStop(0, "rgba(12,107,88,0.28)");
    gradient.addColorStop(1, "rgba(12,107,88,0)");

    const configuration: ChartConfiguration<"line"> = {
      data: {
        labels: points.map((_, index) => `Run ${index + 1}`),
        datasets: [
          {
            backgroundColor: gradient,
            borderColor: "#0C6B58",
            borderWidth: 3,
            data: points.map((point) => point.price),
            fill: true,
            pointBackgroundColor: "#FFFFFF",
            pointBorderColor: "#0C6B58",
            pointBorderWidth: 2,
            pointHoverBackgroundColor: "#0C6B58",
            pointHoverBorderColor: "#FFFFFF",
            pointHoverBorderWidth: 2,
            pointHoverRadius: 7,
            pointRadius: 4,
            tension: 0.32
          }
        ]
      },
      options: {
        animation: {
          duration: 220
        },
        interaction: {
          intersect: false,
          mode: "nearest"
        },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "#102033",
            bodySpacing: 6,
            boxPadding: 0,
            caretPadding: 10,
            cornerRadius: 14,
            displayColors: false,
            padding: 14,
            titleMarginBottom: 10,
            callbacks: {
              afterBody: (items) => {
                const point = resolvePoint(points, items[0]);

                if (!point) {
                  return [];
                }

                return [
                  `Outbound: ${formatIsoDate(point.outboundDepartureAt)}`,
                  `Return: ${formatIsoDate(point.returnDepartureAt)}`,
                  `Candidates found: ${point.totalCandidatesFound}`,
                  `Candidates verified: ${point.totalCandidatesVerified}`
                ];
              },
              beforeBody: (items) => {
                const point = resolvePoint(points, items[0]);

                if (!point) {
                  return [];
                }

                return [`Destination: ${point.outboundDestinationCity}`];
              },
              label: (item) => {
                const point = resolvePoint(points, item);
                return point ? `Best fare: ${formatMoney(point.currency, point.price)}` : "";
              },
              title: (items) => {
                const point = resolvePoint(points, items[0]);
                return point ? `Scan ${formatIsoDateTime(point.scanDate)}` : "";
              }
            }
          }
        },
        responsive: true,
        scales: {
          x: {
            border: {
              display: false
            },
            grid: {
              color: "rgba(214,222,232,0.18)",
              drawTicks: false
            },
            ticks: {
              callback: (_value, index) => formatTrendTick(points, index),
              color: "#64748B",
              maxRotation: 0
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              color: "rgba(214,222,232,0.82)",
              drawTicks: false
            },
            ticks: {
              color: "#64748B",
              callback: (value) => formatAxisMoney(points[0]?.currency ?? null, Number(value)),
              maxTicksLimit: 5
            }
          }
        }
      },
      type: "line"
    };

    chartRef.current = new Chart(context, configuration);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex min-h-[18rem] min-w-0 items-center bg-[linear-gradient(180deg,rgba(240,246,248,0.64),rgba(240,246,248,0.18))] px-4 py-6 text-sm leading-6 text-slate-500">
        Completed runs with a best candidate will appear here once the session starts building a price history.
      </div>
    );
  }

  return (
    <div className="flex min-h-[19rem] min-w-0 flex-col overflow-hidden">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sea">
            Fare trend
          </p>
          <h3 className="text-base font-semibold tracking-tight text-ink md:text-lg">
            Best fare across completed runs
          </h3>
        </div>
        <p className="max-w-[16rem] min-w-0 text-[11px] leading-5 text-slate-500 sm:text-right">
          Hover a point to inspect fare, flight dates, and scan time.
        </p>
      </div>

      <div className="mt-4 h-[18rem] min-h-[18rem] min-w-0 flex-1 overflow-hidden md:h-[19.5rem] xl:h-[20.5rem]">
        <canvas
          ref={canvasRef}
          aria-label="Best fare trend chart"
          role="img"
          className="block h-full w-full max-w-full"
        />
      </div>
    </div>
  );
}

function formatAxisMoney(currency: string | null, amount: number) {
  if (!currency || Number.isNaN(amount)) {
    return "";
  }

  return `${currency} ${Math.round(amount).toLocaleString("en-AU")}`;
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "Run";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function formatTrendTick(points: SessionRunTrendPoint[], index: number) {
  const point = points[index];

  if (!point) {
    return "";
  }

  const currentLabel = formatShortDate(point.scanDate);
  const previousLabel =
    index > 0 ? formatShortDate(points[index - 1]?.scanDate ?? null) : null;
  const nextLabel =
    index < points.length - 1 ? formatShortDate(points[index + 1]?.scanDate ?? null) : null;

  if (currentLabel === previousLabel && currentLabel === nextLabel) {
    return "";
  }

  if (currentLabel === previousLabel && index !== points.length - 1) {
    return "";
  }

  return currentLabel;
}

function resolvePoint(
  points: SessionRunTrendPoint[],
  tooltipItem: TooltipItem<"line"> | undefined
) {
  if (!tooltipItem) {
    return null;
  }

  return points[tooltipItem.dataIndex] ?? null;
}
