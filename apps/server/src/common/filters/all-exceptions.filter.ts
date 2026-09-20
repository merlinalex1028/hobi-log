import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { mapException } from './exception.mapper'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const body = mapException(exception)

    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      )
    }

    response.status(body.statusCode).json(body)
  }
}
