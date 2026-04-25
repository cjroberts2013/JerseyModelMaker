import { create } from 'zustand'

/**
 * Zustand store for editor state.
 * partColors: { [partId]: "#rrggbb" }
 * textConfigs: { [zoneId]: { text, fontName, size, depth, spacing, align, color, embed } }
 */
export const useModelStore = create((set) => ({
  modelId: null,
  partColors: {},
  textConfigs: {},
  exportScale: 1,

  initFromModel: (model, fonts) => {
    const partColors = {}
    model.parts.forEach((p) => {
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
    set({ modelId: model.id, partColors, textConfigs, exportScale: 1 })
  },

  setPartColor: (partId, color) =>
    set((state) => ({
      partColors: { ...state.partColors, [partId]: color },
    })),

  setTextField: (zoneId, field, value) =>
    set((state) => ({
      textConfigs: {
        ...state.textConfigs,
        [zoneId]: { ...state.textConfigs[zoneId], [field]: value },
      },
    })),

  setExportScale: (scale) => set({ exportScale: scale }),
}))
