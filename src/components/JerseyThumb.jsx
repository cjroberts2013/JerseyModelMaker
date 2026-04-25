/**
 * Stylized SVG thumbnail of a framed jersey, used on the gallery tiles.
 * Mirrors the actual model: curved shoulders, sleeve stripes, recessed name
 * plate, large number on the body. Player name and full name render the
 * model's actual override values rather than placeholders.
 */
export default function JerseyThumb({ header, playerName, number, fullName, jersey, accent }) {
  const headerLines = String(header).split(/\r?\n/)
  const fullNameLines = String(fullName).split(/\r?\n/)
  // Color to use for the name/number text: light against dark jerseys, dark against light.
  const ink = isLight(jersey) ? '#1a1a1a' : '#f5f5f5'

  return (
    <div className="w-full h-full bg-neutral-200 rounded-md shadow-inner flex flex-col items-stretch px-2 pt-2 pb-1.5 relative overflow-hidden border-[3px] border-black">
      {/* Team name */}
      <div className="text-[10px] font-extrabold text-black text-center leading-[1.05] tracking-tight uppercase">
        {headerLines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      {/* Jersey artwork */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <svg viewBox="0 0 120 130" className="w-[88%] h-auto">
          {/* Main jersey body — curved shoulders, slight body taper, rounded hem */}
          <path
            d={[
              'M 50 6',                           // left of collar dip
              'Q 60 4 70 6',                      // collar curve
              'Q 80 8 88 14',                     // right shoulder
              'L 116 30',                         // sleeve tip
              'Q 117 38 113 44',                  // sleeve cuff curve out
              'L 96 38',                          // sleeve cuff inner
              'L 96 116',                         // body right side
              'Q 96 124 86 124',                  // hem right
              'L 34 124',
              'Q 24 124 24 116',                  // hem left
              'L 24 38',
              'L 7 44',                           // sleeve cuff inner left
              'Q 3 38 4 30',                      // sleeve cuff curve out left
              'L 32 14',                          // left shoulder
              'Q 40 8 50 6 Z',                    // close
            ].join(' ')}
            fill={jersey}
            stroke={accent}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Sleeve stripes (left + right) */}
          <g stroke={accent} strokeWidth="1.4" fill="none">
            <line x1="6"   y1="36" x2="22"  y2="30" />
            <line x1="8"   y1="40" x2="22"  y2="34" />
            <line x1="114" y1="36" x2="98"  y2="30" />
            <line x1="112" y1="40" x2="98"  y2="34" />
          </g>
          {/* Recessed name plate */}
          <rect
            x="38" y="36" width="44" height="14"
            rx="1.5" ry="1.5"
            fill="rgba(255,255,255,0.18)"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.6"
          />
          {/* Player name */}
          <text
            x="60" y="46.5"
            fontSize={fitFontSize(playerName, 38, 9)}
            fill={ink}
            fontFamily="'Arial Black', 'Helvetica Neue', sans-serif"
            fontWeight="900"
            letterSpacing="-0.3"
            textAnchor="middle"
          >
            {String(playerName).toUpperCase()}
          </text>
          {/* Player number */}
          <text
            x="60" y="92"
            fontSize="36"
            fill={ink}
            fontFamily="'Arial Black', 'Helvetica Neue', sans-serif"
            fontWeight="900"
            letterSpacing="-1.5"
            textAnchor="middle"
          >
            {number}
          </text>
        </svg>
      </div>

      {/* Full name at bottom-left of the matte */}
      <div className="text-[8px] font-extrabold text-black leading-[1.05] uppercase pl-1">
        {fullNameLines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  )
}

/** Quick visual luminance check so name/number text contrasts the jersey. */
function isLight(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '')
  if (!m) return false
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16)
  // Rec.601 luma; > 160 → treat as light
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

/**
 * Shrink the player-name font size for long names so it stays inside the
 * 44-unit-wide name plate. `max` is the comfortable size for a 6-letter name.
 */
function fitFontSize(text, plateWidth, max) {
  const len = String(text || '').length
  if (len <= 6) return max
  // Heuristic: each char beyond 6 trims ~0.5 units, capped at 6.
  return Math.max(max - (len - 6) * 0.6, 5.5)
}
