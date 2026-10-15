import type { StateLayout, StateView } from "../shared/layout";
import { MATERIAL_PROPERTIES, type MaterialId } from "../shared/materials";

export interface AreaLamp {
  readonly xMm: number;
  readonly yMm: number;
  readonly intensity: number;
}

const BASE_ABSORPTION = 0.002;
const ALBEDO_ABSORPTION_SCALE = 0.012;
const ABSORPTION_BY_MATERIAL: readonly number[] = [
  absorb(0),
  absorb(1),
  absorb(2),
  absorb(3),
  absorb(4),
  absorb(5),
  absorb(6),
  absorb(7),
  absorb(8),
];

function absorb(material: MaterialId): number {
  return (
    BASE_ABSORPTION +
    (1 - MATERIAL_PROPERTIES[material].albedo) *
      ALBEDO_ABSORPTION_SCALE
  );
}

export class LightTransport {
  step(state: StateView, layout: StateLayout, lamp: AreaLamp): void {
    state.light.fill(0);
    if (lamp.intensity === 0) return;

    const sourceX = Math.max(
      0,
      Math.min(layout.width - 1, Math.round(lamp.xMm)),
    );
    const sourceY = Math.max(
      0,
      Math.min(layout.height - 1, Math.round(lamp.yMm)),
    );
    const direction = sourceX < layout.width / 2 ? 1 : -1;
    const areaRadius = Math.max(1, layout.height / 4);
    const xEnd = direction > 0 ? layout.width - 1 : 0;

    for (let y = 0; y < layout.height; y += 1) {
      const verticalDistance = Math.abs(y - sourceY);
      if (verticalDistance >= areaRadius) continue;
      const areaFalloff = 1 - verticalDistance / areaRadius;
      let incoming = lamp.intensity * areaFalloff;
      const row = y * layout.width;
      for (let x = sourceX; x !== xEnd; x += direction) {
        const index = row + x;
        const absorption = ABSORPTION_BY_MATERIAL[state.materials[index]] ?? 0;
        state.light[index] = incoming * absorption;
        incoming *= 1 - absorption;
      }
    }
  }
}
