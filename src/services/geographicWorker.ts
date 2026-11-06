export function criarWorkerGeografico() {
  return new Worker(new URL('./geographic.worker.ts', import.meta.url), { type: 'module' });
}
