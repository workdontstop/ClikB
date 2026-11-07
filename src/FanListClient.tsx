// FanListClient.tsx
import React from "react";
import axios from "axios";
const emptyCounts = { followers: 0, following: 0 };

type FanRow = {
    id: number;
    username: string;
    profile_image: string | null;
    color1: string | null;
    followed_at: string; // ISO string from DB
};
const emptyRows: FanRow[] = [];

type FanListResponse = {
    ok: true;
    userId: number;
    limit: number;
    offset: number;
    counts: { followers: number; following: number };
    followers: FanRow[];
    following: FanRow[];
};

type UseFanListOpts = {
    id: number;        // the profile/user id to fetch for
    limit?: number;    // default 50
    offset?: number;   // default 0
    CLIK_URL: string;  // your base url
};

export function useFanList({ id, limit = 50, offset = 0, CLIK_URL }: UseFanListOpts) {
    const inFlightRef = React.useRef<AbortController | null>(null);

    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [followers, setFollowers] = React.useState<FanRow[]>([]);
    const [following, setFollowing] = React.useState<FanRow[]>([]);
    const [counts, setCounts] = React.useState(emptyCounts);
    const [loadedId, setLoadedId] = React.useState<number | null>(null);
    const [page, setPage] = React.useState({ limit, offset });

    const fetchFanList = React.useCallback(async (nextOffset = 0) => {
        // abort any prior request
        inFlightRef.current?.abort();
        const controller = new AbortController();
        inFlightRef.current = controller;

        setLoading(true);
        setError(null);

        const dataHold = { id, limit: page.limit, offset: nextOffset };

        try {
            const config = { withCredentials: true, signal: controller.signal };
            const { data } = await axios.post<FanListResponse>(
                `${CLIK_URL}/fanList`,
                { values: dataHold },
                config
            );
            if (controller.signal.aborted || inFlightRef.current !== controller) return;

            // basic shape check
            if (!data?.ok || Number(data.userId) !== id) throw new Error("Bad response");

            setFollowers(data.followers ?? []);
            setFollowing(data.following ?? []);
            setCounts(data.counts ?? emptyCounts);
            setLoadedId(id);
            setPage({ limit: data.limit, offset: data.offset });
            console.log('good');
        } catch (e: any) {
            console.log(e);
            // optionally keep previous state
        } finally {
            if (inFlightRef.current === controller) {
                setLoading(false);
                inFlightRef.current = null;
            }
        }
    }, [CLIK_URL, id, page.limit]);

    // initial load
    React.useEffect(() => {
        fetchFanList(0);
        return () => inFlightRef.current?.abort();
    }, [fetchFanList]);

    return {
        loading,
        error,
        followers: loadedId === id ? followers : emptyRows,
        following: loadedId === id ? following : emptyRows,
        counts: loadedId === id ? counts : emptyCounts,
        page,         // { limit, offset }
        refresh: () => fetchFanList(page.offset),
        setOffset: (o: number) => fetchFanList(o),
        setLimit: (l: number) => { /* optional: update and refetch */ },
    };
}
