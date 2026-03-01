import React from 'react'

// ──────────────────────────────────────────────────────────────────────────────
// Pixel art constants
// ──────────────────────────────────────────────────────────────────────────────
const PX = 5 // 1 "pixel" = 5 CSS px

interface Rect { x: number; y: number; w?: number; h?: number; color: string }

// ── Robot body pixels (10 × 14 grid, origin top-left) ───────────────────────
const STATIC_PIXELS: Rect[] = [
  // ── Antenna ──
  { x: 4, y: 0, color: '#f59e0b' },
  { x: 4, y: 1, color: '#fbbf24' },
  // ── Head outline ──
  { x: 1, y: 2, color: '#6366f1' }, { x: 2, y: 2, color: '#6366f1' }, { x: 3, y: 2, color: '#6366f1' },
  { x: 4, y: 2, color: '#6366f1' }, { x: 5, y: 2, color: '#6366f1' }, { x: 6, y: 2, color: '#6366f1' },
  { x: 7, y: 2, color: '#6366f1' }, { x: 8, y: 2, color: '#6366f1' },
  { x: 1, y: 3, color: '#6366f1' }, { x: 2, y: 3, color: '#c7d2fe' }, { x: 3, y: 3, color: '#c7d2fe' },
  { x: 4, y: 3, color: '#c7d2fe' }, { x: 5, y: 3, color: '#c7d2fe' }, { x: 6, y: 3, color: '#c7d2fe' },
  { x: 7, y: 3, color: '#c7d2fe' }, { x: 8, y: 3, color: '#6366f1' },
  // ── Eyes row ──
  { x: 1, y: 4, color: '#6366f1' }, { x: 4, y: 4, color: '#c7d2fe' },
  { x: 5, y: 4, color: '#c7d2fe' }, { x: 8, y: 4, color: '#6366f1' },
  // ── Smile row ──
  { x: 1, y: 5, color: '#6366f1' }, { x: 2, y: 5, color: '#c7d2fe' },
  { x: 3, y: 5, color: '#818cf8' }, { x: 4, y: 5, color: '#818cf8' },
  { x: 5, y: 5, color: '#818cf8' }, { x: 6, y: 5, color: '#818cf8' },
  { x: 7, y: 5, color: '#c7d2fe' }, { x: 8, y: 5, color: '#6366f1' },
  // ── Head bottom ──
  { x: 1, y: 6, color: '#6366f1' }, { x: 2, y: 6, color: '#6366f1' }, { x: 3, y: 6, color: '#6366f1' },
  { x: 4, y: 6, color: '#6366f1' }, { x: 5, y: 6, color: '#6366f1' }, { x: 6, y: 6, color: '#6366f1' },
  { x: 7, y: 6, color: '#6366f1' }, { x: 8, y: 6, color: '#6366f1' },
  // ── Neck ──
  { x: 4, y: 7, color: '#4f46e5' }, { x: 5, y: 7, color: '#4f46e5' },
  // ── Body ──
  { x: 0, y: 8, color: '#4f46e5' }, { x: 1, y: 8, color: '#4f46e5' }, { x: 2, y: 8, color: '#4f46e5' },
  { x: 3, y: 8, color: '#4f46e5' }, { x: 4, y: 8, color: '#4f46e5' }, { x: 5, y: 8, color: '#4f46e5' },
  { x: 6, y: 8, color: '#4f46e5' }, { x: 7, y: 8, color: '#4f46e5' }, { x: 8, y: 8, color: '#4f46e5' },
  { x: 9, y: 8, color: '#4f46e5' },
  { x: 0, y: 9, color: '#4f46e5' }, { x: 1, y: 9, color: '#818cf8' }, { x: 2, y: 9, color: '#4f46e5' },
  { x: 3, y: 9, color: '#4f46e5' }, { x: 4, y: 9, color: '#4f46e5' }, { x: 5, y: 9, color: '#4f46e5' },
  { x: 6, y: 9, color: '#4f46e5' }, { x: 7, y: 9, color: '#4f46e5' }, { x: 8, y: 9, color: '#818cf8' },
  { x: 9, y: 9, color: '#4f46e5' },
  { x: 0, y: 10, color: '#4f46e5' }, { x: 1, y: 10, color: '#4f46e5' }, { x: 2, y: 10, color: '#4f46e5' },
  { x: 3, y: 10, color: '#4f46e5' }, { x: 4, y: 10, color: '#4f46e5' }, { x: 5, y: 10, color: '#4f46e5' },
  { x: 6, y: 10, color: '#4f46e5' }, { x: 7, y: 10, color: '#4f46e5' }, { x: 8, y: 10, color: '#4f46e5' },
  { x: 9, y: 10, color: '#4f46e5' },
  // ── Legs ──
  { x: 1, y: 11, color: '#4f46e5' }, { x: 2, y: 11, color: '#4f46e5' },
  { x: 7, y: 11, color: '#4f46e5' }, { x: 8, y: 11, color: '#4f46e5' },
  { x: 1, y: 12, color: '#6366f1' }, { x: 2, y: 12, color: '#6366f1' },
  { x: 7, y: 12, color: '#6366f1' }, { x: 8, y: 12, color: '#6366f1' },
  // ── Feet ──
  { x: 0, y: 13, color: '#818cf8' }, { x: 1, y: 13, color: '#818cf8' }, { x: 2, y: 13, color: '#818cf8' },
  { x: 7, y: 13, color: '#818cf8' }, { x: 8, y: 13, color: '#818cf8' }, { x: 9, y: 13, color: '#818cf8' },
]

