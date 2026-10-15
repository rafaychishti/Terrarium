import { afterEach, describe, expect, it, vi } from "vitest";
import { installSimWorker, type SimWorkerScope } from "../../src/worker/sim.worker";
import type { WorkerRequest, WorkerResponse } from "../../src/worker/protocol";

describe("simulation worker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes the generated state through the shared back buffer each tick", () => {
    vi.useFakeTimers();
    const responses: WorkerResponse[] = [];
    const scope: SimWorkerScope = {
      onmessage: null,
      postMessage: (message) => responses.push(message),
    };
    installSimWorker(scope);
    const send = (data: WorkerRequest): void => {
      scope.onmessage?.({ data });
    };

    send({
      type: "init",
      seed: 42,
      width: 8,
      height: 12,
      tickSeconds: 1,
    });
    const ready = responses[0];
    expect(ready?.type).toBe("ready");
    if (ready?.type !== "ready") throw new Error("Worker did not become ready");

    send({ type: "action", action: { tick: 1, type: "tap", xMm: 2, yMm: 3 } });
    vi.advanceTimersByTime(1000);

    const frontIndex = Atomics.load(new Int32Array(ready.storage, 0, 1), 0);
    expect(frontIndex).toBe(1);
    const frontMaterials = new Uint8Array(
      ready.storage,
      Int32Array.BYTES_PER_ELEMENT + frontIndex * ready.layout.bytesPerBuffer,
      ready.layout.cells,
    );
    expect(frontMaterials).toContain(4);
    expect(responses.at(-1)).toEqual({
      type: "tick",
      tick: 1,
      events: [
        {
          tick: 1,
          type: "action",
          payload: { action: "tap", xMm: 2, yMm: 3 },
        },
      ],
    });
    send({ type: "stop" });
  });
});
