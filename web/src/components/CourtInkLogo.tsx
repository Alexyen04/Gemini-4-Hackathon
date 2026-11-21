import { motion, useReducedMotion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

const SHOT_DURATION = 3.1

// Discrete manga time-lapse / "teleporting" ball exposures along the shot arc
// from the static ball in the player's hands (~376, 62) toward the hoop "I" (868, 150)
const ghostBalls = [
  { x: 468, y: 38, rot: 22, start: 0.18 },
  { x: 564, y: 18, rot: 54, start: 0.31 },
  { x: 664, y: 22, rot: 88, start: 0.44 },
  { x: 756, y: 50, rot: 122, start: 0.57 },
  { x: 828, y: 100, rot: 156, start: 0.7 },
]

const BALL_SIZE = 54

export function CourtInkLogo() {
  const reduced = useReducedMotion()
  const [run, setRun] = useState(0)

  const replay = () => setRun((count) => count + 1)

  const T = SHOT_DURATION

  return (
    <div className="cover-stage">
      <svg
        key={run}
        className="cover-svg"
        viewBox="0 0 1200 545"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="COURT//INK — Slam Dunk style anime basketball player holding the ball while fading manga basketball frames arc into the hoop I"
      >
        {/* Subtle manga court horizon & floor baseline */}
        <line x1="20" y1="322" x2="1180" y2="322" stroke="#0a0a0a" strokeWidth="2.4" strokeDasharray="10 8" opacity="0.14" />
        <line x1="210" y1="534" x2="520" y2="534" stroke="#0a0a0a" strokeWidth="2.8" strokeLinecap="round" opacity="0.2" />

        {/* Giant COURT wordmark */}
        <text
          x="18"
          y="314"
          fill="#0a0a0a"
          fontFamily="'Anton', Impact, sans-serif"
          fontSize="214"
          letterSpacing="-4"
        >
          COURT
        </text>

        {/* Curved "//" Shot Trajectory Paths — drawn smoothly as the fading manga balls step across the gap */}
        <motion.path
          d="M520 288 Q592 92 758 58"
          pathLength={1}
          stroke="#0a0a0a"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray="1"
          fill="none"
          initial={{ strokeDashoffset: reduced ? 0 : 1, opacity: reduced ? 1 : 0 }}
          animate={{ strokeDashoffset: 0, opacity: 1 }}
          transition={{
            strokeDashoffset: { duration: reduced ? 0 : 1.35, delay: reduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.1, delay: reduced ? 0 : 0.64 },
          }}
        />
        <motion.path
          d="M576 308 Q648 114 804 78"
          pathLength={1}
          stroke="#0a0a0a"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray="1"
          fill="none"
          initial={{ strokeDashoffset: reduced ? 0 : 1, opacity: reduced ? 1 : 0 }}
          animate={{ strokeDashoffset: 0, opacity: 1 }}
          transition={{
            strokeDashoffset: { duration: reduced ? 0 : 1.35, delay: reduced ? 0 : 0.78, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.1, delay: reduced ? 0 : 0.77 },
          }}
        />

        {/* Crisp manga speed-line dash hugging the shot curve */}
        <motion.path
          d="M452 56 Q652 -4 838 92"
          stroke="#0a0a0a"
          strokeWidth="2.4"
          strokeDasharray="8 10"
          strokeLinecap="round"
          fill="none"
          initial={{ strokeDashoffset: reduced ? 0 : 320, opacity: reduced ? 0.42 : 0 }}
          animate={{ strokeDashoffset: 0, opacity: 0.42 }}
          transition={{
            strokeDashoffset: { duration: reduced ? 0 : 1.6, delay: reduced ? 0 : 0.42, ease: 'easeOut' },
            opacity: { duration: 0.14, delay: reduced ? 0 : 0.42 },
          }}
        />

        {/* The "I" of INK — Styled as a Giant Black-and-White Basketball Hoop */}
        <g className="hoop-letter-i">
          <rect x="814" y="106" width="108" height="78" rx="4" fill="#fffdf8" stroke="#0a0a0a" strokeWidth="5.5" />
          <rect x="845" y="136" width="46" height="36" fill="none" stroke="#0a0a0a" strokeWidth="3.5" />

          <rect x="850" y="196" width="36" height="118" fill="#0a0a0a" />
          <rect x="836" y="306" width="64" height="10" fill="#0a0a0a" />

          <motion.g
            style={{ transformOrigin: '868px 184px' }}
            initial={{ scaleY: 1, scaleX: 1 }}
            animate={
              reduced
                ? { scaleY: 1, scaleX: 1 }
                : { scaleY: [1, 1, 1.24, 0.9, 1.07, 1], scaleX: [1, 1, 0.86, 1.1, 0.97, 1] }
            }
            transition={{ duration: T, times: [0, 0.83, 0.88, 0.93, 0.97, 1], ease: 'easeOut' }}
          >
            <path
              d="M834 184 L844 236 L892 236 L902 184 Z"
              fill="#fffdf8"
              stroke="#0a0a0a"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <path
              d="M844 184 L860 236 M868 184 L868 236 M892 184 L876 236 M838 202 L898 202 M841 219 L895 219"
              stroke="#0a0a0a"
              strokeWidth="2.2"
            />
          </motion.g>

          <line x1="826" y1="184" x2="910" y2="184" stroke="#0a0a0a" strokeWidth="8.5" strokeLinecap="round" />
        </g>

        {/* Giant NK completing COURT // INK */}
        <text
          x="934"
          y="314"
          fill="#0a0a0a"
          fontFamily="'Anton', Impact, sans-serif"
          fontSize="214"
          letterSpacing="-4"
        >
          NK
        </text>

        {/* Subtle floor shadow under the stationary shooter */}
        <ellipse cx="362" cy="534" rx="74" ry="9" fill="#0a0a0a" opacity="0.16" />

        {/* Slam Dunk Anime Player: holds ball in hands -> ball cleanly leaves hands as arc begins */}
        <motion.g
          data-shooter
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut' }}
        >
          {/* Base frame without ball (stays visible once the ball leaves his hands) */}
          <motion.image
            href="/demo/sakuragi-noball.png"
            x="265"
            y="16"
            width="192"
            height="518"
            preserveAspectRatio="xMidYMax meet"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: reduced ? 1 : [0, 0, 1, 1] }}
            transition={{ duration: reduced ? 0 : T, times: [0, 0.17, 0.23, 1], ease: 'easeInOut' }}
          />
          {/* Initial frame holding the ball (fades out right as the first arc ball appears) */}
          <motion.image
            href="/demo/sakuragi-hold.png"
            x="265"
            y="16"
            width="192"
            height="518"
            preserveAspectRatio="xMidYMax meet"
            initial={{ opacity: reduced ? 0 : 1 }}
            animate={{ opacity: reduced ? 0 : [1, 1, 0, 0] }}
            transition={{ duration: reduced ? 0 : T, times: [0, 0.18, 0.24, 1], ease: 'easeInOut' }}
          />
        </motion.g>

        {/* Slowly Fading / "Teleporting" Screentone Manga Basketballs Moving Frame-by-Frame to the Net */}
        {!reduced &&
          ghostBalls.map((step, index) => {
            const fadePeak = step.start + 0.08
            const fadeHold = step.start + 0.16
            const fadeEnd = Math.min(0.96, step.start + 0.3)
            return (
              <motion.g
                key={index}
                style={{ transformOrigin: `${step.x}px ${step.y}px` }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{
                  opacity: [0, 0, 0.92, 0.78, 0],
                  scale: [0.92, 0.92, 1, 0.98, 0.94],
                }}
                transition={{
                  duration: T,
                  times: [0, step.start, fadePeak, fadeHold, fadeEnd],
                  ease: 'easeInOut',
                }}
              >
                <image
                  href="/demo/manga-ball.png"
                  x={step.x - BALL_SIZE / 2}
                  y={step.y - BALL_SIZE / 2}
                  width={BALL_SIZE}
                  height={BALL_SIZE}
                  transform={`rotate(${step.rot} ${step.x} ${step.y})`}
                />
              </motion.g>
            )
          })}

        {/* Final Screentone Manga Basketball Materializing into the Hoop "I" & Staying as the I-Dot */}
        <motion.g
          style={{ transformOrigin: '868px 150px' }}
          initial={reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -14, scale: 0.94 }}
          animate={
            reduced
              ? { opacity: 1, y: 0, scale: 1 }
              : {
                  opacity: [0, 0, 1, 1, 1],
                  y: [-14, -14, 18, -3, 0],
                  scale: [0.94, 0.94, 1.03, 0.99, 1],
                }
          }
          transition={{
            duration: reduced ? 0 : T,
            times: [0, 0.8, 0.87, 0.94, 1],
            ease: 'easeOut',
          }}
        >
          <image
            href="/demo/manga-ball.png"
            x={868 - BALL_SIZE / 2}
            y={150 - BALL_SIZE / 2}
            width={BALL_SIZE}
            height={BALL_SIZE}
          />
        </motion.g>

        {/* Crisp Black-and-White "SWISH! シュッ" Manga SFX */}
        <motion.g
          initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.45, y: 12 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: [0, 0, 1, 1], scale: [0.45, 0.45, 1.15, 1], y: [12, 12, -3, 0] }}
          style={{ transformOrigin: '995px 84px' }}
          transition={{ duration: T, times: [0, 0.84, 0.92, 1], ease: 'easeOut' }}
        >
          <text
            x="934"
            y="88"
            fill="#0a0a0a"
            fontFamily="'Bangers', Impact, cursive"
            fontSize="48"
            letterSpacing="2"
            transform="rotate(-8 934 88)"
          >
            SWISH!
          </text>
          <text
            x="1055"
            y="84"
            fill="#0a0a0a"
            fontFamily="'Space Grotesk', sans-serif"
            fontSize="24"
            fontWeight="700"
            transform="rotate(-8 1055 84)"
          >
            シュッ
          </text>
        </motion.g>
      </svg>

      <button
        type="button"
        className="cover-replay-btn"
        onClick={replay}
        aria-label="Replay jump shot animation"
      >
        <RotateCcw size={14} aria-hidden="true" /> Replay shot
      </button>
    </div>
  )
}
