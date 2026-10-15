export const Material = {
  air: 0,
  glass: 1,
  gravel: 2,
  sand: 3,
  soil: 4,
  clay: 5,
  rock: 6,
  water: 7,
  detritus: 8,
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

export interface MaterialProperties {
  /** Density in g/cm³. */
  readonly density: number;
  /** Pore-space fraction in [0, 1]. */
  readonly porosity: number;
  /** Thermal conductivity in W/(m·K). */
  readonly conductivity: number;
  /** Reflected-light fraction in [0, 1]. */
  readonly albedo: number;
}

export const MATERIAL_PROPERTIES = {
  [Material.air]: {
    density: 0.0012,
    porosity: 1,
    conductivity: 0.025,
    albedo: 0,
  },
  [Material.glass]: {
    density: 2.5,
    porosity: 0,
    conductivity: 1,
    albedo: 0.08,
  },
  [Material.gravel]: {
    density: 1.7,
    porosity: 0.4,
    conductivity: 0.4,
    albedo: 0.18,
  },
  [Material.sand]: {
    density: 1.6,
    porosity: 0.38,
    conductivity: 0.3,
    albedo: 0.3,
  },
  [Material.soil]: {
    density: 1.2,
    porosity: 0.5,
    conductivity: 0.25,
    albedo: 0.15,
  },
  [Material.clay]: {
    density: 1.1,
    porosity: 0.55,
    conductivity: 0.9,
    albedo: 0.2,
  },
  [Material.rock]: {
    density: 2.7,
    porosity: 0.02,
    conductivity: 2.5,
    albedo: 0.25,
  },
  [Material.water]: {
    density: 1,
    porosity: 0,
    conductivity: 0.6,
    albedo: 0.06,
  },
  [Material.detritus]: {
    density: 0.2,
    porosity: 0.8,
    conductivity: 0.1,
    albedo: 0.2,
  },
} as const satisfies Readonly<Record<MaterialId, MaterialProperties>>;
