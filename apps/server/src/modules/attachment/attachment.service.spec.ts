import { AttachmentService } from './attachment.service'
import type { CreateAttachmentDto } from './dto/create-attachment.dto'
import type { UploadUrlDto } from './dto/upload-url.dto'

interface AttachmentPrismaMock {
  attachment: {
    create: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

interface BucketApiMock {
  createSignedUploadUrl: ReturnType<typeof vi.fn>
  createSignedUrl: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

interface BucketFromMock {
  from: ReturnType<typeof vi.fn>
}

interface SupabaseMock {
  admin: { storage: BucketFromMock }
  bucket: BucketApiMock
}

interface OrderServiceMock {
  assertOwned: ReturnType<typeof vi.fn>
}

interface ProductServiceMock {
  getOwnedProductIds: ReturnType<typeof vi.fn>
}

const prismaMock = (): AttachmentPrismaMock => ({
  attachment: {
    create: vi.fn().mockResolvedValue({
      id: 'a1',
      type: 'PAYMENT_PROOF',
      fileName: 'invoice.png',
      storagePath: 'attachments/u1/o1/x.png',
      mimeType: 'image/png',
      fileSize: BigInt(2048),
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
    }),
    findFirst: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ id: 'a1' }),
  },
})

const supabaseMock = (): SupabaseMock => {
  const bucket: BucketApiMock = {
    createSignedUploadUrl: vi.fn().mockResolvedValue({
      data: { token: 'token-1', signedUrl: 'https://signed', path: 'u1/o1/x.png' },
      error: null,
    }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://download' }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return { admin: { storage: { from: vi.fn().mockReturnValue(bucket) } }, bucket }
}

const orderServiceMock = (): OrderServiceMock => ({
  assertOwned: vi.fn().mockResolvedValue(undefined),
})

const productServiceMock = (): ProductServiceMock => ({
  getOwnedProductIds: vi.fn().mockResolvedValue(['p1']),
})

const build = (
  prisma: AttachmentPrismaMock,
  supabase = supabaseMock(),
  orderService = orderServiceMock(),
  productService = productServiceMock(),
) =>
  new AttachmentService(
    prisma as never,
    { admin: supabase.admin } as never,
    orderService as never,
    productService as never,
  )

const uploadDto = (patch: Partial<UploadUrlDto> = {}): UploadUrlDto => ({
  bucket: 'attachments',
  targetType: 'ORDER',
  targetId: 'o1',
  fileName: 'invoice final.png',
  mimeType: 'image/png',
  fileSize: 2048,
  ...patch,
})

const createDto = (patch: Partial<CreateAttachmentDto> = {}): CreateAttachmentDto => ({
  bucket: 'attachments',
  storagePath: 'u1/o1/x.png',
  type: 'PAYMENT_PROOF',
  fileName: 'x.png',
  ...patch,
})

describe('AttachmentService.createUploadUrl', () => {
  it('路径前缀为 userId/targetId，文件名被清洗并带随机 UUID', async () => {
    const prisma = prismaMock()
    const supabase = supabaseMock()
    const result = await build(prisma, supabase).createUploadUrl('u1', uploadDto())

    expect(result.path.startsWith('u1/o1/')).toBe(true)
    expect(result.path).toContain('-invoice_final.png')
    expect(result).toMatchObject({ bucket: 'attachments', token: 'token-1', signedUrl: 'https://signed' })
    expect(supabase.admin.storage.from).toHaveBeenCalledWith('attachments')
    expect(supabase.bucket.createSignedUploadUrl).toHaveBeenCalledWith(result.path)
  })

  it('订单归属校验由 OrderService 完成，不通过则透传 404', async () => {
    const prisma = prismaMock()
    const orderService = orderServiceMock()
    orderService.assertOwned.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404, response: { code: 'ORDER_NOT_FOUND' } }),
    )
    const supabase = supabaseMock()

    await expect(
      build(prisma, supabase, orderService).createUploadUrl('u1', uploadDto({ targetId: 'o-other' })),
    ).rejects.toMatchObject({ status: 404, response: { code: 'ORDER_NOT_FOUND' } })
    expect(supabase.bucket.createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('PRODUCT 目标不属于当前用户 → 404 PRODUCT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    const productService = productServiceMock()
    productService.getOwnedProductIds.mockResolvedValue([])

    await expect(
      build(prisma, supabaseMock(), orderServiceMock(), productService).createUploadUrl(
        'u1',
        uploadDto({ targetType: 'PRODUCT', targetId: 'p-other' }),
      ),
    ).rejects.toMatchObject({ status: 404, response: { code: 'PRODUCT_NOT_FOUND' } })
  })

  it('Storage 报错 → 502 STORAGE_UNAVAILABLE', async () => {
    const prisma = prismaMock()
    const supabase = supabaseMock()
    supabase.bucket.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })

    await expect(build(prisma, supabase).createUploadUrl('u1', uploadDto())).rejects.toMatchObject({
      status: 502,
      response: { code: 'STORAGE_UNAVAILABLE' },
    })
  })
})

