import { createHash } from 'node:crypto'
import { build } from 'esbuild'

/** Reviewed synthetic numbers only: no browser capture, private file or remote input. */
export async function evaluateMeasurement() {
  const inputs = [
    {
      id: 'small-wait-dominated',
      bytes: 65536,
      response: 180,
      body: 20,
      cleanup: 1000,
      rate: 1,
      buffer: 0.4,
      age: 100,
    },
    {
      id: 'large-vbr',
      bytes: 8000000,
      response: 40,
      body: 2500,
      cleanup: 100,
      rate: 2,
      buffer: 6,
      age: 2000,
    },
    {
      id: 'wall-clock-forward',
      bytes: 1000000,
      response: 50,
      body: 400,
      cleanup: 0,
      rate: 1,
      buffer: 2,
      age: 500,
      wallJump: 60000,
    },
    {
      id: 'wall-clock-backward',
      bytes: 1000000,
      response: 50,
      body: 400,
      cleanup: 0,
      rate: 1,
      buffer: 2,
      age: 500,
      wallJump: -60000,
    },
    {
      id: 'expired-playback',
      bytes: 1000000,
      response: 50,
      body: 800,
      cleanup: 0,
      rate: 2,
      buffer: 3,
      age: 2001,
    },
    {
      id: 'callback-delay',
      bytes: 1000000,
      response: 50,
      body: 400,
      cleanup: 700,
      rate: 2,
      buffer: 2,
      age: 1900,
    },
  ]
  const compiled = await build({
    stdin: {
      contents:
        "export {measuredTiming} from './src-v2/domain/measurement-time.ts'; export {predictCompletionMs} from './src-v2/domain/route-completion.ts'",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  })
  const policy = (await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.contents).toString('base64')}`
  )) as {
    measuredTiming(a: number, b: number, c: number): { elapsedMs: number }
    predictCompletionMs(a: number, b: number, c: number): number | null
  }
  const scenarios = inputs.map((input) => {
    const end = input.response + input.body
    const timing = policy.measuredTiming(0, input.response, end)
    const independentRate = (input.bytes * 8) / input.body / 1000
    const predictedMs = policy.predictCompletionMs(input.bytes, independentRate, input.response)
    if (predictedMs === null || Math.abs(predictedMs - end) > 1e-8 || timing.elapsedMs !== end)
      throw Error('Independent formula mismatch')
    return {
      ...input,
      timingBasis: 'probe-reader',
      actualDeliveryMs: end,
      measuredMs: timing.elapsedMs,
      priorCleanupElapsedMs: Math.max(1, end + input.cleanup + (input.wallJump ?? 0)),
      predictedMs,
      oldBudgetMs: (input.buffer / input.rate) * 1000,
      remainingBudgetMs:
        input.age <= 2000 ? Math.max(0, (input.buffer / input.rate) * 1000 - input.age) : null,
      absoluteErrorMs: Math.abs(predictedMs - end),
      underestimationMs: Math.max(0, end - predictedMs),
      observationStatus: 'completed',
      representation: { bandwidth: 4_000_000, declaredFps: 60000 / 1001 },
      interpretation:
        'Fixed representation and held-out delivery; FPS does not multiply already encoded bitrate.',
    }
  })
  return {
    baselineRevision: '304c63196a2110943387848765cf5156a01af066',
    inputSha256: createHash('sha256').update(JSON.stringify(inputs)).digest('hex'),
    scope:
      'Measurement arithmetic only; synthetic supplied service is not calibrated CDN capacity, Auto, decode throughput or causal switching benefit. No recovery or probe execution is simulated.',
    scenarios,
  }
}
