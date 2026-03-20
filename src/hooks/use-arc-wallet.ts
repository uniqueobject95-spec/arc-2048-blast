import { useState, useCallback, useRef } from "react";
import { BrowserProvider, JsonRpcSigner, toUtf8Bytes, hexlify } from "ethers";

const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  blockExplorerUrls: [],
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

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) {
      setError("Install MetaMask to play on-chain");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      
      // Switch to Arc Testnet
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET.chainId }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ARC_TESTNET],
          });
        } else {
          throw switchError;
        }
      }

      const signer = await provider.getSigner();
      signerRef.current = signer;
      const addr = await signer.getAddress();
      setAddress(addr);
    } catch (err: any) {
      setError(err?.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    signerRef.current = null;
    setTxHistory([]);
  }, []);

  const sendMoveTx = useCallback(async (direction: string, moveNumber: number): Promise<TxResult | null> => {
    if (!signerRef.current) return null;
    setSending(true);
    setError(null);
    try {
      const data = hexlify(toUtf8Bytes(`2048:move:${direction}:${moveNumber}`));
      const tx = await signerRef.current.sendTransaction({
        to: await signerRef.current.getAddress(),
        value: 0n,
        data,
      });
      const result: TxResult = { hash: tx.hash, direction, moveNumber };
      setTxHistory((prev) => [result, ...prev].slice(0, 50));
      return result;
    } catch (err: any) {
      setError(err?.message || "Transaction failed");
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { address, connecting, sending, txHistory, error, connect, disconnect, sendMoveTx, setError };
}
