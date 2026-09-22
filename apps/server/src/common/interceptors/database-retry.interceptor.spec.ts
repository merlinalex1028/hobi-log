import { ExecutionContext } from '@nestjs/common'
import { lastValueFrom, of, throwError } from 'rxjs'
import { DatabaseRetryInterceptor } from './database-retry.interceptor'

function context(method: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
  } as ExecutionContext
}

describe('DatabaseRetryInterceptor', () => {
  it('GET 遇到数据库连接异常时只重试一次', async () => {
    const next = {
      handle: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('Connection terminated due to connection timeout')))
        .mockReturnValueOnce(of('ok')),
    }

    await expect(lastValueFrom(new DatabaseRetryInterceptor().intercept(context('GET'), next))).resolves.toBe('ok')
    expect(next.handle).toHaveBeenCalledTimes(2)
  })

  it('POST 不重试，避免写请求重复提交', async () => {
    const error = new Error('Connection terminated due to connection timeout')
    const next = { handle: vi.fn().mockReturnValue(throwError(() => error)) }

    await expect(lastValueFrom(new DatabaseRetryInterceptor().intercept(context('POST'), next))).rejects.toBe(error)
    expect(next.handle).toHaveBeenCalledTimes(1)
  })
})
