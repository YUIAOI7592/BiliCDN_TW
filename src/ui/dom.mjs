// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createDom(deps) {
const waitForElm = (selector, timeoutMs) => new Promise((resolve, reject) => {
    const ele = document.querySelector(selector)
    if (ele) return resolve(ele)
    let timer = null
    const observer = new MutationObserver(() => {
        const found = document.querySelector(selector)
        if (found) {
            observer.disconnect()
            if (timer) clearTimeout(timer)
            resolve(found)
        }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    if (timeoutMs) {
        timer = setTimeout(() => {
            observer.disconnect()
            reject(new Error('等待元素逾時：' + selector))
        }, timeoutMs)
    }
})

function fromHTML(html) {
    const template = document.createElement('template')
    template.innerHTML = html
    const result = template.content.children
    return result.length === 1 ? result[0] : result
}
return { /* TEST_EXPORTS:dom */
get waitForElm() { return waitForElm; },
get fromHTML() { return fromHTML; }
};
}
