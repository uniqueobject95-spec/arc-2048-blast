import { useState, useCallback, useRef } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createEthersAdapterFromProvider } from "@circle-fin/adapter-ethers-v6";
import {
  BrowserProvider,
  JsonRpcSigner,
  parseUnits,
  toUtf8Bytes,
  hexlify,
  type Eip1193Provider,
} from "ethers";

const ARC_TESTNET_CHAIN_ID = "0x4cef52";
const ARC_TESTNET = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const RECIPIENT = "0xEA549e458e77Fd93bf330e5EAEf730c50d8F5249";
const MOVE_AMOUNT = "0.000001";
const MOVE_AMOUNT_WEI = parseUnits(MOVE_AMOUNT, 18);

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
  const adapterRef = useRef<Awaited<ReturnType<typeof createEthersAdapterFromProvider>> | null>(null);
  const signerRef = useRef<JsonRpcSigner | null>(null);

  const ensureArcNetwork = useCallback(async (provider: Eip1193Provider) => {
    try {
      await provider.request?.({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_CHAIN_ID }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        await provider.request?.({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      } else {
        throw switchError;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum as Eip1193Provider | undefined;
    if (!eth) {
      setError("Install MetaMask or a compatible wallet to play on-chain");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await eth.request?.({ method: "eth_requestAccounts" });
      await ensureArcNetwork(eth);

      const adapter = await createEthersAdapterFromProvider({ provider: eth });
      adapterRef.current = adapter;
      kitRef.current = new AppKit();

      const browserProvider = new BrowserProvider(eth);
      const signer = await browserProvider.getSigner();
      signerRef.current = signer;
      setAddress(await signer.getAddress());
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setError(err?.message?.slice(0, 140) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [ensureArcNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    kitRef.current = null;
    adapterRef.current = null;
    signerRef.current = null;
    setTxHistory([]);
    setError(null);
  }, []);

  const sendMoveTx = useCallback(async (direction: string, moveNumber: number): Promise<TxResult | null> => {
    const eth = (window as any).ethereum as Eip1193Provider | undefined;
    if (!eth || !address) return null;

    setSending(true);
    setError(null);

    try {
      await ensureArcNetwork(eth);

      // Path A: App Kit send (official Arc App Kit flow)
      if (kitRef.current && adapterRef.current) {
        const result = await kitRef.current.send({
          from: { adapter: adapterRef.current, chain: "Arc_Testnet" },
          to: RECIPIENT,
          amount: MOVE_AMOUNT,
          token: "USDC",
        });

        const txHash = (result as { txHash?: string })?.txHash;
        if (txHash) {
          const txResult: TxResult = { hash: txHash, direction, moveNumber };
          setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
          return txResult;
        }
      }

      // Path B fallback: direct wallet tx to force popup reliably in all wallets
      if (!signerRef.current) {
        const browserProvider = new BrowserProvider(eth);
        signerRef.current = await browserProvider.getSigner();
      }

      const data = hexlify(toUtf8Bytes(`2048:move:${direction}:${moveNumber}`));
      const tx = await signerRef.current.sendTransaction({
        to: RECIPIENT,
        value: MOVE_AMOUNT_WEI,
        data,
      });

      const txResult: TxResult = { hash: tx.hash, direction, moveNumber };
      setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
      return txResult;
    } catch (err: any) {
      console.error("Move tx error:", err);
      const raw = err?.shortMessage || err?.message || "Transaction failed";
      setError(raw.length > 140 ? `${raw.slice(0, 140)}...` : raw);
      return null;
    } finally {
      setSending(false);
    }
  }, [address, ensureArcNetwork]);

  return { address, connecting, sending, txHistory, error, connect, disconnect, sendMoveTx, setError };
}
