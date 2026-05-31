/** Dev-only: allow starting with zero humans (`?allCpu=1`, local setup only). */
export function devAllowAllCpuStart(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(globalThis.location.search).get('allCpu') === '1'
  );
}
