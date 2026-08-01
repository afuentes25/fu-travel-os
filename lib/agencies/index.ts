export type PersistedAgency = Readonly<{
  id: string;
  slug: string;
  name: string;
}>;

/** Minimal port for resolving a persisted agency without client credentials. */
export interface PersistedAgencyRepositoryClient {
  findBySlug(slug: string): Promise<PersistedAgency | null>;
}

export function createPersistedAgencyResolver(
  client: PersistedAgencyRepositoryClient,
) {
  return {
    async findBySlug(slug: string) {
      if (!slug.trim()) return null;
      return client.findBySlug(slug);
    },
  };
}
