export interface RuntimeIdPort {
  next(kind: 'request' | 'startup' | 'challenge'): string
}
