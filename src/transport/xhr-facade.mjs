// The public object has no native XHR brand. Native prototype calls cannot
// bypass managed open(), and page-owned properties never reach the backend.
export function createXhrFacade(ManagedXHR, NativeXHR) {
    const invoke = Reflect.apply
    const instances = new WeakMap()
    const add = NativeXHR.prototype.addEventListener
    const objectMembers = new Set(Reflect.ownKeys(Object.prototype))
    const descriptors = new Map()
    const intrinsicPrototype = Object.create(null)
    const nativeKeys = new Set()
    for (let p = NativeXHR.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const key of Reflect.ownKeys(p)) if (!objectMembers.has(key) && !nativeKeys.has(key)) {
            nativeKeys.add(key)
            Object.defineProperty(intrinsicPrototype, key, Object.getOwnPropertyDescriptor(p, key))
        }
    }
    // Managed super calls must not resolve through later page prototype edits.
    Object.setPrototypeOf(ManagedXHR.prototype, Object.freeze(intrinsicPrototype))
    for (let p = ManagedXHR.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const key of Reflect.ownKeys(p)) if (!objectMembers.has(key) && !descriptors.has(key)) {
            descriptors.set(key, Object.getOwnPropertyDescriptor(p, key))
        }
    }
    const eventTypes = ['readystatechange', 'loadstart', 'progress', 'abort', 'error', 'load', 'timeout', 'loadend']
    const eventFields = new Map()
    for (const ctor of [typeof ProgressEvent === 'function' ? ProgressEvent : null, Event]) {
        for (let p = ctor?.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
            for (const key of Reflect.ownKeys(p)) if (!eventFields.has(key)) eventFields.set(key, Object.getOwnPropertyDescriptor(p, key))
        }
    }
    const eventRead = (event, key) => {
        const d = eventFields.get(key)
        if (d?.get) {
            try { return invoke(d.get, event, []) }
            catch { return undefined } // Plain readystatechange Event is not a ProgressEvent.
        }
        // Native isTrusted is a nonconfigurable own accessor. Plain data fields
        // also support non-browser Event implementations without invoking getters.
        const own = Object.getOwnPropertyDescriptor(event, key)
        if (own && 'value' in own) return own.value
        if (key === 'isTrusted' && own?.get && own.configurable === false) return invoke(own.get, event, [])
        return d?.value
    }
    const eventCall = (event, key) => {
        const fn = eventFields.get(key)?.value
        return fn ? invoke(fn, event, []) : undefined
    }
    function events(backend, facade) {
        const rows = new Map(), handlers = new Map(), relays = new Map()
        const views = new WeakMap()
        const view = (event, publicOwned = false) => {
            if (views.has(event)) return views.get(event)
            let stopped = false, immediate = false, active = false, passive = false
            // A separate property space also prevents page-installed getters
            // from receiving the raw native event as their `this` value.
            const result = publicOwned ? event : Object.create(Object.getPrototypeOf(event))
            for (const key of publicOwned ? [] : ['type', 'isTrusted', 'timeStamp', 'bubbles', 'cancelable', 'composed',
                'eventPhase', 'loaded', 'total', 'lengthComputable']) {
                Object.defineProperty(result, key, { configurable: true, enumerable: true, value: eventRead(event, key) })
            }
            const prevent = () => eventCall(event, 'preventDefault')
            const stop = () => eventCall(event, 'stopPropagation')
            const stopImmediate = () => eventCall(event, 'stopImmediatePropagation')
            Object.defineProperties(result, {
                target: { value: facade }, currentTarget: { get: () => active ? facade : null }, srcElement: { value: facade },
                composedPath: { value: () => active ? [facade] : [] },
                preventDefault: { value: () => { if (!passive) prevent() } },
                stopPropagation: { value: () => { stopped = true; stop() } },
                stopImmediatePropagation: { value: () => { immediate = stopped = true; stopImmediate() } },
                defaultPrevented: { get: () => eventRead(event, 'defaultPrevented') },
                cancelBubble: { get: () => stopped || eventRead(event, 'cancelBubble'), set: value => { if (value) { stopped = true; stop() } } },
            })
            const state = { event: result, immediate: () => immediate, active: value => { active = value }, passive: value => { passive = value } }
            views.set(event, state); return state
        }
        const dispatch = (event, publicOwned = false) => {
            const state = view(event, publicOwned), type = eventRead(event, 'type')
            state.active(true)
            for (const row of [...(rows.get(type) || [])]) {
                if (!(rows.get(type) || []).includes(row)) continue
                if (row.once) off(type, row.callback, row.capture)
                state.passive(row.passive)
                try {
                    if (typeof row.callback === 'function') invoke(row.callback, facade, [state.event])
                    else invoke(row.callback.handleEvent, row.callback, [state.event])
                } catch (error) { setTimeout(() => { throw error }, 0) }
                if (state.immediate()) break
            }
            state.passive(false); state.active(false)
            return !eventRead(event, 'defaultPrevented')
        }
        const ensure = type => {
            if (relays.has(type)) return
            const relay = event => dispatch(event)
            relays.set(type, relay); invoke(add, backend, [type, relay])
        }
        const off = (type, callback, options) => {
            type = String(type)
            const capture = typeof options === 'boolean' ? options : !!options?.capture
            const list = rows.get(type) || [], index = list.findIndex(r => r.callback === callback && r.capture === capture)
            if (index >= 0) { const [row] = list.splice(index, 1); row.abortCleanup?.() }
        }
        const on = (type, callback, options) => {
            type = String(type)
            if (!callback || (typeof callback !== 'function' && typeof callback !== 'object')) return
            const capture = typeof options === 'boolean' ? options : !!options?.capture
            const signal = typeof options === 'object' ? options?.signal : null
            if (signal?.aborted) return
            const list = rows.get(type) || []
            if (list.some(r => r.callback === callback && r.capture === capture)) return
            const row = { callback, capture, once: !!options?.once, passive: !!options?.passive }
            if (signal) {
                const abort = () => off(type, callback, capture)
                signal.addEventListener('abort', abort, { once: true })
                row.abortCleanup = () => signal.removeEventListener('abort', abort)
            }
            list.push(row); rows.set(type, list); ensure(type)
        }
        Object.defineProperties(facade, {
            addEventListener: { configurable: true, writable: true, value: on },
            removeEventListener: { configurable: true, writable: true, value: off },
            // Never dispatch a caller-owned event on the backend: the retained
            // original event would otherwise reveal its native target afterwards.
            dispatchEvent: { configurable: true, writable: true, value: event => {
                if (!event || typeof event.type !== 'string') throw new TypeError('Invalid event')
                return dispatch(event, true)
            } },
        })
        for (const type of eventTypes) Object.defineProperty(facade, 'on' + type, {
            configurable: true, enumerable: true,
            get: () => handlers.get(type)?.callback || null,
            set: callback => {
                const prior = handlers.get(type)
                if (prior && typeof callback === 'function') { prior.callback = callback; return }
                if (prior) off(type, prior.listener)
                handlers.delete(type)
                if (typeof callback !== 'function') return
                const entry = { callback }
                const listener = event => { if (invoke(entry.callback, facade, [event]) === false) event.preventDefault() }
                entry.listener = listener; handlers.set(type, entry); on(type, listener)
            },
        })
    }
    class PublicXHR {
        constructor() {
            const backend = new ManagedXHR()
            instances.set(this, backend)
            events(backend, this)
            // Preserve own native implementation fields (normally none). This
            // also permits non-browser XHR implementations to retain their API.
            for (const key of Reflect.ownKeys(backend)) if (!(key in this)) {
                Object.defineProperty(this, key, { configurable: true, enumerable: true,
                    get: () => backend[key], set: value => { backend[key] = value } })
            }
        }
    }
    Object.setPrototypeOf(PublicXHR.prototype, NativeXHR.prototype)
    Object.setPrototypeOf(PublicXHR, NativeXHR)
    for (const [key, d] of descriptors) {
        if (['addEventListener', 'removeEventListener', 'dispatchEvent'].includes(key)
            || typeof key === 'string' && key.startsWith('on')) continue
        const receiver = self => { const backend = instances.get(self); if (!backend) throw new TypeError('Illegal invocation'); return backend }
        if (typeof d.value === 'function') Object.defineProperty(PublicXHR.prototype, key, {
            configurable: true, writable: true, value: function (...args) { return invoke(d.value, receiver(this), args) },
        })
        else if (d.get || d.set) Object.defineProperty(PublicXHR.prototype, key, {
            configurable: true, enumerable: d.enumerable,
            get: d.get ? function () {
                const backend = receiver(this), value = invoke(d.get, backend, [])
                if (key !== 'upload' || !value) return value
                if (!uploads.has(this)) { const facade = {}; events(value, facade); uploads.set(this, facade) }
                return uploads.get(this)
            } : undefined,
            set: d.set ? function (value) { invoke(d.set, receiver(this), [value]) } : undefined,
        })
        else Object.defineProperty(PublicXHR.prototype, key, d)
    }
    const uploads = new WeakMap()
    return PublicXHR
}
