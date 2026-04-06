import { useCallback, useRef, useState } from "react";
import GameBoard from "@/components/GameBoard";
import WalletPanel from "@/components/WalletPanel";
import TransactionSettings, { DEFAULT_TX_SETTINGS, type TxSettings } from "@/components/TransactionSettings";
import { useGame2048, type Direction } from "@/hooks/use-game-2048";
import { useArcWallet } from "@/hooks/use-arc-wallet";

export default function Index() {
  const game = useGame2048();
  const wallet = useArcWallet();
  const moveCountRef = useRef(0);
  const [txSettings, setTxSettings] = useState<TxSettings>(DEFAULT_TX_SETTINGS);

  const handleSwipe = useCallback(
    (dir: Direction) => {
      if (game.gameOver) return;
      if (wallet.loginMethod === "metamask" && wallet.sending) return;

      const moved = game.doMove(dir);
      if (!moved) return;

      if (wallet.address && wallet.sendMoveTx) {
        moveCountRef.current += 1;
        const moveNum = moveCountRef.current;
        wallet.sendMoveTx(dir, moveNum, txSettings).catch((e) => {
          console.error("Move tx failed:", e);
        });
      }
    },
    [game.gameOver, game.doMove, wallet.address, wallet.sendMoveTx, wallet.sending, wallet.loginMethod, txSettings]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 gap-5">
      {/* Header */}
      <div className="text-center space-y-1 animate-slide-up">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">2048</span>
          <span className="text-chain ml-2 text-lg sm:text-xl font-mono align-middle">
            × Arc
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Every move is an on-chain transaction
        </p>
      </div>

      {/* Score bar */}
      <div className="flex gap-3 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <ScoreBox label="Score" value={game.score} />
        <ScoreBox label="Best" value={game.bestScore} />
        <ScoreBox label="Moves" value={game.moveCount} />
      </div>

      {/* Game board */}
      <div className="relative animate-slide-up" style={{ animationDelay: "160ms" }}>
        <GameBoard
          tiles={game.tiles}
          onSwipe={handleSwipe}
          disabled={wallet.loginMethod === "metamask" && wallet.sending}
        />

        {game.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
            <span className="text-2xl font-bold mb-3">Game Over</span>
            <button
              onClick={game.resetGame}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold
                hover:brightness-110 active:scale-[0.97] transition-all duration-150 shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}

        {game.won && !game.gameOver && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full
            bg-primary/90 text-primary-foreground text-xs font-semibold backdrop-blur-sm shadow-lg">
            🎉 2048 reached! Keep going...
          </div>
        )}
      </div>

      {/* New game */}
      <button
        onClick={game.resetGame}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors
          active:scale-[0.97] animate-slide-up"
        style={{ animationDelay: "240ms" }}
      >
        New Game
      </button>

      {/* Wallet panel */}
      <div className="animate-slide-up w-full flex flex-col items-center" style={{ animationDelay: "320ms" }}>
        <WalletPanel
          address={wallet.address}
          connecting={wallet.connecting}
          sending={wallet.sending}
          txHistory={wallet.txHistory}
          error={wallet.error}
          loginMethod={wallet.loginMethod}
          onConnectMetaMask={wallet.connectMetaMask}
          onConnectPrivy={wallet.connectPrivy}
          onDisconnect={wallet.disconnect}
        />
      </div>

      {/* Transaction settings — only when connected */}
      {wallet.address && (
        <div className="animate-slide-up w-full flex flex-col items-center" style={{ animationDelay: "400ms" }}>
          <TransactionSettings
            settings={txSettings}
            onChange={setTxSettings}
            usdcBalance={wallet.usdcBalance}
          />
        </div>
      )}

      {/* Chain info */}
      <div className="text-center text-[11px] text-muted-foreground font-mono space-y-0.5 animate-slide-up"
        style={{ animationDelay: "480ms" }}>
        <div>Arc Testnet · Chain ID 5042002</div>
        <div>RPC: rpc.testnet.arc.network</div>
      </div>
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-card border border-border min-w-[72px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <span className="text-lg font-bold font-mono tabular-nums text-card-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
