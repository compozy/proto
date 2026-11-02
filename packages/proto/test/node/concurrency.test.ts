import { expect, it } from "vitest";
import { mapConcurrent } from "../../src/node/concurrency.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

// Invariant: bounded I/O preserves input order; a failed batch drains before a caller releases its lock.
// Owner: node concurrency executor. No existing suite owns the shared executor contract.
it("bounds active I/O and returns results in input order", async () => {
  const gates = Array.from({ length: 7 }, deferred);
  const started: number[] = [];
  let active = 0;
  let maximum = 0;
  const result = mapConcurrent(gates, async gate => {
    const index = gates.indexOf(gate);
    started.push(index);
    maximum = Math.max(maximum, ++active);
    await gate.promise;
    active--;
    return index;
  });
  expect(started).toHaveLength(4);
  gates[3]!.resolve();
  await gates[3]!.promise;
  for (const gate of [...gates].reverse()) gate.resolve();
  expect(await result).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(maximum).toBe(4);
  expect(active).toBe(0);
});

it("drains started I/O before rejecting and stops scheduling after a failure", async () => {
  const gate = deferred();
  const failed = deferred();
  const error = new Error("I/O failed");
  const started: number[] = [];
  let active = 0;
  const result = mapConcurrent([0, 1, 2, 3, 4, 5], async index => {
    started.push(index);
    active++;
    try {
      if (index === 0) {
        failed.resolve();
        throw error;
      }
      await gate.promise;
      return index;
    } finally {
      active--;
    }
  }).then(
    () => {
      throw new Error("Expected rejection");
    },
    failure => {
      expect(active).toBe(0);
      return failure;
    }
  );
  await failed.promise;
  expect(active).toBe(3);
  gate.resolve();
  expect(await result).toBe(error);
  expect(started).toEqual([0, 1, 2, 3]);
});

// Invariant: parallel completion cannot change the first input error reported to the caller.
// Owner: node concurrency executor; this suite also owns bounded scheduling and failure draining.
it("reports the lowest failing input even when a reused worker fails first", async () => {
  const gates = Array.from({ length: 5 }, deferred);
  const laterStarted = deferred();
  const firstError = new Error("input 1 failed");
  const laterError = new Error("input 4 failed");
  const result = mapConcurrent([0, 1, 2, 3, 4], async index => {
    if (index === 4) laterStarted.resolve();
    await gates[index]!.promise;
    if (index === 1) throw firstError;
    if (index === 4) throw laterError;
    return index;
  }).catch(error => error);
  gates[0]!.resolve();
  await laterStarted.promise;
  gates[4]!.resolve();
  await gates[4]!.promise;
  for (const gate of gates) gate.resolve();
  expect(await result).toBe(firstError);
});
