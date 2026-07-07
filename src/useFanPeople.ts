import * as React from "react";
import axios from "axios";

export type Relationship = "mutual" | "one_way_out" | "one_way_in" | "none";

export type FanRow = {
  /** NEW: cursor from backend (fan.id). Use this for pagination. */
  fan_id?: number | null;

  id: number;
  username: string;
  profile_image: string | null;
  color1: string | null;
  last_item1: string | null; // latest post image (may be null)
  followed_at: string | null; // ISO datetime (or null)
  viewerFollows: boolean; // viewer -> user
  followsViewer: boolean; // user -> viewer
  relationship: Relationship;
};

type UseFanPeopleArgs = {
  CLIK_URL: string;
  ownerId: number; // whose profile weâ€™re looking at
  viewerId?: number | null; // loggedUser?.id (can be null/undefined)
  show: boolean; // trigger fetch when true
  limit?: number;
  offset?: number; // kept for compat; backend ignores in keyset
  lastIdFromArray?: number | null; // 0 or null = first page; else fan_id cursor
};

type UseFanPeopleResult = {
  followers: FanRow[];
  following: FanRow[];
  counts: { followers: number; following: number };
  loading: boolean;
  err: string | null;
  reload: () => void;
};

// Normalize any row coming back from the API, safely handling optional fields
function normalizeRow(r: any): FanRow {
  const a = !!(r?.viewer_follows_user ?? r?.viewerFollows);
  const b = !!(r?.user_follows_viewer ?? r?.followsViewer);

  const rel: Relationship =
    r?.relationship ??
    (a && b ? "mutual" : a ? "one_way_out" : b ? "one_way_in" : "none");

  return {
    // carry the backend cursor through:
    fan_id: r?.fan_id != null ? Number(r.fan_id) : null,

    id: Number(r?.id),
    username: String(r?.username ?? ""),
    profile_image: r?.profile_image ?? null,
    color1: r?.color1 ?? null,
    last_item1: r?.last_item1 ?? r?.item1 ?? null, // be tolerant of key names
    followed_at: (r?.followed_at ?? r?.time ?? null) as string | null,
    viewerFollows: a,
    followsViewer: b,
    relationship: rel,
  };
}

export function useFanPeople({
  CLIK_URL,
  ownerId,
  viewerId,
  show,
  limit = 50,
  offset = 0,
  lastIdFromArray = null,
}: UseFanPeopleArgs): UseFanPeopleResult {
  const [followers, setFollowers] = React.useState<FanRow[]>([]);
  const [following, setFollowing] = React.useState<FanRow[]>([]);
  const [counts, setCounts] = React.useState({ followers: 0, following: 0 });
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // keep a ref to cancel in-flight requests between rerenders
  const inflight = React.useRef<AbortController | null>(null);

  const fetchOnce = React.useCallback(async () => {
    if (!show) return;
    if (!Number.isFinite(ownerId)) return;

    // cancel any prior request
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    try {
      setLoading(true);
      setErr(null);

      const url = `${CLIK_URL}/fanpeople`;
      const payload = {
        values: {
          ownerId,
          viewerId: viewerId ?? null,
          limit: 15, // <- use provided limit
          offset, // <- harmless for compat
          lastIdFromArray, // <- this is your cursor (0/null = first page)
        },
      };

      const { data }: any = await axios.post(url, payload, {
        withCredentials: true,
        // signal: controller.signal,
      });

      const followersRaw = Array.isArray(data?.followers) ? data.followers : [];
      const followingRaw = Array.isArray(data?.following) ? data.following : [];

      const f1 = followersRaw.map(normalizeRow);
      const f2 = followingRaw.map(normalizeRow);

      // Wipe + replace (not infinite scroll)
      setFollowers(f1);
      setFollowing(f2);
      setCounts({
        followers: Number(data?.counts?.followers ?? 0),
        following: Number(data?.counts?.following ?? 0),
      });

      // helpful debug
      console.log("[fan/people]", {
        ownerId,
        viewerId,
        lastIdFromArray,
        limit,
        counts: data?.counts,
        followers: f1,
        following: f2,
      });
    } catch (e: any) {
      const canceled =
        e?.name === "CanceledError" || e?.code === "ERR_CANCELED";
      if (!canceled) {
        console.error("fan/people error:", e);
        setErr("Failed to fetch list");
      }
    } finally {
      setLoading(false);
      inflight.current = null;
    }
  }, [show, ownerId, viewerId, limit, offset, lastIdFromArray, CLIK_URL]);

  // auto-fetch on dependencies
  React.useEffect(() => {
    fetchOnce();
    return () => inflight.current?.abort();
  }, [fetchOnce]);

  return { followers, following, counts, loading, err, reload: fetchOnce };
}
