// EmotionsGate.tsx (ROOT / CONTAINER) â€” direct fetch + button pagination (wipe & replace unless 0 results)
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "./store";
import type { FanRow } from "./useFanPeople"; // keeping the type for Design/Row props
import EmotionsGateDesign, { EmotionsRow } from "./EmotionsGateDesign";
import { Box, Typography } from "@mui/material";

export type EmotionsGateProps = {
    type?: number;
    defaultView?: "followers" | "following";
    showEmotions: boolean;
    ownerId: number;
    lastIdFromArray?: any; // ignored now (we manage cursors here)
    limit?: number;        // default 15 to match backend testing
    offset?: number;       // not used (keyset), kept for prop compat
    onClose?: () => void;
    onViewChange?: (view: "followers" | "following") => void;
    children?: React.ReactNode;
    initiallastidfan: any;
    setIsFullscreen: any;
    isFullscreen: any;
    viewx: any;
    lastId: any;
    setlastid: any;
    setEmotionRoute: any;
    emotionRoute: any;

    // NEW
    Likes?: boolean;   // if true, show Likes list instead of followers/following
    Postid?: number;   // post id to fetch likes for


    searchDataNav: any;
    MyPageIdNav: any;
    feedLastIdNav: any;
    feedScrollPosNav: any;


    setIsFullscreen1: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen1: boolean;

    setIsFullscreen2: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen2: boolean;

    setIsFullscreen3: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen3: boolean;
};

