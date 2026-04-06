import { useState, useCallback } from "react";
import { Plus, Trash2, Lock, Unlock, Shuffle, DollarSign, ArrowRightLeft } from "lucide-react";

export type AmountMode = "fixed" | "range" | "random";

export interface TxSettings {
  recipients: string[];
  lockedRecipients: boolean[];
  amountMode: AmountMode;
  fixedAmount: string;
  minAmount: string;
  maxAmount: string;
}

export const DEFAULT_TX_SETTINGS: TxSettings = {
  recipients: ["0xEA549e458e77Fd93bf330e5EAEf730c50d8F5249"],
  lockedRecipients: [false],
  amountMode: "fixed",
  fixedAmount: "0.000001",
  minAmount: "0.000001",
  maxAmount: "0.0001",
};

export function resolveAmount(settings: TxSettings): string {
  if (settings.amountMode === "fixed") return settings.fixedAmount || "0.000001";
  const min = parseFloat(settings.minAmount) || 0.000001;
  const max = parseFloat(settings.maxAmount) || 0.0001;
  if (settings.amountMode === "random") {
    const val = min + Math.random() * (max - min);
    return val.toFixed(8);
  }
  // range — pick random within range
  const val = min + Math.random() * (max - min);
  return val.toFixed(8);
}

export function resolveRecipients(settings: TxSettings): string[] {
  return settings.recipients.filter((r) => r.trim().length === 42 && r.startsWith("0x"));
}

interface Props {
  settings: TxSettings;
  onChange: (s: TxSettings) => void;
  usdcBalance?: string | null;
}

export default function TransactionSettings({ settings, onChange, usdcBalance }: Props) {
  const [expanded, setExpanded] = useState(false);

  const updateRecipient = (index: number, value: string) => {
    const r = [...settings.recipients];
    r[index] = value;
    onChange({ ...settings, recipients: r });
  };

  const toggleLock = (index: number) => {
    const l = [...settings.lockedRecipients];
    l[index] = !l[index];
    onChange({ ...settings, lockedRecipients: l });
  };

  const addRecipient = () => {
    onChange({
      ...settings,
      recipients: [...settings.recipients, ""],
      lockedRecipients: [...settings.lockedRecipients, false],
    });
  };

  const removeRecipient = (index: number) => {
    if (settings.recipients.length <= 1) return;
    onChange({
      ...settings,
      recipients: settings.recipients.filter((_, i) => i !== index),
      lockedRecipients: settings.lockedRecipients.filter((_, i) => i !== index),
    });
  };

  const amountModes: { value: AmountMode; label: string; icon: React.ReactNode }[] = [
    { value: "fixed", label: "Fixed", icon: <DollarSign className="w-3.5 h-3.5" /> },
    { value: "range", label: "Range", icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
    { value: "random", label: "Random", icon: <Shuffle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full max-w-[400px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border border-border text-sm font-medium text-card-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-primary">⚙️</span>
          Transaction Settings
        </span>
        <span className={`text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="mt-2 p-4 rounded-lg bg-card border border-border space-y-5 animate-slide-up">
          {/* Recipients */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient{settings.recipients.length > 1 ? "s" : ""}
              </label>
              <button
                onClick={addRecipient}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {settings.recipients.map((addr, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={addr}
                  onChange={(e) => updateRecipient(i, e.target.value)}
                  disabled={settings.lockedRecipients[i]}
                  placeholder="0x..."
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono
                    placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                    disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                />
                <button
                  onClick={() => toggleLock(i)}
                  className={`p-1.5 rounded-md transition-colors ${
                    settings.lockedRecipients[i]
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  title={settings.lockedRecipients[i] ? "Unlock" : "Lock"}
                >
                  {settings.lockedRecipients[i] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
                {settings.recipients.length > 1 && (
                  <button
                    onClick={() => removeRecipient(i)}
                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {settings.recipients.length > 1 && (
              <p className="text-[10px] text-muted-foreground">
                Each move sends to all recipients simultaneously
              </p>
            )}
          </div>

          {/* Amount mode */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount per Move
            </label>
            <div className="flex gap-1.5">
              {amountModes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => onChange({ ...settings, amountMode: m.value })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all duration-150
                    ${settings.amountMode === m.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {settings.amountMode === "fixed" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.fixedAmount}
                  onChange={(e) => onChange({ ...settings, fixedAmount: e.target.value })}
                  step="0.000001"
                  min="0.000001"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground font-medium">USDC</span>
              </div>
            )}

            {(settings.amountMode === "range" || settings.amountMode === "random") && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.minAmount}
                  onChange={(e) => onChange({ ...settings, minAmount: e.target.value })}
                  step="0.000001"
                  min="0.000001"
                  placeholder="Min"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="number"
                  value={settings.maxAmount}
                  onChange={(e) => onChange({ ...settings, maxAmount: e.target.value })}
                  step="0.000001"
                  min="0.000001"
                  placeholder="Max"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground font-medium">USDC</span>
              </div>
            )}

            {usdcBalance && (
              <p className="text-[10px] text-muted-foreground">
                Balance: <span className="text-chain font-mono">{usdcBalance}</span> USDC
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
