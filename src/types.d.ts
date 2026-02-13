interface FileSystemSyncAccessHandle {
    read(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
    write(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
    flush(): void;
    close(): void;
    truncate(newSize: number): void;
    getSize(): number;
}

interface FileSystemFileHandle {
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}
declare module 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js' {
    export class IDBBatchAtomicVFS {
        constructor(name: string);
        name: string;
        close(): Promise<void>;
    }
}
