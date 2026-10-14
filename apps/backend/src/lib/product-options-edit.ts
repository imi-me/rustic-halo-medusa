export type WorkspaceOption = { id?: string; title: string; is_exclusive?: boolean; values: { id?: string; value: string }[] }
export function optionsSnapshot(options: WorkspaceOption[]) {
  return JSON.stringify(options.map(option => ({ id: option.id, title: option.title, is_exclusive: option.is_exclusive, values: option.values.map(value => ({ id: value.id, value: value.value })).sort((a, b) => String(a.id).localeCompare(String(b.id))) })).sort((a, b) => String(a.id).localeCompare(String(b.id))))
}
export function optionsChanges(original: WorkspaceOption[], draft: WorkspaceOption[]) {
  const names = draft.map(option => option.title.trim().toLowerCase())
  if (names.some(name => !name) || new Set(names).size !== names.length) throw new Error('Use a different name for each option.')
  const add: any[] = [], update: any[] = []
  for (const option of draft) {
    const labels = option.values.map(value => value.value.trim())
    if (!labels.length || labels.some(value => !value) || new Set(labels.map(value => value.toLowerCase())).size !== labels.length) throw new Error('Each option needs different, non-empty values.')
    const before = original.find(row => row.id === option.id)
    if (!option.id) { add.push({ title: option.title.trim(), is_exclusive: true, values: labels, ranks: Object.fromEntries(labels.map((label, index) => [label, index + 1])) }); continue }
    if (!before) { add.push({ id: option.id, value_ids: option.values.map(value => value.id) }); continue }
    if (before.title !== option.title) throw new Error('Existing option names are managed in the shared option catalog.')
    const removed = before.values.filter(value => !option.values.some(row => row.id === value.id)).map(value => value.id)
    const added = option.values.filter(value => !value.id).map(value => ({ value: value.value.trim() }))
    if (added.length && !before.is_exclusive) throw new Error('Add values to shared options in the option catalog.')
    if (removed.length || added.length) update.push({ product_option_id: option.id, add: added, remove: removed })
  }
  return { add, update, remove: original.filter(option => !draft.some(row => row.id === option.id)).map(option => option.id!) }
}
