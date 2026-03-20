import type { TxResult } from "@/hooks/use-arc-wallet";

interface Props {
  address: string | null;
  connecting: boolean;
  sending: boolean;
  txHistory: TxResult[];
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

const directionEmoji: Record<string, string> = {
  up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️",
};

export default function WalletPanel({ address, connecting, sending, txHistory, error, onConnect, onDisconnect }: Props) {
  return (
    <div className="w-full max-w-[400px] space-y-4">
      {/* Connection */}
      {!address ? (
        <button
          onClick={onConnect}
          disabled={connecting}
          className="w-full py-3 px-4 rounded-lg bg-chain text-chain-foreground font-semibold
            transition-all duration-150 ease-out hover:brightness-110 active:scale-[0.97]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? "Connecting..." : "Connect Wallet to Arc Testnet"}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-chain animate-pulse-chain" />
            <span className="font-mono text-sm text-secondary-foreground">{shortenAddress(address)}</span>
          </div>
          <button
            onClick={onDisconnect}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Status */}
      {sending && (
        <div className="text-center text-sm text-chain font-medium animate-pulse">
          Sending transaction...
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error.length > 100 ? error.slice(0, 100) + "..." : error}
        </div>
      )}

      {/* Transaction history */}
      {txHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Moves ({txHistory.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
            {txHistory.map((tx, i) => (
              <div
                key={tx.hash}
                className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-muted/50
                  animate-slide-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="flex items-center gap-1.5">
                  <span>{directionEmoji[tx.direction]}</span>
                  <span className="text-muted-foreground">#{tx.moveNumber}</span>
                </span>
                <span className="font-mono text-muted-foreground">{shortenHash(tx.hash)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
