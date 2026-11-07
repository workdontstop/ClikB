// EmotionsGate.tsx (ROOT / CONTAINER) — direct fetch + button pagination (wipe & replace unless 0 results)
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./store";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea, publishFeedsArea, removeFeedsArea } from './brainstormSlice';
import type { FeedAreaId, FeedControl } from './feedsControlSnapshot';
import { navigationControl } from './navigationControlSnapshot';
import type { NavigationViewport } from './navigationControlSnapshot';
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

    const dispatch = useDispatch();
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
    const [followRevision, setFollowRevision] = useState(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);

    // NEW: Likes mode state (own cursor, rows, count)
    const [cursorLikes, setCursorLikes] = useState<number>(initiallastidfan);
    const [nextCursorLikes, setNextCursorLikes] = useState<number | null>(null);
    const [likesRows, setLikesRows] = useState<FanRow[]>([]);
    const [likesCount, setLikesCount] = useState<number>(0);
    const [resolvedLikesPost, setResolvedLikesPost] = useState<number | null>(null);
    const paginationRequestRef = useRef<{ listType: string; from: number; to: number } | null>(null);
    const [listViewport, setListViewport] = useState<NavigationViewport | null>(null);
    const previousSettledViewport = useRef<NavigationViewport | null>(null);

    useEffect(() => {
        previousSettledViewport.current = null;
        setListViewport(null);
    }, [ownerId, Likes, view]);

    useEffect(() => {
        if (!showEmotions || !listViewport?.settledAt || listViewport.isScrolling) return;
        const previous = previousSettledViewport.current;
        if (previous?.settledAt === listViewport.settledAt) return;
        previousSettledViewport.current = listViewport;
        if (!previous || (previous.region === listViewport.region && previous.visibleIds.join('|') === listViewport.visibleIds.join('|'))) return;
        dispatch(recordNavigationTransition({
            actor: 'unknown', kind: 'area',
            before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { listType: Likes ? 'likes' : view, scrollRegion: previous.region, visibleIds: previous.visibleIds.join(',') } },
            after: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { listType: Likes ? 'likes' : view, scrollRegion: listViewport.region, visibleIds: listViewport.visibleIds.join(',') } },
            outcome: 'succeeded', authoritativeSource: 'EmotionsGateDesign scroll settlement',
        }));
    }, [dispatch, showEmotions, listViewport, ownerId, Likes, view]);


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

    const closeRelationships = React.useCallback((source: string, controlName: 'close' | 'backdrop_close' = 'close') => {
        paginationRequestRef.current = null;
        onClose?.();
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'area',
            before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { open: true, view: Likes ? 'likes' : view } },
            after: { areaId: 'clikb.profile_header', controlId: `clikb.navigation.relationships.control.${controlName}`, entityId: ownerId, state: { relationshipsOpen: false } },
            outcome: 'succeeded', authoritativeSource: source,
        }));
    }, [dispatch, Likes, onClose, ownerId, view]);

    // Close on ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeRelationships('EmotionsGate Escape handler');
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [closeRelationships]);

    const handleSetView = (next: "followers" | "following") => {
        // in Likes mode there’s no tab switch; keep logic for normal mode
        if (Likes) return;
        paginationRequestRef.current = null;
        const previousCursor = view === 'followers' ? cursorFollowers : cursorFollowing;
        if (next === "followers") {
            setCursorFollowers(0);
            setNextCursorFollowers(null);
        } else {
            setCursorFollowing(0);
            setNextCursorFollowing(null);
        }
        setView(next);
        onViewChange?.(next);
        if (next === view && previousCursor === 0) return;
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'area',
            before: { areaId: 'clikb.navigation.relationships', state: { view, ownerId, cursor: previousCursor } },
            after: { areaId: 'clikb.navigation.relationships', controlId: `clikb.navigation.relationships.control.tab_${next}`, entityId: ownerId, state: { view: next, ownerId, cursor: 0 } },
            outcome: 'succeeded', authoritativeSource: 'EmotionsGate tab state handler',
        }));
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
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;

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
                    } else setNextCursorFollowers(null);
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
                    } else setNextCursorFollowing(null);
                }

                setCounts({
                    followers: Number(data?.counts?.followers ?? 0),
                    following: Number(data?.counts?.following ?? 0),
                });
                const paginationRequest = paginationRequestRef.current;
                if (paginationRequest && paginationRequest.listType === view && paginationRequest.to === activeCursor) {
                    dispatch(recordNavigationTransition({
                        actor: 'manual', kind: 'area',
                        before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { view, cursor: paginationRequest.from } },
                        after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.navigation.relationships.control.load_more', entityId: ownerId, state: { view, cursor: activeCursor, visibleRowCount: view === 'followers' ? followersRaw.length : followingRaw.length } },
                        outcome: 'succeeded', authoritativeSource: 'POST /fanpeople response',
                    }));
                    paginationRequestRef.current = null;
                }
            } catch (e: any) {
                if (controller.signal.aborted || e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
                console.error("fan/people fetch error:", e);
                setErr("Failed to fetch list");
                const paginationRequest = paginationRequestRef.current;
                if (paginationRequest && paginationRequest.listType === view && paginationRequest.to === activeCursor) {
                    dispatch(recordNavigationTransition({
                        actor: 'manual', kind: 'area',
                        before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { view, cursor: paginationRequest.from } },
                        after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.navigation.relationships.control.load_more', entityId: ownerId, state: { view, cursor: paginationRequest.from } },
                        outcome: 'failed', authoritativeSource: 'POST /fanpeople error',
                    }));
                    paginationRequestRef.current = null;
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [Likes, showEmotions, ownerId, loggedUser?.id, view, activeCursor, limit, CLIK_URL, isFirstPage, lastId, followRevision]);

    // --- NEW: Likes fetch (runs only when Likes === true)
    useEffect(() => {
        if (!Likes) return;
        if (!showEmotions) return;
        if (!Number.isFinite(ownerId)) return;

        const controller = new AbortController();
        setResolvedLikesPost(null);

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
                if (controller.signal.aborted) return;

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
                setResolvedLikesPost(Number(Postid));
                const paginationRequest = paginationRequestRef.current;
                if (paginationRequest && paginationRequest.listType === 'likes' && paginationRequest.to === cursorLikes) {
                    dispatch(recordNavigationTransition({
                        actor: 'manual', kind: 'area',
                        before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { view: 'likes', cursor: paginationRequest.from } },
                        after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.navigation.relationships.control.load_more', entityId: ownerId, state: { view: 'likes', cursor: cursorLikes, visibleRowCount: likesRaw.length } },
                        outcome: 'succeeded', authoritativeSource: 'POST /likesx response',
                    }));
                    paginationRequestRef.current = null;
                }
            } catch (e: any) {
                if (controller.signal.aborted) return;
                console.error("likes fetch error:", e);
                setErr("Failed to fetch likes");
                const paginationRequest = paginationRequestRef.current;
                if (paginationRequest?.listType === 'likes' && paginationRequest.to === cursorLikes) {
                    dispatch(recordNavigationTransition({
                        actor: 'manual', kind: 'area',
                        before: { areaId: 'clikb.navigation.relationships', entityId: ownerId, state: { view: 'likes', cursor: paginationRequest.from } },
                        after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.navigation.relationships.control.load_more', entityId: ownerId, state: { view: 'likes', cursor: paginationRequest.from } },
                        outcome: 'failed', authoritativeSource: 'POST /likesx error',
                    }));
                    paginationRequestRef.current = null;
                }
            } finally {
                setLoading(false);
            }
        };

        run();
        return () => controller.abort();
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

    // called by Design’s + button. It advances the cursor for the active "mode".
    const paginate = () => {
        if (Likes) {
            if (nextCursorLikes != null) {
                paginationRequestRef.current = { listType: 'likes', from: cursorLikes, to: nextCursorLikes };
                setCursorLikes(nextCursorLikes);
            }
            return;
        }
        if (view === "followers") {
            if (nextCursorFollowers != null) {
                paginationRequestRef.current = { listType: view, from: cursorFollowers, to: nextCursorFollowers };
                setCursorFollowers(nextCursorFollowers);
            }
        } else {
            if (nextCursorFollowing != null) {
                paginationRequestRef.current = { listType: view, from: cursorFollowing, to: nextCursorFollowing };
                setCursorFollowing(nextCursorFollowing);
            }
        }
    };

    useEffect(() => {
        if (!showEmotions) return;
        const areaId = 'clikb.navigation.relationships';
        dispatch(publishNavigationArea({
            areaId,
            source: 'EmotionsGate',
            scrolls: listViewport ? { people_list: listViewport } : undefined,
            state: {
                listType: Likes ? 'likes' : view,
                ownerId: Number(ownerId) || 0,
                postId: Likes ? Number(Postid) || 0 : null,
                loading,
                error: err || '',
                visibleRowCount: rows.length,
                followersCount: Number(effectiveCounts.followers || 0),
                followingCount: Number(effectiveCounts.following || 0),
                cursor: Likes ? cursorLikes : activeCursor,
                nextCursor: Likes ? nextCursorLikes : view === 'followers' ? nextCursorFollowers : nextCursorFollowing,
                hasMoreKnown: false,
            },
            visibleControls: [
                ...(!Likes ? [
                    navigationControl(areaId, 'tab_following', 'EmotionsGate.handleSetView(following)'),
                    navigationControl(areaId, 'tab_followers', 'EmotionsGate.handleSetView(followers)'),
                ] : []),
                navigationControl(areaId, 'close', 'EmotionsGate.onClose'),
                navigationControl(areaId, 'backdrop_close', 'EmotionsGateDesign.backdrop.onClick'),
                ...(!loading && !err && rows.length > 0 && (listViewport?.region === 'end' || listViewport?.region === 'all') && listViewport.visibleIds.includes('clikb.navigation.relationships.control.load_more')
                    ? [navigationControl(areaId, 'load_more', 'EmotionsGate.paginate', 'manual_only',
                        Likes ? nextCursorLikes != null : view === 'followers' ? nextCursorFollowers != null : nextCursorFollowing != null,
                        undefined, (Likes ? nextCursorLikes : view === 'followers' ? nextCursorFollowers : nextCursorFollowing) == null
                            ? 'No next page cursor' : undefined)]
                    : []),
            ],
        }));
    }, [dispatch, showEmotions, Likes, view, ownerId, Postid, loading, err, rows.length, effectiveCounts.followers, effectiveCounts.following, cursorLikes, activeCursor, nextCursorLikes, nextCursorFollowers, nextCursorFollowing, listViewport]);

    // Likes reuses the Navigation relationship overlay. This Feeds area links
    // the liked post to that owner; it does not duplicate row/follow actions.
    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.likes';
        if (!showEmotions || !Likes) {
            dispatch(removeFeedsArea({ areaId, source: 'EmotionsGate' }));
            return;
        }
        const control = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate', enabled = true): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef, enabled, aiPolicy: policy,
            targetId: Number(Postid) || 0,
            ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
            ...(!enabled ? { disabledReason: 'No next page cursor' } : {}),
        });
        dispatch(publishFeedsArea({ areaId, source: 'EmotionsGate', instanceId: 'likes',
            state: {
                postId: Number(Postid) || 0, relationshipAreaId: 'clikb.navigation.relationships',
                scrollOwner: 'clikb.navigation.relationships:people_list',
                status: err ? 'error' : loading || resolvedLikesPost !== Number(Postid) ? 'loading' : likesRows.length ? 'ready' : 'empty',
                errorHint: err ? String(err).slice(0, 120) : '',
                count: likesCount, loadedRowCount: likesRows.length,
                visibleLikerIds: (listViewport?.visibleIds ?? [])
                    .filter(id => id.startsWith('clikb.navigation.relationship_row.'))
                    .slice(0, 18).map(id => id.slice('clikb.navigation.relationship_row.'.length)).join(','),
                scrollRegion: listViewport?.region ?? 'unknown',
                canScrollBackward: Boolean(listViewport?.canScrollBackward),
                canScrollForward: Boolean(listViewport?.canScrollForward),
                isScrolling: Boolean(listViewport?.isScrolling),
                settledAt: listViewport?.settledAt ?? null,
                cursor: cursorLikes, nextCursor: nextCursorLikes,
                hasMoreKnown: false,
            }, visiblePosts: [],
            visibleControls: [
                control('close', 'EmotionsGate.onClose'),
                control('backdrop_close', 'EmotionsGateDesign.backdrop.onClick'),
                control('scroll_people', 'EmotionsGateDesign.people_list manual scroll', 'manual_only'),
                ...(!loading && !err && likesRows.length > 0 && (listViewport?.region === 'end' || listViewport?.region === 'all') && listViewport.visibleIds.includes('clikb.navigation.relationships.control.load_more')
                    ? [control('load_more', 'EmotionsGate.paginate', 'manual_only', nextCursorLikes != null)] : []),
            ],
        }));
    }, [dispatch, showEmotions, Likes, Postid, loading, err, likesRows.length,
          likesCount, listViewport, cursorLikes, nextCursorLikes, resolvedLikesPost]);
    useEffect(() => () => {
        dispatch(removeFeedsArea({ areaId: 'clikb.feeds.likes', source: 'EmotionsGate' }));
    }, [dispatch]);

    useEffect(() => () => {
        dispatch(removeNavigationArea({ areaId: 'clikb.navigation.relationships', source: 'EmotionsGate' }));
    }, [dispatch]);

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

    const updateViewerFollow = (targetId: number, following: boolean) => {
        const updateRows = (previous: FanRow[]) => previous.map(row => row.id !== targetId ? row : {
            ...row,
            viewerFollows: following,
            relationship: following ? (row.followsViewer ? 'mutual' : 'one_way_out') : (row.followsViewer ? 'one_way_in' : 'none'),
        } satisfies FanRow);
        const isOwnList = Number(loggedUser?.id) === Number(ownerId);
        setFollowersRows(updateRows);
        setLikesRows(updateRows);
        setFollowingRows(previous => isOwnList && !following
            ? previous.filter(row => row.id !== targetId)
            : updateRows(previous));
        if (isOwnList && !Likes) setFollowRevision(revision => revision + 1);
    };

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
            onClose={(reason) => closeRelationships(
                reason === 'backdrop' ? 'EmotionsGate backdrop handler' : 'EmotionsGate close handler',
                reason === 'backdrop' ? 'backdrop_close' : 'close',
            )}
            view={view}
            onSetView={handleSetView}
            counts={effectiveCounts}
            loading={loading}
            err={err}
            rows={rows}
            loggedUser={loggedUser}
            onPaginate={paginate}
            onViewportChange={setListViewport}
        >

            {loading && <Typography sx={{ opacity: 0.85 }}>Loading…</Typography>}
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
                        visibleInList={!Likes || Boolean(listViewport?.visibleIds.includes(`clikb.navigation.relationship_row.${Number(row.id)}`))}
                        view={view}
                        showEmotions={showEmotions}
                        rows={rows}
                        key={row.id}
                        item={row}
                        onViewerFollowChange={updateViewerFollow}
                        index={index}
                        isDark={!!isDark}
                        loggedUser={loggedUser}
                        onClose={() => closeRelationships('EmotionsRow profile-navigation close')}
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
                            ? "When people like your stuff, they’ll appear here."
                            : "When people connect, they’ll appear here with their latest post."}
                    </Typography>
                </Box>
            )}

            {children}
        </EmotionsGateDesign>
    );
}
