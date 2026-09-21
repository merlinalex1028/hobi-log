import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../database/prisma.service'

export interface DimensionRow {
  key: string | null
  currency: string
  amount: Prisma.Decimal | number | string | null
  orderCount: bigint | number
  itemCount: bigint | number
}

export type DimensionField = 'category' | 'platform' | 'manufacturer' | 'ip'

@Injectable()
export class StatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private groupExpression(field: DimensionField): Prisma.Sql {
    switch (field) {
      case 'category':
        return Prisma.sql`p.category`
      case 'manufacturer':
        return Prisma.sql`COALESCE(p.manufacturer, '未填写厂商')`
      case 'ip':
        return Prisma.sql`COALESCE(p."ipName", '未填写 IP')`
      case 'platform':
        return Prisma.sql`COALESCE(pf.name, '未填写平台')`
    }
  }

  private joinFor(field: DimensionField): Prisma.Sql {
    return field === 'platform'
      ? Prisma.sql`LEFT JOIN platforms pf ON pf.id = o."platformId"`
      : Prisma.empty
  }

  async dimension(
    userId: string,
    field: DimensionField,
    from: Date,
    to: Date,
    currency?: string,
  ): Promise<DimensionRow[]> {
    const group = this.groupExpression(field)
    const platformJoin = this.joinFor(field)

    return this.prisma.$queryRaw<DimensionRow[]>`
      WITH paid AS (
        SELECT pay."orderId" AS "orderId", pay.currency AS currency, SUM(pay.amount) AS amount
        FROM payments pay
        WHERE pay.status = 'PAID'
          AND pay.type <> 'REFUND'
          AND pay."paidAt" >= ${from}
          AND pay."paidAt" < ${to}
          ${currency ? Prisma.sql`AND pay.currency = ${currency}` : Prisma.empty}
        GROUP BY 1, 2
      )
      SELECT
        ${group} AS key,
        paid.currency AS currency,
        SUM(paid.amount * oi.subtotal / NULLIF(o."totalAmount", 0)) AS amount,
        COUNT(DISTINCT o.id) AS "orderCount",
        COALESCE(SUM(oi.quantity), 0) AS "itemCount"
      FROM paid
      JOIN orders o ON o.id = paid."orderId"
      JOIN order_items oi ON oi."orderId" = o.id
      JOIN products p ON p.id = oi."productId"
      ${platformJoin}
      WHERE o."userId" = ${userId}::uuid
        AND o.archived = false
      GROUP BY 1, 2
      ORDER BY amount DESC NULLS LAST
    `
  }

  async countCollectionItems(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COALESCE(SUM(oi.quantity), 0) AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE o."userId" = ${userId}::uuid
        AND o.archived = false
        AND o.status <> 'CANCELLED'
        AND EXISTS (
          SELECT 1 FROM shipments s
          WHERE s."orderId" = o.id AND s.status = 'DELIVERED'
        )
    `
    return Number(rows[0]?.count ?? 0)
  }
}
