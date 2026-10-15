import type { StateLayout, StateView } from "../shared/layout";

export interface PaperCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  clip(): void;
}

export type PaperDebugView = "moisture" | "temperature" | "light";

export interface PaperOptions {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly physicalWidthMm?: number;
  readonly debugView?: PaperDebugView;
}

export const PAPER_BACKGROUND_COLOR = "#eee7d8";
export const PAPER_COLOR = PAPER_BACKGROUND_COLOR;
const INK = "#354139";

// Material IDs follow the M0 world table: air, glass, gravel, sand, soil,
// clay, rock, water, detritus.
const MATERIAL_WASH: readonly string[] = [
  "transparent",
  "#c9d7d1",
  "#82745f",
  "#c4a875",
  "#604d3f",
  "#8b7667",
  "#555b55",
  "#8ebdc0",
  "#80674b",
];

function hash(x: number, y: number): number {
  let value = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y ^ 0xc2b2ae35, 0x27d4eb2f);
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return (value ^ (value >>> 15)) >>> 0;
}

function paperGround(context: PaperCanvasContext, width: number, height: number): void {
  context.fillStyle = PAPER_BACKGROUND_COLOR;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.12;
  for (let y = 9; y < height; y += 13) {
    for (let x = 7; x < width; x += 19) {
      const grain = hash(x, y);
      const length = 1 + (grain % 8);
      context.fillStyle = (grain & 1) === 0 ? "#fffdf4" : "#b6a88f";
      context.fillRect(x, y, length, 0.7);
    }
  }
  context.globalAlpha = 1;
}

function drawCase(context: PaperCanvasContext, x: number, y: number, width: number, height: number): void {
  context.fillStyle = "#d9e2d9";
  context.globalAlpha = 0.4;
  context.fillRect(x + width * 0.018, y + height * 0.012, width * 0.964, height * 0.976);
  context.globalAlpha = 1;

  context.fillStyle = "#f4f0e5";
  context.fillRect(x + width * 0.035, y + height * 0.025, width * 0.93, height * 0.95);
  context.strokeStyle = INK;
  context.lineWidth = Math.max(1, width * 0.009);
  context.strokeRect(x + width * 0.025, y + height * 0.018, width * 0.95, height * 0.964);

  context.strokeStyle = "#fffdf5";
  context.lineWidth = Math.max(1, width * 0.014);
  context.beginPath();
  context.moveTo(x + width * 0.08, y + height * 0.035);
  context.lineTo(x + width * 0.9, y + height * 0.035);
  context.moveTo(x + width * 0.055, y + height * 0.075);
  context.lineTo(x + width * 0.055, y + height * 0.88);
  context.stroke();
}

