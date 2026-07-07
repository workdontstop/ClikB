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
  const [status, setStatus] = React.useState<{
    following: boolean;
    followedBy: boolean;
    relationship: Relationship;
  } | null>(null);

  const fetchStatus = React.useCallback(async () => {
    // abort any prior request
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post<FanStatusResponse>(
        `${CLIK_URL}/fanStatus`,
        { values: { userid, favid } },
        { withCredentials: true }
      );
      if (!data?.ok) throw new Error((data as any)?.error || "Bad response");
      setStatus({
        following: data.following,
        followedBy: data.followedBy,
        relationship: data.relationship,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to check follow status");
    } finally {
      setLoading(false);
      inFlightRef.current = null;
    }
  }, [CLIK_URL, userid, favid]);

  React.useEffect(() => {
    if (auto) fetchStatus();
    return () => inFlightRef.current?.abort();
  }, [auto, fetchStatus]);

  return { loading, error, status, refresh: fetchStatus };
}
