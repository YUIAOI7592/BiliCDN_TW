// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createTrustedUI(deps) {
const TrustedMenuUI = (() => {
    const HOST_ID = 'bilicdn-trusted-menu-ui'
    const MAX_TOASTS = 3
    const TONE_TTL = Object.freeze({ success: 3000, info: 3000, warning: 5000, error: 5000 })
    const bounded = (value, max = 2000) => String(value == null ? '' : value).slice(0, max)
    const call = fn => Function.call.bind(fn)
    const dom = {
        create: document.createElement.bind(document),
        append: call(Node.prototype.appendChild),
        remove: Element.prototype.remove ? call(Element.prototype.remove) : node => {
            if (node && node.parentNode) node.parentNode.removeChild(node)
        },
        attachShadow: call(Element.prototype.attachShadow),
        addEvent: call(EventTarget.prototype.addEventListener),
        focus: HTMLElement.prototype.focus ? call(HTMLElement.prototype.focus) : () => {},
    }

    let host = null
    let shadow = null
    let toastLayer = null
    let modalLayer = null
    let activeModal = null
    let activeCapability = null
    let uiSession = null
    let sessionRevision = 0
    let serial = 0
    const toastEntries = []

    const make = (tag, text, attrs = {}) => {
        const node = dom.create(tag)
        if (text != null) node.textContent = bounded(text, attrs.maxText || 2000)
        if (attrs.className) node.className = attrs.className
        if (attrs.kind) node.dataset.uiKind = attrs.kind
        if (attrs.action) node.dataset.uiAction = attrs.action
        if (attrs.role) node.setAttribute('role', attrs.role)
        if (attrs.ariaLabel) node.setAttribute('aria-label', bounded(attrs.ariaLabel, 200))
        return node
    }

    const ensure = () => {
        if (host && shadow && host.parentNode) return true
        try {
            host = make('div')
            host.id = HOST_ID
            host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
            shadow = dom.attachShadow(host, { mode: 'closed' })
            const style = make('style', `
                :host{all:initial;color-scheme:dark}
                *{box-sizing:border-box}
                .toasts{position:fixed;top:18px;right:18px;width:min(380px,calc(100vw - 36px));display:grid;gap:8px;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .toast{border:1px solid #4b5563;border-left:4px solid #38bdf8;border-radius:8px;background:#111827;color:#f9fafb;padding:10px 12px;box-shadow:0 8px 28px #0009;white-space:pre-wrap;overflow-wrap:anywhere}
                .toast.success{border-left-color:#4ade80}.toast.warning{border-left-color:#fbbf24}.toast.error{border-left-color:#fb7185}
                .modal-layer{position:fixed;inset:0;pointer-events:none;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
                .backdrop{position:absolute;inset:0;background:#0009;display:grid;place-items:center;padding:20px;pointer-events:auto}
                .dialog{width:min(640px,100%);max-height:min(82vh,760px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #4b5563;border-radius:12px;background:#111827;color:#f9fafb;box-shadow:0 18px 64px #000c}
                .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #374151}
                .title{margin:0;font-size:18px;line-height:1.35}.body{padding:16px 18px;overflow:auto;display:grid;gap:12px}
                .text{margin:0;color:#d1d5db;white-space:pre-wrap;overflow-wrap:anywhere}.detail{font-size:12px;color:#9ca3af}
                .choices{display:grid;gap:8px}.choice{width:100%;text-align:left;border:1px solid #4b5563;border-radius:8px;background:#1f2937;color:#f9fafb;padding:9px 11px;cursor:pointer}
                .choice.selected{border-color:#38bdf8;background:#0c4a6e}.choice:disabled{opacity:.55;cursor:not-allowed}
                .choice-main{display:block}.choice-detail{display:block;margin-top:2px;font-size:12px;color:#cbd5e1}
                .section-title{margin:4px 0 0;font-size:13px;color:#7dd3fc}.action-list{display:grid;gap:8px}.action-list .btn{text-align:left;padding:10px 12px}
                .report{width:100%;min-height:260px;resize:vertical;border:1px solid #4b5563;border-radius:8px;background:#030712;color:#e5e7eb;padding:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
                .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid #374151}
                button{font:inherit}.btn{border:1px solid #4b5563;border-radius:7px;background:#1f2937;color:#f9fafb;padding:7px 13px;cursor:pointer}.btn.primary{border-color:#0284c7;background:#0369a1}.btn.danger{border-color:#be123c;background:#9f1239}.btn:disabled{opacity:.45;cursor:not-allowed}
                @media(max-width:600px){.toasts{top:10px;right:10px;width:calc(100vw - 20px)}.backdrop{padding:10px}.dialog{max-height:90vh}}
                @media(prefers-reduced-motion:no-preference){.toast,.dialog{animation:biliCdnIn .14s ease-out}@keyframes biliCdnIn{from{opacity:.25;transform:translateY(-5px)}to{opacity:1;transform:none}}}
            `, { maxText: 12000 })
            toastLayer = make('div', null, { className: 'toasts', role: 'status', ariaLabel: 'BiliCDN 操作訊息' })
            toastLayer.setAttribute('aria-live', 'polite')
            toastLayer.setAttribute('aria-atomic', 'false')
            modalLayer = make('div', null, { className: 'modal-layer' })
            dom.append(shadow, style)
            dom.append(shadow, toastLayer)
            dom.append(shadow, modalLayer)
            dom.addEvent(shadow, 'keydown', event => {
                if (!event || !event.isTrusted || !activeModal) return
                if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation(); closeDialog()
                } else if (event.key === 'Tab') {
                    const targets = []
                    const visit = node => {
                        if (!node || node.hidden || node.style?.display === 'none' || node.style?.visibility === 'hidden'
                            || node.getAttribute?.('aria-hidden') === 'true') return
                        const tab = node.getAttribute?.('tabindex')
                        if (!node.disabled && (tab == null || Number(tab) >= 0)
                            && (['BUTTON', 'TEXTAREA', 'INPUT', 'SELECT'].includes(node.tagName) || (tab != null && Number(tab) >= 0))) targets.push(node)
                        ;[...(node.children || [])].forEach(visit)
                    }
                    visit(activeModal)
                    if (targets.length) {
                        const focused = shadow.activeElement || document.activeElement
                        const index = targets.indexOf(focused)
                        const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0)
                            : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length
                        event.preventDefault(); event.stopPropagation(); dom.focus(targets[next])
                    }
                }
            })
            dom.append(document.documentElement, host)
            return true
        } catch (e) {
            try { console.error('[BiliCDN] 無法建立可信選單 UI：', e) } catch {}
            host = shadow = toastLayer = modalLayer = null
            return false
        }
    }

    const removeToastEntry = entry => {
        const index = toastEntries.indexOf(entry)
        if (index >= 0) toastEntries.splice(index, 1)
        if (entry.timer) clearTimeout(entry.timer)
        try { if (entry.node) dom.remove(entry.node) } catch {}
        entry.node = null
    }

    const toast = (message, tone = 'info', options = {}) => {
        if (!ensure()) return Object.freeze({ update: () => {}, close: () => {} })
        const normalizedTone = Object.prototype.hasOwnProperty.call(TONE_TTL, tone) ? tone : 'info'
        const node = make('div', bounded(message, 500), {
            className: 'toast ' + normalizedTone,
            kind: 'toast',
            role: normalizedTone === 'error' ? 'alert' : 'status',
        })
        dom.append(toastLayer, node)
        const entry = { node, timer: null, tone: normalizedTone }
        toastEntries.push(entry)
        while (toastEntries.length > MAX_TOASTS) removeToastEntry(toastEntries[0])
        const arm = () => {
            if (entry.timer) clearTimeout(entry.timer)
            if (!options.sticky) entry.timer = setTimeout(() => removeToastEntry(entry), TONE_TTL[entry.tone])
        }
        arm()
        return Object.freeze({
            update(nextMessage, nextTone = entry.tone, sticky = false) {
                if (!entry.node) return
                entry.tone = Object.prototype.hasOwnProperty.call(TONE_TTL, nextTone) ? nextTone : 'info'
                entry.node.className = 'toast ' + entry.tone
                entry.node.textContent = bounded(nextMessage, 500)
                options.sticky = !!sticky
                arm()
            },
            close() { removeToastEntry(entry) },
        })
    }

    const mintCapability = () => {
        try {
            if (!crypto || typeof crypto.getRandomValues !== 'function') return null
            const bytes = new Uint8Array(16)
            crypto.getRandomValues(bytes)
            return Object.freeze({ serial: ++serial, bytes })
        } catch { return null }
    }

    const closeView = () => {
        activeCapability = null
        if (activeModal) {
            try { dom.remove(activeModal) } catch {}
            activeModal = null
        }
    }
    const restoreSessionFocus = session => {
        if (!session) return
        try {
            const video = deps.Watchdog.getVideo()
            const target = session.focus && document.contains(session.focus) ? session.focus
                : video && document.contains(video) ? video : document.body
            if (!target) return
            if (target === document.body) {
                const oldTab = target.getAttribute('tabindex')
                target.setAttribute('tabindex', '-1')
                try { dom.focus(target, { preventScroll: true }) }
                finally { if (oldTab == null) target.removeAttribute('tabindex'); else target.setAttribute('tabindex', oldTab) }
            } else dom.focus(target, { preventScroll: true })
        } catch {}
    }
    const closeDialog = (restoreFocus = true) => {
        const session = uiSession
        closeView()
        uiSession = null
        sessionRevision++
        if (restoreFocus) restoreSessionFocus(session)
    }

    const beginDialog = ({ title, paragraphs = [], requiresCapability = false }) => {
        if (!ensure()) return null
        // Tampermonkey 可在前一個 dialog 尚未關閉時再開啟另一個 menu。保留最初的頁面
        // 焦點，不要把已移除 dialog 的關閉按鈕當成 Escape 後的回復目標。
        if (!uiSession) { uiSession = { focus: document.activeElement }; sessionRevision++ }
        closeView()
        const capability = requiresCapability ? mintCapability() : Object.freeze({ readOnly: true, serial: ++serial })
        if (!capability) {
            closeDialog()
            toast('安全亂數不可用，無法開啟會修改設定的對話框', 'error')
            return null
        }
        activeCapability = capability
        const backdrop = make('div', null, { className: 'backdrop', kind: 'dialog', role: 'presentation' })
        const panel = make('section', null, { className: 'dialog', role: 'dialog', ariaLabel: bounded(title, 120) })
        panel.setAttribute('aria-modal', 'true')
        const head = make('div', null, { className: 'head' })
        const heading = make('h2', title, { className: 'title', maxText: 160 })
        const close = make('button', '關閉', { className: 'btn', action: 'cancel', ariaLabel: '關閉對話框' })
        close.type = 'button'
        dom.addEvent(close, 'click', event => {
            if (!event || !event.isTrusted || activeCapability !== capability) return
            closeDialog()
        })
        dom.append(head, heading)
        dom.append(head, close)
        const body = make('div', null, { className: 'body' })
        ;[].concat(paragraphs || []).slice(0, 24).forEach(text => dom.append(body, make('p', text, { className: 'text' })))
        const actions = make('div', null, { className: 'actions' })
        dom.append(panel, head)
        dom.append(panel, body)
        dom.append(panel, actions)
        dom.append(backdrop, panel)
        dom.append(modalLayer, backdrop)
        activeModal = backdrop
        try { dom.focus(close) } catch {}
        return { capability, backdrop, panel, body, actions, close }
    }

    const addAction = (dialog, { label, action, tone = '', onActivate, closeOnActivate = true }) => {
        const button = make('button', label, {
            className: 'btn' + (tone ? ' ' + tone : ''),
            action,
            maxText: 100,
        })
        button.type = 'button'
        dom.addEvent(button, 'click', event => {
            if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
            if (closeOnActivate) closeDialog(true)
            onActivate()
        })
        dom.append(dialog.actions, button)
        return button
    }

    const openConfirm = ({ title, paragraphs, confirmLabel = '確認', danger = false, onConfirm }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        addAction(dialog, {
            label: confirmLabel,
            action: 'confirm',
            tone: danger ? 'danger' : 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm() },
        })
        return true
    }

    const openChoice = ({
        title, paragraphs, choices = [], multiple = false, selected = [], confirmLabel = '套用',
        onConfirm, secondaryLabel = '', onSecondary,
    }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        const safeChoices = choices.slice(0, 64).map(choice => ({
            label: bounded(choice && choice.label, 300),
            detail: bounded(choice && choice.detail, 500),
            disabled: !!(choice && choice.disabled),
        }))
        const picked = new Set([].concat(selected || []).filter(index => Number.isInteger(index)
            && index >= 0 && index < safeChoices.length))
        if (!multiple && picked.size > 1) {
            const first = picked.values().next().value
            picked.clear(); picked.add(first)
        }
        const list = make('div', null, { className: 'choices' })
        safeChoices.forEach((choice, index) => {
            const button = make('button', null, { className: 'choice', action: 'choice-' + index })
            button.type = 'button'
            button.disabled = choice.disabled
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', choice.detail, { className: 'choice-detail' })
            const render = () => {
                const isPicked = picked.has(index)
                button.className = 'choice' + (isPicked ? ' selected' : '')
                main.textContent = (multiple ? (isPicked ? '☑ ' : '☐ ') : (isPicked ? '◉ ' : '○ ')) + choice.label
            }
            render()
            dom.append(button, main)
            if (choice.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability || choice.disabled) return
                if (multiple) {
                    if (picked.has(index)) picked.delete(index); else picked.add(index)
                } else {
                    picked.clear(); picked.add(index)
                    safeChoices.forEach((_, other) => {
                        const otherButton = list.children && list.children[other]
                        if (!otherButton || !otherButton.children || !otherButton.children[0]) return
                        const on = picked.has(other)
                        otherButton.className = 'choice' + (on ? ' selected' : '')
                        otherButton.children[0].textContent = (on ? '◉ ' : '○ ') + safeChoices[other].label
                    })
                }
                render()
            })
            dom.append(list, button)
        })
        dom.append(dialog.body, list)
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        if (secondaryLabel && typeof onSecondary === 'function') {
            addAction(dialog, { label: secondaryLabel, action: 'secondary', onActivate: onSecondary })
        }
        addAction(dialog, {
            label: confirmLabel,
            action: 'confirm',
            tone: 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm([...picked].sort((a, b) => a - b)) },
        })
        return true
    }

    const openText = ({ title, paragraphs, text = '', copyLabel = '', onCopy }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: false })
        if (!dialog) return false
        const area = make('textarea', bounded(text, 48 * 1024), { action: 'manual-copy-text', maxText: 48 * 1024 })
        area.className = 'report'
        area.value = bounded(text, 48 * 1024)
        area.readOnly = true
        area.setAttribute('readonly', '')
        dom.append(dialog.body, area)
        addAction(dialog, { label: '關閉', action: 'cancel-secondary', onActivate: () => {} })
        if (copyLabel && typeof onCopy === 'function') {
            addAction(dialog, { label: copyLabel, action: 'copy', tone: 'primary', onActivate: onCopy })
        }
        return true
    }

    const openActions = ({ title, paragraphs, items = [] }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        const list = make('div', null, { className: 'action-list' })
        items.slice(0, 16).forEach(item => {
            const button = make('button', item.label, { className: 'btn', action: item.action, maxText: 120 })
            button.type = 'button'
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                const session = uiSession
                closeView()
                try { if (typeof item.onActivate === 'function') item.onActivate() }
                finally { if (!activeModal && uiSession === session) closeDialog() }
            })
            dom.append(list, button)
        })
        dom.append(dialog.body, list)
        addAction(dialog, { label: '關閉', action: 'cancel-secondary', onActivate: () => {} })
        return true
    }

    const openRouting = ({ title, paragraphs, routes = [], fixedSelected = 0, catalogSelected = [], onConfirm, onDefaults }) => {
        const dialog = beginDialog({ title, paragraphs, requiresCapability: true })
        if (!dialog) return false
        let routeIndex = Number.isInteger(fixedSelected) ? fixedSelected : 0
        const enabled = new Set([].concat(catalogSelected || []).filter(Number.isInteger))
        const routeList = make('div', null, { className: 'choices' })
        dom.append(dialog.body, make('h3', '模式與固定節點', { className: 'section-title' }))
        routes.slice(0, 64).forEach((route, index) => {
            const button = make('button', null, { className: 'choice', action: 'route-' + index })
            button.type = 'button'
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', route.detail || '', { className: 'choice-detail' })
            const render = () => {
                const selected = routeIndex === index
                button.className = 'choice' + (selected ? ' selected' : '')
                main.textContent = (selected ? '◉ ' : '○ ') + bounded(route.label, 300)
            }
            render(); dom.append(button, main); if (route.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                routeIndex = index
                ;[...(routeList.children || [])].forEach((node, other) => {
                    if (!node.children || !node.children[0]) return
                    const selected = other === routeIndex
                    node.className = 'choice' + (selected ? ' selected' : '')
                    node.children[0].textContent = (selected ? '◉ ' : '○ ') + bounded(routes[other].label, 300)
                })
            })
            dom.append(routeList, button)
        })
        dom.append(dialog.body, routeList)
        dom.append(dialog.body, make('h3', '自動選路候選', { className: 'section-title' }))
        const catalogList = make('div', null, { className: 'choices' })
        routes.slice(1, 65).forEach((route, index) => {
            const button = make('button', null, { className: 'choice', action: 'catalog-' + index })
            button.type = 'button'
            const main = make('span', '', { className: 'choice-main' })
            const detail = make('span', route.detail || '', { className: 'choice-detail' })
            const render = () => {
                const selected = enabled.has(index)
                button.className = 'choice' + (selected ? ' selected' : '')
                main.textContent = (selected ? '☑ ' : '☐ ') + bounded(route.label, 300)
            }
            render(); dom.append(button, main); if (route.detail) dom.append(button, detail)
            dom.addEvent(button, 'click', event => {
                if (!event || !event.isTrusted || activeCapability !== dialog.capability) return
                if (enabled.has(index)) enabled.delete(index); else enabled.add(index)
                render()
            })
            dom.append(catalogList, button)
        })
        dom.append(dialog.body, catalogList)
        addAction(dialog, { label: '取消', action: 'cancel-secondary', onActivate: () => {} })
        if (typeof onDefaults === 'function') addAction(dialog, {
            label: '恢復自動預設', action: 'routing-defaults', onActivate: onDefaults,
        })
        addAction(dialog, {
            label: '套用', action: 'confirm', tone: 'primary',
            onActivate: () => { if (typeof onConfirm === 'function') onConfirm({ routeIndex, enabled: [...enabled].sort((a, b) => a - b) }) },
        })
        return true
    }

    const invalidate = ({ clearToasts = true } = {}) => {
        closeDialog(false)
        activeCapability = null
        serial++
        if (clearToasts) [...toastEntries].forEach(removeToastEntry)
    }

    const captureContext = () => ({ revision: sessionRevision, serial })
    const isContextCurrent = context => !!context && context.revision === sessionRevision && context.serial === serial
    return Object.freeze({ toast, openConfirm, openChoice, openText, openActions, openRouting, closeDialog, invalidate,
        captureContext, isContextCurrent })
})()
return { /* TEST_EXPORTS:trustedUI */
get TrustedMenuUI() { return TrustedMenuUI; }
};
}
