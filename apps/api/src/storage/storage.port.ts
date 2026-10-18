export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}
