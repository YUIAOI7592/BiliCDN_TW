const controlCenterCss = `
:host{all:initial;color-scheme:light dark}
*{box-sizing:border-box}
.backdrop{position:fixed;inset:0;z-index:2147483647;background:#0008;display:grid;place-items:center;padding:18px;font:14px/1.55 system-ui,-apple-system,"Microsoft JhengHei",sans-serif}
.dialog{--bg:light-dark(#f6f8fc,#0e1728);--surface:light-dark(#fff,#162136);--ink:light-dark(#17283f,#e8eff9);--muted:light-dark(#5b6d83,#9aacbf);--line:light-dark(#dde5ef,#2b3a51);--blue:light-dark(#2263ce,#83b5ff);--green:light-dark(#147651,#79d6b0);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:20px;width:min(900px,100%);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 70px #0008;overflow:hidden}
h2,h3,p{margin:0}h2{font-size:21px;font-weight:600}h3{font-size:15px;font-weight:600}
.head{display:flex;gap:12px;align-items:center;padding:24px 28px 18px;flex-wrap:wrap}.brand{flex:1;min-width:200px}
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;padding:0 28px;border-bottom:1px solid var(--line)}
.tab{font:inherit;color:var(--muted);background:transparent;border:0;border-bottom:3px solid transparent;padding:13px 0;cursor:pointer}
.tab[aria-current=page]{color:var(--blue);border-bottom-color:var(--blue)}
.body{overflow:auto;padding:24px 28px;display:grid;gap:20px}
.foot{display:flex;gap:9px;flex-wrap:wrap;padding:16px 28px;border-top:1px solid var(--line)}.foot:empty{display:none}
.notice:empty{display:none}.notice{padding:10px 28px;color:light-dark(#b14242,#f59b9b)}
.btn,select{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 13px;cursor:pointer}
.btn:disabled{opacity:.55;cursor:wait}.btn.danger{color:light-dark(#b14242,#f59b9b)}.power[aria-pressed=true]{color:var(--green)}
:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.hero{display:flex;align-items:center;justify-content:space-between;gap:12px}.playback{font-size:20px}.badge{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:5px 10px;border-radius:8px}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.metric,.panel{border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.metric{padding:17px 18px;min-width:0}.number{display:flex;align-items:baseline;gap:6px;margin:7px 0}.value{font-size:30px;font-weight:500;letter-spacing:-.8px;font-variant-numeric:tabular-nums}.unit,.detail{font-size:12px;color:var(--muted)}
.routes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.route{padding:18px;min-width:0}.route+.route{border-left:1px solid var(--line)}.route-host{font-size:16px;margin:9px 0;overflow-wrap:anywhere}
.activity{padding:16px 18px;display:grid;gap:10px}.event{font-size:12px;color:var(--muted)}
.grid{display:grid;gap:8px}.row{display:flex;align-items:center;gap:16px;padding:15px 18px;border:1px solid var(--line);border-radius:10px;background:var(--surface);flex-wrap:wrap}
.row label{flex:1;min-width:150px;overflow-wrap:anywhere}.row input{width:19px;height:19px;flex:none;accent-color:var(--blue);cursor:pointer}.row select{max-width:100%;min-width:0}.restriction{flex-basis:100%}.restriction:empty{display:none}
.tools{padding:14px 18px}.tools summary{cursor:pointer;color:var(--muted);font-size:13px}.tools[open] summary{margin-bottom:14px}.tools .btn{margin:5px 8px 5px 0}.confirmation:empty{display:none}.confirmation{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:9px}
.summary{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted)}.status-details:empty{display:none}
.report{width:100%;height:min(46vh,450px);resize:vertical;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:12px;font:12px/1.5 ui-monospace,Consolas,monospace}
@media(max-width:560px){.backdrop{padding:8px}.head{padding:18px}.tabs{padding:0 18px;gap:8px}.body{padding:20px 18px}.metrics,.routes{grid-template-columns:1fr}.metric{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center}.metric .detail:last-child{grid-column:1/-1}.number{margin:0}.route+.route{border-left:0;border-top:1px solid var(--line)}.foot{padding:14px 18px}h2{font-size:19px}.brand{min-width:170px}.row select{width:100%}}
`
export function createControlCenterStyle(): HTMLStyleElement {
  const style = document.createElement('style')
  style.textContent = controlCenterCss
  return style
}
