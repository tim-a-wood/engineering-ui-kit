"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Workspace = "scenario" | "optimizer" | "validation";

type Point = {
  u: number;
  t: number;
  s: number;
  x: number;
  y: number;
  tractorYaw: number;
  trailerYaw: number;
  articulation: number;
  steering: number;
  steeringRate: number;
  clearance: number;
  speed: number;
  acceleration: number;
  jerk: number;
};

type Series = { label: string; color: string; values: number[] };

type PlotProps = {
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
  xValues: number[];
  series: Series[];
  yMin: number;
  yMax: number;
  cursor: number;
  threshold?: number;
  thresholdLabel?: string;
  thresholdDirection?: "min" | "max";
  digits?: number;
  onSeek: (ratio: number) => void;
};

const COLORS = {
  cyan: "#38c9dc",
  violet: "#a894ee",
  amber: "#e9a94b",
  red: "#ee7373",
  green: "#4ec58a",
  text: "#d9e3e8",
  muted: "#82929c",
  grid: "#26333b",
  canvas: "#0b1115",
};

const WORKSPACES: { id: Workspace; label: string; short: string }[] = [
  { id: "scenario", label: "Scenario authoring", short: "Scenario" },
  { id: "optimizer", label: "Search + optimizer", short: "Search + Optimizer" },
  { id: "validation", label: "Validation review", short: "Validation Review" },
];

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const gaussian = (value: number, center: number, width: number) => Math.exp(-Math.pow((value - center) / width, 2));
const format = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "—");

function makeTrajectory(optimized: boolean, dockOffset: number): Point[] {
  const points = Array.from({ length: 81 }, (_, index) => {
    const u = index / 80;
    const refineShift = optimized ? -0.72 * gaussian(u, 0.66, 0.19) : 0;
    const tractorYaw = 140 + 40 * u + (optimized ? 20.5 : 24.5) * Math.sin(Math.PI * u);
    const trailerYaw = 140 + 40 * u - (optimized ? 7.2 : 10.2) * Math.sin(Math.PI * u);
    const steering = 6.5 * Math.sin(2 * Math.PI * u) + 26.5 * Math.sin(Math.PI * u) - (optimized ? 2.8 : 0) * gaussian(u, 0.62, 0.18);
    const speed = -1.22 * Math.pow(Math.sin(Math.PI * u), 0.72);
    return {
      u,
      t: u * 28.4,
      s: u * 31.8,
      x: 18 + 10.1 * u + 0.8 * Math.sin(Math.PI * u),
      y: 29 - 17 * u + 2.8 * Math.sin(Math.PI * u) + dockOffset * u + refineShift,
      tractorYaw,
      trailerYaw,
      articulation: Math.abs(tractorYaw - trailerYaw),
      steering,
      steeringRate: 0,
      clearance: 1.38 - (optimized ? 1.04 : 1.22) * gaussian(u, 0.68, 0.105) + Math.max(-0.08, -dockOffset * 0.18),
      speed,
      acceleration: 0,
      jerk: 0,
    };
  });

  for (let index = 1; index < points.length; index += 1) {
    const dt = points[index].t - points[index - 1].t;
    points[index].steeringRate = (points[index].steering - points[index - 1].steering) / dt;
    points[index].acceleration = (points[index].speed - points[index - 1].speed) / dt;
  }
  points[0].steeringRate = points[1].steeringRate;
  points[0].acceleration = points[1].acceleration;
  for (let index = 1; index < points.length; index += 1) {
    const dt = points[index].t - points[index - 1].t;
    points[index].jerk = (points[index].acceleration - points[index - 1].acceleration) / dt;
  }
  points[0].jerk = points[1].jerk;
  return points;
}

function useCanvas(
  ref: React.RefObject<HTMLCanvasElement | null>,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
  dependencies: React.DependencyList,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(context, bounds.width, bounds.height);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

function TechnicalPlot({
  title,
  subtitle,
  xLabel,
  yLabel,
  xValues,
  series,
  yMin,
  yMax,
  cursor,
  threshold,
  thresholdLabel,
  thresholdDirection = "max",
  digits = 2,
  onSeek,
}: PlotProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const index = Math.min(series[0].values.length - 1, Math.round(cursor * (series[0].values.length - 1)));

  const draw = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = COLORS.canvas;
    context.fillRect(0, 0, width, height);
    const left = 47;
    const right = width - 12;
    const top = 9;
    const bottom = height - 30;
    const plotWidth = Math.max(1, right - left);
    const plotHeight = Math.max(1, bottom - top);
    const xAt = (i: number) => left + (i / Math.max(1, xValues.length - 1)) * plotWidth;
    const yAt = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * plotHeight;

    context.lineWidth = 1;
    context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textBaseline = "middle";
    context.strokeStyle = COLORS.grid;
    context.fillStyle = COLORS.muted;
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = yMin + ((yMax - yMin) * tick) / 4;
      const y = yAt(value);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.textAlign = "right";
      context.fillText(value.toFixed(Math.abs(yMax - yMin) < 4 ? 2 : 0), left - 7, y);
    }
    for (let tick = 0; tick <= 4; tick += 1) {
      const i = Math.round(((xValues.length - 1) * tick) / 4);
      const x = xAt(i);
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      context.textAlign = "center";
      context.fillText(xValues[i].toFixed(xValues.at(-1)! < 10 ? 1 : 0), x, bottom + 12);
    }

    if (threshold !== undefined) {
      const y = yAt(threshold);
      context.strokeStyle = thresholdDirection === "min" ? COLORS.red : COLORS.amber;
      context.setLineDash([5, 4]);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = thresholdDirection === "min" ? COLORS.red : COLORS.amber;
      context.textAlign = "left";
      context.fillText(thresholdLabel || "limit", left + 5, Math.max(top + 7, y - 7));
    }

    series.forEach((item) => {
      context.strokeStyle = item.color;
      context.lineWidth = 1.7;
      context.beginPath();
      item.values.forEach((value, i) => {
        if (i === 0) context.moveTo(xAt(i), yAt(value));
        else context.lineTo(xAt(i), yAt(value));
      });
      context.stroke();
    });

    const cursorX = left + cursor * plotWidth;
    context.strokeStyle = COLORS.text;
    context.globalAlpha = 0.58;
    context.beginPath();
    context.moveTo(cursorX, top);
    context.lineTo(cursorX, bottom);
    context.stroke();
    context.globalAlpha = 1;
    series.forEach((item) => {
      context.fillStyle = item.color;
      context.beginPath();
      context.arc(cursorX, yAt(item.values[index]), 3, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = COLORS.muted;
    context.textAlign = "center";
    context.fillText(xLabel, left + plotWidth / 2, height - 6);
    context.save();
    context.translate(9, top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(yLabel, 0, 0);
    context.restore();
  }, [cursor, index, series, threshold, thresholdDirection, thresholdLabel, xLabel, xValues, yLabel, yMax, yMin]);

  useCanvas(ref, draw, [draw]);

  return (
    <section className="plot-panel">
      <div className="plot-head">
        <div><strong>{title}</strong><span>{subtitle}</span></div>
        <div className="plot-live">
          {series.map((item) => <span key={item.label} style={{ color: item.color }}>{item.label} {format(item.values[index], digits)}</span>)}
        </div>
      </div>
      <canvas
        ref={ref}
        className="technical-canvas"
        aria-label={`${title}. ${subtitle}`}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(1, (event.clientX - bounds.left - 47) / Math.max(1, bounds.width - 59))));
        }}
      />
    </section>
  );
}

