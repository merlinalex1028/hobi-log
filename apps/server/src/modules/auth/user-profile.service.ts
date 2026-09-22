import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import type { AuthUser } from './auth.types'

@Injectable()
export class UserProfileService {
  private readonly pendingProfiles = new Map<string, Promise<{ id: string }>>()

  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(user: AuthUser): Promise<{ id: string }> {
    const pending = this.pendingProfiles.get(user.id)
    if (pending) return pending

    const promise = this.ensureProfileInDatabase(user).finally(() => {
      this.pendingProfiles.delete(user.id)
    })
    this.pendingProfiles.set(user.id, promise)
    return promise
  }

  private async ensureProfileInDatabase(user: AuthUser): Promise<{ id: string }> {
    const existing = await this.prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { id: true },
    })
    if (existing) return existing

    try {
      return await this.prisma.userProfile.create({ data: { id: user.id }, select: { id: true } })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'P2002') {
        const created = await this.prisma.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        })
        if (created) return created
      }
      throw error
    }
  }
}
