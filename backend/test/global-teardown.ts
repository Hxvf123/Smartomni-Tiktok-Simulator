export default async function globalTeardown(): Promise<void> {
  const pg = (globalThis as any).__SIM_PG__;
  if (pg) await pg.stop();
}
