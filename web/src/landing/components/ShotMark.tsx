// DUNKOMA shot wordmark. Adapted from David's COURT//INK shot animation (timing, ghost-ball arc, net snap, replay),
// with an original shooter (generated, not an existing manga character) and the ball landing as the "O".
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const T = 1.6 // seconds, whole shot
const ART = '/hero-shot/'

// Shooter art is 439×1296; ball sits at (191, 56) in the "hold" frame.
const SH = { x: 30, y: 26, h: 500 }
const s = SH.h / 1296
const SH_W = 439 * s
const BALL = { x: SH.x + 191 * s, y: SH.y + 56 * s, size: 52 }

// Hoop floats above the "O" slot of the wordmark; the ball drops through and becomes the O.
const O = { x: 724, y: 430, size: 172 }
const RIM = { x: O.x, y: 238 }
const CTRL = { x: 420, y: -150 }
const ARC = `M${BALL.x} ${BALL.y} Q${CTRL.x} ${CTRL.y} ${RIM.x} ${RIM.y}`
const at = (t: number) => ({
  x: (1 - t) ** 2 * BALL.x + 2 * t * (1 - t) * CTRL.x + t ** 2 * RIM.x,
  y: (1 - t) ** 2 * BALL.y + 2 * t * (1 - t) * CTRL.y + t ** 2 * RIM.y,
})
// Discrete manga "time-lapse" exposures along the arc (David's ghost balls)
const GHOSTS = [0.17, 0.33, 0.5, 0.66, 0.82].map((t, i) => ({ ...at(t), rot: 30 + i * 34, start: 0.18 + i * 0.13 }))

const WORD = { size: 250, baseline: 515 }

