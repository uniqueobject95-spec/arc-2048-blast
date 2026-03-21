import { useState, useCallback, useEffect } from "react";

export type Direction = "up" | "down" | "left" | "right";

export interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

interface GameState {
  tiles: TileData[];
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  moveCount: number;
}

let tileIdCounter = 0;
const nextId = () => ++tileIdCounter;

function createEmptyGrid(): (TileData | null)[][] {
  return Array.from({ length: 4 }, () => Array(4).fill(null));
}

function tilesToGrid(tiles: TileData[]): (TileData | null)[][] {
  const grid = createEmptyGrid();
  tiles.forEach((t) => {
    grid[t.row][t.col] = t;
  });
  return grid;
}

function getEmptyCells(grid: (TileData | null)[][]): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (!grid[r][c]) cells.push([r, c]);
  return cells;
}

function addRandomTile(tiles: TileData[]): TileData[] {
  const grid = tilesToGrid(tiles);
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return tiles;
  const [row, col] = empty[Math.floor(Math.random() * empty.length)];
  return [
    ...tiles.map((t) => ({ ...t, isNew: false, isMerged: false })),
    { id: nextId(), value: Math.random() < 0.9 ? 2 : 4, row, col, isNew: true },
  ];
}

function moveLeft(tiles: TileData[]): { tiles: TileData[]; scoreDelta: number; moved: boolean } {
  const grid = tilesToGrid(tiles);
  const newTiles: TileData[] = [];
  let scoreDelta = 0;
  let moved = false;

  for (let r = 0; r < 4; r++) {
    const row = grid[r].filter(Boolean) as TileData[];
    const merged: TileData[] = [];
    let col = 0;
    for (let i = 0; i < row.length; i++) {
      if (i + 1 < row.length && row[i].value === row[i + 1].value) {
        const newVal = row[i].value * 2;
        merged.push({ id: nextId(), value: newVal, row: r, col, isMerged: true });
        scoreDelta += newVal;
        i++;
      } else {
        merged.push({ ...row[i], row: r, col, isNew: false, isMerged: false });
      }
      col++;
    }
    merged.forEach((t) => {
      const orig = tiles.find((o) => o.id === t.id);
      if (!orig || orig.row !== t.row || orig.col !== t.col) moved = true;
      if (t.isMerged) moved = true;
    });
    newTiles.push(...merged);
  }

  return { tiles: newTiles, scoreDelta, moved };
}

function rotateGrid(tiles: TileData[], times: number): TileData[] {
  let result = tiles;
  for (let t = 0; t < times; t++) {
    result = result.map((tile) => ({
      ...tile,
      row: tile.col,
      col: 3 - tile.row,
    }));
  }
  return result;
}

function move(tiles: TileData[], direction: Direction): { tiles: TileData[]; scoreDelta: number; moved: boolean } {
  const rotations: Record<Direction, number> = { left: 0, down: 1, right: 2, up: 3 };
  const reverseRotations: Record<Direction, number> = { left: 0, down: 3, right: 2, up: 1 };

  const rotated = rotateGrid(tiles, rotations[direction]);
  const result = moveLeft(rotated);
  const finalTiles = rotateGrid(result.tiles, reverseRotations[direction]);

  return { tiles: finalTiles, scoreDelta: result.scoreDelta, moved: result.moved };
}

function isGameOver(tiles: TileData[]): boolean {
  if (tiles.length < 16) return false;
  for (const dir of ["left", "right", "up", "down"] as Direction[]) {
    const { moved } = move(tiles, dir);
    if (moved) return false;
  }
  return true;
}

function initTiles(): TileData[] {
  tileIdCounter = 0;
  let tiles: TileData[] = [];
  tiles = addRandomTile(tiles);
  tiles = addRandomTile(tiles);
  return tiles;
}

export function useGame2048() {
  const [state, setState] = useState<GameState>(() => {
    const best = parseInt(localStorage.getItem("2048-best") || "0", 10);
    return {
      tiles: initTiles(),
      score: 0,
      bestScore: best,
      gameOver: false,
      won: false,
      moveCount: 0,
    };
  });

  const doMove = useCallback((direction: Direction): boolean => {
    let didMove = false;
    setState((prev) => {
      if (prev.gameOver) return prev;
      const result = move(prev.tiles, direction);
      if (!result.moved) return prev;
      didMove = true;

      const newTiles = addRandomTile(result.tiles);
      const newScore = prev.score + result.scoreDelta;
      const newBest = Math.max(newScore, prev.bestScore);
      localStorage.setItem("2048-best", String(newBest));

      const won = !prev.won && newTiles.some((t) => t.value >= 2048);
      const gameOver = isGameOver(newTiles);

      return {
        tiles: newTiles,
        score: newScore,
        bestScore: newBest,
        gameOver,
        won: won || prev.won,
        moveCount: prev.moveCount + 1,
      };
    });
    return didMove;
  }, []);

  const resetGame = useCallback(() => {
    setState((prev) => ({
      tiles: initTiles(),
      score: 0,
      bestScore: prev.bestScore,
      gameOver: false,
      won: false,
      moveCount: 0,
    }));
  }, []);

  return { ...state, doMove, resetGame };
}
