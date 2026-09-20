import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { SupabaseService } from './supabase.service'
import { UserProfileService } from './user-profile.service'

@Global()
@Module({
  providers: [
    SupabaseService,
    UserProfileService,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
  exports: [SupabaseService, UserProfileService],
})
export class AuthModule {}
