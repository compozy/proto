/** Ordered I/O with at most four operations in flight; drain active work before rejecting. */
export async function mapConcurrent<T, R>(
  values: Iterable<T>,
  operation: (value: T) => Promise<R>
): Promise<R[]> {
  const items = [...values];
  const results: R[] = [];
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await operation(items[index]!);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(4, items.length) }, worker)
  );
  const failure = workers.find(result => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return results;
}
