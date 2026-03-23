import { useState, useCallback, useRef } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createEthersAdapterFromProvider } from "@circle-fin/adapter-ethers-v6";
import {
  BrowserProvider,
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
const ARC_TESTNET_APPKIT_CHAIN = "Arc_Testnet" as const;

const RECIPIENT = "0xEA549e458e77Fd93bf330e5EAEf730c50d8F5249";
const MOVE_AMOUNT = "0.000001";

export type LoginMethod = "metamask" | "privy";

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
  const [loginMethod, setLoginMethod] = useState<LoginMethod | null>(null);

  const kitRef = useRef<AppKit | null>(null);
  const adapterRef = useRef<Awaited<ReturnType<typeof createEthersAdapterFromProvider>> | null>(null);
  const sendingLockRef = useRef(false);
  // Store the active provider so we use the correct one (embedded vs MetaMask)
  const providerRef = useRef<Eip1193Provider | null>(null);

  const getKit = useCallback(() => {
    if (!kitRef.current) kitRef.current = new AppKit();
    return kitRef.current;
  }, []);

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

  // MetaMask connect
  const connectMetaMask = useCallback(async () => {
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
      providerRef.current = eth;
      getKit();

      const browserProvider = new BrowserProvider(eth);
      const signer = await browserProvider.getSigner();
      setAddress(await signer.getAddress());
      setLoginMethod("metamask");
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setError(err?.message?.slice(0, 140) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [ensureArcNetwork, getKit]);

  // Privy connect - accepts the embedded wallet's EIP-1193 provider
  const connectPrivy = useCallback(async (privyAddress: string, privyProvider: Eip1193Provider) => {
    setError(null);
    try {
      providerRef.current = privyProvider;

      // Switch embedded wallet to Arc Testnet
      await ensureArcNetwork(privyProvider);

      const adapter = await createEthersAdapterFromProvider({ provider: privyProvider });
      adapterRef.current = adapter;
      getKit();

      setAddress(privyAddress);
      setLoginMethod("privy");
    } catch (err: any) {
      console.error("Privy wallet setup error:", err);
      setError(err?.message?.slice(0, 140) || "Wallet setup failed");
    }
  }, [ensureArcNetwork, getKit]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setLoginMethod(null);
    kitRef.current = null;
    adapterRef.current = null;
    providerRef.current = null;
    sendingLockRef.current = false;
    setSending(false);
    setTxHistory([]);
    setError(null);
  }, []);

  const sendMoveTx = useCallback(async (direction: string, moveNumber: number): Promise<TxResult | null> => {
    const provider = providerRef.current;
    if (!provider || !address) return null;
    if (sendingLockRef.current) return null;

    sendingLockRef.current = true;
    setSending(true);
    setError(null);

    try {
      // Re-create adapter from the stored provider each time to avoid stale state
      const adapter = await createEthersAdapterFromProvider({ provider });
      adapterRef.current = adapter;

      const result = await getKit().send({
        from: { adapter, chain: ARC_TESTNET_APPKIT_CHAIN },
        to: RECIPIENT,
        amount: MOVE_AMOUNT,
        token: "USDC",
      });

      const hash = (result as { txHash?: string; hash?: string; message?: string })?.txHash
        ?? (result as { txHash?: string; hash?: string; message?: string })?.hash;

      if (!hash) {
        const message = (result as { message?: string })?.message || "Transaction failed";
        throw new Error(message);
      }

      const txResult: TxResult = { hash, direction, moveNumber };
      setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
      return txResult;
    } catch (err: any) {
      console.error("Move tx error:", err);
      const raw = err?.shortMessage || err?.message || "Transaction failed";
      setError(raw.length > 140 ? `${raw.slice(0, 140)}...` : raw);
      return null;
    } finally {
      sendingLockRef.current = false;
      setSending(false);
    }
  }, [address, getKit]);

  return {
    address, connecting, sending, txHistory, error, loginMethod,
    connectMetaMask, connectPrivy, disconnect, sendMoveTx, setError,
  };
}
