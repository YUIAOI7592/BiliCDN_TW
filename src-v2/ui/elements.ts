export function createButton(
  label: string,
  action: () => void | Promise<void>,
  tone = '',
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `btn ${tone}`.trim()
  button.textContent = label
  button.addEventListener('click', (event) => {
    if (!event.isTrusted) return
    event.preventDefault()
    event.stopPropagation()
    void action()
  })
  return button
}

export function createRow(label: string, control: HTMLElement, detail = ''): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'row'
  const text = document.createElement('label')
  text.textContent = label
  if (detail) {
    const small = document.createElement('span')
    small.className = 'detail'
    small.textContent = detail
    text.append(document.createElement('br'), small)
  }
  row.append(text, control)
  return row
}
