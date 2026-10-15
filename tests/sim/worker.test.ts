import { afterEach, describe, expect, it, vi } from "vitest";
import { installSimWorker, type SimWorkerScope } from "../../src/worker/sim.worker";
import type { WorkerRequest, WorkerResponse } from "../../src/worker/protocol";

describe("simulation worker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at default speed and publishes each due tick", () => {
    vi.useFakeTimers();
    const responses: WorkerResponse[] = [];
    const scope: SimWorkerScope = {
      onmessage: null,
      postMessage: (message) => responses.push(message),
    };
    installSimWorker(scope, () => Date.now());
    const send = (data: WorkerRequest): void => {
      scope.onmessage?.({ data });
    };

    send({
      type: "init",
      seed: 42,
      width: 8,
      height: 12,
    });
    const ready = responses[0];
    expect(ready?.type).toBe("ready");
    if (ready?.type !== "ready") throw new Error("Worker did not become ready");

    send({ type: "action", action: { tick: 1, type: "tap", xMm: 2, yMm: 3 } });
    vi.advanceTimersByTime(20);

    const frontIndex = Atomics.load(new Int32Array(ready.storage, 0, 1), 0);
    const frontMaterials = new Uint8Array(
      ready.storage,
      Int32Array.BYTES_PER_ELEMENT + frontIndex * ready.layout.bytesPerBuffer,
      ready.layout.cells,
    );
    expect(frontMaterials).toContain(4);
    expect(responses).toContainEqual(
      expect.objectContaining({
      type: "tick",
      tick: 1,
      ticksAdvanced: 1,
      ticksPerSecondMode: "default",
      events: [
        {
          tick: 1,
          type: "action",
          payload: { action: "tap", xMm: 2, yMm: 3 },
        },
      ],
      }),
    );
    expect(responses.some((response) => response.type === "tick")).toBe(true);
    send({ type: "stop" });
  });

  it("publishes state every tick but batches notifications and events per bounded pump", () => {
    vi.useFakeTimers();
    const responses: WorkerResponse[] = [];
    let now = 0;
    const scope: SimWorkerScope = {
      onmessage: null,
      postMessage: (message) => responses.push(message),
    };
    installSimWorker(scope, () => now);
    const send = (data: WorkerRequest): void => {
      scope.onmessage?.({ data });
    };

    send({ type: "init", seed: 42, width: 8, height: 12 });
    const ready = responses[0];
    expect(ready?.type).toBe("ready");
    if (ready?.type !== "ready") throw new Error("Worker did not become ready");

    send({ type: "action", action: { tick: 1, type: "tap", xMm: 2, yMm: 3 } });
    send({ type: "action", action: { tick: 2, type: "tap", xMm: 3, yMm: 4 } });
    now = 1000;
    vi.advanceTimersByTime(10);

    const tickMessages = responses.filter((response) => response.type === "tick");
    expect(tickMessages).toHaveLength(1);
    expect(tickMessages[0]).toMatchObject({
      type: "tick",
      tick: 32,
      ticksAdvanced: 32,
      ticksPerSecondMode: "default",
      events: [
        { tick: 1, type: "action" },
        { tick: 2, type: "action" },
      ],
    });
    expect(
      Atomics.load(new Int32Array(ready.storage, 0, 1), 0),
    ).toBe(0);
    now = 2000;
    vi.advanceTimersByTime(100);
    expect(responses.filter((response) => response.type === "tick")).toHaveLength(1);

    send({ type: "ack", tick: 32 });
    vi.advanceTimersByTime(10);
    expect(responses.filter((response) => response.type === "tick")).toHaveLength(2);
    expect(responses.filter((response) => response.type === "tick")[1]).toMatchObject({
      tick: 64,
      ticksAdvanced: 32,
    });
    send({ type: "stop" });
  });
});
