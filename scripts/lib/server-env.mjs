import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SERVER_ENV_PATH = resolve(REPO_ROOT, 'apps/server/.env')
export const REMOTE_SNAPSHOT_PATH = resolve(REPO_ROOT, 'apps/server/.env.remote')

export const CONTAINER_NAME = process.env.HOBILOG_PG_CONTAINER ?? 'hobilog-pg'
export const CONTAINER_IMAGE = process.env.HOBILOG_PG_IMAGE ?? 'postgres:17-alpine'
export const CONTAINER_VOLUME = process.env.HOBILOG_PG_VOLUME ?? 'hobilog-pg-data'
export const HOST_PORT = process.env.HOBILOG_PG_PORT ?? '5433'
export const DATABASE_NAME = process.env.HOBILOG_PG_DATABASE ?? 'hobilog_test'
export const DATABASE_USER = process.env.HOBILOG_PG_USER ?? 'postgres'
export const DATABASE_PASSWORD = process.env.HOBILOG_PG_PASSWORD ?? 'postgres'

export const DATABASE_KEYS = ['DATABASE_URL', 'DIRECT_URL']
export const LOCAL_DATABASE_URL = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@localhost:${HOST_PORT}/${DATABASE_NAME}`

export const READY_TIMEOUT_MS = 30_000
export const READY_POLL_MS = 500

export function log(message) {
  process.stdout.write(`[db-local] ${message}\n`)
}

export function warn(message) {
  process.stderr.write(`[db-local] warning: ${message}\n`)
}

export function fail(message) {
  process.stderr.write(`[db-local] error: ${message}\n`)
  process.exit(1)
}

export function run(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    if (allowFailure) return null
    const detail = error.stderr?.toString().trim() || error.message
    fail(`命令执行失败: ${command} ${args.join(' ')}\n${detail}`)
  }
}

export function hasDocker() {
  return run('docker', ['info'], { allowFailure: true }) !== null
}

export function readEnvText(path) {
  if (!existsSync(path)) fail(`找不到环境变量文件: ${path}`)
  return readFileSync(path, 'utf8')
}

export function parseEnv(text) {
  const values = new Map()
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (match) values.set(match[1], match[2].trim())
  }
  return values
}

export function patchEnvText(text, patch) {
  const pending = new Map(Object.entries(patch))
  const lines = text.split('\n').map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (!match || !pending.has(match[1])) return line
    const value = pending.get(match[1])
    pending.delete(match[1])
    return `${match[1]}=${value}`
  })
  for (const [key, value] of pending) lines.push(`${key}=${value}`)
  return lines.join('\n')
}

export function writeEnvText(path, text) {
  const mode = existsSync(path) ? statSync(path).mode : 0o600
  writeFileSync(path, text, { mode })
}

export function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function maskUrl(url) {
  return String(url).replace(/:\/\/([^:@/]+):[^@]+@/, '://$1:***@')
}

export function displayPath(path) {
  const rel = relative(REPO_ROOT, path)
  return rel.startsWith('..') ? path : rel
}

export function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

export function containerRunning() {
  const state = run('docker', ['inspect', '--format', '{{.State.Running}}', CONTAINER_NAME], { allowFailure: true })
  if (state === null) return null
  return state === 'true'
}

export function containerExists() {
  return containerRunning() !== null
}

export async function waitForDatabase() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = run(
      'docker',
      ['exec', CONTAINER_NAME, 'pg_isready', '-U', DATABASE_USER, '-d', DATABASE_NAME],
      { allowFailure: true },
    )
    if (result !== null && result.includes('accepting connections')) return true
    await sleep(READY_POLL_MS)
  }
  return false
}
