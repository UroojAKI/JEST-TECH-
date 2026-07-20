export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(prefix: string): Promise<void>;
}

export const CACHE_PROVIDER_TOKEN = 'CACHE_PROVIDER_TOKEN';
