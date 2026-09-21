import { useQueryClient } from '@tanstack/vue-query'
import { MUTATION_INVALIDATION_KEYS, type MutationDomain } from '@/api/query-keys'

export function useInvalidate(): (domain: MutationDomain) => Promise<void> {
  const queryClient = useQueryClient()
  return domain =>
    Promise.all(
      MUTATION_INVALIDATION_KEYS[domain].map(key => queryClient.invalidateQueries({ queryKey: key })),
    ).then(() => undefined)
}
