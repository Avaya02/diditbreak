"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { byTask } from "@/lib/run";
import { passRateDifference, relativeChange, type Estimate } from "@/lib/stats";

import styles from "./BootstrapFigure.module.css";
import { prefersReducedMotion, useInView } from "./useInView";

interface Row {
  id: string;
  label: string;
  detail: string;
  estimate: Estimate;
  domain: [number, number];
  ticks: number[];
  unit: "pts" | "%";
  verdict: string;
  real: boolean;
}

const DURATION = 2600;

function signed(value: number, unit: "pts" | "%"): string {
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * 100);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return `${sign}${Math.abs(rounded)}${unit === "%" ? "%" : " pts"}`;
}

function tick(value: number, unit: "pts" | "%"): string {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}${unit === "%" ? "%" : ""}`;
}

/** Deterministic vertical scatter for sample i, so redraws land identically. */
function jitter(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * The CLI's paired bootstrap, run live on the 12 real runs. Every dot is one
 * resample; the bracket is the 95% interval the dots settle into.
 */
export function BootstrapFigure() {
  const rows = useMemo<Row[]>(() => {
    const success = passRateDifference(byTask("HEAD", (t) => t.passed), byTask("working", (t) => t.passed));
    const cost = relativeChange(byTask("HEAD", (t) => t.costUsd), byTask("working", (t) => t.costUsd));
    const turns = relativeChange(byTask("HEAD", (t) => t.turns), byTask("working", (t) => t.turns));
    return [
      {
        id: "success",
        label: "Tasks solved",
        detail: "working minus HEAD, in points",
        estimate: success,
        domain: [-1, 1],
        ticks: [-1, -0.5, 0, 0.5, 1],
        unit: "pts",
        verdict: "No clear difference: the interval reaches zero.",
        real: false
      },
      {
        id: "cost",
        label: "Cost per run",
        detail: "working against HEAD",
        estimate: cost,
        domain: [-0.3, 1],
        ticks: [-0.25, 0, 0.25, 0.5, 0.75, 1],
        unit: "%",
        verdict: "Costlier: the whole interval is above zero.",
        real: true
      },
      {
        id: "turns",
        label: "Turns per run",
        detail: "working against HEAD",
        estimate: turns,
        domain: [-0.3, 1],
        ticks: [-0.25, 0, 0.25, 0.5, 0.75, 1],
        unit: "%",
        verdict: "More turns: the whole interval is above zero.",
        real: true
      }
    ];
  }, []);

  const figure = useRef<HTMLDivElement>(null);
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const drawn = useRef(0);
  const frame = useRef(0);
  const inView = useInView(figure);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);

  const total = rows[0]?.estimate.samples.length ?? 0;

  const paint = useCallback(
    (from: number, to: number, clear: boolean) => {
      rows.forEach((row, r) => {
        const canvas = canvases.current[r];
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          return;
        }
        const ratio = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          clear = true;
        }
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const ink = getComputedStyle(canvas).color;
        const [min, max] = row.domain;
        const x = (value: number) => ((value - min) / (max - min)) * width;

        if (clear) {
          context.clearRect(0, 0, width, height);
          context.save();
          context.strokeStyle = ink;
          context.globalAlpha = 0.35;
          context.setLineDash([2, 4]);
          context.beginPath();
          context.moveTo(Math.round(x(0)) + 0.5, 0);
          context.lineTo(Math.round(x(0)) + 0.5, height);
          context.stroke();
          context.restore();
          from = 0;
        }

        context.fillStyle = ink;
        context.globalAlpha = 0.2;
        const band = height / 2 - 10;
        for (let i = from; i < to; i += 1) {
          const value = row.estimate.samples[i] ?? 0;
          context.beginPath();
          context.arc(x(value), height / 2 + jitter(i + r * 7919) * band, 1.7, 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      });
    },
    [rows]
  );

  // Animate the resamples in once the figure is in view, fast and then settling.
  useEffect(() => {
    if (!inView) {
      return;
    }
    if (prefersReducedMotion()) {
      paint(0, total, true);
      drawn.current = total;
      setDone(true);
      return;
    }
    setDone(false);
    drawn.current = 0;
    paint(0, 0, true);
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      const target = Math.round(total * eased);
      paint(drawn.current, target, false);
      drawn.current = target;
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        setDone(true);
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [inView, paint, total, run]);

  // Keep the drawing crisp across resizes and zoom.
  useEffect(() => {
    const observer = new ResizeObserver(() => paint(0, drawn.current, true));
    canvases.current.forEach((canvas) => canvas && observer.observe(canvas));
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div ref={figure} className={styles.figure} data-done={done}>
      {rows.map((row, r) => {
        const [min, max] = row.domain;
        const at = (value: number) => `${((value - min) / (max - min)) * 100}%`;
        return (
          <div key={row.id} className={styles.row} data-real={row.real}>
            <div className={styles.label}>
              <p className={styles.name}>{row.label}</p>
              <p className={styles.detail}>{row.detail}</p>
            </div>

            <div className={styles.plot}>
              <canvas
                ref={(node) => {
                  canvases.current[r] = node;
                }}
                className={styles.canvas}
                aria-hidden="true"
              />
              <div
                className={styles.bracket}
                style={{ left: at(row.estimate.low), width: `calc(${at(row.estimate.high)} - ${at(row.estimate.low)})` } as CSSProperties}
                aria-hidden="true"
              />
              <div className={styles.mean} style={{ left: at(row.estimate.mean) }} aria-hidden="true" />
              <div className={styles.axis} aria-hidden="true">
                {row.ticks.map((value) => (
                  <span key={value} style={{ left: at(value) }} data-zero={value === 0}>
                    {tick(value, row.unit)}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.result}>
              <p className={styles.value}>{signed(row.estimate.mean, row.unit)}</p>
              <p className={styles.interval}>
                95% CI {signed(row.estimate.low, row.unit)} … {signed(row.estimate.high, row.unit)}
              </p>
              <p className={styles.verdict}>{row.verdict}</p>
            </div>
          </div>
        );
      })}

      <div className={styles.footer}>
        <p>
          {done ? `${total.toLocaleString("en")} resamples per row.` : `Resampling ${total.toLocaleString("en")} times…`} Same code
          and seed as the CLI, so it lands on the interval the CLI printed.
        </p>
        <button type="button" className={styles.replay} onClick={() => setRun((n) => n + 1)} disabled={!done}>
          Run it again
        </button>
      </div>
    </div>
  );
}
