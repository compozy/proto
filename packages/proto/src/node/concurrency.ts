/** Ordered I/O with at most four operations in flight; drain active work before rejecting. */
export async function mapConcurrent<T, R>(
  values: Iterable<T>,
  operation: (value: T) => Promise<R>
): Promise<R[]> {
  const items = [...values];
  const results: R[] = [];
  let next = 0;
  const failures: { index: number; reason: unknown }[] = [];
  /** Claim inputs in order until a failure, retaining each started operation's error for final selection. */
  async function worker() {
    while (!failures.length && next < items.length) {
      const index = next++;
      try {
        results[index] = await operation(items[index]!);
      } catch (error) {
        failures.push({ index, reason: error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  const [failure] = failures.sort((a, b) => a.index - b.index);
  if (failure) throw failure.reason;
  return results;
}
