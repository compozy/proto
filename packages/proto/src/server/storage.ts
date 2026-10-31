import type { ReviewStore } from "../store/types.ts";
import type { Registry } from "../model/registry.ts";
export type Credential = {
  id: string;
  ownerId: string;
  name: string;
  scopes: ["comment"];
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
/** The server owns auth; adapters persist only hashed credentials and review data. */
export interface ReviewStorage {
  store: ReviewStore;
  configure(registry: () => Promise<Registry>, commit: () => Promise<string | null>): void;
  checkSchema(): Promise<void>;
  credentials: {
    create(value: Credential): Promise<void>;
    find(hash: string): Promise<Credential | null>;
    list(ownerId: string): Promise<Credential[]>;
    revoke(ownerId: string, id: string): Promise<void>;
    used(id: string): Promise<void>;
  };
}
