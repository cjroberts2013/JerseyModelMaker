/**
 * Merges a model's template with its per-team overrides into a single
 * flattened object shaped like the old models.json entries.
 *
 * Template defines the shared base STL parts (frame, matte, background,
 * stand), the text zones, and an array of jersey styles. Each team model
 * references a template id and supplies textOverrides / colorOverrides
 * plus an optional `defaultStyle` selecting which jersey style to load
 * initially. The viewer renders base parts + the active style's parts.
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

  // Apply color overrides into each style's parts as well, so when a user
  // picks a style its initial jersey color reflects the team's palette.
  const jerseyStyles = (template.jerseyStyles || []).map((style) => ({
    ...style,
    parts: style.parts.map((p) => ({
      ...p,
      defaultColor: colorOverrides[p.id] ?? p.defaultColor,
    })),
  }))

  // Resolve the active style id: explicit team default, else first style.
  const defaultStyleId =
    modelEntry.defaultStyle && jerseyStyles.find((s) => s.id === modelEntry.defaultStyle)
      ? modelEntry.defaultStyle
      : jerseyStyles[0]?.id || null

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
    jerseyStyles,
    defaultStyleId,
    textZones,
  }
}

/**
 * Returns the parts list to render for a given style id.
 * Falls back to the first style if id is unknown.
 */
export function getStyleParts(model, styleId) {
  if (!model?.jerseyStyles?.length) return []
  const style =
    model.jerseyStyles.find((s) => s.id === styleId) || model.jerseyStyles[0]
  return style.parts
}

export function listGalleryEntries(models) {
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    subtitle: m.subtitle,
    thumb: m.thumb,
    defaultStyle: m.defaultStyle,
    textOverrides: m.textOverrides,
  }))
}
