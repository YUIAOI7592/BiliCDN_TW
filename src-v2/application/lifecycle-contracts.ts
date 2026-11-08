export interface NavigationPort {
  key(): string
  subscribe(listener: () => void): () => void
}
