/**
 * PixelSpriteLoader – 16-bit スタイルのかわいいモノクロームローダー
 * ノート一覧の読み込み中に表示します
 */
import React from 'react'

// ピクセルサイズ（px）
const P = 5

// ゴーストのボディ色（インディゴ系）
const C_BODY = '#818cf8'  // indigo-400
const C_EYE  = '#1e1b4b'  // indigo-950（目の色）
const C_GLOW = '#4338ca'  // indigo-700（影・グロー）

// ─── ゴーストのピクセル座標 [col, row] ─────────────────────
// 7列 × 8行（1ピクセル = P px）
const BODY: [number, number][] = [
  // 頭頂部
  [2,0],[3,0],[4,0],
  // 頭
  [1,1],[2,1],[3,1],[4,1],[5,1],
  // 顔（目の列）
  [0,2],[1,2],/**left-eye*/ [3,2],[4,2],/**right-eye*/ [6,2],
  // 胴体
  [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
  [0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],
  [0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],
]

const EYES: [number, number][] = [
  [2,2],[5,2],
]

// フレーム1: 裾の波
const SKIRT_A: [number, number][] = [
  [0,6],[2,6],[4,6],[6,6],
]
// フレーム2: 裾の波（交互）
const SKIRT_B: [number, number][] = [
  [1,6],[3,6],[5,6],
]

// SVG の実サイズ
const W = 7 * P  // 35px
const H = 8 * P  // 40px

export function PixelSpriteLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 select-none pointer-events-none">

      {/* ゴーストスプライト（浮遊アニメ） */}
      <div className="pixel-float" style={{ lineHeight: 0 }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ imageRendering: 'pixelated' }}
        >
          {/* グロー（背景の淡い光） */}
          <ellipse
            cx={W / 2} cy={H - 4}
            rx={W / 2 - 2} ry={3}
            fill={C_GLOW}
            opacity={0.25}
          />

          {/* ボディ */}
          {BODY.map(([c, r]) => (
            <rect key={`b-${c}-${r}`} x={c * P} y={r * P} width={P} height={P} fill={C_BODY} />
          ))}

          {/* 目 */}
          {EYES.map(([c, r]) => (
            <rect key={`e-${c}-${r}`} x={c * P} y={r * P} width={P} height={P} fill={C_EYE} />
          ))}

          {/* 裾 フレームA（0,0.5s 表示） */}
          <g className="pixel-skirt-a">
            {SKIRT_A.map(([c, r]) => (
              <rect key={`sa-${c}-${r}`} x={c * P} y={r * P} width={P} height={P} fill={C_BODY} />
            ))}
          </g>

          {/* 裾 フレームB（0.5s ずらして表示） */}
          <g className="pixel-skirt-b">
            {SKIRT_B.map(([c, r]) => (
              <rect key={`sb-${c}-${r}`} x={c * P} y={r * P} width={P} height={P} fill={C_BODY} />
            ))}
          </g>
        </svg>
      </div>

      {/* 読み込み中ドット */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase pixel-text">
          LOADING
        </span>
        <span className="flex gap-1">
          <span className="pixel-dot" style={{ animationDelay: '0ms' }} />
          <span className="pixel-dot" style={{ animationDelay: '200ms' }} />
          <span className="pixel-dot" style={{ animationDelay: '400ms' }} />
        </span>
      </div>

      {/* ピクセルプログレスバー */}
      <div
        className="flex gap-px"
        style={{ imageRendering: 'pixelated' }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="pixel-bar-block"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
