import { useState, useCallback, useRef } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createEthersAdapterFromProvider } from "@circle-fin/adapter-ethers-v6";
import { useSendTransaction } from "@privy-io/react-auth";
import {
  BrowserProvider,
  parseUnits,
  formatUnits,
  type Eip1193Provider,
} from "ethers";
import type { TxSettings } from "@/components/TransactionSettings";
import { resolveAmount, resolveRecipients } from "@/components/TransactionSettings";

const ARC_TESTNET_CHAIN_ID = "0x4cef52";
const ARC_TESTNET_CHAIN_ID_DEC = 5042002;
const ARC_TESTNET = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};
const ARC_TESTNET_APPKIT_CHAIN = "Arc_Testnet" as const;

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
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const { sendTransaction: sendPrivyTransaction } = useSendTransaction();

  const kitRef = useRef<AppKit | null>(null);
  const providerRef = useRef<Eip1193Provider | null>(null);
  const privyTxQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const getKit = useCallback(() => {
    if (!kitRef.current) kitRef.current = new AppKit();
    return kitRef.current;
  }, []);

  const fetchBalance = useCallback(async (provider: Eip1193Provider, addr: string) => {
    try {
      const bp = new BrowserProvider(provider);
      const bal = await bp.getBalance(addr);
      setUsdcBalance(parseFloat(formatUnits(bal, 18)).toFixed(6));
    } catch {
      setUsdcBalance(null);
    }
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
      await createEthersAdapterFromProvider({ provider: eth });
      providerRef.current = eth;
      getKit();
      const bp = new BrowserProvider(eth);
      const signer = await bp.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
      setLoginMethod("metamask");
      fetchBalance(eth, addr);
    } catch (err: any) {
      setError(err?.message?.slice(0, 140) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [ensureArcNetwork, getKit, fetchBalance]);

  const connectPrivy = useCallback(async (privyAddress: string, privyProvider: Eip1193Provider) => {
    setError(null);
    try {
      providerRef.current = privyProvider;
      await ensureArcNetwork(privyProvider);
      setAddress(privyAddress);
      setLoginMethod("privy");
      fetchBalance(privyProvider, privyAddress);
    } catch (err: any) {
      setError(err?.message?.slice(0, 140) || "Wallet setup failed");
    }
  }, [ensureArcNetwork, fetchBalance]);

  const enqueuePrivyTx = useCallback(<T,>(job: () => Promise<T>) => {
    const run = privyTxQueueRef.current.then(job, job);
    privyTxQueueRef.current = run.then(() => undefined, () => undefined);
    return run;
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setLoginMethod(null);
    kitRef.current = null;
    providerRef.current = null;
    privyTxQueueRef.current = Promise.resolve();
    setSending(false);
    setTxHistory([]);
    setError(null);
    setUsdcBalance(null);
  }, []);

  const sendMoveTx = useCallback(async (
    direction: string,
    moveNumber: number,
    txSettings: TxSettings
  ): Promise<TxResult | null> => {
    if (!address) return null;

    const recipients = resolveRecipients(txSettings);
    if (recipients.length === 0) return null;

    const amount = resolveAmount(txSettings);
    const isPrivy = loginMethod === "privy";
    setError(null);

    // Send to all recipients
    const sendToRecipient = async (recipient: string): Promise<TxResult | null> => {
      if (isPrivy) {
        return enqueuePrivyTx(async () => {
          try {
            const result = await sendPrivyTransaction(
              {
                to: recipient,
                value: parseUnits(amount, 18),
                chainId: ARC_TESTNET_CHAIN_ID_DEC,
              },
              {
                sponsor: true,
                uiOptions: { showWalletUIs: false, isCancellable: false },
                address,
              },
            );
            const hash = result?.hash;
            if (!hash) throw new Error("Transaction failed");
            const txResult: TxResult = { hash, direction, moveNumber };
            setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
            return txResult;
          } catch (err: any) {
            const raw = err?.shortMessage || err?.message || "Transaction failed";
            setError(raw.length > 140 ? `${raw.slice(0, 140)}...` : raw);
            return null;
          }
        });
      }

      // MetaMask flow
      const provider = providerRef.current;
      if (!provider) return null;
      setSending(true);
      try {
        const adapter = await createEthersAdapterFromProvider({ provider });
        const result = await getKit().send({
          from: { adapter, chain: ARC_TESTNET_APPKIT_CHAIN },
          to: recipient,
          amount,
          token: "USDC",
        });
        const hash = (result as any)?.txHash ?? (result as any)?.hash;
        if (!hash) throw new Error((result as any)?.message || "Transaction failed");
        const txResult: TxResult = { hash, direction, moveNumber };
        setTxHistory((prev) => [txResult, ...prev].slice(0, 50));
        return txResult;
      } catch (err: any) {
        const raw = err?.shortMessage || err?.message || "Transaction failed";
        setError(raw.length > 140 ? `${raw.slice(0, 140)}...` : raw);
        return null;
      } finally {
        setSending(false);
      }
    };

    // Fire all recipient sends
    const results = await Promise.all(recipients.map(sendToRecipient));

    // Refresh balance after tx
    if (providerRef.current && address) {
      fetchBalance(providerRef.current, address);
    }

    return results.find((r) => r !== null) || null;
  }, [address, loginMethod, getKit, enqueuePrivyTx, sendPrivyTransaction, fetchBalance]);

  return {
    address, connecting, sending, txHistory, error, loginMethod, usdcBalance,
    connectMetaMask, connectPrivy, disconnect, sendMoveTx, setError,
  };
}
