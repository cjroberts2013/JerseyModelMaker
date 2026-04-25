/**
 * Resolve a path under Vite's base URL. In dev `import.meta.env.BASE_URL`
 * is "/", in production builds for GitHub Pages it is "/JerseyModelMaker/".
 * Accepts paths with or without a leading slash.
 */
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL || '/'
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const trimmedPath = path.startsWith('/') ? path : '/' + path
  return trimmedBase + trimmedPath
}
