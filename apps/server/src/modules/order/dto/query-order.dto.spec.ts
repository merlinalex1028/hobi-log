import { plainToInstance } from 'class-transformer'
import { QueryOrderDto } from './query-order.dto'

describe('QueryOrderDto', () => {
  it('delayed 缺省为 undefined', () => {
    expect(plainToInstance(QueryOrderDto, {}).delayed).toBeUndefined()
  })

  it("delayed='true' → true", () => {
    expect(plainToInstance(QueryOrderDto, { delayed: 'true' }).delayed).toBe(true)
  })

  it("delayed='false' → false（不能被 Boolean 构造器转成 true）", () => {
    expect(plainToInstance(QueryOrderDto, { delayed: 'false' }).delayed).toBe(false)
  })

  it('数字 0 / 1 严格比较为 false（查询串实际只会是字符串）', () => {
    expect(plainToInstance(QueryOrderDto, { delayed: 0 }).delayed).toBe(false)
    expect(plainToInstance(QueryOrderDto, { delayed: 1 }).delayed).toBe(false)
  })

  it('tab 缺省为 ALL', () => {
    expect(plainToInstance(QueryOrderDto, {}).tab).toBe('ALL')
  })
})
