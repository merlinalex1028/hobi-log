export const queryKeys = {
  orders: {
    all: ['orders'] as const,
    list: (params: Record<string, unknown>) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: (params: Record<string, unknown>) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  platforms: {
    all: ['platforms'] as const,
    list: (params: Record<string, unknown>) => ['platforms', 'list', params] as const,
  },
  stores: {
    all: ['stores'] as const,
    list: (params: Record<string, unknown>) => ['stores', 'list', params] as const,
  },
  dashboard: ['statistics', 'dashboard'] as const,
  statistics: {
    monthly: (params: Record<string, unknown>) => ['statistics', 'monthly', params] as const,
    future: (params: Record<string, unknown>) => ['statistics', 'future', params] as const,
    dimension: (dimension: string, params: Record<string, unknown>) =>
      ['statistics', dimension, params] as const,
  },
  calendar: (params: Record<string, unknown>) => ['calendar', 'events', params] as const,
  collection: {
    list: (params: Record<string, unknown>) => ['collection', 'list', params] as const,
    stats: ['collection', 'stats'] as const,
  },
  notifications: ['notifications', 'todos'] as const,
}

export const ORDER_MUTATION_INVALIDATIONS = [
  ['orders'],
  ['statistics'],
  ['calendar'],
  ['notifications'],
] as const
