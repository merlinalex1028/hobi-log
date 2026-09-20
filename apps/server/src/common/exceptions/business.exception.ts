import { HttpException, HttpStatus } from '@nestjs/common'

export interface ErrorBody {
  statusCode: number
  code: string
  message: string
}

export class BusinessException extends HttpException {
  constructor(statusCode: HttpStatus, code: string, message: string) {
    super({ statusCode, code, message } satisfies ErrorBody, statusCode)
  }
}
