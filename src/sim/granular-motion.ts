import type { StateLayout, StateView } from "../shared/layout";
import { Material } from "../shared/materials";
import { cos, sin } from "../shared/dmath";

const DEGREES_TO_RADIANS = 0.017453292519943295;
const DIRECTION_EPSILON = 1e-7;

function isGranular(material: number): boolean {
  return (
    material === Material.gravel ||
    material === Material.sand ||
    material === Material.soil ||
    material === Material.water
  );
}

function swapCells(state: StateView, source: number, destination: number): void {
  const material = state.materials[source];
  state.materials[source] = state.materials[destination];
  state.materials[destination] = material;

  let value = state.water[source];
  state.water[source] = state.water[destination];
  state.water[destination] = value;
  value = state.temperature[source];
  state.temperature[source] = state.temperature[destination];
  state.temperature[destination] = value;
  value = state.co2[source];
  state.co2[source] = state.co2[destination];
  state.co2[destination] = value;
  value = state.oxygen[source];
  state.oxygen[source] = state.oxygen[destination];
  state.oxygen[destination] = value;
  value = state.nutrients[source];
  state.nutrients[source] = state.nutrients[destination];
  state.nutrients[destination] = value;
  value = state.microbes[source];
  state.microbes[source] = state.microbes[destination];
  state.microbes[destination] = value;
  value = state.light[source];
  state.light[source] = state.light[destination];
  state.light[destination] = value;
}

function tryMove(
  state: StateView,
  layout: StateLayout,
  source: number,
  dx: number,
  dy: number,
  gravityX: number,
  gravityY: number,
  moved: Uint8Array,
): boolean {
  if (dx === 0 && dy === 0) return false;
  if (gravityX * dx + gravityY * dy <= DIRECTION_EPSILON) return false;

  const x = source % layout.width;
  const y = Math.floor(source / layout.width);
  const destinationX = x + dx;
  const destinationY = y + dy;
  if (
    destinationX <= 0 ||
    destinationX >= layout.width - 1 ||
    destinationY < 0 ||
    destinationY >= layout.height - 1
  ) {
    return false;
  }

  const destination = destinationY * layout.width + destinationX;
  if (
    state.materials[destination] !== Material.air ||
    moved[destination] !== 0
  ) {
    return false;
  }
  swapCells(state, source, destination);
  moved[destination] = 1;
  return true;
}

export class GranularMotion {
  private readonly moved: Uint8Array;

  constructor(private readonly layout: StateLayout) {
    this.moved = new Uint8Array(layout.cells);
  }

  step(state: StateView, tick: number, tiltDegrees: number): boolean {
    this.moved.fill(0);
    const layout = this.layout;
    const normalizedDegrees = tiltDegrees % 360;
    const radians = normalizedDegrees * DEGREES_TO_RADIANS;
    // Positive tilt points gravity toward increasing x; screen y increases downward.
    const gravityX = sin(radians);
    const gravityY = cos(radians);
    const horizontalDirection =
      gravityX > DIRECTION_EPSILON
        ? 1
        : gravityX < -DIRECTION_EPSILON
          ? -1
          : 0;
    const verticalDirection =
      gravityY > DIRECTION_EPSILON
        ? 1
        : gravityY < -DIRECTION_EPSILON
          ? -1
          : 0;
    const firstDiagonalX =
      horizontalDirection === 0
        ? tick % 2 === 0
          ? 1
          : -1
        : horizontalDirection;
    const firstDiagonalY =
      verticalDirection === 0
        ? tick % 2 === 0
          ? 1
          : -1
        : verticalDirection;
    const yStart =
      verticalDirection < 0 ? 0 : layout.height - 2;
    const yEnd = verticalDirection < 0 ? layout.height - 1 : -1;
    const yStep = verticalDirection < 0 ? 1 : -1;
    const scanLeftToRight = tick % 2 === 0;
    let didMove = false;

    for (let y = yStart; y !== yEnd; y += yStep) {
      const row = y * layout.width;
      const xStart = scanLeftToRight ? 1 : layout.width - 2;
      const xEnd = scanLeftToRight ? layout.width - 1 : 0;
      const xStep = scanLeftToRight ? 1 : -1;
      for (let x = xStart; x !== xEnd; x += xStep) {
        const source = row + x;
        if (!isGranular(state.materials[source])) continue;

        const diagonalX = firstDiagonalX;
        const diagonalY = firstDiagonalY;
        let moved = false;
        if (horizontalDirection !== 0 && verticalDirection !== 0) {
          moved = tryMove(
            state,
            this.layout,
            source,
            diagonalX,
            diagonalY,
            gravityX,
            gravityY,
            this.moved,
          );
        }
        if (!moved && Math.abs(gravityY) >= Math.abs(gravityX)) {
          moved = tryMove(
            state,
            this.layout,
            source,
            0,
            verticalDirection,
            gravityX,
            gravityY,
            this.moved,
          );
          if (!moved) {
            moved = tryMove(
              state,
              this.layout,
              source,
              horizontalDirection,
              0,
              gravityX,
              gravityY,
              this.moved,
            );
          }
        } else if (!moved) {
          moved = tryMove(
            state,
            this.layout,
            source,
            horizontalDirection,
            0,
            gravityX,
            gravityY,
            this.moved,
          );
          if (!moved) {
            moved = tryMove(
              state,
              this.layout,
              source,
              0,
              verticalDirection,
              gravityX,
              gravityY,
              this.moved,
            );
          }
        }
        if (
          !moved &&
          horizontalDirection !== 0 &&
          verticalDirection !== 0
        ) {
          moved = tryMove(
            state,
            this.layout,
            source,
            -diagonalX,
            diagonalY,
            gravityX,
            gravityY,
            this.moved,
          );
        }
        if (
          !moved &&
          horizontalDirection === 0 &&
          verticalDirection !== 0
        ) {
          moved = tryMove(
            state,
            layout,
            source,
            firstDiagonalX,
            verticalDirection,
            gravityX,
            gravityY,
            this.moved,
          );
          if (!moved) {
            moved = tryMove(
              state,
              layout,
              source,
              -firstDiagonalX,
              verticalDirection,
              gravityX,
              gravityY,
              this.moved,
            );
          }
        }
        didMove ||= moved;
      }
    }
    return didMove;
  }
}
