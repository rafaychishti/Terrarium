import type { StateLayout, StateView } from "../shared/layout";
import {
  MATERIAL_PROPERTIES,
  Material,
  type MaterialId,
} from "../shared/materials";

export const ROOM_TEMPERATURE_C = 18;

const LIGHT_TO_HEAT = 0.08;
const DIFFUSION_SCALE = 0.005;
const BOUNDARY_COOLING_RATE = 0.02;
const SETTLED_TEMPERATURE_DELTA_C = 0.001;

export class HeatTransfer {
  private readonly temperatureDelta: Float32Array;
  private readonly horizontalConductivity: Float32Array;
  private readonly verticalConductivity: Float32Array;
  private materialPropertiesDirty = true;

  constructor(layout: StateLayout) {
    this.temperatureDelta = new Float32Array(layout.cells);
    this.horizontalConductivity = new Float32Array(layout.cells);
    this.verticalConductivity = new Float32Array(layout.cells);
  }

  step(
    state: StateView,
    layout: StateLayout,
    materialsChanged = false,
    elapsedTicks = 1,
  ): boolean {
    if (materialsChanged) this.materialPropertiesDirty = true;
    if (this.materialPropertiesDirty) this.updateMaterialProperties(state, layout);

    let greatestTemperatureChange = 0;
    for (let index = 0; index < layout.cells; index += 1) {
      const absorbedLight = state.light[index];
      const heat = absorbedLight * LIGHT_TO_HEAT * elapsedTicks;
      state.temperature[index] += heat;
      greatestTemperatureChange = Math.max(greatestTemperatureChange, Math.abs(heat));
    }

    const temperatureDelta = this.temperatureDelta;
    const horizontalConductivity = this.horizontalConductivity;
    const verticalConductivity = this.verticalConductivity;
    temperatureDelta.fill(0);
    for (let index = 0; index < layout.cells; index += 1) {
      const temperature = state.temperature[index];
      const horizontal = horizontalConductivity[index];
      if (horizontal > 0) {
        const transfer =
          (state.temperature[index + 1] - temperature) *
          horizontal *
          elapsedTicks;
        temperatureDelta[index] += transfer;
        temperatureDelta[index + 1] -= transfer;
      }
      const vertical = verticalConductivity[index];
      if (vertical > 0) {
        const transfer =
          (state.temperature[index + layout.width] - temperature) *
          vertical *
          elapsedTicks;
        temperatureDelta[index] += transfer;
        temperatureDelta[index + layout.width] -= transfer;
      }
    }

    for (let index = 0; index < layout.cells; index += 1) {
      const previousTemperature = state.temperature[index];
      let temperature =
        previousTemperature + temperatureDelta[index];
      if (state.materials[index] === Material.glass) {
        let retainedHeat = 1;
        for (let step = 0; step < elapsedTicks; step += 1) {
          retainedHeat *= 1 - BOUNDARY_COOLING_RATE;
        }
        temperature =
          ROOM_TEMPERATURE_C +
          (temperature - ROOM_TEMPERATURE_C) * retainedHeat;
      }
      state.temperature[index] = temperature;
      greatestTemperatureChange = Math.max(
        greatestTemperatureChange,
        Math.abs(temperature - previousTemperature),
      );
    }

    return greatestTemperatureChange < SETTLED_TEMPERATURE_DELTA_C;
  }

  private updateMaterialProperties(state: StateView, layout: StateLayout): void {
    const horizontal = this.horizontalConductivity;
    const vertical = this.verticalConductivity;
    horizontal.fill(0);
    vertical.fill(0);
    for (let y = 0; y < layout.height; y += 1) {
      const row = y * layout.width;
      for (let x = 0; x < layout.width; x += 1) {
        const index = row + x;
        const conductivity =
          MATERIAL_PROPERTIES[
            state.materials[index] as MaterialId
          ].conductivity;
        if (x + 1 < layout.width) {
          const nextConductivity =
            MATERIAL_PROPERTIES[
              state.materials[index + 1] as MaterialId
            ].conductivity;
          horizontal[index] =
            Math.min(conductivity, nextConductivity) * DIFFUSION_SCALE;
        }
        if (y + 1 < layout.height) {
          const nextConductivity =
            MATERIAL_PROPERTIES[
              state.materials[index + layout.width] as MaterialId
            ].conductivity;
          vertical[index] =
            Math.min(conductivity, nextConductivity) * DIFFUSION_SCALE;
        }
      }
    }
    this.materialPropertiesDirty = false;
  }
}
