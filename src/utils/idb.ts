const DB_NAME = 'loomi'
const STORE_NAME = 'kv'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const req = fn(tx.objectStore(STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  return withStore<T>('readonly', (s) => s.get(key) as IDBRequest<T>)
}

export function idbSet(key: string, value: unknown): Promise<void> {
  return withStore('readwrite', (s) => s.put(value, key) as IDBRequest<unknown>).then(() => undefined)
}

export function idbDel(key: string): Promise<void> {
  return withStore('readwrite', (s) => s.delete(key) as IDBRequest<unknown>).then(() => undefined)
}

export function idbKeys(): Promise<string[]> {
  return withStore<IDBValidKey[]>('readonly', (s) => s.getAllKeys() as IDBRequest<IDBValidKey[]>).then(
    (keys) => keys.map((k) => String(k)),
  )
}
