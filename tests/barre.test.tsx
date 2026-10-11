import { expect, test } from 'claude-code/testing'

import { barre, libelleOutil, resume } from '../hooks/register'

const BAND = {
  plugin: 'barre-progression',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('la barre et le résumé comptent les étapes faites', () => {
  expect(barre(2, 4, 10)).toBe('█████░░░░░')
  expect(barre(0, 0, 4)).toBe('░░░░')
  expect(resume([])).toBeUndefined()
  expect(
    resume([
      { id: '1', sujet: 'A', statut: 'completed' },
      { id: '2', sujet: 'B', enCours: 'Écrit B', statut: 'in_progress' },
    ]),
  ).toBe('█████░░░░░ 1/2 · Écrit B')
  expect(libelleOutil('WebSearch')).toBe('recherche web')
  expect(libelleOutil('TaskUpdate')).toBeNull()
  expect(libelleOutil('mcp__nergie_SOFRILOG__requete_flux')).toBe('nergie SOFRILOG · requete flux')
})

test('les étapes créées puis terminées font avancer la barre', async ($, on) => {
  let n = 0
  on('tool.call', { tool: 'TaskCreate' }, ($, e) => {
    n += 1
    return { result: { task: { id: String(n), subject: e.subject } } }
  })
  on('tool.call', { tool: 'TaskUpdate' }, ($, e) => ({
    result: { success: true, taskId: e.taskId, updatedFields: ['status'] },
  }))

  await $.tool.call({ tool: 'TaskCreate', subject: 'Lire les fichiers', description: 'd', activeForm: 'Lecture des fichiers' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Corriger', description: 'd' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /0 %/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Lecture des fichiers/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ensuite : Corriger/ })).toBeDefined()
    await ui.unmount()
  }

  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /50 %/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /étape 2\/2/ })).toBeDefined()
  await ui.unmount()

  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'completed' })
  const fin = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: false } })
  expect(await fin.find({ type: 'Text', text: /terminées/ })).toBeDefined()
  await fin.unmount()
})

test('sans liste d’étapes, la bande montre la dernière action', async ($, on) => {
  on('tool.call', { tool: 'WebSearch' }, () => ({ result: { query: 'x', results: [], durationSeconds: 0 } }))
  await $.prompt.submit({ text: 'question' } as never).catch(() => undefined)
  await $.tool.call({ tool: 'WebSearch', query: 'tarif', mode: 'standard' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /En cours/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /recherche web/ })).toBeDefined()
  await ui.unmount()
})
