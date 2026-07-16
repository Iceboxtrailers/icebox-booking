export interface Storage {
  save(path: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  read(path: string): Promise<Buffer>;
}
