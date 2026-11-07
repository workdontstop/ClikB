// useFanStatus.ts
import React from "react";
import axios from "axios";

export type Relationship =
  | "mutual"
  | "one_way_out"
  | "one_way_in"
  | "none"
  | "self";
export type FanStatusResponse =
  | {
      ok: true;
      following: boolean;
      followedBy: boolean;
      relationship: Relationship;
    }
  | { ok: false; error: string };

type UseFanStatusOpts = {
  userid: number; // viewer
  favid: number; // target
  CLIK_URL: string; // base API URL
  auto?: boolean; // auto-fetch on mount (default true)
};

export function useFanStatus({
  userid,
  favid,
  CLIK_URL,
  auto = true,
}: UseFanStatusOpts) {
  const inFlightRef = React.useRef<AbortController | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scope = `${CLIK_URL}:${userid}:${favid}`;
  const [result, setResult] = React.useState<{ scope: string; status: {
    following: boolean;
    followedBy: boolean;
    relationship: Relationship;
  } } | null>(null);

  const fetchStatus = React.useCallback(async () => {
    // abort any prior request
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const config = { withCredentials: true, signal: controller.signal };
      const { data } = await axios.post<FanStatusResponse>(
        `${CLIK_URL}/fanStatus`,
        { values: { userid, favid } },
        config
      );
      if (controller.signal.aborted || inFlightRef.current !== controller) return;
      if (!data?.ok) throw new Error((data as any)?.error || "Bad response");
      const status = {
        following: data.following,
        followedBy: data.followedBy,
        relationship: data.relationship,
      };
      setResult({ scope, status });
      return status;
    } catch (e: any) {
      if (!controller.signal.aborted && inFlightRef.current === controller) setError(e?.message || "Failed to check follow status");
    } finally {
      if (inFlightRef.current === controller) {
        setLoading(false);
        inFlightRef.current = null;
      }
    }
  }, [CLIK_URL, userid, favid, scope]);

  React.useEffect(() => {
    if (auto) fetchStatus();
    return () => inFlightRef.current?.abort();
  }, [auto, fetchStatus]);

  return { loading, error, status: result?.scope === scope ? result.status : null, refresh: fetchStatus };
}
