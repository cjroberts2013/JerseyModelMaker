import { create } from 'zustand'

/**
 * Zustand store for editor state.
 *
 * partColors: { [partId or accentSlotId]: "#rrggbb" }
 *   Single-material color per part (legacy / STL fallback path).
 *
 * colorPalettes: { [partId]: [{ originalColor, currentColor, vertexCount }] }
 *   Vertex-color palette extracted from FBX/GLB models with painted accents.
 *   When present, ModelViewer renders that part with vertexColors:true and
 *   ColorEditor surfaces one swatch per palette entry. Initialized by
 *   setColorPalette() once the geometry has loaded; mutated by
 *   setPaletteColor() when the user picks a swatch.
 *
 * globalTextColor: "#rrggbb" or null
 *   Single color applied to every text zone (matches PressPrint's "Text
 *   Color — Applies to all texts" UI). When null each zone keeps its
 *   per-zone color from textConfigs.
 *
 * textConfigs: { [zoneId]: { text, fontName, size, depth, spacing, align, color, embed } }
 * jerseyStyleId: id of the active jersey style for this model
 * partSlots: { [partId]: number } — connected-component sub-mesh count for
 *   splitColors parts (legacy STL multi-piece path).
 */
export const useModelStore = create((set) => ({
  modelId: null,
  partColors: {},
  colorPalettes: {},
  globalTextColor: null,
  textConfigs: {},
  exportScale: 1,
  jerseyStyleId: null,
  partSlots: {},

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
      // Clear old slot counts; they'll get repopulated as PartMesh splits
      // each part on the new style.
      partSlots: {},
      // Reset palettes; PartMesh will populate them as it extracts colors
      // from each newly loaded geometry.
      colorPalettes: {},
      globalTextColor: null,
    })
  },

  setPartColor: (partId, color) =>
    set((state) => ({
      partColors: { ...state.partColors, [partId]: color },
    })),

  setPartSlots: (partId, count) =>
    set((state) => {
      if (state.partSlots[partId] === count) return state
      return { partSlots: { ...state.partSlots, [partId]: count } }
    }),

  /** Initialize a part's vertex-color palette (called by PartMesh once the
   *  geometry has loaded and we've scanned it). Each entry is
   *  `{ originalColor, currentColor, vertexCount, _linearOriginal }`. */
  setColorPalette: (partId, palette) =>
    set((state) => {
      // No-op if the same palette is already in place — saves rerenders
      // when geometries reload.
      const existing = state.colorPalettes[partId]
      if (existing && existing.length === palette.length) {
        const same = existing.every(
          (e, i) =>
            e.originalColor === palette[i].originalColor &&
            e.currentColor === palette[i].currentColor,
        )
        if (same) return state
      }
      return { colorPalettes: { ...state.colorPalettes, [partId]: palette } }
    }),

  /** User picked a new color for one swatch in a part's palette. Updates
   *  the entry's `currentColor`; the viewer side reads the palette and
   *  reapplies it to the GL buffer. */
  setPaletteColor: (partId, index, color) =>
    set((state) => {
      const palette = state.colorPalettes[partId]
      if (!palette || !palette[index]) return state
      const next = palette.map((e, i) =>
        i === index ? { ...e, currentColor: color } : e,
      )
      return { colorPalettes: { ...state.colorPalettes, [partId]: next } }
    }),

  /** Single text color applied to all text zones; null clears the override. */
  setGlobalTextColor: (color) => set({ globalTextColor: color }),

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
