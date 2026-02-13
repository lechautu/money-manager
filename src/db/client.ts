/* eslint-disable @typescript-eslint/no-explicit-any */
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';

const DB_NAME = 'money-mgmt.sqlite';

let sqlite: SQLiteAPI;
let db: number;

export async function getDB() {
    if (db) return { sqlite, db };

    const module = await SQLiteESMFactory();
    sqlite = SQLite.Factory(module);

    const vfs = new IDBBatchAtomicVFS(DB_NAME);
    await (vfs as any).isReady;

    sqlite.vfs_register(vfs as any, true);

    db = await sqlite.open_v2(
        DB_NAME,
        SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
        vfs.name
    );

    // Initialize PRAGMAs
    // IDBBatchAtomicVFS handles atomicity via IDB transactions. WAL might be problematic or unnecessary.
    // await sqlite.exec(db, 'PRAGMA journal_mode=WAL;');
    await sqlite.exec(db, 'PRAGMA foreign_keys=ON;');

    return { sqlite, db };
}


class Mutex {
    private queue: Promise<void> = Promise.resolve();

    lock(): Promise<() => void> {
        let unlock: () => void = () => { };
        const ticket = new Promise<void>(resolve => {
            unlock = resolve;
        });

        const current = this.queue;
        this.queue = this.queue.then(() => ticket);

        return current.then(() => unlock);
    }

    async dispatch<T>(fn: () => Promise<T> | T): Promise<T> {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        } finally {
            unlock();
        }
    }
}

const dbMutex = new Mutex();

export async function run(sql: string, args: any[] = []) {
    return dbMutex.dispatch(async () => {
        const { sqlite, db } = await getDB();
        const results: any[] = [];

        for await (const stmt of sqlite.statements(db, sql)) {
            if (args.length > 0) {
                // Use built-in bind_collection for safer binding
                // @ts-ignore
                if (sqlite.bind_collection) {
                    // @ts-ignore
                    sqlite.bind_collection(stmt, args);
                } else {
                    // Fallback if bind_collection is missing (unlikely with this factory)
                    for (let i = 0; i < args.length; i++) {
                        const val = args[i];
                        const idx = i + 1;
                        if (val === null || val === undefined) {
                            sqlite.bind_null(stmt, idx);
                        } else if (typeof val === 'number') {
                            if (Number.isInteger(val)) {
                                sqlite.bind_int(stmt, idx, val);
                            } else {
                                sqlite.bind_double(stmt, idx, val);
                            }
                        } else if (typeof val === 'string') {
                            sqlite.bind_text(stmt, idx, val);
                        } else if (typeof val === 'boolean') {
                            sqlite.bind_int(stmt, idx, val ? 1 : 0);
                        } else if (val instanceof Uint8Array) {
                            sqlite.bind_blob(stmt, idx, val);
                        } else {
                            sqlite.bind_text(stmt, idx, JSON.stringify(val));
                        }
                    }
                }
            }

            while (await sqlite.step(stmt) === SQLite.SQLITE_ROW) {
                const row: any = {};
                const colCount = sqlite.column_count(stmt);
                for (let i = 0; i < colCount; i++) {
                    const name = sqlite.column_name(stmt, i);
                    const type = sqlite.column_type(stmt, i);
                    let value;
                    switch (type) {
                        case SQLite.SQLITE_INTEGER:
                        case SQLite.SQLITE_FLOAT:
                            value = sqlite.column_double(stmt, i);
                            break;
                        case SQLite.SQLITE_TEXT:
                            value = sqlite.column_text(stmt, i);
                            break;
                        case SQLite.SQLITE_BLOB:
                            value = sqlite.column_blob(stmt, i);
                            break;
                        case SQLite.SQLITE_NULL:
                            value = null;
                            break;
                    }
                    row[name] = value;
                }
                results.push(row);
            }
        }
        return results;
    });
}

export async function exec(sql: string) {
    return dbMutex.dispatch(async () => {
        const { sqlite, db } = await getDB();
        await sqlite.exec(db, sql);
    });
}

export function getSqliteInstance() {
    return { sqlite, db };
}

