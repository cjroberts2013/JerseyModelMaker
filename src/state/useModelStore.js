import { create } from 'zustand'

/**
 * Zustand store for editor state.
 * partColors: { [partId]: "#rrggbb" }
 * textConfigs: { [zoneId]: { text, fontName, size, depth, spacing, align, color, embed } }
 * jerseyStyleId: id of the active jersey style for this model
 */
export const useModelStore = create((set) => ({
  modelId: null,
  partColors: {},
  textConfigs: {},
  exportScale: 1,
  jerseyStyleId: null,

  initFromModel: (model, fonts) => {
    const partColors = {}
    // Seed colors from base parts first, then from the active style's parts.
    model.parts.forEach((p) => {
      partColors[p.id] = p.defaultColor
    })
    const activeStyle =
      model.jerseyStyles?.find((s) => s.id === model.defaultStyleId) ||
      model.jerseyStyles?.[0]
    activeStyle?.parts?.forEach((p) => {
      partColors[p.id] = p.defaultColor
    })
    const textConfigs = {}
    model.textZones.forEach((z) => {
      // fontName matches a `name` in /fonts.json; fall back to the first font.
      const fallback = fonts[0]?.name
      textConfigs[z.id] = {
        text: z.defaultText,
        fontName: z.defaultFont || fallback,
        size: z.defaultSize,
        depth: z.defaultDepth,
        spacing: z.defaultSpacing,
        lineSpacing: z.defaultLineSpacing ?? 0,
        align: z.defaultAlign || 'center',
        color: z.defaultColor,
        embed: z.defaultEmbed ?? 0,
        // Offsets (mm) in surface-local X (right) and Y (up) space.
        offsetX: z.defaultOffsetX ?? 0,
        offsetY: z.defaultOffsetY ?? 0,
      }
    })
    set({
      modelId: model.id,
      partColors,
      textConfigs,
      exportScale: 1,
      jerseyStyleId: activeStyle?.id || null,
    })
  },

  setPartColor: (partId, color) =>
    set((state) => ({
      partColors: { ...state.partColors, [partId]: color },
    })),

  setJerseyStyle: (styleId, model) =>
    set((state) => {
      // When switching styles, seed any new style-part colors with their
      // defaults but keep colors the user already set for shared part ids
      // (e.g. "jersey" stays whatever they picked).
      const style = model?.jerseyStyles?.find((s) => s.id === styleId)
      if (!style) return { jerseyStyleId: styleId }
      const partColors = { ...state.partColors }
      style.parts.forEach((p) => {
        if (!(p.id in partColors)) partColors[p.id] = p.defaultColor
      })
      return { jerseyStyleId: styleId, partColors }
    }),

  setTextField: (zoneId, field, value) =>
    set((state) => ({
      textConfigs: {
        ...state.textConfigs,
        [zoneId]: { ...state.textConfigs[zoneId], [field]: value },
      },
    })),

  setExportScale: (scale) => set({ exportScale: scale }),
}))