export default function EmotionsGate({
    type,
    defaultView,
    showEmotions,
    ownerId,
    lastIdFromArray, // not used
    limit,
    offset = 0,      // not used
    onClose,
    onViewChange,
    children,
    initiallastidfan,
    setIsFullscreen,
    isFullscreen,
    viewx,
    lastId,
    setlastid,
    setEmotionRoute,
    emotionRoute,

    // NEW
    Likes = false,
    Postid,

    searchDataNav,
    MyPageIdNav,
    feedLastIdNav,
    feedScrollPosNav,

    setIsFullscreen1,
    isFullscreen1,
    setIsFullscreen2,
    isFullscreen2,
    setIsFullscreen3,
    isFullscreen3,


}: EmotionsGateProps) {

    const isDark = useSelector((s: RootState) => s.settings.darkMode);
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    // initial tab from props (still used in non-Likes mode)
    const initialViewFromProps: "followers" | "following" =
        defaultView ?? (type === 1 ? "following" : "followers");

    const [view, setView] = useState<"followers" | "following">(initialViewFromProps);

    // separate cursors for each tab (keyset on fan.id); 0 = first page
    const [cursorFollowers, setCursorFollowers] = useState<number>(initiallastidfan);
    const [cursorFollowing, setCursorFollowing] = useState<number>(initiallastidfan);

    // store the *next* cursor (min fan_id of current page)
    const [nextCursorFollowers, setNextCursorFollowers] = useState<number | null>(null);
    const [nextCursorFollowing, setNextCursorFollowing] = useState<number | null>(null);

    // rows & meta (non-Likes mode)
    const [followersRows, setFollowersRows] = useState<FanRow[]>([]);
    const [followingRows, setFollowingRows] = useState<FanRow[]>([]);
    const [counts, setCounts] = useState({ followers: 0, following: 0 });
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);

    // NEW: Likes mode state (own cursor, rows, count)
    const [cursorLikes, setCursorLikes] = useState<number>(initiallastidfan);
    const [nextCursorLikes, setNextCursorLikes] = useState<number | null>(null);
    const [likesRows, setLikesRows] = useState<FanRow[]>([]);
    const [likesCount, setLikesCount] = useState<number>(0);


    // sync when props change (and reset pagination)
    useEffect(() => {
        if (lastId > 0) {
            setView(viewx);

            if (viewx === "following") setCursorFollowing(lastId);
            if (viewx === "followers") setCursorFollowers(lastId);
        } else {
            setView(defaultView ?? (type === 1 ? "following" : "followers"));
        }

        setCursorFollowers(0);
        setCursorFollowing(0);
        setNextCursorFollowers(null);
        setNextCursorFollowing(null);

        // reset Likes cursor too
        setCursorLikes(0);
        setNextCursorLikes(null);
    }, [defaultView, type, lastId, viewx, showEmotions]);

    // sync when props change (and reset pagination)
    useEffect(() => {
        if (lastId > 0) {
            if (viewx === "following") setCursorFollowing(lastId);
            if (viewx === "followers") setCursorFollowers(lastId);
            setCursorLikes(lastId); // align likes cursor when provided
        } else {
            setCursorFollowers(initiallastidfan);
            setCursorFollowing(initiallastidfan);
            setCursorLikes(initiallastidfan);
        }
    }, [initiallastidfan, viewx, lastId]);

    // Close on ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleSetView = (next: "followers" | "following") => {
        // in Likes mode thereâ€™s no tab switch; keep logic for normal mode
        if (Likes) return;
        if (next === "followers") {
            setCursorFollowers(0);
            setNextCursorFollowers(null);
        } else {
            setCursorFollowing(0);
            setNextCursorFollowing(null);
        }
        setView(next);
        onViewChange?.(next);
    };

    // active cursor based on current tab (non-Likes)
    const activeCursor = view === "followers" ? cursorFollowers : cursorFollowing;
    const isFirstPage = activeCursor === 0;

    // --- followers/following fetch (skip entirely in Likes mode)
    useEffect(() => {
        if (Likes) return; // do not fetch fanpeople in Likes mode
        if (!showEmotions) return;
        if (!Number.isFinite(ownerId)) return;

        const controller = new AbortController();
        const run = async () => {
            try {
                setLoading(true);
                setErr(null);

                const payload = {
                    values: {
                        ownerId,
                        viewerId: loggedUser?.id ?? 0,
                        limit: 15,
                        lastIdFromArray: activeCursor || 0,
                    },
                };

                const { data }: any = await axios.post(`${CLIK_URL}/fanpeople`, payload, {
                    withCredentials: true,
                    // signal: controller.signal,
                });

                const followersRaw: any[] = Array.isArray(data?.followers) ? data.followers : [];
                const followingRaw: any[] = Array.isArray(data?.following) ? data.following : [];

                if (view === "followers") {
                    if (isFirstPage || followersRaw.length > 0) {
                        const mapped: FanRow[] = followersRaw.map((r: any) => ({
                            fan_id: Number(r?.fan_id),
                            id: Number(r?.id),
                            username: String(r?.username ?? ""),
                            profile_image: r?.profile_image ?? null,
                            color1: r?.color1 ?? null,
                            last_item1: r?.last_item1 ?? r?.item1 ?? null,
                            followed_at: (r?.followed_at ?? r?.time ?? null) as string | null,
                            viewerFollows: !!(r?.viewer_follows_user ?? r?.viewerFollows),
                            followsViewer: !!(r?.user_follows_viewer ?? r?.followsViewer),
                            relationship:
                                !!(r?.viewer_follows_user ?? r?.viewerFollows) && !!(r?.user_follows_viewer ?? r?.followsViewer)
                                    ? "mutual"
                                    : !!(r?.viewer_follows_user ?? r?.viewerFollows)
                                        ? "one_way_out"
                                        : !!(r?.user_follows_viewer ?? r?.followsViewer)
                                            ? "one_way_in"
                                            : "none",
                        }));
                        setFollowersRows(mapped);

                        const fanIds = followersRaw
                            .map((r) => Number(r?.fan_id))
                            .filter((n) => Number.isFinite(n)) as number[];
                        setNextCursorFollowers(fanIds.length ? Math.min(...fanIds) : null);
                    }
                } else {
                    if (isFirstPage || followingRaw.length > 0) {
                        const mapped: FanRow[] = followingRaw.map((r: any) => ({
                            fan_id: Number(r?.fan_id),
                            id: Number(r?.id),
                            username: String(r?.username ?? ""),
                            profile_image: r?.profile_image ?? null,
                            color1: r?.color1 ?? null,
                            last_item1: r?.last_item1 ?? r?.item1 ?? null,
                            followed_at: (r?.followed_at ?? r?.time ?? null) as string | null,
                            viewerFollows: !!(r?.viewer_follows_user ?? r?.viewerFollows),
                            followsViewer: !!(r?.user_follows_viewer ?? r?.followsViewer),
                            relationship:
                                !!(r?.viewer_follows_user ?? r?.viewerFollows) && !!(r?.user_follows_viewer ?? r?.followsViewer)
                                    ? "mutual"
                                    : !!(r?.viewer_follows_user ?? r?.viewerFollows)
                                        ? "one_way_out"
                                        : !!(r?.user_follows_viewer ?? r?.followsViewer)
                                            ? "one_way_in"
                                            : "none",
                        }));
                        setFollowingRows(mapped);

                        const fanIds = followingRaw
                            .map((r) => Number(r?.fan_id))
                            .filter((n) => Number.isFinite(n)) as number[];
                        setNextCursorFollowing(fanIds.length ? Math.min(...fanIds) : null);
                    }
                }

                setCounts({
                    followers: Number(data?.counts?.followers ?? 0),
                    following: Number(data?.counts?.following ?? 0),
                });
            } catch (e: any) {
                if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
                console.error("fan/people fetch error:", e);
                setErr("Failed to fetch list");
            } finally {
                setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [Likes, showEmotions, ownerId, loggedUser?.id, view, activeCursor, limit, CLIK_URL, isFirstPage, lastId]);

    // --- NEW: Likes fetch (runs only when Likes === true)
    useEffect(() => {
        if (!Likes) return;
        if (!showEmotions) return;
        if (!Number.isFinite(ownerId)) return;

        const run = async () => {
            try {
                setLoading(true);
                setErr(null);

                const payload = {
                    values: {
                        ownerId,
                        viewerId: loggedUser?.id ?? 0,
                        limit: 15,
                        lastIdFromArray: cursorLikes || 0,
                        postid: Number(Postid) || 0, // send post id for likes route
                    },
                };

                // Minimal likes endpoint (expects { likes: [], counts: { likes: number } })
                const { data }: any = await axios.post(`${CLIK_URL}/likesx`, payload, {
                    withCredentials: true,
                });

                const likesRaw: any[] = Array.isArray(data?.likes) ? data.likes : [];
                const isFirstPageLikes = cursorLikes === 0;

                if (isFirstPageLikes || likesRaw.length > 0) {
                    const mapped: FanRow[] = likesRaw.map((r: any) => ({
                        // Map to your existing row type so EmotionsRow renders identically
                        fan_id: Number(r?.fan_id ?? r?.id ?? 0),
                        id: Number(r?.id),
                        username: String(r?.username ?? ""),
                        profile_image: r?.profile_image ?? null,
                        color1: r?.color1 ?? null,
                        last_item1: r?.last_item1 ?? r?.item1 ?? null,
                        followed_at: (r?.followed_at ?? r?.time ?? null) as string | null,
                        viewerFollows: !!(r?.viewer_follows_user ?? r?.viewerFollows),
                        followsViewer: !!(r?.user_follows_viewer ?? r?.followsViewer),
                        relationship:
                            !!(r?.viewer_follows_user ?? r?.viewerFollows) && !!(r?.user_follows_viewer ?? r?.followsViewer)
                                ? "mutual"
                                : !!(r?.viewer_follows_user ?? r?.viewerFollows)
                                    ? "one_way_out"
                                    : !!(r?.user_follows_viewer ?? r?.followsViewer)
                                        ? "one_way_in"
                                        : "none",
                    }));
                    setLikesRows(mapped);

                    const fanIds = likesRaw
                        .map((r) => Number(r?.fan_id ?? r?.id))
                        .filter((n) => Number.isFinite(n)) as number[];
                    setNextCursorLikes(fanIds.length ? Math.min(...fanIds) : null);
                }

                setLikesCount(Number(data?.counts?.likes ?? data?.likesCount ?? 0));
            } catch (e: any) {
                console.error("likes fetch error:", e);
                setErr("Failed to fetch likes");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [Likes, showEmotions, ownerId, loggedUser?.id, CLIK_URL, cursorLikes, Postid]);

    // rows shown (Likes overrides followers/following)
    const rows: FanRow[] = useMemo(
        () => (Likes ? likesRows : (view === "followers" ? followersRows : followingRows)),
        [Likes, likesRows, view, followersRows, followingRows]
    );

    // counts to display (reuse the same prop shape; in Likes mode we show the likes count as the left/top number)
    const effectiveCounts = Likes
        ? { followers: likesCount, following: 0 }
        : counts;

    // called by Designâ€™s + button. It advances the cursor for the active "mode".
    const paginate = () => {
        if (Likes) {
            if (nextCursorLikes != null) setCursorLikes(nextCursorLikes);
            return;
        }
        if (view === "followers") {
            if (nextCursorFollowers != null) setCursorFollowers(nextCursorFollowers);
        } else {
            if (nextCursorFollowing != null) setCursorFollowing(nextCursorFollowing);
        }
    };

    // optional: reset the active tab to first page (kept as-is; Likes gets its own reset)
    const refresh = () => {
        if (Likes) {
            setCursorLikes(0);
            setNextCursorLikes(null);
            return;
        }
        if (view === "followers") {
            setCursorFollowers(0);
            setNextCursorFollowers(null);
        } else {
            setCursorFollowing(0);
            setNextCursorFollowing(null);
        }
    };

    if (!showEmotions) return null;

    return (
        <EmotionsGateDesign
            isFullscreen={isFullscreen}
            likesCount={likesCount}
            Likes={Likes}
            setEmotionRoute={setEmotionRoute}
            emotionRoute={emotionRoute}
            setlastid={setlastid}
            isDark={!!isDark}
            showEmotions={showEmotions}
            onClose={onClose}
            view={view}
            onSetView={handleSetView}
            counts={effectiveCounts}
            loading={loading}
            err={err}
            rows={rows}
            loggedUser={loggedUser}
            onPaginate={paginate}
        >

            {loading && <Typography sx={{ opacity: 0.85 }}>Loadingâ€¦</Typography>}
            {err && <Typography color="error">{err}</Typography>}

            {!loading &&
                !err &&
                rows.map((row, index) => (
                    <EmotionsRow
                        setIsFullscreen1={setIsFullscreen1}
                        setIsFullscreen2={setIsFullscreen2}
                        setIsFullscreen3={setIsFullscreen3}

                        isFullscreen1={isFullscreen1}
                        isFullscreen2={isFullscreen2}
                        isFullscreen3={isFullscreen3}

                        searchDataNav={searchDataNav}
                        MyPageIdNav={MyPageIdNav}
                        feedLastIdNav={feedLastIdNav}
                        feedScrollPosNav={feedScrollPosNav}


                        LikesPostid={Postid}
                        Likes={Likes}
                        view={view}
                        showEmotions={showEmotions}
                        rows={rows}
                        key={row.id}
                        item={row}
                        index={index}
                        isDark={!!isDark}
                        loggedUser={loggedUser}
                        onClose={onClose}
                        ownerId={ownerId}
                        setIsFullscreen={setIsFullscreen}
                        isFullscreen={isFullscreen}
                    />
                ))}

            {!loading && !err && rows.length === 0 && (
                <Box sx={{ textAlign: "center", py: 6, opacity: 0.8 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                        {Likes ? "No likes yet" : `No ${view === "followers" ? "followers" : "following"} yet`}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {Likes
                            ? "When people like your stuff, theyâ€™ll appear here."
                            : "When people connect, theyâ€™ll appear here with their latest post."}
                    </Typography>
                </Box>
            )}

            {children}
        </EmotionsGateDesign>
    );
}
