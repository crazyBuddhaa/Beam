import type { StagedItem } from '../types/transfer.ts';

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (success: (file: File) => void, error?: (err: unknown) => void) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    error?: (err: unknown) => void
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => FileSystemDirectoryReaderLike;
}

function readAllDirectoryEntries(
  reader: FileSystemDirectoryReaderLike
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all);
          } else {
            all.push(...batch);
            readBatch();
          }
        },
        () => resolve(all)
      );
    };
    readBatch();
  });
}

async function traverseEntry(
  entry: FileSystemEntryLike,
  prefix = ''
): Promise<{ file: File; relativePath?: string }[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike;
    return new Promise((resolve) => {
      fileEntry.file(
        (file) => {
          const rel = prefix ? `${prefix}/${file.name}` : undefined;
          resolve([{ file, relativePath: rel }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntryLike;
    const reader = dirEntry.createReader();
    const entries = await readAllDirectoryEntries(reader);
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const nested = await Promise.all(entries.map((child) => traverseEntry(child, nextPrefix)));
    return nested.flat();
  }

  return [];
}

export function filesToStagedItems(files: FileList | File[]): StagedItem[] {
  const arr = Array.from(files);
  return arr.map((file) => {
    const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return {
      id: crypto.randomUUID(),
      kind: 'file',
      name: file.name,
      relativePath: webkitPath && webkitPath.includes('/') ? webkitPath : undefined,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      file,
    };
  });
}

export async function dataTransferToStagedItems(
  dataTransfer: DataTransfer
): Promise<StagedItem[]> {
  const items = Array.from(dataTransfer.items || []);
  const entries: FileSystemEntryLike[] = [];

  for (const item of items) {
    const withEntry = item as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntryLike | null;
    };
    if (typeof withEntry.webkitGetAsEntry === 'function') {
      const entry = withEntry.webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  if (entries.length > 0) {
    const collected = (await Promise.all(entries.map((e) => traverseEntry(e)))).flat();
    if (collected.length > 0) {
      return collected.map(({ file, relativePath }) => ({
        id: crypto.randomUUID(),
        kind: 'file',
        name: file.name,
        relativePath,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        file,
      }));
    }
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return filesToStagedItems(dataTransfer.files);
  }

  return [];
}

export function triggerFileDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
