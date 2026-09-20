export interface AuthUser {
  id: string
  email?: string
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>
  user?: AuthUser
}