// Eyes — animated separately (blink)
const LEFT_EYE:  Rect[] = [{ x: 2, y: 4, color: '#a5f3fc' }, { x: 3, y: 4, color: '#67e8f9' }]
const RIGHT_EYE: Rect[] = [{ x: 6, y: 4, color: '#a5f3fc' }, { x: 7, y: 4, color: '#67e8f9' }]
// Blink: solid colour row
const BLINK_EYE: Rect[] = [
  { x: 2, y: 4, color: '#6366f1' }, { x: 3, y: 4, color: '#6366f1' },
  { x: 6, y: 4, color: '#6366f1' }, { x: 7, y: 4, color: '#6366f1' },
]

// ── Sparkle positions (relative to robot top-left) ──────────────────────────
const SPARKLES = [
  { cx: -12, cy: 20, delay: 0,   color: '#f59e0b' },
  { cx:  62, cy: 10, delay: 300, color: '#a5f3fc' },
  { cx: -16, cy: 50, delay: 600, color: '#c084fc' },
  { cx:  66, cy: 55, delay: 150, color: '#6ee7b7' },
  { cx:  25, cy: -8, delay: 450, color: '#fb7185' },
]

// ── Pixel font letters (5×7 bitmap encoded as column bits LSB=top) ────────────
// We'll draw "AI THINKING..." using pre-made pixel rects for readability.

function PixelRobot({ blink }: { blink: boolean }) {
  const w = 10 * PX
  const h = 14 * PX

  const eyes = blink ? BLINK_EYE : [...LEFT_EYE, ...RIGHT_EYE]

  return (
    <svg
      width={w}
      height={h}
      style={{ imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {[...STATIC_PIXELS, ...eyes].map((p, i) => (
        <rect
          key={i}
          x={p.x * PX}
          y={p.y * PX}
          width={(p.w ?? 1) * PX}
          height={(p.h ?? 1) * PX}
          fill={p.color}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  )
}

// ── Pixel sparkle (4-point star) ─────────────────────────────────────────────
function PixelSparkle({ color, delay }: { color: string; delay: number }) {
  return (
    <svg
      width={7 * PX}
      height={7 * PX}
      className="pixel-sparkle"
      style={{
        animationDelay: `${delay}ms`,
        imageRendering: 'pixelated',
        position: 'absolute',
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 4-point star pattern */}
      {[
        { x: 3, y: 0 }, { x: 3, y: 1 },
        { x: 3, y: 5 }, { x: 3, y: 6 },
        { x: 0, y: 3 }, { x: 1, y: 3 },
        { x: 5, y: 3 }, { x: 6, y: 3 },
        { x: 2, y: 2 }, { x: 4, y: 2 },
        { x: 2, y: 4 }, { x: 4, y: 4 },
        { x: 3, y: 3 },
      ].map((p, i) => (
        <rect
          key={i}
          x={p.x * PX}
          y={p.y * PX}
          width={PX}
          height={PX}
          fill={color}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  )
}

// ── Dot loader ────────────────────────────────────────────────────────────────
const DOT_COLORS = ['#818cf8', '#a5b4fc', '#c7d2fe']

function PixelDots() {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {DOT_COLORS.map((color, i) => (
        <div
          key={i}
          className="pixel-dot"
          style={{
            width: PX * 2,
            height: PX * 2,
            background: color,
            imageRendering: 'pixelated',
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export function PixelLoadingOverlay() {
  const [blink, setBlink] = React.useState(false)
  const [msgIndex, setMsgIndex] = React.useState(0)

  const messages = [
    'AI THINKING...',
    'PARSING FLOW...',
    'BUILDING GRAPH...',
    'ALMOST DONE...',
  ]

  // Blink timer
  React.useEffect(() => {
    const id = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 120)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  // Cycle messages
  React.useEffect(() => {
    const id = setInterval(
      () => setMsgIndex((prev) => (prev + 1) % messages.length),
      1800
    )
    return () => clearInterval(id)
  }, [])

  const robotW = 10 * PX
  const robotH = 14 * PX

  return (
    <div
      className="pixel-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(9,9,11,0.82)',
        backdropFilter: 'blur(2px)',
        pointerEvents: 'all',
        cursor: 'wait',
        userSelect: 'none',
      }}
    >
      {/* ── Card ── */}
      <div
        style={{
          background: 'rgba(24,24,27,0.95)',
          border: '2px solid #6366f1',
          boxShadow: '0 0 0 1px #4f46e5, 0 0 24px 4px rgba(99,102,241,0.35)',
          padding: '32px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          imageRendering: 'pixelated',
          position: 'relative',
        }}
      >
        {/* Corner pixels */}
        {[
          { top: -2, left:  -2 }, { top: -2, right: -2 },
          { bottom: -2, left: -2 }, { bottom: -2, right: -2 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: PX,
              height: PX,
              background: '#a5b4fc',
              imageRendering: 'pixelated',
              ...pos,
            }}
          />
        ))}

        {/* ── Robot + sparkles ── */}
        <div
          className="pixel-robot-bounce"
          style={{
            position: 'relative',
            width: robotW,
            height: robotH,
            marginBottom: 20,
          }}
        >
          <PixelRobot blink={blink} />
          {SPARKLES.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: s.cx,
                top: s.cy,
              }}
            >
              <PixelSparkle color={s.color} delay={s.delay} />
            </div>
          ))}
        </div>

        {/* ── Status text ── */}
        <div
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: '#a5b4fc',
            textTransform: 'uppercase',
            textShadow: '0 0 8px rgba(165,180,252,0.7)',
            minWidth: 160,
            textAlign: 'center',
          }}
          className="pixel-text-cycle"
          key={msgIndex}
        >
          {messages[msgIndex]}
        </div>

        {/* ── Dot loader ── */}
        <PixelDots />
      </div>

      {/* ── Scan-line overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