describe('AttachmentService.create', () => {
  it('storagePath 必须以 userId 开头', async () => {
    const prisma = prismaMock()
    await expect(
      build(prisma).create('u1', createDto({ storagePath: 'u-not-mine/o1/x.png' })),
    ).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_STORAGE_PATH' } })
    expect(prisma.attachment.create).not.toHaveBeenCalled()
  })

  it('fileSize 出口为 string，storagePath 前缀 bucket', async () => {
    const prisma = prismaMock()
    const vo = await build(prisma).create(
      'u1',
      createDto({ mimeType: 'image/png', fileSize: 2048, orderId: 'o1' }),
    )

    expect(vo.fileSize).toBe('2048')
    expect(vo).toMatchObject({
      id: 'a1',
      type: 'PAYMENT_PROOF',
      storagePath: 'attachments/u1/o1/x.png',
      createdAt: '2026-09-18T00:00:00.000Z',
    })
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        orderId: 'o1',
        productId: null,
        type: 'PAYMENT_PROOF',
        fileName: 'x.png',
        storagePath: 'attachments/u1/o1/x.png',
        mimeType: 'image/png',
        fileSize: BigInt(2048),
      },
    })
  })

  it('未传 fileSize 时写入 null，不传 orderId / productId 时为 null', async () => {
    const prisma = prismaMock()
    prisma.attachment.create.mockResolvedValue({
      id: 'a2',
      type: 'OTHER',
      fileName: 'x.png',
      storagePath: 'product-images/u1/p1/x.png',
      mimeType: null,
      fileSize: null,
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
    })
    const vo = await build(prisma).create('u1', createDto({ bucket: 'product-images' }))

    expect(vo.fileSize).toBeNull()
    expect(vo.mimeType).toBeNull()
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: null,
        productId: null,
        mimeType: null,
        fileSize: null,
        storagePath: 'product-images/u1/o1/x.png',
      }),
    })
  })

  it('productId 不属于当前用户 → 404 PRODUCT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    const productService = productServiceMock()
    productService.getOwnedProductIds.mockResolvedValue([])

    await expect(
      build(prisma, supabaseMock(), orderServiceMock(), productService).create(
        'u1',
        createDto({ productId: 'p-other' }),
      ),
    ).rejects.toMatchObject({ status: 404, response: { code: 'PRODUCT_NOT_FOUND' } })
  })
})

describe('AttachmentService.remove', () => {
  it('同时删除 Storage 对象与元数据', async () => {
    const prisma = prismaMock()
    const supabase = supabaseMock()
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      storagePath: 'attachments/u1/o1/x.png',
    })

    const result = await build(prisma, supabase).remove('u1', 'a1')

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u1' } })
    expect(supabase.admin.storage.from).toHaveBeenCalledWith('attachments')
    expect(supabase.bucket.remove).toHaveBeenCalledWith(['u1/o1/x.png'])
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    expect(result).toEqual({ id: 'a1' })
  })

  it('bucket 非法时跳过 Storage 删除，仍删除元数据', async () => {
    const prisma = prismaMock()
    const supabase = supabaseMock()
    prisma.attachment.findFirst.mockResolvedValue({ id: 'a1', storagePath: 'other/u1/x.png' })

    await build(prisma, supabase).remove('u1', 'a1')

    expect(supabase.admin.storage.from).not.toHaveBeenCalled()
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
  })

  it('不存在 → 404 ATTACHMENT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    await expect(build(prisma).remove('u1', 'a1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'ATTACHMENT_NOT_FOUND' },
    })
  })
})

describe('AttachmentService.createDownloadUrl', () => {
  it('返回签名 URL 并透传 expiresIn', async () => {
    const prisma = prismaMock()
    const supabase = supabaseMock()
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      storagePath: 'product-images/u1/p1/x.png',
    })

    const result = await build(prisma, supabase).createDownloadUrl('u1', 'a1', 600)

    expect(supabase.admin.storage.from).toHaveBeenCalledWith('product-images')
    expect(supabase.bucket.createSignedUrl).toHaveBeenCalledWith('u1/p1/x.png', 600)
    expect(result).toEqual({ signedUrl: 'https://download' })
  })

  it('不存在 → 404 ATTACHMENT_NOT_FOUND', async () => {
    const prisma = prismaMock()
    await expect(build(prisma).createDownloadUrl('u1', 'a1', 3600)).rejects.toMatchObject({
      status: 404,
      response: { code: 'ATTACHMENT_NOT_FOUND' },
    })
  })
})
