export const FIELD_NAMES = [
  "water",
  "temperature",
  "co2",
  "oxygen",
  "nutrients",
  "microbes",
  "light",
] as const;

export type FloatField = (typeof FIELD_NAMES)[number];

export interface StateLayout {
  readonly width: number;
  readonly height: number;
  readonly cells: number;
  readonly bytesPerBuffer: number;
  readonly materialOffset: number;
  readonly fieldOffsets: Readonly<Record<FloatField, number>>;
}

export interface StateView {
  readonly materials: Uint8Array;
  readonly water: Float32Array;
  readonly temperature: Float32Array;
  readonly co2: Float32Array;
  readonly oxygen: Float32Array;
  readonly nutrients: Float32Array;
  readonly microbes: Float32Array;
  readonly light: Float32Array;
}

export interface SharedStateBuffer {
  readonly storage: SharedArrayBuffer;
  readonly frontIndex: Int32Array;
  readonly buffers: readonly [StateView, StateView];
  front(): StateView;
  back(): StateView;
  publishBack(): void;
}

export function createStateLayout(width: number, height: number): StateLayout {
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError("Grid width must be a positive safe integer");
  }
  if (!Number.isSafeInteger(height) || height < 1) {
    throw new RangeError("Grid height must be a positive safe integer");
  }
  const cells = width * height;
  if (!Number.isSafeInteger(cells)) {
    throw new RangeError("Grid cell count exceeds the safe integer range");
  }

  let offset = Math.ceil(cells / Float32Array.BYTES_PER_ELEMENT) * 4;
  const fieldOffsets = {} as Record<FloatField, number>;
  for (const name of FIELD_NAMES) {
    fieldOffsets[name] = offset;
    offset += cells * Float32Array.BYTES_PER_ELEMENT;
  }

  return {
    width,
    height,
    cells,
    bytesPerBuffer: offset,
    materialOffset: 0,
    fieldOffsets,
  };
}

function createStateView(
  storage: SharedArrayBuffer,
  layout: StateLayout,
  bufferIndex: number,
): StateView {
  const bufferOffset = Int32Array.BYTES_PER_ELEMENT + bufferIndex * layout.bytesPerBuffer;
  const floats = (field: FloatField): Float32Array =>
    new Float32Array(
      storage,
      bufferOffset + layout.fieldOffsets[field],
      layout.cells,
    );

  return {
    materials: new Uint8Array(
      storage,
      bufferOffset + layout.materialOffset,
      layout.cells,
    ),
    water: floats("water"),
    temperature: floats("temperature"),
    co2: floats("co2"),
    oxygen: floats("oxygen"),
    nutrients: floats("nutrients"),
    microbes: floats("microbes"),
    light: floats("light"),
  };
}

export function createSharedStateBuffer(layout: StateLayout): SharedStateBuffer {
  if (typeof SharedArrayBuffer === "undefined") {
    throw new Error("SharedArrayBuffer is unavailable; enable cross-origin isolation");
  }
  const storage = new SharedArrayBuffer(
    Int32Array.BYTES_PER_ELEMENT + layout.bytesPerBuffer * 2,
  );
  const frontIndex = new Int32Array(storage, 0, 1);
  const buffers: readonly [StateView, StateView] = [
    createStateView(storage, layout, 0),
    createStateView(storage, layout, 1),
  ];

  return {
    storage,
    frontIndex,
    buffers,
    front: () => buffers[Atomics.load(frontIndex, 0) as 0 | 1],
    back: () => buffers[(1 - Atomics.load(frontIndex, 0)) as 0 | 1],
    publishBack: () => {
      Atomics.store(frontIndex, 0, 1 - Atomics.load(frontIndex, 0));
    },
  };
}
