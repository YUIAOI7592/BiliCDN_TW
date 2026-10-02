// Each suite runs in its own process; no state or hook ownership crosses suites.
export const suites = ['domain-boundaries', 'suites/domain', 'suites/state', 'suites/application',
  'suites/diagnostics', 'suites/adapters', 'suites/native-routing', 'suites/native-transport', 'suites/orchestration',
  'suites/adapter-boundaries', 'suites/measurement-state'] as const
