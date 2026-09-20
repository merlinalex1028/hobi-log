import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { BusinessException } from '../../common/exceptions/business.exception'
import type { AuthUser } from './auth.types'

export function extractBearerToken(header?: string): string | null {
  if (!header) return null
  const match = /^bearer\s+(\S+)\s*$/i.exec(header)
  return match?.[1] ?? null
}

@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient
  private authClient: SupabaseClient

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL') ?? 'http://localhost'
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_test'
    const secretKey = this.config.get<string>('SUPABASE_SECRET_KEY') ?? 'sb_secret_test'
    this.admin = createClient(url, secretKey, { auth: { persistSession: false } })
    this.authClient = createClient(url, publishableKey, { auth: { persistSession: false } })
  }

  async getUserFromToken(token: string): Promise<AuthUser> {
    const { data, error } = await this.authClient.auth.getUser(token)
    if (error || !data.user) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '令牌无效或已过期')
    }
    return data.user.email ? { id: data.user.id, email: data.user.email } : { id: data.user.id }
  }
}