function YardMap({
  points,
  baseline,
  cursor,
  optimized,
  dockOffset,
  workspace,
  onSeek,
}: {
  points: Point[];
  baseline: Point[];
  cursor: number;
  optimized: boolean;
  dockOffset: number;
  workspace: Workspace;
  onSeek: (ratio: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    const portrait = width < 600 && height > width * 1.12;
    const worldWidth = portrait ? 38 : 60;
    const worldHeight = portrait ? 50 : 38;
    const scale = Math.min(width / worldWidth, height / worldHeight);
    const offsetX = (width - worldWidth * scale) / 2;
    const offsetY = (height - worldHeight * scale) / 2;
    const screen = (x: number, y: number) => portrait
      ? { x: offsetX + (38 - y) * scale, y: offsetY + (x - 10) * scale }
      : { x: offsetX + x * scale, y: offsetY + y * scale };
    const moveTo = (x: number, y: number) => { const point = screen(x, y); context.moveTo(point.x, point.y); };
    const lineTo = (x: number, y: number) => { const point = screen(x, y); context.lineTo(point.x, point.y); };
    const worldPolygon = (vertices: { x: number; y: number }[], fill: string, stroke: string, lineWidth = 1) => {
      context.beginPath();
      vertices.forEach((vertex, vertexIndex) => vertexIndex === 0 ? moveTo(vertex.x, vertex.y) : lineTo(vertex.x, vertex.y));
      context.closePath();
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.stroke();
    };
    const worldRect = (x: number, y: number, rectWidth: number, rectHeight: number, fill: string, stroke: string, lineWidth = 1) => worldPolygon([
      { x, y }, { x: x + rectWidth, y }, { x: x + rectWidth, y: y + rectHeight }, { x, y: y + rectHeight },
    ], fill, stroke, lineWidth);
    const index = Math.min(points.length - 1, Math.round(cursor * (points.length - 1)));
    const current = points[index];

    context.clearRect(0, 0, width, height);
    const asphalt = context.createLinearGradient(0, 0, width, height);
    asphalt.addColorStop(0, "#111a20");
    asphalt.addColorStop(0.55, "#0a1115");
    asphalt.addColorStop(1, "#071015");
    context.fillStyle = asphalt;
    context.fillRect(0, 0, width, height);
    const vignette = context.createRadialGradient(width * 0.48, height * 0.45, 0, width * 0.48, height * 0.45, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, "rgba(39,66,76,.08)");
    vignette.addColorStop(1, "rgba(0,0,0,.42)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(197,221,230,.055)";
    for (let dot = 0; dot < 180; dot += 1) {
      const dx = (Math.sin(dot * 91.17) * 0.5 + 0.5) * width;
      const dy = (Math.sin(dot * 37.41 + 1.7) * 0.5 + 0.5) * height;
      context.fillRect(dx, dy, 1, 1);
    }
    context.font = `${portrait ? 10 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.lineWidth = 1;
    for (let x = portrait ? 10 : 0; x <= 60; x += 2) {
      context.strokeStyle = x % 10 === 0 ? "rgba(82,113,126,.34)" : "rgba(45,65,73,.23)";
      context.beginPath(); moveTo(x, 0); lineTo(x, 38); context.stroke();
    }
    for (let y = 0; y <= 38; y += 2) {
      context.strokeStyle = y % 10 === 0 ? "rgba(82,113,126,.34)" : "rgba(45,65,73,.23)";
      context.beginPath(); moveTo(portrait ? 10 : 0, y); lineTo(60, y); context.stroke();
    }

    worldRect(47, 0, 13, 38, "#17232a", "#617581", 1.2);
    for (let bay = 2; bay < 38; bay += 6) {
      context.strokeStyle = "rgba(125,150,160,.32)";
      context.beginPath(); moveTo(47, bay); lineTo(60, bay); context.stroke();
    }
    context.fillStyle = COLORS.muted;
    let labelPoint = screen(49, 4);
    context.fillText("WAREHOUSE A", labelPoint.x, labelPoint.y);
    labelPoint = screen(49, 10.4 + dockOffset);
    context.fillText("DOCK D-17", labelPoint.x, labelPoint.y);
    worldRect(45.6, 8 + dockOffset, 1.4, 8, "rgba(56,201,220,.10)", COLORS.cyan, 2.2);
    for (let stripe = 0; stripe < 8; stripe += 1.25) {
      context.strokeStyle = "rgba(56,201,220,.42)";
      context.beginPath(); moveTo(44.4, 8 + dockOffset + stripe); lineTo(45.6, 8 + dockOffset + stripe + .8); context.stroke();
    }

    const hazardCenter = screen(33.15, 19.25);
    context.fillStyle = "rgba(238,115,115,.075)";
    context.beginPath(); context.arc(hazardCenter.x, hazardCenter.y, 3.2 * scale, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(238,115,115,.38)";
    context.setLineDash([4, 4]);
    context.beginPath(); context.arc(hazardCenter.x, hazardCenter.y, 3.2 * scale, 0, Math.PI * 2); context.stroke();
    context.setLineDash([]);
    worldRect(31.4, 18, 3.5, 2.5, "#3c4a52", "#a3b1b8", 1.2);
    context.fillStyle = COLORS.muted;
    labelPoint = screen(31.2, 17.2);
    context.fillText("PALLET-12", labelPoint.x, labelPoint.y);
    worldRect(11, 5, 5.5, 3.2, "#243138", "#3c4e57");
    worldRect(12, 31, 4.2, 3.2, "#243138", "#3c4e57");

    if (workspace === "optimizer") {
      for (let ring = 0; ring < 18; ring += 1) {
        for (let sample = 0; sample < 12; sample += 1) {
          const u = (ring * 12 + sample) / 215;
          const anchor = baseline[Math.min(80, Math.round(u * 80))];
          const spread = 1.1 + ring * 0.09;
          const x = anchor.x + Math.sin(sample * 2.13 + ring * 0.71) * spread;
          const y = anchor.y + Math.cos(sample * 1.69 + ring * 0.43) * spread * 0.78;
          const particle = screen(x, y);
          context.fillStyle = ring < 11 ? "rgba(233,169,75,.33)" : "rgba(238,115,115,.20)";
          context.fillRect(particle.x, particle.y, portrait ? 2 : 1.3, portrait ? 2 : 1.3);
        }
      }
      context.strokeStyle = COLORS.red;
      context.lineWidth = 1.2;
      context.setLineDash([4, 3]);
      context.beginPath();
      moveTo(23, 25);
      const cp1 = screen(31, 30); const cp2 = screen(36, 25); const end = screen(40, 22);
      context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y); context.stroke();
      context.setLineDash([]);
      context.fillStyle = COLORS.red;
      labelPoint = screen(36.5, 24); context.fillText("rejected primitive · α bound", labelPoint.x, labelPoint.y);
      context.strokeStyle = COLORS.amber;
      const analyticPoint = screen(27.8, 19.9);
      context.beginPath();
      context.arc(analyticPoint.x, analyticPoint.y, 8, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = COLORS.amber;
      labelPoint = screen(29.2, 18.5); context.fillText("analytic expansion accepted", labelPoint.x, labelPoint.y);
    }

    const drawRoute = (route: Point[], getX: (point: Point) => number, getY: (point: Point) => number, color: string, dash: number[], widthValue = 2) => {
      context.strokeStyle = color;
      context.lineWidth = widthValue;
      context.setLineDash(dash);
      context.beginPath();
      route.forEach((point, pointIndex) => {
        if (pointIndex === 0) moveTo(getX(point), getY(point));
        else lineTo(getX(point), getY(point));
      });
      context.stroke();
      context.setLineDash([]);
    };

    if (workspace === "validation") {
      drawRoute(baseline, (point) => point.x, (point) => point.y, "rgba(238,115,115,.22)", [], 8);
      drawRoute(baseline, (point) => point.x, (point) => point.y, COLORS.red, [7, 5], 1.7);
      context.fillStyle = COLORS.red;
      labelPoint = screen(20, 33); context.fillText("run_0018 · rejected baseline", labelPoint.x, labelPoint.y);
    }
    drawRoute(points, (point) => point.x, (point) => point.y, "rgba(56,201,220,.07)", [], 5.4 * scale);
    drawRoute(points, (point) => point.x, (point) => point.y, "rgba(56,201,220,.16)", [], 8);
    drawRoute(points, (point) => point.x, (point) => point.y, COLORS.cyan, [], portrait ? 2.8 : 2.2);
    drawRoute(points, (point) => point.x - Math.cos(rad(point.trailerYaw)) * 8.5, (point) => point.y - Math.sin(rad(point.trailerYaw)) * 8.5, COLORS.violet, [6, 4], 1.8);
    points.filter((_, pointIndex) => pointIndex % 8 === 0).forEach((point) => {
      const marker = screen(point.x, point.y);
      context.fillStyle = COLORS.cyan;
      context.beginPath(); context.arc(marker.x, marker.y, portrait ? 2.3 : 1.7, 0, Math.PI * 2); context.fill();
    });

    const drawBody = (x: number, y: number, yaw: number, length: number, bodyWidth: number, fill: string, stroke: string, kind: "tractor" | "trailer", alpha = 1) => {
      const center = screen(x, y);
      context.save();
      context.globalAlpha = alpha;
      context.translate(center.x, center.y);
      context.rotate(rad(yaw) + (portrait ? Math.PI / 2 : 0));
      context.fillStyle = "rgba(0,0,0,.45)";
      context.fillRect((-length / 2) * scale + 2, (-bodyWidth / 2) * scale + 3, length * scale, bodyWidth * scale);
      context.strokeStyle = stroke;
      context.lineWidth = portrait ? 1.7 : 1.2;
      if (kind === "tractor") {
        const halfLength = length * scale / 2;
        const halfWidth = bodyWidth * scale / 2;
        const nose = halfLength;
        context.beginPath();
        context.moveTo(-halfLength, -halfWidth);
        context.lineTo(nose - .72 * scale, -halfWidth);
        context.lineTo(nose, -.55 * halfWidth);
        context.lineTo(nose, .55 * halfWidth);
        context.lineTo(nose - .72 * scale, halfWidth);
        context.lineTo(-halfLength, halfWidth);
        context.closePath();
        const cabPaint = context.createLinearGradient(-halfLength, -halfWidth, halfLength, halfWidth);
        cabPaint.addColorStop(0, "#0f3138");
        cabPaint.addColorStop(.55, fill);
        cabPaint.addColorStop(1, "#246879");
        context.fillStyle = cabPaint;
        context.fill(); context.stroke();
        context.fillStyle = "rgba(115,196,214,.28)";
        context.fillRect((length * .08) * scale, -halfWidth + 2, length * .25 * scale, bodyWidth * scale - 4);
        context.strokeStyle = "rgba(213,245,250,.44)";
        context.strokeRect((length * .08) * scale, -halfWidth + 2, length * .25 * scale, bodyWidth * scale - 4);
        context.fillStyle = "#091014";
        context.beginPath(); context.arc(-length * .28 * scale, 0, bodyWidth * .24 * scale, 0, Math.PI * 2); context.fill();
        context.strokeStyle = "#7a8b94"; context.beginPath(); context.arc(-length * .28 * scale, 0, bodyWidth * .15 * scale, 0, Math.PI * 2); context.stroke();
        context.fillStyle = COLORS.amber;
        context.fillRect(nose - 2, -halfWidth + 2, 2, 3); context.fillRect(nose - 2, halfWidth - 5, 2, 3);
        context.fillStyle = "#030607";
        [-.26, .24].forEach((lengthRatio) => [-1, 1].forEach((side) => context.fillRect(length * lengthRatio * scale - 3, side * bodyWidth * .5 * scale - 2, 6, 4)));
      } else {
        const trailerPaint = context.createLinearGradient((-length / 2) * scale, (-bodyWidth / 2) * scale, (length / 2) * scale, (bodyWidth / 2) * scale);
        trailerPaint.addColorStop(0, "#242139"); trailerPaint.addColorStop(.52, fill); trailerPaint.addColorStop(1, "#514477");
        context.fillStyle = trailerPaint;
        context.fillRect((-length / 2) * scale, (-bodyWidth / 2) * scale, length * scale, bodyWidth * scale);
        context.strokeRect((-length / 2) * scale, (-bodyWidth / 2) * scale, length * scale, bodyWidth * scale);
        context.strokeStyle = "rgba(226,221,255,.28)";
        context.strokeRect((-length / 2 + .35) * scale, (-bodyWidth / 2 + .24) * scale, (length - .7) * scale, (bodyWidth - .48) * scale);
        context.beginPath(); context.moveTo((-length / 2 + .6) * scale, 0); context.lineTo((length / 2 - .6) * scale, 0); context.stroke();
        context.fillStyle = "#040609";
        [-.36, -.28, -.20].forEach((lengthRatio) => [-1, 1].forEach((side) => context.fillRect(length * lengthRatio * scale - 2.5, side * bodyWidth * .5 * scale - 1.9, 5, 3.8)));
        context.fillStyle = COLORS.amber;
        [-.25, .05, .35].forEach((lengthRatio) => [-1, 1].forEach((side) => context.fillRect(length * lengthRatio * scale, side * bodyWidth * .48 * scale - 1, 2, 2)));
        context.fillStyle = COLORS.red;
        context.fillRect((-length / 2) * scale, (-bodyWidth / 2 + .22) * scale, 2.5, 3);
        context.fillRect((-length / 2) * scale, (bodyWidth / 2 - .42) * scale, 2.5, 3);
      }
      context.restore();
    };

    const drawVehicle = (point: Point, alpha = 1) => {
      const tractorDirection = { x: Math.cos(rad(point.tractorYaw)), y: Math.sin(rad(point.tractorYaw)) };
      const trailerDirection = { x: Math.cos(rad(point.trailerYaw)), y: Math.sin(rad(point.trailerYaw)) };
      const hitch = { x: point.x - tractorDirection.x * 2.1, y: point.y - tractorDirection.y * 2.1 };
      const trailerCenter = { x: hitch.x - trailerDirection.x * 6.8, y: hitch.y - trailerDirection.y * 6.8 };
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = COLORS.amber;
      context.lineWidth = 2;
      context.beginPath(); moveTo(hitch.x, hitch.y); lineTo(trailerCenter.x + trailerDirection.x * 6.8, trailerCenter.y + trailerDirection.y * 6.8); context.stroke();
      context.restore();
      drawBody(trailerCenter.x, trailerCenter.y, point.trailerYaw, 13.6, 2.55, "#302b48", COLORS.violet, "trailer", alpha);
      drawBody(point.x, point.y, point.tractorYaw, 5.1, 2.55, "#123f49", COLORS.cyan, "tractor", alpha);
    };

    [0.18, 0.36, 0.54, 0.72, 0.9].forEach((ratio) => drawVehicle(points[Math.round(ratio * 80)], workspace === "scenario" ? 0.16 : 0.08));
    drawVehicle(current, 1);

    const closestIndex = points.reduce((best, point, pointIndex) => point.clearance < points[best].clearance ? pointIndex : best, 0);
    const closest = points[closestIndex];
    context.strokeStyle = optimized ? COLORS.green : COLORS.red;
    context.setLineDash([4, 3]);
    context.beginPath(); moveTo(closest.x + 1.8, closest.y); lineTo(31.4, 19.25); context.stroke();
    context.setLineDash([]);
    context.fillStyle = optimized ? COLORS.green : COLORS.red;
    labelPoint = screen(28, 21.4); context.fillText(`d_min ${Math.min(...points.map((point) => point.clearance)).toFixed(2)} m`, labelPoint.x, labelPoint.y);
    context.fillStyle = COLORS.text;
    labelPoint = screen(points[0].x - 2, points[0].y + 3); context.fillText("START", labelPoint.x, labelPoint.y);
    labelPoint = screen(35.4, 7.2 + dockOffset); context.fillText("TRAILER GOAL", labelPoint.x, labelPoint.y);
    context.fillStyle = COLORS.muted;
    context.fillText("ENU · 2 m grid", 12, height - 14);
    context.save();
    context.translate(width - 27, 28);
    context.fillStyle = "rgba(8,16,20,.78)";
    context.strokeStyle = "#50626c";
    context.beginPath(); context.arc(0, 0, 17, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = COLORS.cyan; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(0, 8); context.lineTo(0, -10); context.stroke();
    context.fillStyle = COLORS.cyan; context.beginPath(); context.moveTo(0, -13); context.lineTo(-3, -7); context.lineTo(3, -7); context.closePath(); context.fill();
    context.font = "9px ui-monospace, monospace"; context.textAlign = "center"; context.fillText("N", 0, -21);
    context.restore();
  }, [baseline, cursor, dockOffset, optimized, points, workspace]);

  useCanvas(ref, draw, [draw]);

  return (
    <canvas
      ref={ref}
      className="yard-canvas"
      aria-label="Top-down articulated yard tractor reverse docking scenario and planner evidence"
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const portrait = bounds.height > bounds.width * 1.12;
        const ratio = portrait ? (event.clientY - bounds.top) / bounds.height : (event.clientX - bounds.left) / bounds.width;
        onSeek(Math.max(0, Math.min(1, ratio)));
      }}
    />
  );
}

function PropertyRow({ label, value, tone }: { label: string; value: string; tone?: "pass" | "fail" }) {
  return <div className="property-row"><span>{label}</span><code className={tone === "pass" ? "pass-text" : tone === "fail" ? "fail-text" : ""}>{value}</code></div>;
}

function ScenarioInspector({
  clearanceMargin,
  articulationLimit,
  dockOffset,
  minClearance,
  maxArticulation,
  maxSteering,
  maxSteeringRate,
  terminalLateral,
  terminalYaw,
  nlpResidual,
  collisionPass,
  onClearance,
  onArticulation,
  onDockOffset,
}: {
  clearanceMargin: number;
  articulationLimit: number;
  dockOffset: number;
  minClearance: number;
  maxArticulation: number;
  maxSteering: number;
  maxSteeringRate: number;
  terminalLateral: number;
  terminalYaw: number;
  nlpResidual: number;
  collisionPass: boolean;
  onClearance: (value: number) => void;
  onArticulation: (value: number) => void;
  onDockOffset: (value: number) => void;
}) {
  return (
    <>
      <div className="dock-title">Vehicle model & constraints</div>
      <div className="inspector-heading">Articulated vehicle</div>
      <PropertyRow label="Tractor wheelbase L₀" value="3.20 m" />
      <PropertyRow label="Tractor envelope" value="5.10 × 2.55 m" />
      <PropertyRow label="Hitch offset M₁" value="−0.30 m" />
      <PropertyRow label="Kingpin → axle L₁" value="11.80 m" />
      <PropertyRow label="Trailer envelope" value="13.60 × 2.55 m" />
      <div className="inspector-heading">Hard constraints</div>
      <label className="range-property"><span>Clearance margin</span><output>{clearanceMargin.toFixed(2)} m</output><input type="range" min="20" max="60" value={Math.round(clearanceMargin * 100)} onChange={(event) => onClearance(Number(event.target.value) / 100)} /></label>
      <label className="range-property"><span>Max articulation |α|</span><output>{articulationLimit.toFixed(0)}°</output><input type="range" min="32" max="48" value={articulationLimit} onChange={(event) => onArticulation(Number(event.target.value))} /></label>
      <PropertyRow label="Max road-wheel steer" value="35.0°" />
      <PropertyRow label="Max steering rate" value="18.0°/s" />
      <PropertyRow label="Reverse speed" value="1.25 m/s" />
      <PropertyRow label="Terminal tolerance" value="0.10 m / 0.5°" />
      <div className="inspector-heading">Goal pose</div>
      <label className="range-property"><span>Dock lateral offset</span><output>{dockOffset >= 0 ? "+" : ""}{dockOffset.toFixed(2)} m</output><input type="range" min="-80" max="80" value={Math.round(dockOffset * 100)} onChange={(event) => onDockOffset(Number(event.target.value) / 100)} /></label>
      <PropertyRow label="Trailer goal yaw" value="180.0°" />
      <PropertyRow label="Dock depth target" value="0.35 m" />
      <div className="inspector-heading">Current result</div>
      <PropertyRow label="Minimum clearance" value={`${minClearance.toFixed(2)} m`} tone={collisionPass ? "pass" : "fail"} />
      <PropertyRow label="Peak articulation" value={`${maxArticulation.toFixed(1)}°`} />
      <PropertyRow label="Peak steer / rate" value={`${maxSteering.toFixed(1)}° / ${maxSteeringRate.toFixed(1)}°/s`} />
      <PropertyRow label="Terminal lat / yaw" value={`${terminalLateral.toFixed(2)} m / ${terminalYaw.toFixed(1)}°`} />
      <PropertyRow label="NLP primal residual" value={nlpResidual.toExponential(1)} />
    </>
  );
}

function OptimizerInspector({ optimized, solving }: { optimized: boolean; solving: boolean }) {
  return (
    <>
      <div className="dock-title">Solver inspector</div>
      <div className="solver-phase-heading"><span>01</span><div><strong>Hybrid A* warm start</strong><small>{solving ? "SEARCHING" : "ACCEPTED"}</small></div></div>
      <div className="solver-kpis"><div><span>Expanded</span><code>{solving ? "12,804" : "18,642"}</code></div><div><span>Generated</span><code>{solving ? "48,116" : "71,903"}</code></div><div><span>Search time</span><code>72.4 ms</code></div></div>
      <div className="inspector-heading">State lattice</div>
      <PropertyRow label="XY / heading resolution" value="0.20 m / 5.0°" />
      <PropertyRow label="Motion primitive" value="0.40 m" />
      <PropertyRow label="Steering samples" value="7 × 2 gears" />
      <PropertyRow label="Analytic expansion" value="14 tried / 1 used" />
      <PropertyRow label="Heuristic" value="Reeds–Shepp + 2D" />
      <PropertyRow label="Warm-start cost" value="18.447" />
      <div className="solver-phase-heading second"><span>02</span><div><strong>Nonlinear refinement</strong><small className={optimized ? "is-pass" : "is-fail"}>{solving ? "ITERATING" : optimized ? "CONVERGED" : "INFEASIBLE"}</small></div></div>
      <div className="solver-kpis"><div><span>SQP iterations</span><code>{solving ? "18 / 60" : optimized ? "31" : "60"}</code></div><div><span>KKT residual</span><code>{optimized ? "6.4e−5" : "3.7e−2"}</code></div><div><span>Solve time</span><code>{optimized ? "41.8 ms" : "86.3 ms"}</code></div></div>
      <div className="inspector-heading">Transcription</div>
      <PropertyRow label="Nodes / interval" value="81 / 0.10 s" />
      <PropertyRow label="Integrator" value="RK4 multiple shooting" />
      <PropertyRow label="Hessian" value="Gauss–Newton" />
      <PropertyRow label="Line search" value="ℓ₁ merit / filter" />
      <PropertyRow label="Feasibility tolerance" value="1.0e−3" />
      <PropertyRow label="Accepted objective J" value={optimized ? "13.821" : "—"} tone={optimized ? "pass" : undefined} />
    </>
  );
}

type ValidationRow = { name: string; observed: string; required: string; margin: string; pass: boolean };

function ValidationInspector({ rows, valid, passed, onExport }: { rows: ValidationRow[]; valid: boolean; passed: number; onExport: () => void }) {
  return (
    <>
      <div className="dock-title">Validation inspector</div>
      <div className={`release-summary ${valid ? "is-valid" : "is-invalid"}`}><div><span>{valid ? "RELEASEABLE" : "REJECTED"}</span><strong>{passed} / 8 required checks</strong></div><code>run_0019</code></div>
      <table className="validation-table">
        <thead><tr><th>Requirement</th><th>Observed</th><th>Required</th><th>Margin</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}><th><i className={row.pass ? "pass" : "fail"}>{row.pass ? "✓" : "×"}</i>{row.name}</th><td>{row.observed}</td><td>{row.required}</td><td className={row.pass ? "pass-text" : "fail-text"}>{row.margin}</td></tr>)}</tbody>
      </table>
      <div className="inspector-heading">Evidence artifacts</div>
      <div className="evidence-list">
        <button type="button"><span>▦</span><div><strong>swept_body.parquet</strong><small>81 poses · 0.25 m sample</small></div><code>sha256:81ab…</code></button>
        <button type="button"><span>≋</span><div><strong>solver_trace.json</strong><small>SQP + search diagnostics</small></div><code>42.8 KB</code></button>
        <button type="button"><span>✓</span><div><strong>validation_report.json</strong><small>schema v1.4 · deterministic</small></div><code>signed</code></button>
      </div>
      <button type="button" className="export-evidence" disabled={!valid} onClick={onExport}>Export release evidence bundle</button>
      <p className="inspector-note">Evaluation basis: kinematic single-track tractor with off-axle hitch and rigid semitrailer. Low-speed yard ODD; no dynamic tire model.</p>
    </>
  );
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("scenario");
  const [optimized, setOptimized] = useState(true);
  const [solving, setSolving] = useState(false);
  const [cursor, setCursor] = useState(0.68);
  const [playing, setPlaying] = useState(false);
  const [dockOffset, setDockOffset] = useState(0);
  const [clearanceMargin, setClearanceMargin] = useState(0.3);
  const [articulationLimit, setArticulationLimit] = useState(42);
  const [mobileDesktop, setMobileDesktop] = useState(false);
  const [mobileZoom, setMobileZoom] = useState(0.3);
  const [toast, setToast] = useState("");
  const points = useMemo(() => makeTrajectory(optimized, dockOffset), [optimized, dockOffset]);
  const baseline = useMemo(() => makeTrajectory(false, dockOffset), [dockOffset]);
  const currentIndex = Math.min(points.length - 1, Math.round(cursor * (points.length - 1)));
  const current = points[currentIndex];
  const minClearance = Math.min(...points.map((point) => point.clearance));
  const maxArticulation = Math.max(...points.map((point) => point.articulation));
  const maxSteering = Math.max(...points.map((point) => Math.abs(point.steering)));
  const maxSteeringRate = Math.max(...points.map((point) => Math.abs(point.steeringRate)));
  const maxSpeed = Math.max(...points.map((point) => Math.abs(point.speed)));
  const maxAcceleration = Math.max(...points.map((point) => Math.abs(point.acceleration)));
  const terminalLateral = optimized ? Math.abs(dockOffset) * 0.08 + 0.04 : 0.13 + Math.abs(dockOffset) * 0.08;
  const terminalYaw = optimized ? 0.3 : 0.9;
  const nlpResidual = optimized ? 8.2e-5 : 3.7e-2;
  const checks = {
    collision: minClearance >= clearanceMargin,
    articulation: maxArticulation <= articulationLimit,
    steering: maxSteering <= 35,
    steeringRate: maxSteeringRate <= 18,
    speed: maxSpeed <= 1.25,
    terminal: terminalLateral <= 0.1 && terminalYaw <= 0.5,
    optimizer: nlpResidual <= 1e-3,
    continuity: true,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const valid = passed === Object.keys(checks).length;
  const baselineMinClearance = Math.min(...baseline.map((point) => point.clearance));
  const validationRows: ValidationRow[] = [
    { name: "Swept-body clearance", observed: `${minClearance.toFixed(2)} m`, required: `≥ ${clearanceMargin.toFixed(2)} m`, margin: `${(minClearance - clearanceMargin) >= 0 ? "+" : ""}${(minClearance - clearanceMargin).toFixed(2)} m`, pass: checks.collision },
    { name: "Articulation |α|", observed: `${maxArticulation.toFixed(1)}°`, required: `≤ ${articulationLimit.toFixed(1)}°`, margin: `${(articulationLimit - maxArticulation).toFixed(1)}°`, pass: checks.articulation },
    { name: "Road-wheel steer |δ|", observed: `${maxSteering.toFixed(1)}°`, required: "≤ 35.0°", margin: `${(35 - maxSteering).toFixed(1)}°`, pass: checks.steering },
    { name: "Steering rate |δ̇|", observed: `${maxSteeringRate.toFixed(1)}°/s`, required: "≤ 18.0°/s", margin: `${(18 - maxSteeringRate).toFixed(1)}°/s`, pass: checks.steeringRate },
    { name: "Reverse velocity |v|", observed: `${maxSpeed.toFixed(2)} m/s`, required: "≤ 1.25 m/s", margin: `${(1.25 - maxSpeed).toFixed(2)} m/s`, pass: checks.speed },
    { name: "Terminal pose", observed: `${terminalLateral.toFixed(2)} m / ${terminalYaw.toFixed(1)}°`, required: "≤ .10 m / .5°", margin: checks.terminal ? "within" : "outside", pass: checks.terminal },
    { name: "NLP primal residual", observed: nlpResidual.toExponential(1), required: "≤ 1.0e−3", margin: optimized ? "12.2×" : "0.03×", pass: checks.optimizer },
    { name: "C¹ continuity", observed: "0 gaps", required: "0 gaps", margin: "exact", pass: checks.continuity },
  ];

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let start: number | null = null;
    const animate = (timestamp: number) => {
      if (start === null) start = timestamp - cursor * 12000;
      const next = Math.min(1, (timestamp - start) / 12000);
      setCursor(next);
      if (next >= 1) { setPlaying(false); return; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const markDirty = () => { setOptimized(false); setPlaying(false); };
  const runPipeline = () => {
    setWorkspace("optimizer");
    setSolving(true);
    setOptimized(false);
    setPlaying(false);
    window.setTimeout(() => {
      setOptimized(true);
      setSolving(false);
      setCursor(0.68);
      setToast("Optimizer converged · 8/8 validation checks passed");
    }, 1150);
  };
  const appStyle = { "--mobile-zoom": String(mobileZoom) } as React.CSSProperties;
  const workspaceLabel = WORKSPACES.find((item) => item.id === workspace)?.label ?? "Scenario authoring";
  const seek = (value: number) => { setPlaying(false); setCursor(value); };

  return (
    <main className={`site-shell ${mobileDesktop ? "mobile-desktop" : ""}`} style={appStyle}>
      <div className="mobile-modebar">
        <span>Workbench view</span>
        {mobileDesktop && <div className="mobile-zoom-controls"><button type="button" onClick={() => setMobileZoom((value) => Math.max(0.3, value - 0.12))}>−</button><output>{Math.round(mobileZoom * 100)}%</output><button type="button" onClick={() => setMobileZoom((value) => Math.min(0.78, value + 0.12))}>+</button></div>}
        <button type="button" className="mobile-mode-toggle" onClick={() => setMobileDesktop((value) => !value)}>{mobileDesktop ? "Close desktop" : "Desktop mode"}</button>
      </div>
      <div className="scale-frame">
        <div className="workbench-app">
          <header className="titlebar">
            <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
            <div className="document-title">DockPlan Lab — yard_north / dock_D17</div>
            <div className="document-state">scenario rev 12 · run_0019</div>
          </header>
          <nav className="menubar" aria-label="Application menu"><span>File</span><span>Edit</span><span>Scenario</span><span>Vehicle</span><span>Planner</span><span>Validation</span><span>View</span><span>Help</span></nav>

          <section className="commandbar" aria-label="Planning commands">
            <div className="workspace-switch" role="tablist" aria-label="Workbench workspace">
              {WORKSPACES.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={workspace === item.id} onClick={() => setWorkspace(item.id)}><span>0{index + 1}</span>{item.short}</button>)}
            </div>
            <span className="separator" />
            <button type="button" className="run-button" disabled={solving} onClick={runPipeline}>{solving ? "Solving…" : "Refine + validate"}</button>
            <button type="button" className="tool-button" disabled={!valid} onClick={() => setToast("Release evidence bundle prepared")}>Export</button>
            <div className={`release-state ${valid ? "is-valid" : "is-invalid"}`}><span>{solving ? "RUNNING" : valid ? "RELEASEABLE" : "REJECTED"}</span><code>{passed}/8 checks · {workspaceLabel}</code></div>
          </section>

          <section className="pipeline-strip" aria-label="Planner pipeline">
            <div><span>1</span><strong>Inputs normalized</strong><code>3.1 ms</code></div><b>›</b>
            <div className={solving ? "active" : "done"}><span>2</span><strong>Hybrid A* warm start</strong><code>{solving ? "searching" : "72.4 ms"}</code></div><b>›</b>
            <div className={solving ? "active" : optimized ? "done" : "warn"}><span>3</span><strong>Nonlinear refinement</strong><code>{solving ? "iterating" : optimized ? "31 iter" : "stale"}</code></div><b>›</b>
            <div className={optimized ? "done" : ""}><span>4</span><strong>Time parameterization</strong><code>Δt 0.10 s</code></div><b>›</b>
            <div className={valid ? "done" : "fail"}><span>5</span><strong>Drivability checks</strong><code>{passed}/8 pass</code></div>
          </section>

          <div className="desktop-grid">
            <aside className="project-dock">
              <div className="dock-title">Experiment</div>
              <div className="tree-section">Scenario</div>
              <button type="button" className="tree-item selected">◇ dock_D17_reverse</button>
              <button type="button" className="tree-item">◇ dock_D18_blocked</button>
              <div className="tree-section">Inputs</div>
              <button type="button" className="tree-item">▦ terminal_north.xodr</button>
              <button type="button" className="tree-item">▦ costmap_0.10m</button>
              <button type="button" className="tree-item">▱ dock_goal.pose</button>
              <div className="tree-section">Vehicle model</div>
              <button type="button" className="tree-item">▰ ottawa_t2_4x2</button>
              <button type="button" className="tree-item">▭ semi_13p6m</button>
              <div className="tree-section">Planner</div>
              <button type="button" className="tree-item">⌘ hybrid_astar.yaml</button>
              <button type="button" className="tree-item">⌘ sqp_refine.yaml</button>
              <div className="tree-section">Runs</div>
              <button type="button" className="tree-item">× run_0018 · rejected</button>
              <button type="button" className="tree-item">✓ run_0019 · accepted</button>
              <div className="adapter-block"><div className="dock-title">Adapters</div><p><i className="online" /> ROS 2 / Autoware</p><p><i className="online" /> CommonRoad</p><p><i /> ASAM OpenSCENARIO</p></div>
            </aside>

            <section className="scenario-document">
              <div className="document-tabs" role="tablist"><button type="button" aria-selected="true">{workspaceLabel} ●</button><button type="button" aria-selected="false">run_0019.solution</button><button type="button" aria-selected="false">planner_config.yaml</button></div>
              <div className="viewport-toolbar">
                <strong>{workspace === "scenario" ? "Articulated swept-path view" : workspace === "optimizer" ? "Hybrid-search state lattice + refined solution" : "Accepted trajectory / rejected baseline comparison"}</strong>
                <span>frame: map</span><span>occupancy: 0.10 m</span><span>sample: 0.25 m</span><code>t {current.t.toFixed(2)} s · s {current.s.toFixed(2)} m</code>
              </div>
              <div className="map-stage">
                <YardMap points={points} baseline={baseline} cursor={cursor} optimized={optimized} dockOffset={dockOffset} workspace={workspace} onSeek={seek} />
                <div className={`map-diagnostic ${valid ? "valid" : "invalid"}`}>
                  <strong>{workspace === "optimizer" ? solving ? "SOLVER ACTIVE" : optimized ? "REFINEMENT CONVERGED" : "WARM START ONLY" : valid ? "TRAJECTORY VALID" : "VALIDATOR REJECTED"}</strong>
                  <span>{workspace === "optimizer" ? solving ? "SQP iteration 18 · merit line search accepted" : "Hybrid A* seed refined to continuous, collision-free controls" : valid ? "all required drivability checks passed" : `trailer ↔ PALLET-12 clearance ${minClearance.toFixed(2)} m < ${clearanceMargin.toFixed(2)} m`}</span>
                  <code>α {current.articulation.toFixed(1)}° · δ {current.steering.toFixed(1)}° · v {current.speed.toFixed(2)} m/s</code>
                </div>
                <div className="map-legend">
                  {workspace === "optimizer" && <span><i className="expanded-line" />expanded states</span>}
                  {workspace === "validation" && <span><i className="baseline-line" />rejected baseline</span>}
                  <span><i className="tractor-line" />tractor reference</span><span><i className="trailer-line" />trailer axle path</span><span><i className="clearance-line" />critical clearance</span>
                </div>
              </div>
              <div className="playback-bar">
                <button type="button" onClick={() => { setPlaying(false); setCursor(0); }} aria-label="Return to start">|◀</button>
                <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause trajectory" : "Play trajectory"}>{playing ? "Ⅱ" : "▶"}</button>
                <input type="range" min="0" max="1000" value={Math.round(cursor * 1000)} onChange={(event) => seek(Number(event.target.value) / 1000)} aria-label="Trajectory playback position" />
                <output>t {current.t.toFixed(2)} / 28.40 s</output><span>gear <b>R</b></span>
              </div>
            </section>

            <aside className={`inspector-dock inspector-${workspace}`}>
              {workspace === "scenario" && <ScenarioInspector clearanceMargin={clearanceMargin} articulationLimit={articulationLimit} dockOffset={dockOffset} minClearance={minClearance} maxArticulation={maxArticulation} maxSteering={maxSteering} maxSteeringRate={maxSteeringRate} terminalLateral={terminalLateral} terminalYaw={terminalYaw} nlpResidual={nlpResidual} collisionPass={checks.collision} onClearance={(value) => { markDirty(); setClearanceMargin(value); }} onArticulation={(value) => { markDirty(); setArticulationLimit(value); }} onDockOffset={(value) => { markDirty(); setDockOffset(value); }} />}
              {workspace === "optimizer" && <OptimizerInspector optimized={optimized} solving={solving} />}
              {workspace === "validation" && <ValidationInspector rows={validationRows} valid={valid} passed={passed} onExport={() => setToast("Release evidence bundle prepared")} />}
            </aside>
          </div>

          <section className={`bottom-dock bottom-${workspace}`}>
            <div className="bottom-tabs" role="tablist">{WORKSPACES.map((item) => <button key={item.id} type="button" aria-selected={workspace === item.id} onClick={() => setWorkspace(item.id)}>{item.label}{item.id === "validation" && <span>{passed}/8</span>}</button>)}</div>

            {workspace === "scenario" && <div className="scenario-plot-grid">
              <TechnicalPlot title="Articulation α(t)" subtitle="tractor yaw − trailer yaw" xLabel="time [s]" yLabel="α [deg]" xValues={points.map((point) => point.t)} series={[{ label: "α", color: COLORS.violet, values: points.map((point) => point.articulation) }]} yMin={0} yMax={48} cursor={cursor} threshold={articulationLimit} thresholdLabel={`limit ${articulationLimit}°`} onSeek={seek} digits={1} />
              <TechnicalPlot title="Steering rate δ̇(t)" subtitle="actuator trackability" xLabel="time [s]" yLabel="δ̇ [deg/s]" xValues={points.map((point) => point.t)} series={[{ label: "δ̇", color: COLORS.cyan, values: points.map((point) => point.steeringRate) }]} yMin={-22} yMax={22} cursor={cursor} threshold={18} thresholdLabel="+18°/s" onSeek={seek} digits={1} />
              <TechnicalPlot title="Clearance d(s)" subtitle="tractor + trailer swept body" xLabel="station s [m]" yLabel="d [m]" xValues={points.map((point) => point.s)} series={[{ label: "d", color: checks.collision ? COLORS.green : COLORS.red, values: points.map((point) => point.clearance) }]} yMin={0} yMax={1.6} cursor={cursor} threshold={clearanceMargin} thresholdLabel={`margin ${clearanceMargin.toFixed(2)} m`} thresholdDirection="min" onSeek={seek} digits={2} />
            </div>}

            {workspace === "optimizer" && <div className="optimizer-grid">
              <TechnicalPlot title="Primal feasibility" subtitle="log₁₀ maximum constraint residual" xLabel="SQP iteration k" yLabel="log₁₀ rₚ" xValues={Array.from({ length: 32 }, (_, index) => index)} series={[{ label: "log rₚ", color: COLORS.cyan, values: Array.from({ length: 32 }, (_, index) => optimized ? -0.15 - 3.95 * Math.pow(index / 31, 0.72) : -0.15 - 1.28 * Math.pow(index / 31, 0.7)) }]} yMin={-5} yMax={0} cursor={solving ? 0.58 : 1} threshold={-3} thresholdLabel="accept 1e−3" onSeek={() => undefined} digits={2} />
              <TechnicalPlot title="Objective J(k)" subtitle="merit objective after line search" xLabel="SQP iteration k" yLabel="J" xValues={Array.from({ length: 32 }, (_, index) => index)} series={[{ label: "J", color: COLORS.violet, values: Array.from({ length: 32 }, (_, index) => 13.821 + 8.9 * Math.exp(-index / 6.2) + 0.34 * Math.sin(index * 0.7) * Math.exp(-index / 9)) }]} yMin={12} yMax={24} cursor={solving ? 0.58 : 1} onSeek={() => undefined} digits={3} />
              <section className="diagnostic-panel objective-panel"><div className="plot-head"><div><strong>Objective decomposition</strong><span>weighted terms at accepted solution</span></div><code>J 13.821</code></div><div className="objective-row"><span>path length</span><i style={{ width: "74%" }} /><code>8.240</code></div><div className="objective-row"><span>steer effort</span><i style={{ width: "31%" }} /><code>2.106</code></div><div className="objective-row"><span>steer rate</span><i style={{ width: "18%" }} /><code>1.247</code></div><div className="objective-row"><span>obstacle slack</span><i className="pass-bar" style={{ width: "4%" }} /><code>0.008</code></div><div className="objective-row"><span>terminal error</span><i style={{ width: "8%" }} /><code>0.220</code></div></section>
              <section className="diagnostic-panel event-log"><div className="plot-head"><div><strong>Iteration / event log</strong><span>deterministic solver trace</span></div><code>42 events</code></div><ol><li><time>00.003</time><span>costmap normalized</span><code>ok</code></li><li><time>00.075</time><span>analytic expansion accepted</span><code>node 18327</code></li><li><time>00.083</time><span>warm start reconstructed</span><code>81 nodes</code></li><li><time>00.106</time><span>active set changed</span><code>clearance[54]</code></li><li><time>00.125</time><span>filter line search</span><code>step 0.50</code></li><li><time>00.128</time><span>KKT conditions satisfied</span><code className="pass-text">accepted</code></li></ol></section>
            </div>}

            {workspace === "validation" && <div className="validation-bottom-grid">
              <TechnicalPlot title="Articulation envelope" subtitle="accepted vs baseline" xLabel="station s [m]" yLabel="|α| [deg]" xValues={points.map((point) => point.s)} series={[{ label: "accepted", color: COLORS.violet, values: points.map((point) => point.articulation) }, { label: "baseline", color: COLORS.red, values: baseline.map((point) => point.articulation) }]} yMin={0} yMax={48} cursor={cursor} threshold={articulationLimit} thresholdLabel="hard limit" onSeek={seek} digits={1} />
              <TechnicalPlot title="Swept-body clearance" subtitle="nearest obstacle distance" xLabel="station s [m]" yLabel="d [m]" xValues={points.map((point) => point.s)} series={[{ label: "accepted", color: COLORS.green, values: points.map((point) => point.clearance) }, { label: "baseline", color: COLORS.red, values: baseline.map((point) => point.clearance) }]} yMin={0} yMax={1.6} cursor={cursor} threshold={clearanceMargin} thresholdLabel="required" thresholdDirection="min" onSeek={seek} digits={2} />
              <TechnicalPlot title="Steering command" subtitle="road-wheel angle" xLabel="time [s]" yLabel="δ [deg]" xValues={points.map((point) => point.t)} series={[{ label: "δ", color: COLORS.cyan, values: points.map((point) => point.steering) }]} yMin={-10} yMax={38} cursor={cursor} threshold={35} thresholdLabel="limit" onSeek={seek} digits={1} />
              <TechnicalPlot title="Longitudinal motion" subtitle="reverse velocity and acceleration" xLabel="time [s]" yLabel="v / a" xValues={points.map((point) => point.t)} series={[{ label: "v", color: COLORS.amber, values: points.map((point) => point.speed) }, { label: "a", color: COLORS.cyan, values: points.map((point) => point.acceleration) }]} yMin={-1.5} yMax={0.8} cursor={cursor} threshold={-1.25} thresholdLabel="speed bound" thresholdDirection="min" onSeek={seek} digits={2} />
              <section className="diagnostic-panel comparison-panel"><div className="plot-head"><div><strong>Baseline → refined delta</strong><span>run_0018 compared with run_0019</span></div><code>same seed</code></div><table><thead><tr><th>Metric</th><th>Baseline</th><th>Refined</th><th>Δ / decision</th></tr></thead><tbody><tr><th>Minimum clearance</th><td>{baselineMinClearance.toFixed(2)} m</td><td>{minClearance.toFixed(2)} m</td><td className="pass-text">+{(minClearance - baselineMinClearance).toFixed(2)} m</td></tr><tr><th>Peak articulation</th><td>{Math.max(...baseline.map((p) => p.articulation)).toFixed(1)}°</td><td>{maxArticulation.toFixed(1)}°</td><td className="pass-text">−{(Math.max(...baseline.map((p) => p.articulation)) - maxArticulation).toFixed(1)}°</td></tr><tr><th>Terminal lateral</th><td>0.13 m</td><td>{terminalLateral.toFixed(2)} m</td><td className="pass-text">within tolerance</td></tr><tr><th>Max acceleration</th><td>{maxAcceleration.toFixed(2)} m/s²</td><td>{maxAcceleration.toFixed(2)} m/s²</td><td>unchanged</td></tr><tr><th>Release decision</th><td className="fail-text">REJECT</td><td className={valid ? "pass-text" : "fail-text"}>{valid ? "ACCEPT" : "REJECT"}</td><td>{passed}/8 checks</td></tr></tbody></table></section>
            </div>}
          </section>

          <footer className="statusbar"><span>{solving ? "Refining trajectory and reconstructing control inputs…" : valid ? "Solution valid · export gate enabled" : "Scenario changed · re-run optimizer before release"}</span><span>units: SI</span><span>frame: map → base_link → trailer_axle</span><span>model: articulated kinematic v2</span><span>scenario: 8f2a…c19d</span></footer>
          {toast && <div className="toast" role="status">{toast}</div>}
        </div>
      </div>
    </main>
  );
}
