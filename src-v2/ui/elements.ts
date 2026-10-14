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

export function createToggle(
  label: string,
  checked: boolean,
  update: (value: boolean) => void | Promise<unknown>,
  detail = '',
): HTMLDivElement {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', (event) => {
    if (!event.isTrusted) {
      input.checked = checked
      return
    }
    void update(input.checked)
  })
  return createRow(label, input, detail)
}
