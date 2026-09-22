import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { defer, delay, retryWhen, scan, type Observable } from 'rxjs'
import { mapException } from '../filters/exception.mapper'

interface HttpRequestLike {
  method?: string
}

@Injectable()
export class DatabaseRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>()
    if (request.method !== 'GET' && request.method !== 'HEAD') return next.handle()

    return defer(() => next.handle()).pipe(
      retryWhen(errors =>
        errors.pipe(
          scan((attempt, error: unknown) => {
            if (attempt >= 1 || mapException(error).code !== 'DATABASE_UNAVAILABLE') throw error
            return attempt + 1
          }, 0),
          delay(100),
        ),
      ),
    )
  }
}
