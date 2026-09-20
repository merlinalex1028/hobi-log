import { PrismaService } from './prisma.service'

const config = { get: () => 'postgresql://postgres:postgres@localhost:5432/hobilog_test' }

describe('PrismaService', () => {
  it('暴露 Prisma Model Delegate', () => {
    const service = new PrismaService(config as never)
    expect(typeof service.order.findMany).toBe('function')
    expect(typeof service.payment.findMany).toBe('function')
    expect(typeof service.releaseEvent.findMany).toBe('function')
    expect(typeof service.shipmentItem.findMany).toBe('function')
    expect(typeof service.$transaction).toBe('function')
    void service.$disconnect()
  })
})
