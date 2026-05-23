export interface Pile {
  id?: number
  name: string
  note: string
  tags: string[]
  createdAt: number
  updatedAt: number
  archivedAt: number
}

export interface SavedTab {
  id?: number
  pileId: number
  url: string
  title: string
  favIconUrl?: string
  note?: string
  /** Plain-text snapshot of the page at save time. Pro feature; truncated to 50 KB. */
  snapshot?: string
  addedAt: number
}
