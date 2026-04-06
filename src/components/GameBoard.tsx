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

// Glow effect for high-value tiles
function tileGlow(value: number) {
  if (value >= 2048) return "shadow-[0_0_20px_hsl(var(--tile-2048)/0.5)]";
  if (value >= 1024) return "shadow-[0_0_15px_hsl(var(--tile-1024)/0.4)]";
  if (value >= 512) return "shadow-[0_0_10px_hsl(var(--tile-512)/0.3)]";
  return "";
}

interface Props {
  tiles: TileData[];
  onSwipe: (dir: "up" | "down" | "left" | "right") => void;
  disabled: boolean;
}

const GAP = 8;
const GAP_SM = 12;
const PAD = 8;
const PAD_SM = 12;

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
      className="relative w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] rounded-2xl p-2 sm:p-3 select-none touch-none
        bg-gradient-to-br from-secondary to-muted shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      {/* Background grid cells */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full h-full">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-background/30 rounded-lg" />
        ))}
      </div>

      {/* Tiles — CSS transitions handle the sliding */}
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className={`absolute flex items-center justify-center rounded-lg font-bold font-mono
            transition-[left,top] duration-[120ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]
            ${tileClass(tile.value)} ${fontSize(tile.value)} ${tileGlow(tile.value)}
            ${tile.isNew ? "animate-tile-pop" : ""}
            ${tile.isMerged ? "animate-tile-merge" : ""}
          `}
          style={{
            width: `calc((100% - ${PAD * 2}px - ${GAP * 3}px) / 4)`,
            height: `calc((100% - ${PAD * 2}px - ${GAP * 3}px) / 4)`,
            left: `calc(${PAD}px + ${tile.col} * (((100% - ${PAD * 2}px - ${GAP * 3}px) / 4) + ${GAP}px))`,
            top: `calc(${PAD}px + ${tile.row} * (((100% - ${PAD * 2}px - ${GAP * 3}px) / 4) + ${GAP}px))`,
          }}
        >
          {tile.value}
        </div>
      ))}
    </div>
  );
}
