export interface RuntimeIdPort {
  next(kind: 'request' | 'startup' | 'challenge' | 'circuit' | 'observation' | 'commit'): string
}
