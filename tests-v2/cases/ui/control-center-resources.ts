import { createControlReadModel } from '../../../src-v2/ui/control-read-model.ts'
import { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../support/runtime-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'
import { ControlCenter } from '../../../src-v2/ui/control-center.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { representationId } from '../../../src-v2/domain/model.ts'

export function setOverviewCapacity(
  f: ReturnType<typeof ui>,
  safeMbps: number | null,
  bandwidth: number | null,
  playbackRate = 1,
) {
  const representation = representationId('capacity-display')
  f.session.setRepresentation(representation)
  f.setVideo({ ...f.video(), playbackRate })
  f.deps.monitor.tick()
  const before = f.routes.snapshot()
  f.routes.snapshot = () => ({
    ...before,
    attribution: 'confirmed',
    representation: {
      kind: 'video',
      height: 1080,
      codec: 'avc',
      bandwidth: bandwidth ?? 0,
      routeCount: 1,
    },
    currentCapacity: {
      capacityConfidence: safeMbps !== null ? 'sufficient' : 'missing',
      freshSpeedCount: safeMbps !== null ? 2 : 0,
      newestSpeedAt: safeMbps !== null ? f.clock.now() : null,
      safePayloadMbps: null,
      estimatedCompletionMs: null,
      predictionReason: 'unknown-size',
      generation: f.session.get().generation,
      epoch: f.session.get().epoch,
      representation,
      decisionId: 'v224-capacity' as NonNullable<typeof before.activePlan>['id'],
      host: TRUSTED_CATALOG[0],
      routeType: 'catalog-generated',
      safeMbps,
      sampleStatus: safeMbps !== null ? 'available' : 'missing',
    },
    activePlan: {
      id: 'v224-capacity' as NonNullable<typeof before.activePlan>['id'],
      action: 'rewrite',
      reason: 'recent-success',
      routeType: 'catalog-generated',
      host: TRUSTED_CATALOG[0],
      ranking: [
        {
          host: TRUSTED_CATALOG[0],
          type: 'catalog-generated',
          state: 'usable',
          eligible: true,
          reasons: [],
          safeMbps,
          ratio: null,
          ttfbMs: 30,
        },
      ],
    },
  })
}

class QueuedSettingsStorage extends FakeStorage {
  held = true
  tasks: (() => Promise<void>)[] = []
  override async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    if (name !== 'settings' || !this.held) return await task()
    return await new Promise<T>((resolve, reject) =>
      this.tasks.push(async () => {
        try {
          resolve(await task())
        } catch (error) {
          reject(error)
        }
      }),
    )
  }
  async drain(): Promise<void> {
    while (this.tasks.length) await this.tasks.shift()!()
    await Promise.resolve()
  }
}

// Event-path contract model, not a browser or evidence of real isTrusted/default actions.
export class UiEvent {
  defaultPrevented = false
  stopped = false
  eventPhase = 0
  target: Element
  currentTarget: Element | null = null
  constructor(
    readonly type: string,
    target: Element,
    readonly key = '',
    readonly isTrusted = true,
  ) {
    this.target = target
  }
  preventDefault() {
    this.defaultPrevented = true
  }
  stopPropagation() {
    this.stopped = true
  }
}

type UiListener = (event: UiEvent) => void

