import { DISPLAY_STATUSES } from '@hobilog/shared'
import { describe, expect, it } from 'vitest'
import { STATUS_CONFIG, TONE_BY_COLOR } from './status'

describe('STATUS_CONFIG', () => {
  it('覆盖全部 DisplayStatus', () => {
    for (const status of DISPLAY_STATUSES) {
      expect(STATUS_CONFIG[status], `缺少配置：${status}`).toBeTruthy()
    }
  })

  it('每个状态都有中文 label 与 color', () => {
    for (const [status, config] of Object.entries(STATUS_CONFIG)) {
      expect(config.label, status).not.toBe('')
      expect(config.color, status).not.toBe('')
      expect(config.icon, status).not.toBe('')
    }
  })

  it('每个 color 都能映射到 el-tag 色调', () => {
    for (const [status, config] of Object.entries(STATUS_CONFIG)) {
      expect(TONE_BY_COLOR[config.color], status).toBeTruthy()
    }
  })
})
