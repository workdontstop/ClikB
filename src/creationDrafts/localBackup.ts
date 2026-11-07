/** JSON overflow backing store. Media bytes remain in S3. */
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Local draft storage is unavailable.'));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('clik-creation-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error || new Error('Local draft storage could not open.')); };
    request.onblocked = () => { database = undefined; reject(new Error('Local draft storage is blocked.')); };
  });
  return database;
}
export async function writeDraftBackup(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    transaction.objectStore('snapshots').put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Local draft could not be retained.'));
  });
}
export async function readDraftBackup(key: string): Promise<any | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
}
