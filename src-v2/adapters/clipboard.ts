/** Resolve the platform API during the trusted click; recheck ownership after getters. */
export async function writeClipboard(
  text: string,
  ownsView: () => boolean,
): Promise<'native' | 'manager' | null> {
  let clipboard: Clipboard | undefined, write: Clipboard['writeText'] | undefined
  try {
    clipboard = navigator.clipboard
    write = clipboard?.writeText
  } catch {
    /* manager fallback */
  }
  if (!ownsView()) return null
  if (typeof write === 'function') {
    await write.call(clipboard, text)
    return 'native'
  }
  GM_setClipboard(text, 'text')
  return 'manager'
}
