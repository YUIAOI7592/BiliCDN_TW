/** Node's boolean remove option differs from DOM capture matching; normalize only the model. */
export class CaptureEventTarget extends EventTarget {
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type,
      callback,
      typeof options === 'boolean' ? { capture: options } : options,
    )
  }
}
