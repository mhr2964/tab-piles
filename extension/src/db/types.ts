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
  addedAt: number
}
