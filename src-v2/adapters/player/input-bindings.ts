/** Owned by one observer; event registration carries no operation or reload revision. */
export class PlayerInputBindings {
  #stops: (() => void)[] = []

  listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener, true)
    this.#stops.push(() => target.removeEventListener(type, listener, true))
  }
  trusted(target: EventTarget, type: string, listener: EventListener): void {
    this.listen(target, type, (event) => {
      if (event.isTrusted) listener(event)
    })
  }
  own(stop: () => void): void {
    this.#stops.push(stop)
  }
  playback(video: HTMLVideoElement, invalidate: () => void): void {
    for (const type of ['pause', 'play', 'ratechange', 'seeking', 'emptied', 'ended'])
      this.listen(video, type, () => invalidate())
  }
  pointerRelease(release: EventListener): void {
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.listen(document, type, release)
  }
  keyboard(listener: EventListener): void {
    for (const type of ['keydown', 'keyup']) this.listen(document, type, listener)
  }
  clear(): void {
    for (const stop of this.#stops.splice(0).reverse()) stop()
  }
}

export function isControlKeyboard(event: Event): event is KeyboardEvent {
  return (
    event instanceof KeyboardEvent &&
    event.isTrusted &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
}

export function isEditableTarget(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    (!!target.closest('input, textarea, select, [role="textbox"], #bilicdn-v2-control-center') ||
      (target instanceof HTMLElement && target.isContentEditable))
  )
}

export function progressPointerId(event: Event, region: Element | null): number | null {
  const hit =
    event.target instanceof Element
      ? event.target.closest(
          '.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]',
        )
      : null
  if (
    !hit ||
    !region?.contains(hit) ||
    typeof PointerEvent !== 'function' ||
    !(event instanceof PointerEvent)
  )
    return null
  const pointerId = event.pointerId
  return Number.isInteger(pointerId) ? pointerId : null
}
