#!/usr/bin/env node
import { existsSync } from 'node:fs'

import {
  CONTAINER_IMAGE,
  CONTAINER_NAME,
  CONTAINER_VOLUME,
  DATABASE_NAME,
  DATABASE_PASSWORD,
  HOST_PORT,
  LOCAL_DATABASE_URL,
  REMOTE_SNAPSHOT_PATH,
  SERVER_ENV_PATH,
  containerRunning,
  displayPath,
  fail,
  hasDocker,
  isLocalUrl,
  log,
  maskUrl,
  parseEnv,
  patchEnvText,
  readEnvText,
  run,
  waitForDatabase,
  writeEnvText,
} from './lib/server-env.mjs'

if (!hasDocker()) fail('docker 不可用，请先启动 Docker Desktop')

const envText = readEnvText(SERVER_ENV_PATH)
const currentDatabaseUrl = parseEnv(envText).get('DATABASE_URL')
if (!currentDatabaseUrl) fail(`${displayPath(SERVER_ENV_PATH)} 缺少 DATABASE_URL，无法判断当前指向`)

if (isLocalUrl(currentDatabaseUrl)) {
  if (!existsSync(REMOTE_SNAPSHOT_PATH)) {
    fail(
      `当前 ${displayPath(SERVER_ENV_PATH)} 已指向本地库（${maskUrl(currentDatabaseUrl)}），` +
        `但缺少远端快照 ${displayPath(REMOTE_SNAPSHOT_PATH)}；拒绝把本地配置存为远端快照。` +
        '请先把 DATABASE_URL/DIRECT_URL 手动恢复为远端值再重试',
    )
  }
  log(`当前已指向本地库，跳过快照（${displayPath(REMOTE_SNAPSHOT_PATH)} 保留不变）`)
} else if (existsSync(REMOTE_SNAPSHOT_PATH)) {
  log(`远端快照已存在，保留不覆盖: ${displayPath(REMOTE_SNAPSHOT_PATH)}`)
} else {
  writeEnvText(REMOTE_SNAPSHOT_PATH, envText)
  log(`已保存远端快照: ${displayPath(REMOTE_SNAPSHOT_PATH)}`)
}

const running = containerRunning()
if (running === null) {
  log(`容器不存在，创建: ${CONTAINER_NAME} (${CONTAINER_IMAGE})`)
  run('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER_NAME,
    '-e',
    `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
    '-e',
    `POSTGRES_DB=${DATABASE_NAME}`,
    '-p',
    `${HOST_PORT}:5432`,
    '-v',
    `${CONTAINER_VOLUME}:/var/lib/postgresql/data`,
    CONTAINER_IMAGE,
  ])
} else if (running) {
  log(`容器已在运行: ${CONTAINER_NAME}`)
} else {
  log(`启动容器: ${CONTAINER_NAME}`)
  run('docker', ['start', CONTAINER_NAME])
}

if (!(await waitForDatabase())) {
  fail(`等待数据库就绪超时（${CONTAINER_NAME} / ${DATABASE_NAME}），请检查 docker logs ${CONTAINER_NAME}`)
}
log(`数据库就绪: ${CONTAINER_NAME} / ${DATABASE_NAME}`)

const nextText = patchEnvText(readEnvText(SERVER_ENV_PATH), {
  DATABASE_URL: LOCAL_DATABASE_URL,
  DIRECT_URL: LOCAL_DATABASE_URL,
})
if (nextText !== readEnvText(SERVER_ENV_PATH)) {
  writeEnvText(SERVER_ENV_PATH, nextText)
  log(`已切换 ${displayPath(SERVER_ENV_PATH)} → ${maskUrl(LOCAL_DATABASE_URL)}`)
} else {
  log(`${displayPath(SERVER_ENV_PATH)} 已指向本地库，无需改写`)
}

log('后续命令（未自动执行）:')
log('  pnpm --filter @hobilog/server exec prisma migrate deploy')
log('  pnpm dev:server')
