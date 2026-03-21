import { useState, useCallback, useRef } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createEthersAdapterFromProvider } from "@circle-fin/adapter-ethers-v6";
import type { Eip1193Provider } from "ethers";

const RECIPIENT = "0xEA549e458e77Fd93bf330e5EAEf730c50d8F5249";
const MOVE_AMOUNT = "0.000001";

export interface TxResult {
  hash: string;
  direction: string;
  moveNumber: number;
}

export function useArcWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [txHistory, setTxHistory] = useState<TxResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const kitRef = useRef<AppKit | null>(null);
  const adapterRef = useRef<any>(null);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum as Eip1193Provider | undefined;
    if (!eth) {
      setError("Install MetaMask or a compatible wallet to play on-chain");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // Request accounts
      await (eth as any).request({ method: "eth_requestAccounts" });

      // Create adapter from browser wallet
      const adapter = await createEthersAdapterFromProvider({
        provider: eth,
      });
      adapterRef.current = adapter;

      // Initialize App Kit
      const kit = new AppKit();
      kitRef.current = kit;

      // Get the connected address
      const accounts: string[] = await (eth as any).request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setError(err?.message?.slice(0, 120) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    kitRef.current = null;
    adapterRef.current = null;
    setTxHistory([]);
    setError(null);
  }, []);

  const sendMoveTx = useCallback(async (direction: string, moveNumber: number): Promise<TxResult | null> => {
    if (!kitRef.current || !adapterRef.current) return null;
    setSending(true);
    setError(null);
    try {
      const result = await kitRef.current.send({
        from: { adapter: adapterRef.current, chain: "Arc_Testnet" },
        to: RECIPIENT,
        amount: MOVE_AMOUNT,
        token: "USDC",
      });

      const txResult: TxResult = {
        hash: result.txHash || `move-${moveNumber}`,
        direction,
        moveNumber,
      };
      setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
      return txResult;
    } catch (err: any) {
      console.error("Transaction error:", err);
      const msg = err?.message || "Transaction failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { address, connecting, sending, txHistory, error, connect, disconnect, sendMoveTx, setError };
}
