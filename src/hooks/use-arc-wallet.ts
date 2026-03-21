import { useState, useCallback, useRef } from "react";
import { BrowserProvider, JsonRpcSigner, parseUnits, toUtf8Bytes, hexlify } from "ethers";

const ARC_TESTNET_CHAIN_ID = "0x4cef52";
const RECIPIENT = "0xEA549e458e77Fd93bf330e5EAEf730c50d8F5249";
const MOVE_COST = parseUnits("0.000001", 18); // 0.000001 USDC (native, 18 decimals)

const ARC_TESTNET = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  blockExplorerUrls: [] as string[],
};

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
  const signerRef = useRef<JsonRpcSigner | null>(null);

  const ensureArcNetwork = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("No wallet found");
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // 4902 = chain not added yet
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      } else {
        throw switchError;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("Install MetaMask or a compatible wallet to play on-chain");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // Request accounts first
      await eth.request({ method: "eth_requestAccounts" });

      // Switch/add Arc Testnet
      await ensureArcNetwork();

      // Create provider after network switch
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      signerRef.current = signer;
      const addr = await signer.getAddress();
      setAddress(addr);
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setError(err?.message?.slice(0, 120) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [ensureArcNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    signerRef.current = null;
    setTxHistory([]);
    setError(null);
  }, []);

  const sendMoveTx = useCallback(async (direction: string, moveNumber: number): Promise<TxResult | null> => {
    if (!signerRef.current) return null;
    setSending(true);
    setError(null);
    try {
      // Ensure we're still on Arc Testnet
      await ensureArcNetwork();

      // Re-create provider/signer in case network changed
      const eth = (window as any).ethereum;
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      signerRef.current = signer;

      const data = hexlify(toUtf8Bytes(`2048:move:${direction}:${moveNumber}`));
      const tx = await signer.sendTransaction({
        to: RECIPIENT,
        value: MOVE_COST,
        data,
      });
      const result: TxResult = { hash: tx.hash, direction, moveNumber };
      setTxHistory((prev) => [result, ...prev].slice(0, 50));
      return result;
    } catch (err: any) {
      console.error("Transaction error:", err);
      const msg = err?.message || "Transaction failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
      return null;
    } finally {
      setSending(false);
    }
  }, [ensureArcNetwork]);

  return { address, connecting, sending, txHistory, error, connect, disconnect, sendMoveTx, setError };
}