export class Element {
  children: Element[] = []
  listeners = new Map<string, { callback: UiListener; capture: boolean }[]>()
  parent: Element | null = null
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  #textContent = ''
  readonly textWrites: string[] = []
  get textContent(): string {
    return this.#textContent
  }
  set textContent(value: string) {
    this.#textContent = value
    this.textWrites.push(value)
  }
  className = ''
  type = ''
  value = ''
  checked = false
  disabled = false
  id = ''
  shadow: Element | null = null
  attributes = new Map<string, string>()
  get isConnected(): boolean {
    return this.tag === 'document' || this.parent?.isConnected === true
  }
  constructor(readonly tag = 'div') {}
  append(...elements: Element[]) {
    for (const element of elements) {
      element.parent = this
      this.children.push(element)
    }
  }
  replaceChildren(...elements: Element[]) {
    for (const child of this.children) child.parent = null
    this.children = []
    this.append(...elements)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  attachShadow(_options: { mode: string }) {
    this.shadow = new Element('shadow')
    this.shadow.parent = this
    return this.shadow
  }
  addEventListener(type: string, callback: UiListener, capture = false) {
    const rows = this.listeners.get(type) ?? []
    if (!rows.some((row) => row.callback === callback && row.capture === capture))
      rows.push({ callback, capture })
    this.listeners.set(type, rows)
  }
  removeEventListener(type: string, callback: UiListener, capture = false) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (row) => row.callback !== callback || row.capture !== capture,
      ),
    )
  }
  emit(type: string, key = '', trusted = true): UiEvent {
    const event = new UiEvent(type, this, key, trusted),
      path: Element[] = []
    for (let node: Element | null = this; node; node = node.parent) path.push(node)
    const shadowIndex = path.findIndex((node) => node.tag === 'shadow')
    const invoke = (node: Element, capture: boolean) => {
      event.currentTarget = node
      event.eventPhase = node === this ? 2 : capture ? 1 : 3
      event.target =
        shadowIndex >= 0 && path.indexOf(node) > shadowIndex ? path[shadowIndex + 1]! : this
      for (const row of [...(node.listeners.get(type) ?? [])]) {
        if (row.capture === capture && node.listeners.get(type)?.includes(row)) row.callback(event)
      }
    }
    for (const node of [...path].reverse()) {
      invoke(node, true)
      if (event.stopped) break
    }
    if (!event.stopped)
      for (const node of path) {
        invoke(node, false)
        if (event.stopped) break
      }
    event.eventPhase = 0
    event.currentTarget = null
    return event
  }
  focusCount = 0
  click() {
    this.emit('click', '', false)
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this)
    this.parent = null
  }
  focus(_options?: unknown) {
    this.focusCount++
  }
  flatten(): Element[] {
    return [
      this,
      ...this.children.flatMap((child) => child.flatten()),
      ...(this.shadow?.flatten() ?? []),
    ]
  }
}

export async function flushCommands(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

export function readSummary(f: ReturnType<typeof ui>): Element {
  if (!f.doc.flatten().some((e) => e.className === 'summary'))
    f.button('查看詳細狀態').emit('click')
  return f.doc.flatten().find((e) => e.className === 'summary')!
}

export function ui(t: TestContext) {
  const storage = new QueuedSettingsStorage()
  storage.values.set('bilicdn.v2.settings', { schema: 2, considerNativeSources: true })
  const f = fixture(t, storage),
    doc = new Element('document')
  f.scope.defineGlobal('GM_info', {
    configurable: true,
    value: { script: { version: 'contract' } },
  })
  const body = new Element('body'),
    video = new Element('video')
  doc.append(body, video)
  f.scope.defineGlobal('HTMLElement', { configurable: true, value: Element })
  f.scope.defineGlobal('document', {
    configurable: true,
    value: {
      documentElement: doc,
      body,
      activeElement: null,
      createElement: (tag: string) => new Element(tag),
      querySelector: () => video,
    },
  })
  f.scope.defineGlobal('Option', {
    configurable: true,
    value: class extends Element {
      constructor(label: string, value: string) {
        super('option')
        this.textContent = label
        this.value = value
      }
    },
  })
  f.scope.defineGlobal('queueMicrotask', {
    configurable: true,
    value: (task: () => void) => f.clock.microtask(task),
  })
  const center = new ControlCenter({
    model: createControlReadModel(f.deps),
    version: 'contract',
    commands: f.deps.commands,
    now: f.deps.now,
  })
  center.show()
  const button = (label: string) => {
    const found = doc.flatten().find((e) => e.tag === 'button' && e.textContent === label)
    assert.ok(found, label)
    return found
  }
  const toggle = (label: string) => {
    const row = doc
      .flatten()
      .find(
        (e) =>
          e.className === 'row' &&
          e.children.some((child) => child.tag === 'label' && child.textContent === label),
      )
    const input = row?.children.find((e) => e.tag === 'input')
    assert.ok(input, label)
    return input
  }
  f.scope.defer(() => center.close())
  return { ...f, storage, doc, center, button, toggle }
}
