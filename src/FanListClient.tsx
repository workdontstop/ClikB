// FanListClient.tsx
import React from "react";
import axios from "axios";

type FanRow = {
    id: number;
    username: string;
    profile_image: string | null;
    color1: string | null;
    followed_at: string; // ISO string from DB
};

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
    const [counts, setCounts] = React.useState({ followers: 0, following: 0 });
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
            const { data } = await axios.post<FanListResponse>(
                `${CLIK_URL}/fanList`,
                { values: dataHold },
                { withCredentials: true, }
            );

            // basic shape check
            if (!data?.ok) throw new Error("Bad response");

            setFollowers(data.followers ?? []);
            setFollowing(data.following ?? []);
            setCounts(data.counts ?? { followers: 0, following: 0 });
            setPage({ limit: data.limit, offset: data.offset });
            console.log('good');
        } catch (e: any) {
            console.log(e);
            // optionally keep previous state
        } finally {
            setLoading(false);
            inFlightRef.current = null;
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
        followers,
        following,
        counts,       // { followers, following }
        page,         // { limit, offset }
        refresh: () => fetchFanList(page.offset),
        setOffset: (o: number) => fetchFanList(o),
        setLimit: (l: number) => { /* optional: update and refetch */ },
    };
}
