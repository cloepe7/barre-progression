export type Etape = {
  id: string
  sujet: string
  enCours?: string
  statut: 'pending' | 'in_progress' | 'completed'
}

export type Activite = { libelle: string; actions: number }

declare module 'claude-code' {
  interface PluginState {
    'barre-progression': {
      etapes: Etape[]
      activite: Activite | null
    }
  }
}
