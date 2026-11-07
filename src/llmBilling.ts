import { setPixels, showPixelChargeNotice } from "./settingsSlice";
import { captureCreationLedgerHeader } from "./CreationLedgerContext";
import { captureAiProviderHeaders } from "./pixelBillingClient";

/**
 * Shared handling for the backend's `llmBilling` block.
 *
 * The server is the only thing that deducts pixels; the client's job is just to
 * show the authoritative number it sends back. Never subtract locally.
 */

export type LlmBilling = {
  tier: string;
  pixelsCharged: number;
  pixels: number;
};

/**
 * Call with the parsed body of a successful in-scope response. Does nothing for
 * responses that carry no billing block (untagged or non-billable calls).
 */
export const applyLlmBilling = (
  dispatch: any,
  data: any,
  notice?: { label: string; stage: string },
): void => {
  const billing = data?.llmBilling as LlmBilling | undefined;
  if (billing && typeof billing.pixels === "number") {
    dispatch(setPixels(billing.pixels));
    if (notice && Number(billing.pixelsCharged) > 0) {
      dispatch(showPixelChargeNotice({
        pixels: Number(billing.pixelsCharged),
        label: notice.label,
        stage: notice.stage,
      }));
    }
  }
};

/** Fetch responses do not pass through the global Axios interceptor. */
export const applyPixelBillingHeaders = (dispatch: any, response: Response): void => {
  captureAiProviderHeaders(response.headers);
  captureCreationLedgerHeader(response.headers);
  const chargedHeader = response.headers.get("x-clikb-pixels-charged");
  const balanceHeader = response.headers.get("x-clikb-pixels-balance");
  const charged = chargedHeader === null ? NaN : Number(chargedHeader);
  const balance = balanceHeader === null ? NaN : Number(balanceHeader);
  if (Number.isFinite(balance)) dispatch(setPixels(balance));
  if (!Number.isFinite(charged) || charged <= 0) return;

  const encodedLabel = response.headers.get("x-clikb-billing-label") || "AI Prompt";
  let label = encodedLabel;
  try { label = decodeURIComponent(encodedLabel); } catch { /* use the raw label */ }
  dispatch(showPixelChargeNotice({
    pixels: charged,
    label,
    stage: response.headers.get("x-clikb-billing-stage") || undefined,
  }));
};

/**
 * Call from an error path. A 402 carries the current balance, so Redux can
 * still be corrected even though nothing was charged.
 *
 * Accepts an Axios error, a parsed fetch error body, or either's `.data`.
 * Returns the user-facing message when the failure was an affordability one, so
 * callers can surface it through their existing error mechanism.
 */
export const applyLlmBillingError = (
  dispatch: any,
  error: any
): string | null => {
  const body = error?.response?.data ?? error?.data ?? error;
  if (!body || typeof body !== "object") return null;

  if (typeof body.pixels === "number") {
    dispatch(setPixels(body.pixels));
  }

  const status = error?.response?.status ?? error?.status;
  if (status === 402 || typeof body.required === "number") {
    return typeof body.message === "string"
      ? body.message
      : "Not enough pixels for AI prompt writing.";
  }
  return null;
};

/**
 * `fetch` equivalent for a non-OK response on an in-scope route. Syncs the
 * balance from a 402 body and throws with the server's message so the caller's
 * existing error path shows something useful instead of "HTTP 402".
 *
 * The thrown error carries `llmBillingError` for callers that want to stop
 * retrying — a 401/402 will not resolve itself on another attempt.
 */
export const throwLlmFetchError = async (
  resp: Response,
  dispatch: any
): Promise<never> => {
  // A completed base operation can remain charged when a later pacer fails.
  // Recover its separate receipt and balance before throwing for the retry.
  applyPixelBillingHeaders(dispatch, resp);
  let body: any = null;
  try {
    body = await resp.clone().json();
  } catch {
    /* not JSON — fall through to the generic message */
  }

  if (body && typeof body.pixels === "number") {
    dispatch(setPixels(body.pixels));
  }

  const message =
    (resp.status === 402 || resp.status === 401) &&
      typeof body?.message === "string"
      ? body.message
      : `HTTP ${resp.status}`;

  const error = new Error(message) as Error & { llmBillingError?: boolean };
  error.llmBillingError = resp.status === 402 || resp.status === 401;
  throw error;
};
