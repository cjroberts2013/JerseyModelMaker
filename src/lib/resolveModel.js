/**
 * Merges a model's template with its per-team overrides into a single
 * flattened object shaped like the old models.json entries.
 *
 * Template defines the shared STL parts and text zones; each team model
 * references a template id and supplies textOverrides / colorOverrides.
 */
export function resolveModel(modelEntry, templates) {
  if (!modelEntry) return null
  const template = templates.find((t) => t.id === modelEntry.template)
  if (!template) {
    console.warn(`Unknown template: ${modelEntry.template}`)
    return null
  }

  const colorOverrides = modelEntry.colorOverrides || {}
  const parts = template.parts.map((p) => ({
    ...p,
    defaultColor: colorOverrides[p.id] ?? p.defaultColor,
  }))

  const textOverrides = modelEntry.textOverrides || {}
  const textZones = template.textZones.map((z) => ({
    ...z,
    ...(textOverrides[z.id] || {}),
  }))

  return {
    id: modelEntry.id,
    name: modelEntry.name,
    category: modelEntry.category,
    subtitle: modelEntry.subtitle,
    thumb: modelEntry.thumb,
    parts,
    textZones,
  }
}

export function listGalleryEntries(models) {
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    subtitle: m.subtitle,
    thumb: m.thumb,
    textOverrides: m.textOverrides,
  }))
}
