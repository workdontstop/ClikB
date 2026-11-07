import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Box, Button, Dialog, DialogContent, DialogTitle, Divider, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo } from "react";
import { useCreationLedger } from "./CreationLedgerContext";

const STAGE_LABELS: Record<string, string> = {
  plan: "Plan & Story Setup",
  intent: "Intent",
  image_prompt: "Image Prompt",
  image_prompt_pacer: "Image Prompt Pacer",
  video_prompt: "Video Prompt",
  ai_edit: "AI Edits",
  conversation: "Conversation",
  transcription: "Transcription",
  motion_guide: "Motion Guide",
  image_generation: "Image Generation",
  video_generation: "Video Generation",
  other: "AI Support",
};

const number = (value: unknown): number => Number(value) || 0;

export function LedgerButton({ appColor, onClick }: { appColor: string; onClick: (event: any) => void }) {
  return (
    <Button size="small" startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />} onClick={onClick}
      sx={{ ml: "auto", minWidth: 0, px: 1.1, borderRadius: 999, color: appColor,
        border: `1px solid ${alpha(appColor, 0.48)}`, fontSize: 11, fontWeight: 900, textTransform: "none" }}>
      Ledger
    </Button>
  );
}

export default function PixelLedgerDialog({ open, onClose, darkMode, appColor }: {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  appColor: string;
}) {
  const { entries } = useCreationLedger();
  const isDevelopment = import.meta.env.DEV;
  const visibleEntries = useMemo(
    () => isDevelopment ? entries : entries.filter((entry) => number(entry.pixelsCharged) > 0),
    [entries, isDevelopment],
  );
  const totals = useMemo(() => visibleEntries.reduce((acc, entry) => {
    if (number(entry.pixelsCharged) <= 0) return acc;
    const label = STAGE_LABELS[entry.stage] || entry.actionLabel;
    acc[label] = (acc[label] || 0) + number(entry.pixelsCharged);
    return acc;
  }, {} as Record<string, number>), [visibleEntries]);
  const chargedTotal = Object.values(totals).reduce((sum, pixels) => sum + pixels, 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: {
      borderRadius: 4,
      color: darkMode ? "#fff" : "#111",
      background: darkMode ? "rgba(18,18,20,.96)" : "rgba(255,255,255,.97)",
      backdropFilter: "blur(28px)",
      border: `1px solid ${alpha(appColor, 0.32)}`,
    } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 900 }}>
        <ReceiptLongIcon sx={{ color: appColor }} /> Current Creation Ledger
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2, fontSize: 12, opacity: .64 }}>
          This temporary ledger resets when a new creation starts or the creation is cleared.
        </Typography>

        {Object.keys(totals).length > 0 && (
          <Box sx={{ p: 1.5, mb: 2, borderRadius: 3, background: alpha(appColor, 0.09) }}>
            {Object.entries(totals).map(([label, pixels]) => (
              <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: .35 }}>
                <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                <Typography sx={{ fontWeight: 900 }}>{pixels.toLocaleString()} P</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1, borderColor: alpha(appColor, .25) }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 900 }}>Current creation</Typography>
              <Typography sx={{ fontWeight: 900, color: appColor }}>{chargedTotal.toLocaleString()} P</Typography>
            </Box>
          </Box>
        )}

        {visibleEntries.map((entry) => {
          const providerCostUsd = entry.calls.reduce((sum, call) => sum + number(call.providerCostUsd), 0);
          const rawPixels = entry.calls.reduce((sum, call) => sum + number(call.rawPixels), 0);
          return (
            <Box key={entry.requestId} sx={{ py: 1.2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>{entry.actionLabel}</Typography>
                  <Typography sx={{ fontSize: 12, opacity: .62 }}>
                    {new Date(entry.createdAt).toLocaleTimeString()} · {entry.status}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 900, color: appColor, whiteSpace: "nowrap" }}>
                  −{number(entry.pixelsCharged).toLocaleString()} P
                </Typography>
              </Box>

              {isDevelopment && (
                <Box sx={{ mt: 1, p: 1.2, borderRadius: 2, fontSize: 12,
                  background: darkMode ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.035)" }}>
                  {entry.calls.length ? entry.calls.map((call, index) => (
                    <Box key={`${entry.requestId}:${index}`} sx={{ mb: .8 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                        {entry.route} · {call.model || call.provider}
                        {typeof call.metadata?.reasoningEffort === 'string' ? ` · ${call.metadata.reasoningEffort}` : ''}
                      </Typography>
                      <Typography sx={{ fontSize: 11, opacity: .72 }}>
                        in {number(call.inputTokens).toLocaleString()} · cached {number(call.cachedInputTokens).toLocaleString()} · out {number(call.outputTokens).toLocaleString()} · search {number(call.searchCalls)}
                      </Typography>
                    </Box>
                  )) : (
                    <Typography sx={{ fontSize: 11, opacity: .72 }}>{entry.route} · existing media billing</Typography>
                  )}
                  <Typography sx={{ fontSize: 11, color: appColor, fontWeight: 800 }}>
                    Provider ${providerCostUsd.toFixed(6)} · raw {rawPixels.toFixed(3)} P · charged {number(entry.pixelsCharged)} P
                  </Typography>
                </Box>
              )}
              <Divider sx={{ mt: 1.2, opacity: .14 }} />
            </Box>
          );
        })}

        {visibleEntries.length === 0 ? (
          <Typography sx={{ py: 5, textAlign: "center", opacity: .65 }}>No charges in this creation yet.</Typography>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