export function ShotMark() {
  const reduced = useReducedMotion() ?? false
  const [run, setRun] = useState(0)
  const d = (v: number) => (reduced ? 0 : v)

  return (
    <div className="relative w-full">
      <svg
        key={run}
        viewBox="0 0 1080 540"
        className="block h-auto max-h-[58vh] w-full overflow-visible"
        role="img"
        aria-label="Dunkoma: a player shoots, the ball arcs into the hoop and drops in as the O of DUNKOMA"
      >
        {/* floor line under the shooter */}
        <line x1="20" y1="528" x2="230" y2="528" stroke="var(--ink)" strokeWidth="3" strokeLinecap="square" opacity="0.25" />
        <ellipse cx={SH.x + SH_W / 2} cy="528" rx="70" ry="8" fill="var(--ink)" opacity="0.14" />

        {/* wordmark around the O slot */}
        <text x={O.x - O.size / 2 - 8} y={WORD.baseline} textAnchor="end" fontFamily="var(--font-display)" fontSize={WORD.size} fill="var(--ink)">
          DUNK
        </text>
        <text x={O.x + O.size / 2 + 8} y={WORD.baseline} fontFamily="var(--font-display)" fontSize={WORD.size} fill="var(--ink)">
          MA
        </text>

        {/* shot trail: thick ink stroke + dashed speed line along the arc */}
        <motion.path
          d={ARC}
          pathLength={1}
          stroke="var(--ink)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray="1"
          fill="none"
          opacity={0.9}
          initial={{ strokeDashoffset: reduced ? 0 : 1 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: d(0.76), delay: d(0.32), ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={`M${BALL.x + 40} ${BALL.y + 34} Q${CTRL.x + 30} ${CTRL.y + 70} ${RIM.x - 40} ${RIM.y - 30}`}
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeDasharray="8 10"
          fill="none"
          initial={{ strokeDashoffset: reduced ? 0 : 320, opacity: reduced ? 0.45 : 0 }}
          animate={{ strokeDashoffset: 0, opacity: 0.45 }}
          transition={{ duration: d(0.85), delay: d(0.21), ease: 'easeOut' }}
        />

        {/* hoop: backboard + rim + net (net snaps when the ball goes through) */}
        <g>
          <rect x={RIM.x - 64} y={RIM.y - 96} width="128" height="86" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5.5" />
          <rect x={RIM.x - 26} y={RIM.y - 62} width="52" height="40" fill="none" stroke="var(--ink)" strokeWidth="3.5" />
          <rect x={RIM.x - 4} y={RIM.y - 10} width="8" height="10" fill="var(--ink)" />
          <motion.g
            style={{ transformOrigin: `${RIM.x}px ${RIM.y}px` }}
            animate={reduced ? undefined : { scaleY: [1, 1, 1.26, 0.9, 1.07, 1], scaleX: [1, 1, 0.86, 1.1, 0.97, 1] }}
            transition={{ duration: T, times: [0, 0.8, 0.85, 0.9, 0.95, 1], ease: 'easeOut' }}
          >
            <path d={`M${RIM.x - 40} ${RIM.y} L${RIM.x - 28} ${RIM.y + 58} L${RIM.x + 28} ${RIM.y + 58} L${RIM.x + 40} ${RIM.y} Z`} fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
            <path
              d={`M${RIM.x - 30} ${RIM.y} L${RIM.x - 12} ${RIM.y + 58} M${RIM.x} ${RIM.y} L${RIM.x} ${RIM.y + 58} M${RIM.x + 30} ${RIM.y} L${RIM.x + 12} ${RIM.y + 58} M${RIM.x - 37} ${RIM.y + 20} L${RIM.x + 37} ${RIM.y + 20} M${RIM.x - 33} ${RIM.y + 40} L${RIM.x + 33} ${RIM.y + 40}`}
              stroke="var(--ink)"
              strokeWidth="2.2"
            />
          </motion.g>
          <line x1={RIM.x - 48} y1={RIM.y} x2={RIM.x + 48} y2={RIM.y} stroke="var(--ink)" strokeWidth="8.5" strokeLinecap="round" />
        </g>

        {/* shooter: holding frame → release frame as the ball leaves his hands */}
        <motion.g initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: d(0.22), ease: 'easeOut' }}>
          <motion.image
            href={`${ART}shooter-release.png`}
            x={SH.x}
            y={SH.y}
            width={SH_W}
            height={SH.h}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: reduced ? 1 : [0, 0, 1, 1] }}
            transition={{ duration: d(T), times: [0, 0.17, 0.23, 1], ease: 'easeInOut' }}
          />
          <motion.image
            href={`${ART}shooter-hold.png`}
            x={SH.x}
            y={SH.y}
            width={SH_W}
            height={SH.h}
            initial={{ opacity: reduced ? 0 : 1 }}
            animate={{ opacity: reduced ? 0 : [1, 1, 0, 0] }}
            transition={{ duration: d(T), times: [0, 0.18, 0.24, 1], ease: 'easeInOut' }}
          />
        </motion.g>

        {/* ghost balls stepping along the arc */}
        {!reduced &&
          GHOSTS.map((g, i) => (
            <motion.g
              key={i}
              style={{ transformOrigin: `${g.x}px ${g.y}px` }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: [0, 0, 0.92, 0.75, 0], scale: [0.92, 0.92, 1, 0.98, 0.94] }}
              transition={{ duration: T, times: [0, g.start, g.start + 0.08, g.start + 0.16, Math.min(0.96, g.start + 0.3)], ease: 'easeInOut' }}
            >
              <image href={`${ART}ball.png`} x={g.x - BALL.size / 2} y={g.y - BALL.size / 2} width={BALL.size} height={BALL.size} transform={`rotate(${g.rot} ${g.x} ${g.y})`} />
            </motion.g>
          ))}

        {/* the ball drops through the net and grows into the O */}
        <motion.g
          style={{ transformOrigin: `${O.x}px ${O.y}px` }}
          initial={reduced ? false : { opacity: 0, y: RIM.y - O.y, scale: BALL.size / O.size }}
          animate={
            reduced
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: [0, 0, 1, 1, 1, 1], y: [RIM.y - O.y, RIM.y - O.y, RIM.y - O.y + 40, 12, -6, 0], scale: [0.3, 0.3, 0.3, 1.04, 0.98, 1] }
          }
          transition={{ duration: d(T), times: [0, 0.8, 0.84, 0.92, 0.96, 1], ease: 'easeOut' }}
        >
          <image href={`${ART}ball.png`} x={O.x - O.size / 2} y={O.y - O.size / 2} width={O.size} height={O.size} />
        </motion.g>

        {/* SWISH! シュッ */}
        <motion.g
          style={{ transformOrigin: `${RIM.x + 170}px ${RIM.y - 70}px` }}
          initial={reduced ? false : { opacity: 0, scale: 0.45, y: 12 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: [0, 0, 1, 1], scale: [0.45, 0.45, 1.15, 1], y: [12, 12, -3, 0] }}
          transition={{ duration: d(T), times: [0, 0.84, 0.92, 1], ease: 'easeOut' }}
        >
          <text x={RIM.x + 82} y={RIM.y - 58} fill="var(--accent)" stroke="var(--ink)" strokeWidth="3" paintOrder="stroke" fontFamily="var(--font-display)" fontSize="62" transform={`rotate(-8 ${RIM.x + 82} ${RIM.y - 58})`}>
            SWISH!
          </text>
          <text x={RIM.x + 120} y={RIM.y - 14} fontFamily="var(--font-sfx-jp)" fontSize="26" fill="var(--ink)" transform={`rotate(-8 ${RIM.x + 120} ${RIM.y - 14})`}>
            シュッ
          </text>
        </motion.g>
      </svg>

      {!reduced && (
        <button type="button" onClick={() => setRun((n) => n + 1)} className="mono mt-2 ml-auto block border-2 border-ink bg-paper px-2 py-1 shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          ↻ replay shot
        </button>
      )}
    </div>
  )
}
