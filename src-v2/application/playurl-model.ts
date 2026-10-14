export interface PlayurlItem {
  readonly token: object
  readonly key: string
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly primary: string
  readonly urls: readonly string[]
  readonly progressive?: boolean
}
export interface PlayurlInput {
  readonly token: object
  readonly video: readonly PlayurlItem[]
  readonly audio: readonly PlayurlItem[]
}
export interface PlayurlOutput {
  readonly token: object
  readonly primary: string
  readonly backups: readonly string[]
}
