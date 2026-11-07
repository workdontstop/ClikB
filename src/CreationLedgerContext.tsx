import { createContext, useContext } from "react";

export type CreationLedgerCall = {
  provider: string;
  model: string;
  attemptNumber: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  toolCalls: number;
  searchCalls: number;
  providerCostUsd: number;
  rawPixels: number;
  metadata?: Record<string, unknown>;
};

export type CreationLedgerEntry = {
  requestId: string;
  stage: string;
  actionLabel: string;
  route: string;
  status: string;
  pixelsCharged: number;
  billingSource: string;
  createdAt: string;
  calls: CreationLedgerCall[];
  replayed?: boolean;
};

type CreationLedgerValue = {
  entries: CreationLedgerEntry[];
  reset: () => void;
};

export const CreationLedgerContext = createContext<CreationLedgerValue>({
  entries: [],
  reset: () => undefined,
});

export const useCreationLedger = (): CreationLedgerValue => useContext(CreationLedgerContext);

const listeners = new Set<(entry: CreationLedgerEntry) => void>();

export const subscribeToCreationLedger = (
  listener: (entry: CreationLedgerEntry) => void,
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const publishCreationLedgerEntry = (entry: CreationLedgerEntry): void => {
  if (!entry?.requestId) return;
  listeners.forEach((listener) => listener(entry));
};

export const readCreationLedgerHeader = (headers: any): CreationLedgerEntry | null => {
  const raw = headers?.["x-clikb-usage-summary"]
    ?? headers?.get?.("x-clikb-usage-summary")
    ?? "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(String(raw)));
    return parsed?.requestId ? parsed as CreationLedgerEntry : null;
  } catch {
    return null;
  }
};

export const captureCreationLedgerHeader = (headers: any): void => {
  readCreationLedgerEntries(headers).forEach(publishCreationLedgerEntry);
};

/** A multi-operation response carries an aggregate for legacy clients plus its individual rows. */
export const readCreationLedgerEntries = (headers: any): CreationLedgerEntry[] => {
  const summary = readCreationLedgerHeader(headers) as (CreationLedgerEntry & { entries?: CreationLedgerEntry[] }) | null;
  if (!summary) return [];
  const entries = Array.isArray(summary.entries) ? summary.entries : [summary];
  return entries.filter((entry, index) => Boolean(entry?.requestId)
    && Array.isArray(entry.calls)
    && entries.findIndex(other => other?.requestId === entry.requestId) === index);
};
