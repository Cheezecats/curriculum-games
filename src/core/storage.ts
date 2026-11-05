import { openDB } from 'idb';

let database: ReturnType<typeof openDB> | undefined;
function open() {
  database ??= openDB('fieldwork-local', 1, {
    upgrade(db) {
      db.createObjectStore('records');
    },
    terminated() {
      database = undefined;
    },
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

export async function readRecord<T>(key: string, fallback: T): Promise<T> {
  try {
    const record = (await (await open()).get('records', key)) as
      { version?: number; value?: T } | undefined;
    return record?.version === 1 && record.value !== undefined ? record.value : fallback;
  } catch {
    return fallback;
  }
}

export async function writeRecord(key: string, value: unknown): Promise<void> {
  const db = await open();
  await db.put('records', { version: 1, value }, key);
}
