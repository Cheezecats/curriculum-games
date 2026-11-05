import { it, expect } from 'vitest';
import { StartupGate } from './startup';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
it('does not restore or train if hidden during an IndexedDB read, even after visible again', async () => {
  let hidden = false;
  const gate = new StartupGate(() => !hidden);
  const saved = deferred<string | null>();
  const requests: string[] = [];
  const pending = gate.start(
    () => saved.promise,
    (model) => {
      requests.push(model ? 'restore' : 'train');
    },
    () => requests.push('fallback'),
  );
  hidden = true;
  gate.invalidate();
  hidden = false;
  saved.resolve('weights');
  await pending;
  expect(requests).toEqual([]);
  await gate.start(
    () => Promise.resolve('weights'),
    () => requests.push('explicit restore'),
    () => {},
  );
  expect(requests).toEqual(['explicit restore']);
});
it('rejects hidden rejected-read fallbacks, initial-hidden startup and disposed continuations', async () => {
  let hidden = true;
  const gate = new StartupGate(() => !hidden);
  const requests: string[] = [];
  await gate.start(
    () => Promise.resolve(null),
    () => requests.push('train'),
    () => requests.push('fallback'),
  );
  expect(requests).toEqual([]);
  hidden = false;
  const saved = deferred<null>();
  const pending = gate.start(
    () => saved.promise,
    () => requests.push('train'),
    () => requests.push('fallback'),
  );
  hidden = true;
  gate.invalidate();
  saved.reject(Error('IndexedDB failed'));
  await pending;
  expect(requests).toEqual([]);
  hidden = false;
  const late = deferred<null>();
  const disposed = gate.start(
    () => late.promise,
    () => requests.push('train'),
    () => requests.push('fallback'),
  );
  gate.dispose();
  late.resolve(null);
  await disposed;
  expect(requests).toEqual([]);
});
it('explicit reset invalidates startup even if the view stays visible', async () => {
  const gate = new StartupGate(() => true);
  const saved = deferred<null>();
  let starts = 0;
  const pending = gate.start(
    () => saved.promise,
    () => {
      starts++;
    },
    () => {},
  );
  gate.invalidate();
  saved.resolve(null);
  await pending;
  expect(starts).toBe(0);
});
