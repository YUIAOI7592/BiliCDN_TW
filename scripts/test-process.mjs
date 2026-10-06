import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'

// The deadline covers startup, test execution, reporter writes and leaked handles.
export function supervise(executable, args, { timeoutMs = 60_000, maxBytes = 32 * 1024 * 1024, cwd = process.cwd() } = {}) {
  return new Promise(resolve => {
    const started = performance.now(), stdout = [], stderr = []
    let bytes = 0, reason = null, error = null
    const child = spawn(executable, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const stop = why => { if (!reason) { reason = why; child.kill('SIGKILL') } }
    const timer = setTimeout(() => stop('timeout'), timeoutMs)
    const collect = destination => chunk => {
      const remaining = Math.max(0, maxBytes - bytes)
      if (remaining) destination.push(chunk.subarray(0, remaining))
      bytes += chunk.length
      if (bytes > maxBytes) stop('output-limit')
    }
    child.stdout.on('data', collect(stdout)); child.stderr.on('data', collect(stderr))
    child.on('error', value => { error = value.message })
    // close, not exit: both streams have drained and the owned process has exited.
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, reason, error, stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'), durationMs: performance.now() - started })
    })
  })
}
