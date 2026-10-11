import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activite, Etape } from '../types'

const etapes = atom({ plugin: 'barre-progression', key: 'etapes' } as const, [])
const activite = atom({ plugin: 'barre-progression', key: 'activite' } as const, null)

const LARGEUR = 20

const CONSIGNE = [
  "Barre de progression de l'utilisateur : elle est construite à partir de ta liste de tâches.",
  'Pour toute demande de plus de deux étapes, crée la liste de tâches (TaskCreate, ou TodoWrite si TaskCreate est absent) dès le début,',
  'passe chaque étape en in_progress quand tu la commences et en completed dès qu’elle est finie.',
  'Ajoute une étape si le travail s’allonge plutôt que de la taire. Une question simple n’a pas besoin de liste.',
].join(' ')

/** Libellé court, en français, de l'outil appelé. */
export function libelleOutil(outil: string): string | null {
  if (/^Task(Create|Update|Get|List)$|^TodoWrite$|^ToolSearch$|^SendUserMessage$/.test(outil)) {
    return null
  }
  const mcp = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/.exec(outil)
  if (mcp) {
    const serveur = (mcp[1] ?? '').replace(/^remote-devices$/, 'ordinateur').replace(/_/g, ' ')
    const action = (mcp[2] ?? '').replace(/^Claude_Browser__/, 'navigateur ').replace(/_/g, ' ')
    return `${serveur} · ${action}`
  }
  const noms: Record<string, string> = {
    Bash: 'commande',
    Read: 'lecture de fichier',
    Write: 'écriture de fichier',
    Edit: 'modification de fichier',
    Glob: 'recherche de fichiers',
    Grep: 'recherche dans les fichiers',
    WebSearch: 'recherche web',
    WebFetch: 'lecture d’une page web',
    Agent: 'sous-agent',
    Skill: 'chargement d’une compétence',
    Artifact: 'publication',
    SendUserFile: 'envoi de fichier',
    AskUserQuestion: 'question posée',
    Projects: 'documents du projet',
  }
  return noms[outil] ?? outil
}

/** [██████░░░░] pour `faites` sur `total`. */
export function barre(faites: number, total: number, largeur = LARGEUR): string {
  const pleines = total === 0 ? 0 : Math.round((faites / total) * largeur)
  return '█'.repeat(pleines) + '░'.repeat(largeur - pleines)
}

/** Résumé d'une ligne, pour la ligne d'état. */
export function resume(liste: readonly Etape[]): string | undefined {
  if (liste.length === 0) return undefined
  const faites = liste.filter(t => t.statut === 'completed').length
  const active = liste.find(t => t.statut === 'in_progress')
  const suite = active ? ` · ${active.enCours ?? active.sujet}` : ''
  return `${barre(faites, liste.length, 10)} ${faites}/${liste.length}${suite}`
}

async function majEtat($: EngineInterface): Promise<void> {
  $.ui.status(resume(await read($, etapes)))
}

export const register: Register = on => {
  // Rend la tenue de la liste de tâches systématique.
  on('prompt.compose', async ($, e, next) => {
    const res = await next(e)
    if (!e.tools.includes('TaskCreate') && !e.tools.includes('TodoWrite')) return res
    return {
      sections: [...res.sections, { id: 'barre-progression:consigne', text: CONSIGNE, scope: 'session' }],
    }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, activite, () => ({ libelle: 'lecture de la demande', actions: 0 }))
    const liste = await read($, etapes)
    if (liste.length > 0 && liste.every(t => t.statut === 'completed')) {
      await update($, etapes, () => [])
      await majEtat($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    const id = ran.result.task.id
    const nouvelle: Etape = { id, sujet: e.subject, enCours: e.activeForm, statut: 'pending' }
    await update($, etapes, liste => {
      const base = liste.every(t => t.statut === 'completed') ? [] : liste
      return [...base, nouvelle]
    })
    await majEtat($)
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    const statut = e.status
    await update($, etapes, liste =>
      statut === 'deleted'
        ? liste.filter(t => t.id !== e.taskId)
        : liste.map((t): Etape =>
            t.id !== e.taskId
              ? t
              : {
                  ...t,
                  sujet: e.subject ?? t.sujet,
                  enCours: e.activeForm ?? t.enCours,
                  statut: statut ?? t.statut,
                },
          ),
    )
    await majEtat($)
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    await update($, etapes, () =>
      e.todos.map((t, i): Etape => ({ id: String(i), sujet: t.content, enCours: t.activeForm, statut: t.status })),
    )
    await majEtat($)
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const libelle = libelleOutil(e.tool)
    if (libelle !== null) {
      await update($, activite, a => ({ libelle, actions: (a?.actions ?? 0) + 1 }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const liste = await read($, etapes)
    const act: Activite | null = await read($, activite)
    const enTravail = e.props.isWorking

    if (liste.length === 0 && !enTravail) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const detail =
      act && enTravail ? (
        <Text dimColor>
          {'   '}dernière action : {act.libelle} · {act.actions} action{act.actions > 1 ? 's' : ''} ce tour
        </Text>
      ) : null

    if (liste.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">⏳ En cours</Text>
            <Text dimColor> · pas de liste d’étapes pour cette demande</Text>
          </Text>
          {detail}
        </Box>
      )
    }

    const faites = liste.filter(t => t.statut === 'completed').length
    const pct = Math.round((faites / liste.length) * 100)
    const active = liste.find(t => t.statut === 'in_progress')
    const fini = faites === liste.length

    return (
      <Box flexDirection="column">
        <Text>
          <Text color={fini ? 'green' : 'cyan'}>{barre(faites, liste.length)}</Text>
          <Text bold> {pct} %</Text>
          <Text dimColor>
            {' '}· étape {Math.min(faites + (active ? 1 : 0), liste.length)}/{liste.length}
          </Text>
        </Text>
        {fini ? (
          <Text color="green">✓ Toutes les étapes sont terminées</Text>
        ) : (
          <Text wrap="truncate-end">
            <Text color="cyan">▶ </Text>
            {active ? active.enCours ?? active.sujet : 'entre deux étapes'}
            {(() => {
              const suivante = liste.find(t => t.statut === 'pending')
              return suivante ? <Text dimColor> · ensuite : {suivante.sujet}</Text> : null
            })()}
          </Text>
        )}
        {detail}
      </Box>
    )
  })
}
