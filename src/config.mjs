// State belongs to this instance; dependencies are the explicitly wired internal ports.
export function createSettings(deps, input) {
let CustomCDN = input.CustomCDN

let ExcludeHostKeywords = input.ExcludeHostKeywords

let BlockHttpDNS = input.BlockHttpDNS

let PreferredVideoCodec = input.PreferredVideoCodec

let BlockWebRTC = input.BlockWebRTC

let EnableWorkerIntercept = input.EnableWorkerIntercept

const VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '1.6.1'

const parseVer = (v) => String(v || '0').split('.').map(n => parseInt(n, 10) || 0)

const verGte = (a, b) => {
    const A = parseVer(a), B = parseVer(b)
    for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0) }
    return true
}
return { /* TEST_EXPORTS:settings */
get CustomCDN() { return CustomCDN; }, set CustomCDN(value) { CustomCDN = value; },
get ExcludeHostKeywords() { return ExcludeHostKeywords; }, set ExcludeHostKeywords(value) { ExcludeHostKeywords = value; },
get BlockHttpDNS() { return BlockHttpDNS; }, set BlockHttpDNS(value) { BlockHttpDNS = value; },
get PreferredVideoCodec() { return PreferredVideoCodec; }, set PreferredVideoCodec(value) { PreferredVideoCodec = value; },
get BlockWebRTC() { return BlockWebRTC; }, set BlockWebRTC(value) { BlockWebRTC = value; },
get EnableWorkerIntercept() { return EnableWorkerIntercept; }, set EnableWorkerIntercept(value) { EnableWorkerIntercept = value; },
get VERSION() { return VERSION; },
get verGte() { return verGte; }
};
}
