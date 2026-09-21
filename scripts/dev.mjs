#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { REPO_ROOT } from './lib/server-env.mjs'

const PREFIX = '[dev]'
const ENV_PATH = 'apps/server/.env'
const NAME_WIDTH = 6
const SHUTDOWN_GRACE_MS = 2_000
const LINE_BREAK = /(\r\n|\n|\r)/

const COLORS = process.stdout.isTTY === true && !process.env.NO_COLOR

const services = [
  {
    name: 'server',
    color: '\u001b[36m',
    args: ['--filter', '@hobilog/server', 'run', 'start:dev', '--preserveWatchOutput'],
    url: 'http://localhost:3000',
    child: null,
    exited: false,
  },
  {
    name: 'web',
    color: '\u001b[35m',
    args: ['--filter', '@hobilog/web', 'run', 'dev'],
    url: 'http://localhost:5173',
    child: null,
    exited: false,
  },
]

function log(message) {
  process.stdout.write(`${PREFIX} ${message}\n`)
}

function fail(message) {
  process.stderr.write(`${PREFIX} error: ${message}\n`)
  process.exit(1)
}

function prefixStream(stream, service, sink) {
  const label = COLORS
    ? `${service.color}${service.name.padEnd(NAME_WIDTH)}\u001b[0m \u001b[2m|\u001b[0m`
    : `${service.name.padEnd(NAME_WIDTH)} |`
  let buffer = ''

  const flush = (line) => {
    sink.write(`${label} ${line}\n`)
  }

  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer += chunk
    let match = buffer.match(LINE_BREAK)
    while (match) {
      flush(buffer.slice(0, match.index))
      buffer = buffer.slice(match.index + match[0].length)
      match = buffer.match(LINE_BREAK)
    }
  })
  stream.on('end', () => {
    if (buffer.length > 0) flush(buffer)
    buffer = ''
  })
}

function childEnv() {
  const env = { ...process.env }
  if (COLORS && env.FORCE_COLOR === undefined) env.FORCE_COLOR = '1'
  return env
}

let shuttingDown = false
let killTimer = null

function signalService(service, signal) {
  const child = service.child
  if (!child || service.exited || child.pid === undefined) return
  if (process.platform === 'win32') {
    child.kill(signal)
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      return
    }
  }
}

function maybeFinish() {
  if (!services.every((service) => service.exited)) return
  if (killTimer) clearTimeout(killTimer)
  process.exitCode ??= 0
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  process.exitCode = code
  for (const service of services) signalService(service, 'SIGTERM')
  killTimer = setTimeout(() => {
    for (const service of services) signalService(service, 'SIGKILL')
  }, SHUTDOWN_GRACE_MS)
  services.forEach((service) => {
    service.child?.once('close', maybeFinish)
  })
  maybeFinish()
}

function startService(service) {
  const child = spawn('pnpm', service.args, {
    cwd: REPO_ROOT,
    env: childEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  service.child = child
  prefixStream(child.stdout, service, process.stdout)
  prefixStream(child.stderr, service, process.stderr)

  child.on('error', (error) => {
    service.exited = true
    process.stderr.write(`${PREFIX} error: ${service.name} 启动失败: ${error.message}\n`)
    shutdown(1)
    maybeFinish()
  })

  child.on('exit', (code, signal) => {
    service.exited = true
    if (shuttingDown) {
      maybeFinish()
      return
    }
    log(`${service.name} 已退出（${signal ?? `code ${code}`}），停止其余进程`)
    shutdown(code ?? 1)
  })
}

if (!existsSync(resolve(REPO_ROOT, ENV_PATH))) {
  fail(`缺少 ${ENV_PATH}，先执行: cp ${ENV_PATH}.example ${ENV_PATH}`)
}

log(`并行启动: ${services.map((s) => `${s.name} → ${s.url}`).join('  ')}`)
log('按 Ctrl+C 停止全部进程')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!shuttingDown) log(`收到 ${signal}，正在停止全部进程`)
    shutdown(0)
  })
}

for (const service of services) startService(service)