function drawMaterials(
  context: PaperCanvasContext,
  state: StateView,
  layout: StateLayout,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cellWidth = width / layout.width;
  const cellHeight = height / layout.height;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  // Run-length grouping keeps the 128×192 Paper level inexpensive while
  // retaining crisp cell boundaries where material changes.
  for (let row = 0; row < layout.height; row += 1) {
    let column = 0;
    while (column < layout.width) {
      const index = row * layout.width + column;
      const material = state.materials[index] ?? 0;
      const color = MATERIAL_WASH[material] ?? "#756d5e";
      let end = column + 1;
      while (end < layout.width && state.materials[index + end - column] === material) end += 1;
      if (material !== 0) {
        context.fillStyle = color;
        context.globalAlpha = material === 1 ? 0.48 : material === 7 ? 0.86 : 0.94;
        context.fillRect(
          x + column * cellWidth,
          y + row * cellHeight,
          (end - column) * cellWidth + 0.3,
          cellHeight + 0.3,
        );
      }
      column = end;
    }
  }

  context.globalAlpha = 0.2;
  context.fillStyle = "#739a66";
  for (let i = 0; i < layout.cells; i += 1) {
    if ((state.microbes[i] ?? 0) > 0.5) {
      context.fillRect(
        x + (i % layout.width) * cellWidth,
        y + Math.floor(i / layout.width) * cellHeight,
        Math.max(cellWidth, 1),
        Math.max(cellHeight, 1),
      );
    }
  }
  context.globalAlpha = 1;
  context.restore();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function drawWaterCycle(
  context: PaperCanvasContext,
  state: StateView,
  layout: StateLayout,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cellWidth = width / layout.width;
  const cellHeight = height / layout.height;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  for (let index = 0; index < layout.cells; index += 1) {
    const material = state.materials[index] ?? 0;
    const water = Math.max(0, state.water[index] ?? 0);
    const cellX = x + (index % layout.width) * cellWidth;
    const cellY = y + Math.floor(index / layout.width) * cellHeight;
    if (water > 0 && material !== 0 && material !== 1 && material !== 7) {
      context.fillStyle = "#8ebdc0";
      context.globalAlpha = Math.min(0.38, (water / (water + 0.015)) * 0.42);
      context.fillRect(cellX, cellY, cellWidth + 0.25, cellHeight + 0.25);
    } else if (water > 0.0002 && material === 0) {
      context.fillStyle = "#dcebe5";
      context.globalAlpha = Math.min(0.16, (water / (water + 0.003)) * 0.18);
      context.fillRect(cellX, cellY, cellWidth + 0.25, cellHeight + 0.25);
    }
  }

  context.globalAlpha = 1;
  context.restore();
}

function drawDroplet(context: PaperCanvasContext, x: number, y: number, radius: number): void {
  context.beginPath();
  context.moveTo(x, y - radius);
  context.quadraticCurveTo(x + radius * 0.85, y + radius * 0.1, x, y + radius);
  context.quadraticCurveTo(x - radius * 0.85, y + radius * 0.1, x, y - radius);
  context.closePath();
  context.fill();
}

function drawGlassDroplets(
  context: PaperCanvasContext,
  state: StateView,
  layout: StateLayout,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cellWidth = width / layout.width;
  const cellHeight = height / layout.height;
  context.fillStyle = "#fffdf5";
  context.strokeStyle = "#8ebdc0";
  context.lineWidth = Math.max(0.6, cellWidth * 0.35);
  for (let row = 0; row < layout.height; row += 1) {
    for (const column of [0, layout.width - 1]) {
      const index = row * layout.width + column;
      if ((state.materials[index] ?? 0) !== 1) continue;
      const insideIndex = row * layout.width + (column === 0 ? 1 : layout.width - 2);
      const water = Math.max(
        state.water[index] ?? 0,
        state.water[insideIndex] ?? 0,
      );
      if (water <= 0.002) continue;

      const seed = hash(column, row);
      const radius = Math.max(
        0.8,
        Math.min(cellWidth, cellHeight) * (0.3 + clamp01(water / (water + 0.04)) * 0.65),
      );
      const offset = (seed % 41) / 100;
      const dropX = x + (column === 0 ? 0.7 + offset : width - 0.7 - offset);
      const dropY = y + (row + 0.5) * cellHeight;
      drawDroplet(context, dropX, dropY, radius);
      context.globalAlpha = 0.55;
      context.stroke();
      context.globalAlpha = 1;
    }
  }
}

function drawLamp(
  context: PaperCanvasContext,
  state: StateView | undefined,
  layout: StateLayout | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  let brightest = 0;
  if (state && layout) {
    for (let i = 0; i < layout.cells; i += 1) {
      brightest = Math.max(brightest, state.light[i] ?? 0);
    }
  }
  const glow = clamp01(brightest / 0.5);
  const center = x + width * 0.5;
  const shadeTop = y - height * 0.045;
  const shadeWidth = width * 0.22;

  context.save();
  context.strokeStyle = "#82745f";
  context.fillStyle = "#c4a875";
  context.lineWidth = Math.max(1, width * 0.008);
  context.beginPath();
  context.moveTo(center, shadeTop - height * 0.025);
  context.lineTo(center, shadeTop);
  context.lineTo(center - shadeWidth * 0.5, shadeTop + height * 0.018);
  context.lineTo(center + shadeWidth * 0.5, shadeTop + height * 0.018);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "#d9aa59";
  context.globalAlpha = 0.08 + glow * 0.18;
  context.lineWidth = Math.max(1, width * 0.006);
  context.beginPath();
  context.moveTo(center - shadeWidth * 0.3, shadeTop + height * 0.022);
  context.lineTo(x + width * 0.22, y + height * 0.11);
  context.moveTo(center + shadeWidth * 0.3, shadeTop + height * 0.022);
  context.lineTo(x + width * 0.78, y + height * 0.11);
  context.moveTo(center, shadeTop + height * 0.022);
  context.lineTo(center, y + height * 0.14);
  context.stroke();
  context.restore();
}

function debugColor(view: PaperDebugView, value: number, maxLight: number): string {
  const amount = view === "moisture"
    ? clamp01(Math.max(0, value) / (Math.max(0, value) + 0.05))
    : view === "temperature"
      ? clamp01((value - 5) / 35)
      : maxLight > 0
        ? clamp01(value / maxLight)
        : 0;
  const start = view === "temperature" ? [74, 105, 164] : [239, 238, 217];
  const end = view === "temperature" ? [204, 83, 57] : view === "light" ? [219, 168, 69] : [43, 116, 162];
  const channel = (index: number): number =>
    Math.round(start[index] + (end[index] - start[index]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function drawDebugView(
  context: PaperCanvasContext,
  state: StateView,
  layout: StateLayout,
  view: PaperDebugView,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  let maxLight = 0;
  if (view === "light") {
    for (let i = 0; i < layout.cells; i += 1) {
      maxLight = Math.max(maxLight, state.light[i] ?? 0);
    }
  }
  const cellWidth = width / layout.width;
  const cellHeight = height / layout.height;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  for (let index = 0; index < layout.cells; index += 1) {
    const value = state[view === "moisture" ? "water" : view][index] ?? 0;
    context.fillStyle = debugColor(view, value, maxLight);
    context.globalAlpha = 0.78;
    context.fillRect(
      x + (index % layout.width) * cellWidth,
      y + Math.floor(index / layout.width) * cellHeight,
      cellWidth + 0.25,
      cellHeight + 0.25,
    );
  }
  context.globalAlpha = 1;
  context.restore();
}

function drawEmptyLife(context: PaperCanvasContext, x: number, y: number, width: number, height: number): void {
  context.strokeStyle = "#536e4b";
  context.lineWidth = Math.max(1, width * 0.009);
  context.beginPath();
  context.moveTo(x + width * 0.22, y + height * 0.74);
  context.quadraticCurveTo(x + width * 0.23, y + height * 0.62, x + width * 0.18, y + height * 0.56);
  context.moveTo(x + width * 0.77, y + height * 0.74);
  context.quadraticCurveTo(x + width * 0.76, y + height * 0.65, x + width * 0.81, y + height * 0.58);
  context.stroke();
}

export function drawPaper(
  context: PaperCanvasContext,
  state: StateView | undefined,
  layout: StateLayout | undefined,
  options: PaperOptions,
): void {
  const { width: canvasWidth, height: canvasHeight } = options;
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) return;
  paperGround(context, canvasWidth, canvasHeight);

  const physicalWidth = options.physicalWidthMm ?? 256;
  const aspect = layout ? layout.height / layout.width : 1.5;
  const availableWidth = canvasWidth * 0.76;
  const availableHeight = canvasHeight * 0.82;
  const scale = Math.min(availableWidth / physicalWidth, availableHeight / (physicalWidth * aspect));
  const caseWidth = physicalWidth * scale;
  const caseHeight = physicalWidth * aspect * scale;
  const x = options.x ?? (canvasWidth - caseWidth) / 2;
  const y = options.y ?? (canvasHeight - caseHeight) / 2;
  const inset = caseWidth * 0.065;
  const interiorX = x + inset;
  const interiorY = y + caseHeight * 0.055;
  const interiorWidth = caseWidth - inset * 2;
  const interiorHeight = caseHeight * 0.89;

  drawCase(context, x, y, caseWidth, caseHeight);
  drawLamp(context, state, layout, x, y, caseWidth, caseHeight);
  if (state && layout) {
    drawMaterials(context, state, layout, interiorX, interiorY, interiorWidth, interiorHeight);
    if (options.debugView) {
      drawDebugView(
        context,
        state,
        layout,
        options.debugView,
        interiorX,
        interiorY,
        interiorWidth,
        interiorHeight,
      );
    } else {
      drawWaterCycle(context, state, layout, interiorX, interiorY, interiorWidth, interiorHeight);
      drawGlassDroplets(context, state, layout, interiorX, interiorY, interiorWidth, interiorHeight);
    }
  } else {
    drawEmptyLife(context, interiorX, interiorY, interiorWidth, interiorHeight);
  }

  context.strokeStyle = INK;
  context.lineWidth = Math.max(1, caseWidth * 0.006);
  context.strokeRect(interiorX, interiorY, interiorWidth, interiorHeight);
  context.globalAlpha = 0.62;
  context.strokeStyle = "#fffdf5";
  context.lineWidth = Math.max(1, caseWidth * 0.018);
  context.beginPath();
  context.moveTo(x + caseWidth * 0.13, y + caseHeight * 0.08);
  context.lineTo(x + caseWidth * 0.13, y + caseHeight * 0.28);
  context.moveTo(x + caseWidth * 0.13, y + caseHeight * 0.34);
  context.lineTo(x + caseWidth * 0.13, y + caseHeight * 0.43);
  context.stroke();
  context.globalAlpha = 1;
}
