#!/usr/bin/env node
import { existsSync } from 'node:fs'

import {
  CONTAINER_NAME,
  DATABASE_KEYS,
  REMOTE_SNAPSHOT_PATH,
  SERVER_ENV_PATH,
  containerRunning,
  displayPath,
  fail,
  hasDocker,
  log,
  maskUrl,
  parseEnv,
  patchEnvText,
  readEnvText,
  run,
  warn,
  writeEnvText,
} from './lib/server-env.mjs'

if (!existsSync(REMOTE_SNAPSHOT_PATH)) {
  fail(
    `缺少远端快照 ${displayPath(REMOTE_SNAPSHOT_PATH)}，无法恢复；` +
      `请手动把 ${displayPath(SERVER_ENV_PATH)} 的 DATABASE_URL/DIRECT_URL 改回远端值`,
  )
}

const snapshot = parseEnv(readEnvText(REMOTE_SNAPSHOT_PATH))
const patch = {}
for (const key of DATABASE_KEYS) {
  const value = snapshot.get(key)
  if (!value) fail(`远端快照 ${displayPath(REMOTE_SNAPSHOT_PATH)} 缺少 ${key}`)
  patch[key] = value
}

const envText = readEnvText(SERVER_ENV_PATH)
const nextText = patchEnvText(envText, patch)
if (nextText !== envText) {
  writeEnvText(SERVER_ENV_PATH, nextText)
  log(`已恢复 ${displayPath(SERVER_ENV_PATH)} → ${maskUrl(patch.DATABASE_URL)}`)
} else {
  log(`${displayPath(SERVER_ENV_PATH)} 已是远端配置，无需改写`)
}

if (!hasDocker()) {
  warn('docker 不可用，跳过停止容器；请手动确认容器状态')
} else {
  const running = containerRunning()
  if (running === null) {
    log(`容器不存在，跳过: ${CONTAINER_NAME}`)
  } else if (running) {
    run('docker', ['stop', CONTAINER_NAME])
    log(`已停止容器（保留容器与数据）: ${CONTAINER_NAME}`)
  } else {
    log(`容器已处于停止状态: ${CONTAINER_NAME}`)
  }
}

log('注意: 正在运行的 API 需重启才会读取新的 .env')
