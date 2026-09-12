import { notFound } from "next/navigation"

/**
 * Every Tiny Dungeon tile with its index, for checking sprite frames by eye.
 *
 * Development only. This exists because the first hero sprite indices were all wrong - 84 is the
 * wizard, not a warrior - and nothing in the test suite could have noticed. Being able to see the
 * numbered grid is the only reliable way to pick a frame.
 */
const COLS = 12
const ROWS = 11
const TILE = 16
const SCALE = 4

export default function SpritesPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const tiles = Array.from({ length: COLS * ROWS }, (_, index) => index)

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <h1 className="text-xl font-semibold">Tiny Dungeon frames</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        {COLS}×{ROWS} grid of {TILE}px tiles, indexed row-major, exactly as Phaser numbers a
        spritesheet frame. Development only.
      </p>

      <p className="mt-4 text-xs text-zinc-500">
        In use: <span className="text-emerald-400">96 warrior</span>,{" "}
        <span className="text-emerald-400">112 rogue</span>,{" "}
        <span className="text-emerald-400">84 mage</span>,{" "}
        <span className="text-emerald-400">40 floor</span>.
      </p>

      <div
        className="mt-6 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, maxWidth: 900 }}
      >
        {tiles.map((index) => {
          const col = index % COLS
          const row = Math.floor(index / COLS)
          const inUse = [96, 112, 84, 40].includes(index)
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <div
                className={`rounded ${inUse ? "ring-2 ring-emerald-500" : "ring-1 ring-zinc-800"}`}
                style={{
                  width: TILE * SCALE,
                  height: TILE * SCALE,
                  backgroundImage: "url(/game/kenney-tiny-dungeon/tilemap_packed.png)",
                  backgroundPosition: `-${col * TILE * SCALE}px -${row * TILE * SCALE}px`,
                  backgroundSize: `${COLS * TILE * SCALE}px ${ROWS * TILE * SCALE}px`,
                  imageRendering: "pixelated",
                }}
              />
              <span className={`font-mono text-[10px] ${inUse ? "text-emerald-400" : "text-zinc-600"}`}>
                {index}
              </span>
            </div>
          )
        })}
      </div>
    </main>
  )
}
