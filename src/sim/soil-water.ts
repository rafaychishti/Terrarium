import type { StateLayout, StateView } from "../shared/layout";
import { MATERIAL_PROPERTIES, Material, type MaterialId } from "../shared/materials";

const CELL_VOLUME_MILLILITRES = 0.001;
const GRAVITY_BIAS = 0.15;
const FLOW_RATE: readonly number[] = [
  0,
  0,
  0.12,
  0.1,
  0.045,
  0.01,
  0,
  0,
  0.025,
];
const WATER_EPSILON = 1e-12;
const SOIL_WATER_STEP_TICKS = 60;

function isPorous(material: number): boolean {
  return (
    material === Material.gravel ||
    material === Material.sand ||
    material === Material.soil ||
    material === Material.clay ||
    material === Material.detritus
  );
}

function canBeActive(material: number): boolean {
  return isPorous(material) || material === Material.water;
}

function poreCapacity(material: number): number {
  return (
    MATERIAL_PROPERTIES[material as MaterialId].porosity *
    CELL_VOLUME_MILLILITRES
  );
}

export class SoilWater {
  private readonly activeFlags: Uint8Array;
  private readonly activeIndices: Uint32Array;
  private activeCount = 0;
  private readonly delta: Float64Array;
  private readonly deltaFlags: Uint8Array;
  private readonly changedIndices: Uint32Array;
  private changedCount = 0;
  private readonly nextIndices: Uint32Array;
  private initialized = false;
  private lastModule: string | null = null;
  private lastStepTick = Number.NEGATIVE_INFINITY;

  constructor(private readonly layout: StateLayout) {
    this.activeFlags = new Uint8Array(layout.cells);
    this.activeIndices = new Uint32Array(layout.cells);
    this.delta = new Float64Array(layout.cells);
    this.deltaFlags = new Uint8Array(layout.cells);
    this.changedIndices = new Uint32Array(layout.cells);
    this.nextIndices = new Uint32Array(layout.cells);
  }

  get lastWaterModule(): string | null {
    return this.lastModule;
  }

  mist(state: StateView, amount: number): number {
    let surfaceCount = 0;
    for (let x = 1; x < this.layout.width - 1; x += 1) {
      const surface = this.surfaceCell(state, x);
      if (surface >= 0) surfaceCount += 1;
    }
    if (amount > 0 && surfaceCount === 0) {
      throw new RangeError("Cannot mist a jar with no porous surface");
    }

    if (amount > 0) {
      const perCell = amount / surfaceCount;
      let actualAdded = 0;
      for (let x = 1; x < this.layout.width - 1; x += 1) {
        const surface = this.surfaceCell(state, x);
        if (surface < 0) continue;
        const previous = state.water[surface];
        state.water[surface] += perCell;
        actualAdded += state.water[surface] - previous;
        this.addNeighborhood(state, surface);
      }
      this.lastModule = "mist";
      return actualAdded;
    }
    return 0;
  }

  step(
    state: StateView,
    tick: number,
    materialsChanged: boolean,
    waterAddedThisTick = false,
  ): number {
    if (!this.initialized || materialsChanged) {
      this.discoverWater(state);
      this.initialized = true;
    }
    if (materialsChanged || waterAddedThisTick) {
      this.lastStepTick = tick;
    } else if (tick - this.lastStepTick < SOIL_WATER_STEP_TICKS) {
      return 0;
    } else {
      this.lastStepTick = tick;
    }
    if (waterAddedThisTick || this.activeCount === 0) return 0;

    this.changedCount = 0;
    let transferred = false;
    let transferredWater = 0;
    const width = this.layout.width;
    for (let activeIndex = 0; activeIndex < this.activeCount; activeIndex += 1) {
      const index = this.activeIndices[activeIndex];
      const material = state.materials[index];
      if (isPorous(material)) {
        const x = index % width;
        if (x + 1 < width - 1) {
          transferred =
            this.flowPorousPair(state, index, index + 1, false) || transferred;
        }
        if (index + width < this.layout.cells - width) {
          transferred =
            this.flowPorousPair(state, index, index + width, true) || transferred;
        }
      } else if (material === Material.water) {
        transferred = this.infiltrateFreeWater(state, index) || transferred;
      }
    }

    for (let index = 0; index < this.changedCount; index += 1) {
      const cell = this.changedIndices[index];
      const previousWater = state.water[cell];
      state.water[cell] = Math.max(0, previousWater + this.delta[cell]);
      transferredWater += state.water[cell] - previousWater;
      this.delta[cell] = 0;
      this.deltaFlags[cell] = 0;
    }

    const previousCount = this.activeCount;
    for (let index = 0; index < previousCount; index += 1) {
      this.activeFlags[this.activeIndices[index]] = 0;
    }
    let nextCount = 0;
    for (let index = 0; index < previousCount; index += 1) {
      const cell = this.activeIndices[index];
      if (state.water[cell] > WATER_EPSILON) {
        nextCount = this.addNeighborhoodToList(
          state,
          cell,
          this.nextIndices,
          nextCount,
        );
      }
    }
    for (let index = 0; index < this.changedCount; index += 1) {
      const cell = this.changedIndices[index];
      if (state.water[cell] > WATER_EPSILON) {
        nextCount = this.addNeighborhoodToList(
          state,
          cell,
          this.nextIndices,
          nextCount,
        );
      }
    }
    for (let index = 0; index < nextCount; index += 1) {
      this.activeIndices[index] = this.nextIndices[index];
    }
    this.activeCount = nextCount;

    if (transferred) {
      this.lastModule = "soil-water";
    }
    return transferredWater;
  }

