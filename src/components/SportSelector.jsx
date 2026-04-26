import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import data from '../data/models.json'

const SPORTS = [
  {
    id: 'nfl',
    label: 'NFL',
    title: 'Football',
    accent: 'from-blue-700 to-indigo-900',
    icon: '🏈',
  },
  {
    id: 'mlb',
    label: 'MLB',
    title: 'Baseball',
    accent: 'from-red-700 to-rose-900',
    icon: '⚾',
  },
]

export default function SportSelector() {
  const navigate = useNavigate()

  // Show a small preview count of how many teams are available per sport.
  const counts = useMemo(() => {
    const by = {}
    for (const m of data.models) {
      const k = (m.category || '').toUpperCase()
      by[k] = (by[k] || 0) + 1
    }
    return by
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">ModelMaker</h1>
          <p className="text-slate-400 mt-2">Choose a sport to start customizing.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SPORTS.map((s) => {
            const count = counts[s.label] || 0
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/sport/${s.id}`)}
                className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br ${s.accent} p-8 text-left transition hover:-translate-y-1 hover:border-indigo-400`}
              >
                <div className="text-5xl mb-4">{s.icon}</div>
                <div className="text-xs uppercase tracking-wider text-white/70">{s.label}</div>
                <div className="text-2xl font-bold text-white mt-1">{s.title}</div>
                <div className="text-sm text-white/80 mt-3">
                  {count} {count === 1 ? 'team' : 'teams'} available
                </div>
                <div className="absolute bottom-4 right-4 text-white/60 text-sm group-hover:text-white">
                  →
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
