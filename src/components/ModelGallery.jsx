import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import data from '../data/models.json'
import JerseyThumb3D from './JerseyThumb3D.jsx'
import { assetUrl } from '../lib/assetUrl.js'

export default function ModelGallery() {
  const navigate = useNavigate()
  const [fontCatalog, setFontCatalog] = useState(null)

  useEffect(() => {
    // Pull the font catalog so each tile knows where to find its TTF.
    fetch(assetUrl('/fonts.json'))
      .then((r) => r.json())
      .then((data) => {
        const map = new Map((data.fonts || []).map((f) => [f.name, f]))
        setFontCatalog(map)
      })
      .catch((err) => console.error('failed to load fonts.json for gallery', err))
  }, [])

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">ModelMaker</h1>
          <p className="text-slate-400 text-sm mt-1">
            Pick a template to customize and 3D print.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {data.models.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/editor/${m.id}`)}
              className="text-left bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden transition hover:border-indigo-500 hover:-translate-y-0.5"
            >
              <div
                className="aspect-[3/4]"
                style={{ background: 'radial-gradient(circle at center, #2a2255 0%, #1a1438 70%)' }}
              >
                <JerseyThumb3D
                  colorOverrides={m.colorOverrides || {}}
                  textOverrides={m.textOverrides || {}}
                  fontCatalog={fontCatalog}
                />
              </div>
              <div className="p-3">
                <div className="text-xs inline-block px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-200 mb-2">
                  📅 {m.category || 'Template'}
                </div>
                <div className="text-sm font-semibold text-white">{m.name}</div>
                <div className="text-xs text-slate-400 mb-2">{m.subtitle}</div>
                <div className="inline-block text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300">
                  ✎ Editable
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