  private surfaceCell(state: StateView, x: number): number {
    for (let y = 0; y < this.layout.height - 1; y += 1) {
      const index = y * this.layout.width + x;
      if (isPorous(state.materials[index])) return index;
    }
    return -1;
  }

  private discoverWater(state: StateView): void {
    for (let index = 0; index < this.layout.cells; index += 1) {
      if (
        canBeActive(state.materials[index]) &&
        state.water[index] > WATER_EPSILON
      ) {
        this.addNeighborhood(state, index);
      }
    }
  }

  private addNeighborhood(state: StateView, index: number): void {
    this.activeCount = this.addNeighborhoodToList(
      state,
      index,
      this.activeIndices,
      this.activeCount,
    );
  }

  private addNeighborhoodToList(
    state: StateView,
    index: number,
    indices: Uint32Array,
    count: number,
  ): number {
    const width = this.layout.width;
    const x = index % width;
    const y = Math.floor(index / width);
    count = this.addActive(state, index, indices, count);
    if (x > 0) count = this.addActive(state, index - 1, indices, count);
    if (x + 1 < width) count = this.addActive(state, index + 1, indices, count);
    if (y > 0) count = this.addActive(state, index - width, indices, count);
    if (y + 1 < this.layout.height) {
      count = this.addActive(state, index + width, indices, count);
    }
    return count;
  }

  private addActive(
    state: StateView,
    index: number,
    indices: Uint32Array,
    count: number,
  ): number {
    if (
      this.activeFlags[index] === 0 &&
      canBeActive(state.materials[index])
    ) {
      this.activeFlags[index] = 1;
      indices[count] = index;
      return count + 1;
    }
    return count;
  }

  private flowPorousPair(
    state: StateView,
    first: number,
    second: number,
    downward: boolean,
  ): boolean {
    if (!isPorous(state.materials[second])) return false;
    const firstMaterial = state.materials[first];
    const secondMaterial = state.materials[second];
    const firstCapacity = poreCapacity(firstMaterial);
    const secondCapacity = poreCapacity(secondMaterial);
    const firstWater = Math.max(0, state.water[first] + this.delta[first]);
    const secondWater = Math.max(0, state.water[second] + this.delta[second]);
    const potential =
      firstWater / firstCapacity -
      secondWater / secondCapacity +
      (downward ? GRAVITY_BIAS : 0);
    if (potential === 0) return false;

    const source = potential > 0 ? first : second;
    const destination = potential > 0 ? second : first;
    const sourceWater = potential > 0 ? firstWater : secondWater;
    if (sourceWater <= WATER_EPSILON) return false;

    const rate = Math.min(
      FLOW_RATE[firstMaterial],
      FLOW_RATE[secondMaterial],
    );
    const amount = Math.min(
      sourceWater,
      Math.abs(potential) * Math.min(firstCapacity, secondCapacity) * rate,
    );
    if (amount <= WATER_EPSILON) return false;
    this.adjustWater(source, -amount);
    this.adjustWater(destination, amount);
    return true;
  }

  private infiltrateFreeWater(state: StateView, source: number): boolean {
    if (state.water[source] + this.delta[source] <= WATER_EPSILON) return false;
    const width = this.layout.width;
    const x = source % width;
    const y = Math.floor(source / width);
    let transferred = false;
    if (x > 0) {
      transferred =
        this.infiltrateNeighbor(state, source, source - 1) ||
        transferred;
    }
    if (x + 1 < width) {
      transferred =
        this.infiltrateNeighbor(state, source, source + 1) ||
        transferred;
    }
    if (y > 0) {
      transferred =
        this.infiltrateNeighbor(state, source, source - width) ||
        transferred;
    }
    if (y + 1 < this.layout.height) {
      transferred =
        this.infiltrateNeighbor(state, source, source + width) ||
        transferred;
    }
    return transferred;
  }

  private infiltrateNeighbor(
    state: StateView,
    source: number,
    destination: number,
  ): boolean {
    const material = state.materials[destination];
    if (!isPorous(material)) return false;
    const sourceWater = Math.max(0, state.water[source] + this.delta[source]);
    if (sourceWater <= WATER_EPSILON) return false;
    const rate = FLOW_RATE[material];
    const amount = Math.min(sourceWater, sourceWater * rate);
    if (amount <= WATER_EPSILON) return false;
    this.adjustWater(source, -amount);
    this.adjustWater(destination, amount);
    return true;
  }

  private adjustWater(index: number, amount: number): void {
    if (this.deltaFlags[index] === 0) {
      this.deltaFlags[index] = 1;
      this.changedIndices[this.changedCount] = index;
      this.changedCount += 1;
    }
    this.delta[index] += amount;
  }
}
