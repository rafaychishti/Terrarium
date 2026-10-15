import { createStateLayout, type StateLayout, type StateView } from "../shared/layout";
import { createRandom, type SeededRandom, type Seed } from "../shared/prng";

export const DEFAULT_GRID_WIDTH = 256;
export const DEFAULT_GRID_HEIGHT = 384;

export const Material = {
  air: 0,
  glass: 1,
  gravel: 2,
  sand: 3,
  soil: 4,
} as const;

function layerDepth(
  random: SeededRandom,
  height: number,
  minimum: number,
  maximum: number,
): number {
  const lower = Math.max(1, Math.floor(height * minimum));
  const upper = Math.max(lower, Math.floor(height * maximum));
  return lower + random.int(upper - lower + 1);
}

function writeLayer(
  materials: Uint8Array,
  width: number,
  top: number,
  depth: number,
  material: number,
): number {
  const layerTop = Math.max(0, top - depth);
  for (let y = top - 1; y >= layerTop; y -= 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      materials[row + x] = material;
    }
  }
  return layerTop;
}

export function generateJar(
  seed: Seed,
  layout: StateLayout = createStateLayout(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT),
): StateView {
  if (layout.width < 3 || layout.height < 3) {
    throw new RangeError("Jar grid must be at least 3 cells wide and high");
  }

  const state: StateView = {
    materials: new Uint8Array(layout.cells),
    water: new Float32Array(layout.cells),
    temperature: new Float32Array(layout.cells),
    co2: new Float32Array(layout.cells),
    oxygen: new Float32Array(layout.cells),
    nutrients: new Float32Array(layout.cells),
    microbes: new Float32Array(layout.cells),
    light: new Float32Array(layout.cells),
  };
  const random = createRandom(seed).fork("jar-layers");
  const soilDepth = layerDepth(random, layout.height - 1, 0.05, 0.12);
  const sandDepth = layerDepth(random, layout.height - 1, 0.03, 0.08);
  const gravelDepth = layerDepth(random, layout.height - 1, 0.02, 0.06);

  let top = layout.height - 1;
  top = writeLayer(state.materials, layout.width, top, gravelDepth, Material.gravel);
  top = writeLayer(state.materials, layout.width, top, sandDepth, Material.sand);
  writeLayer(state.materials, layout.width, top, soilDepth, Material.soil);

  for (let y = 0; y < layout.height; y += 1) {
    state.materials[y * layout.width] = Material.glass;
    state.materials[y * layout.width + layout.width - 1] = Material.glass;
  }
  state.materials.fill(Material.glass, (layout.height - 1) * layout.width);

  return state;
}
