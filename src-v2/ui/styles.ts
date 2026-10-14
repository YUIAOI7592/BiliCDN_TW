const controlCenterCss = `
:host{all:initial;color-scheme:dark}*{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#000a;display:grid;place-items:center;padding:18px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eef6ff}.dialog{width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#101a2b;border:1px solid #405169;border-radius:12px;box-shadow:0 20px 70px #000d}.head,.foot{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #34445b}.head{justify-content:space-between}.foot{justify-content:flex-end;border:0;border-top:1px solid #34445b;flex-wrap:wrap}.body{padding:14px 16px;overflow:auto;display:grid;gap:12px}h2,h3,p{margin:0}.summary{white-space:pre-wrap;color:#cfe5ff}.grid{display:grid;gap:7px}.row{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #34445b;border-radius:7px;background:#162338}.row label{flex:1;overflow-wrap:anywhere}.detail{font-size:12px;color:#9fb3ca}.btn,select{font:inherit;border:1px solid #52657e;border-radius:7px;background:#213149;color:#f6fbff;padding:7px 11px}.btn{cursor:pointer}.btn.primary{background:#075985;border-color:#0ea5e9}.btn.danger{background:#7f1d1d;border-color:#f87171}.report{width:100%;height:min(52vh,520px);background:#050a12;color:#dbeafe;border:1px solid #405169;border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
`

export function createControlCenterStyle(): HTMLStyleElement {
  const style = document.createElement('style')
  style.textContent = controlCenterCss
  return style
}
