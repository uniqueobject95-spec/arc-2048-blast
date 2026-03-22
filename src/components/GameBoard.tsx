import { useEffect, useRef } from "react";
import type { TileData } from "@/hooks/use-game-2048";

const TILE_COLORS: Record<number, string> = {
  2: "bg-[hsl(var(--tile-2))] text-[hsl(var(--tile-text-dark))]",
  4: "bg-[hsl(var(--tile-4))] text-[hsl(var(--tile-text-dark))]",
  8: "bg-[hsl(var(--tile-8))] text-[hsl(var(--tile-text-light))]",
  16: "bg-[hsl(var(--tile-16))] text-[hsl(var(--tile-text-light))]",
  32: "bg-[hsl(var(--tile-32))] text-[hsl(var(--tile-text-light))]",
  64: "bg-[hsl(var(--tile-64))] text-[hsl(var(--tile-text-light))]",
  128: "bg-[hsl(var(--tile-128))] text-[hsl(var(--tile-text-dark))]",
  256: "bg-[hsl(var(--tile-256))] text-[hsl(var(--tile-text-dark))]",
  512: "bg-[hsl(var(--tile-512))] text-[hsl(var(--tile-text-light))]",
  1024: "bg-[hsl(var(--tile-1024))] text-[hsl(var(--tile-text-light))]",
  2048: "bg-[hsl(var(--tile-2048))] text-[hsl(var(--tile-text-light))]",
};

function tileClass(value: number) {
  return TILE_COLORS[value] || "bg-primary text-primary-foreground";
}

function fontSize(value: number) {
  if (value >= 1024) return "text-lg sm:text-xl";
  if (value >= 128) return "text-xl sm:text-2xl";
  return "text-2xl sm:text-3xl";
}

interface Props {
  tiles: TileData[];
  onSwipe: (dir: "up" | "down" | "left" | "right") => void;
  disabled: boolean;
}

export default function GameBoard({ tiles, onSwipe, disabled }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (disabled) return;
      const map: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        onSwipe(dir);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onSwipe, disabled]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || disabled) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 30) return;
    if (absDx > absDy) {
      onSwipe(dx > 0 ? "right" : "left");
    } else {
      onSwipe(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  return (
    <div
      ref={boardRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] bg-secondary rounded-lg p-2 sm:p-3 select-none touch-none"
    >
      {/* Background grid cells */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full h-full">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-muted rounded-md" />
        ))}
      </div>

      {/* Tiles */}
      {tiles.map((tile) => {
        const cellSize = "calc((100% - 3 * 0.5rem) / 4)";
        const cellSizeSm = "calc((100% - 3 * 0.75rem) / 4)";
        const gapPx = 8;
        const gapPxSm = 12;
        const padPx = 8;
        const padPxSm = 12;

        return (
          <div
            key={tile.id}
            className={`absolute flex items-center justify-center rounded-md font-bold font-mono transition-all duration-150 ease-out
              ${tileClass(tile.value)} ${fontSize(tile.value)}
              ${tile.isNew ? "animate-tile-pop" : ""}
              ${tile.isMerged ? "animate-tile-merge" : ""}
            `}
            style={{
              width: `calc((100% - ${padPx * 2}px - ${gapPx * 3}px) / 4)`,
              height: `calc((100% - ${padPx * 2}px - ${gapPx * 3}px) / 4)`,
              left: `calc(${padPx}px + ${tile.col} * (((100% - ${padPx * 2}px - ${gapPx * 3}px) / 4) + ${gapPx}px))`,
              top: `calc(${padPx}px + ${tile.row} * (((100% - ${padPx * 2}px - ${gapPx * 3}px) / 4) + ${gapPx}px))`,
            }}
          >
            {tile.value}
          </div>
        );
      })}
    </div>
  );
}
