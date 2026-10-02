import { isPlayurlApi } from '../src-v2/domain/catalog.ts'
import { isHttpDnsUrl } from '../src-v2/domain/url-policy.ts'
import { equal, assertionCount } from './support/assert.ts'
import { TRUSTED_CATALOG, DEFAULT_UNAVAILABLE_HOSTS, isCatalogHost } from '../src-v2/domain/catalog.ts'
import { catalogRestrictions, catalogCandidates, hardRestriction } from '../src-v2/domain/route-policy.ts'
import { originalOutputPlan, backupOutputPlan, catalogOutputPlan } from '../src-v2/domain/player-output-plan.ts'

equal(typeof location, 'undefined', 'domain suite has no browser location')
equal(isPlayurlApi('https://api.bilibili.com/x/player/wbi/playurl'), true, 'absolute playurl classification is independent of browser globals')
equal(isHttpDnsUrl('https://httpdns.bilivideo.com/resolve'), true, 'absolute HTTPDNS classification is independent of browser globals')
equal(isPlayurlApi('/x/player/wbi/playurl', 'https://api.bilibili.com/'), true, 'relative playurl uses explicit base')
equal(isPlayurlApi('/x/player/wbi/playurl', 'https://www.bilibili.com/'), false, 'base host does not grant API authority')
equal(isHttpDnsUrl('/resolve', 'https://httpdns.bilivideo.com/'), true, 'relative HTTPDNS uses explicit base')
equal(isHttpDnsUrl('/resolve'), false, 'relative URL without base is not admitted')
const primary = TRUSTED_CATALOG[0]!, next = TRUSTED_CATALOG[1]!, unavailable = [...DEFAULT_UNAVAILABLE_HOSTS][0]!
const restrictions = catalogRestrictions({ [primary]: false, [unavailable]: true })
equal(restrictions.disabledCatalogHosts.has(primary), true, 'explicit Catalog disable enters the restriction snapshot')
equal(restrictions.defaultUnavailableHosts.has(unavailable), false, 'explicit Catalog enable removes only the default restriction')
equal(catalogCandidates('audio', new Set([primary])).every(row => row.kind === 'audio' && row.host !== primary), true, 'candidate construction preserves media kind and exclusions')
const restrictionInput = { blackHosts: new Set([primary]), deadHosts: new Set([primary]), overrides: { [primary]: false }, circuitUntil: 101 }
equal(hardRestriction(primary, restrictionInput, 100), 'black', 'blacklist takes priority over other restrictions')
equal(hardRestriction(primary, { ...restrictionInput, blackHosts: new Set() }, 100), 'dead', 'dead restriction precedes Catalog settings')
equal(hardRestriction(primary, { ...restrictionInput, blackHosts: new Set(), deadHosts: new Set() }, 100), 'catalog-disabled', 'explicit Catalog restriction precedes circuit')
equal(hardRestriction(primary, { blackHosts: new Set(), deadHosts: new Set(), overrides: {}, circuitUntil: 100 }, 100), null, 'expired circuit does not block a legal route')
const candidates = [{ index: 0, host: primary, allowed: false }, { index: 1, host: next, allowed: true },
  { index: 2, host: primary, allowed: true }, { index: 3, host: next, allowed: true }]
equal(originalOutputPlan(candidates).primary, 1, 'comparison output promotes the first permitted exact index')
equal(originalOutputPlan([]).primary, null, 'no eligible comparison route yields no primary')
equal(backupOutputPlan(primary, candidates, false).join(','), '1,2,3', 'backup policy prioritizes distinct hosts before same-host entries')
equal(backupOutputPlan(primary, candidates, true).length, 0, 'host-locked stream has no generated backup candidates')
const catalog = catalogOutputPlan(primary, ['not-catalog.example', next, next], new Set([primary]))
equal(catalog[0], next, 'Catalog backup preferences retain stable first occurrence')
equal(catalog.length <= 5 && catalog.every(host => host !== primary && isCatalogHost(host)), true, 'Catalog output plan is bounded and only returns built-in hosts')
console.log(`domain boundaries: ${assertionCount()} assertions`)
