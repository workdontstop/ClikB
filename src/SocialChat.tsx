import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Dialog, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LanguageIcon from '@mui/icons-material/Language';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ListIcon from '@mui/icons-material/List';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplyIcon from '@mui/icons-material/Reply';
import SendIcon from '@mui/icons-material/Send';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShareIcon from '@mui/icons-material/Share';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { getExecutingNavigationAction } from './navigationActionProvenance';
import { registerSharedBack } from './SharedBackControl';
import { useNavigationViewport } from './useNavigationViewport';
import { store, type RootState } from './store';
import './SocialChat.css';

type Tab = 'global' | 'feeds' | 'post' | 'notifications' | 'rooms';
type Filter = 'all' | 'likes' | 'chats';
type ChatEntry = {
  tab: Tab; postId?: number; roomId?: number; filter: Filter; member: number; paused?: boolean;
  threadRootId?: number; threadHighlightId?: number; threadReturnTab?: Tab;
};
type Person = { authorId: number; username: string; avatar?: string };
type Message = Person & {
  id: number | string; body: string; createdAt: string; postId?: number; postTitle?: string; postThumb?: string;
  replyId?: number; replyUsername?: string; sharedMessageId?: number; sharedBody?: string;
  legacyCommentId?: number;
  replyCount?: number;
};
type Activity = Person & {
  id: number; kind: 'reply' | 'like' | 'room' | 'welcome' | 'credit'; postId?: number; postTitle?: string; roomId?: number;
  body?: string; seenAt?: string; createdAt: string; messageId?: number; replyId?: number;
};
type Room = Person & { id: number; unread: number; lastMessageId: number };
type RoomCursor = { lastMessageId: number; roomId: number };
const area = 'clikb.navigation.social_chat';
const tabs = [
  { id: 'global', label: 'Global', Icon: LanguageIcon },
  { id: 'feeds', label: 'Feeds', Icon: DynamicFeedIcon },
  { id: 'post', label: 'Post', Icon: ChatBubbleOutlineIcon },
  { id: 'notifications', label: 'Notifications', Icon: NotificationsNoneIcon },
  { id: 'rooms', label: 'Rooms', Icon: ForumOutlinedIcon },
] as const;
const filters = [
  { id: 'all', label: 'All', Icon: ListIcon },
  { id: 'likes', label: 'Likes', Icon: FavoriteBorderIcon },
  { id: 'chats', label: 'Chats', Icon: ChatBubbleOutlineIcon },
] as const;
const chatContext = createContext({ open: (_postId?: number) => {}, isOpen: false, hasUnreadNotifications: false });
export const useSocialChat = () => useContext(chatContext);

export function SocialUnreadDot({ accent }: { accent: string }) {
  return <span className="social-unread-dot" style={{ color: accent }} role="img" aria-label="Unread notifications" />;
}

function useChatRequest(member: number) {
  const base = import.meta.env.VITE_CLIK_URL || '';
  return useCallback(async <T,>(path: string, payload?: object, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(`${base}/social/${path}`, {
      credentials: 'include', signal,
      headers: { 'X-ClikB-Active-Member': String(member), ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Chat could not complete that request.');
    return result as T;
  }, [base, member]);
}

function connectSocialChat(member: number, scope: string, id?: number) {
  const url = new URL(`${import.meta.env.VITE_CLIK_URL || location.origin}/social/live`, location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(url);
  socket.onopen = () => socket.send(JSON.stringify({ scope, id, member }));
  return socket;
}

const unreadPath = 'notifications?unreadOnly=1';
const reconnectDelay = (attempt: number) => Math.min(30_000, 750 * 2 ** Math.min(attempt, 6)) + Math.random() * 250;

function useNotificationBadge(member: number, chatOpen: boolean) {
  const request = useChatRequest(member);
  const [badge, setBadge] = useState({ member, unread: 0 });
  const setUnread = useCallback((update: number | ((previous: number) => number)) => {
    setBadge(previous => ({ member, unread: typeof update === 'number' ? update : update(previous.member === member ? previous.unread : 0) }));
  }, [member]);

  useEffect(() => {
    const isDev = Boolean(import.meta.env.DEV);
    if ((!isDev && member <= 1) || member < 1 || chatOpen) return;
    const controller = new AbortController();
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const data = await request<{ unread: number }>(unreadPath, undefined, controller.signal);
        if (!controller.signal.aborted && current === revision) setUnread(data.unread);
      } catch { /* Keep the last count until reconnect or focus refreshes it. */ }
    };
    const connect = () => {
      if (controller.signal.aborted) return;
      socket = connectSocialChat(member, 'notifications');
      socket.onmessage = ({ data }) => {
        if (controller.signal.aborted) return;
        let scope: string | undefined;
        try { scope = JSON.parse(String(data))?.scope; } catch { return; }
        if (scope === 'ready') attempts = 0;
        if (scope === 'ready' || scope === 'notifications' || scope === 'refresh') void refresh();
      };
      socket.onclose = ({ code }) => {
        if (controller.signal.aborted || code === 1008) return;
        retry = setTimeout(connect, reconnectDelay(attempts++));
      };
    };
    void refresh();
    connect();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      clearTimeout(retry);
      socket?.close();
      window.removeEventListener('focus', refresh);
    };
  }, [chatOpen, member, request, setUnread]);

  return { unread: badge.member === member ? badge.unread : 0, setUnread };
}

const toValidId = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : undefined;
};

export function ChatProvider({ children, minimisePrompt = true, onMinimisePrompt }: {
  children: ReactNode; minimisePrompt?: boolean; onMinimisePrompt?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const member = Number(useSelector((state: RootState) => state.profile.loggedUser?.id) || 0);
  const locationKey = `${location.pathname}${location.search}${location.hash}`;
  const entry = location.state?.socialChat as ChatEntry | undefined;
  const active = entry?.member === member ? entry : undefined;
  const { unread, setUnread } = useNotificationBadge(member, Boolean(active));
  const returnEntries = useRef(new Set<string>());
  const pausePreference = useRef(new Map<number, boolean>());
  const change = useCallback((patch: Partial<ChatEntry>) => {
    if (!active) return;
    if (typeof patch.paused === 'boolean') pausePreference.current.set(member, patch.paused);
    navigate(locationKey, { replace: true, state: { ...location.state, socialChat: { ...active, ...patch } } });
  }, [active, location.state, locationKey, member, navigate]);
  const open = useCallback((postId?: number) => {
    const areas = store.getState().brainstorm.userSnapshot.feeds?.areas;
    const fullscreen = Object.values(areas ?? {}).find(area => area?.source === 'FullScreenStories');
    const deck = areas?.['clikb.feeds.deck'] || Object.values(areas ?? {}).find(area => area?.source === 'DeckOverlay');
    const searchParams = new URLSearchParams(window.location.search || location.search);
    const domActiveDeckCard = typeof document !== 'undefined'
      ? (document.querySelector('.deck-card--active[data-deck-post-id]') || document.querySelector('[data-deck-post-id]'))
      : null;

    const id = toValidId(postId)
      ?? toValidId(fullscreen?.state?.postId)
      ?? toValidId(deck?.state?.activePostId)
      ?? toValidId(deck?.state?.postId)
      ?? toValidId(location.state?.clikbDeck?.activePostId)
      ?? toValidId(window.history.state?.usr?.clikbDeck?.activePostId)
      ?? toValidId(window.history.state?.clikbDeck?.activePostId)
      ?? toValidId(searchParams.get('deck'))
      ?? toValidId(searchParams.get('story'))
      ?? toValidId(domActiveDeckCard?.getAttribute('data-deck-post-id'));

    const replaceComposer = !minimisePrompt && Boolean(window.history.state?.clikbPromptInput);
    if (!minimisePrompt) onMinimisePrompt?.();
    navigate(locationKey, { replace: Boolean(entry) || replaceComposer, state: {
      ...location.state, socialChat: { tab: id ? 'post' : 'feeds', postId: id, filter: 'all', member,
        paused: active?.paused ?? pausePreference.current.get(member) ?? false },
    } });
  }, [active?.paused, entry, location.search, location.state, locationKey, member, minimisePrompt, navigate, onMinimisePrompt]);
  const close = useCallback(() => navigate(-1), [navigate]);
  const openPost = useCallback((postId: number, related: number[] = []) => {
    if (postId <= 0) return;
    returnEntries.current.add(location.key);
    if (returnEntries.current.size > 100) returnEntries.current.delete(returnEntries.current.values().next().value!);
    navigate(`/experience/${postId}`, { state: {
      socialChatPost: true, socialChatPostIds: [...new Set([postId, ...related])].slice(0, 28),
    } });
  }, [location.key, navigate]);
  const openProfile = useCallback((userId: number) => {
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    returnEntries.current.add(location.key);
    if (returnEntries.current.size > 100) returnEntries.current.delete(returnEntries.current.values().next().value!);
    navigate('/pages', { state: { userId } });
  }, [location.key, navigate]);
  useEffect(() => {
    if (active) return registerSharedBack('socialChat', { priority: 300, label: 'Close Chat', back: close });
  }, [active, close]);
  const isDev = Boolean(import.meta.env.DEV);
  return <chatContext.Provider value={{ open, isOpen: Boolean(active), hasUnreadNotifications: (isDev ? member >= 1 : member > 1) && unread > 0 }}>
    {children}
    {active && <ChatDialog key={member} entry={active} change={change} close={close} openPost={openPost} openProfile={openProfile}
      returning={returnEntries.current.has(location.key)} unread={unread} setUnread={setUnread} />}
  </chatContext.Provider>;
}

type FeedResponse = { messages: Message[]; legacy: Message[]; hasMore: boolean; legacyHasMore?: boolean; legacyBefore?: number | null };
type NotificationResponse = { notifications: Activity[]; unread: number; hasMore: boolean };
type RoomResponse = { rooms: Room[]; hasMore?: boolean; nextCursor?: RoomCursor | null };
const scrollPositions = new Map<string, number>();
const chatScope = ({ member, tab, roomId, postId, filter, threadRootId }: ChatEntry) =>
  `${member}:${tab}:${threadRootId ? `thread_${threadRootId}` : tab === 'rooms' ? roomId || '' : tab === 'post' ? postId || '' : tab === 'notifications' ? filter : ''}`;
const newestFirst = (a: Message, b: Message) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
const previewText = (value: string) => (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [value]).slice(0, 2).join('').trim().slice(0, 180);
const avatar = (row: Person) => <Avatar src={row.avatar} alt="" sx={{ width: 32, height: 32 }}>{row.username?.slice(0, 1)}</Avatar>;
const time = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};

function ChatDialog({ entry, change, close, openPost, openProfile, returning, unread, setUnread }: {
  entry: ChatEntry; change: (patch: Partial<ChatEntry>) => void; close: () => void; openPost: (id: number, related?: number[]) => void;
  openProfile: (id: number) => void;
  returning: boolean;
  unread: number; setUnread: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { member, tab, filter, roomId, postId: rawPostId, threadRootId, threadHighlightId, threadReturnTab } = entry;
  const isThread = Boolean(threadRootId);
  const dispatch = useDispatch();
  const request = useChatRequest(member);
  const dark = useSelector((state: RootState) => state.settings.darkMode);
  const accent = useSelector((state: RootState) => dark ? state.settings.appColorDark : state.settings.appColorLight)
    || (dark ? '#e8bafa' : '#0099cc');

  const feedsAreas = useSelector((state: RootState) => state.brainstorm.userSnapshot.feeds?.areas);
  const fullscreen = Object.values(feedsAreas ?? {}).find(area => area?.source === 'FullScreenStories');
  const deck = feedsAreas?.['clikb.feeds.deck'] || Object.values(feedsAreas ?? {}).find(area => area?.source === 'DeckOverlay');
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const domActiveDeckCard = typeof document !== 'undefined'
    ? (document.querySelector('.deck-card--active[data-deck-post-id]') || document.querySelector('[data-deck-post-id]'))
    : null;

  const postId = toValidId(rawPostId)
    ?? toValidId(fullscreen?.state?.postId)
    ?? toValidId(deck?.state?.activePostId)
    ?? toValidId(deck?.state?.postId)
    ?? toValidId(window.history.state?.usr?.clikbDeck?.activePostId)
    ?? toValidId(window.history.state?.clikbDeck?.activePostId)
    ?? toValidId(searchParams?.get('deck'))
    ?? toValidId(searchParams?.get('story'))
    ?? toValidId(domActiveDeckCard?.getAttribute('data-deck-post-id'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [more, setMore] = useState(false);
  const paused = Boolean(entry.paused);
  const setPaused = (value: boolean) => change({ paused: value });
  const resumeAt = useRef(returning && !paused ? Date.now() + 2000 : 0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<Message>();
  const [shared, setShared] = useState<Message>();
  const isDev = Boolean(import.meta.env.DEV);
  const [options, setOptions] = useState<Message>();
  const [confirmDelete, setConfirmDelete] = useState<Message['id']>();
  const [expanded, setExpanded] = useState<Message['id']>();
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [epoch, reload] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingScroll = useRef<number | undefined>(undefined);
  const latestMessage = useRef(0);
  const messagePage = useRef<{ before?: number; legacyBefore?: number; modernMore: boolean; legacyMore: boolean } | undefined>(undefined);
  const oldestActivity = useRef<number | undefined>(undefined);
  const oldestRoom = useRef<RoomCursor | null>(null);
  const dismissedActivity = useRef(new Set<number>());
  const paginationRevision = useRef(0);
  const scopeGeneration = useRef(0);
  const composerTransfer = useRef<string | undefined>(undefined);
  const searchGeneration = useRef(0);
  const signedIn = member > 0;
  const scope = chatScope({ ...entry, postId });
  const channel = tab === 'rooms' ? 'room' : tab;
  const messagePath = isThread
    ? `messages?threadRootId=${threadRootId}`
    : `messages?channel=${channel}${tab === 'post' && postId ? `&postId=${postId}` : ''}${tab === 'rooms' && roomId ? `&roomId=${roomId}` : ''}`;
  const selectRoom = !isThread && tab === 'rooms' && !roomId;
  const showingMessages = isThread || (tab !== 'notifications' && !selectRoom);
  const showSearch = selectRoom && searching;
  const canLoadOlder = more && !showSearch;
  const visibleTabs = tabs.filter(item => item.id !== 'post' || postId);
  const displayMessages = isThread
    ? [...messages].sort((a, b) => {
        if (Number(a.id) === Number(threadRootId)) return -1;
        if (Number(b.id) === Number(threadRootId)) return 1;
        return Number(a.id) - Number(b.id) || Date.parse(a.createdAt) - Date.parse(b.createdAt);
      })
    : messages;
  const localReplyCounts = useMemo(() => {
    const counts = new Map<number | string, number>();
    for (const msg of messages) {
      if (msg.replyId) {
        const key = Number(msg.replyId);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [messages]);
  const viewport = useNavigationViewport('vertical', `${scope}:${messages.length}:${activity.length}:${rooms.length}:${matches.length}:${expanded ?? ''}`);
  const visibleIds = viewport.viewport?.visibleIds ?? [];
  const visibleMessages = displayMessages.filter(row => visibleIds.includes(`message_${row.id}`));
  const roomScrollId = (row: Person | Room) => 'id' in row ? `room_${row.id}` : `member_${row.authorId}`;
  const roomActionId = (row: Person | Room) => 'id' in row ? `room_open_${row.id}` : `room_member_${row.authorId}`;
  const visibleRooms = (showSearch ? matches : rooms).filter(row => visibleIds.includes(roomScrollId(row)));
  const visibleActivity = activity.filter(row => visibleIds.includes(`notification_${row.id}`));
  const notificationName = (row: Activity) => row.kind === 'welcome' || row.kind === 'credit' ? 'ClikBSocial' : row.username;
  const canCompose = signedIn && showingMessages && (isThread || tab !== 'feeds');
  const record = (name: string, patch: Record<string, string | number | boolean | null>, outcome: 'succeeded' | 'failed') => {
    dispatch(recordNavigationTransition({
      actor: getExecutingNavigationAction() === `${area}.action.${name}` ? 'ai' : 'manual',
      kind: 'control',
      before: { areaId: area, state: { tab, filter, paused, postId: postId ?? null, roomId: roomId ?? null } },
      after: { areaId: area, controlId: `${area}.control.${name}`, state: patch },
      authoritativeSource: 'ChatDialog', outcome,
    }));
  };
  const move = (name: string, handler: () => void, patch: Record<string, string | number | boolean | null> = {}) => {
    handler();
    record(name, patch, 'succeeded');
  };
  useEffect(() => {
    const name = (key: string, enabled = true, targetId?: number | string) => navigationControl(area, key, `ChatDialog.${key}`, 'candidate', enabled, targetId);
    const previews = Object.fromEntries(visibleMessages.slice(0, 8).map((row, index) => [
      `messagePreview${index + 1}`, `[${row.id}] @${row.username}: ${previewText(row.body || row.sharedBody || '')}`.slice(0, 200),
    ]));
    const expandedRow = visibleMessages.find(row => row.id === expanded);
    const expandedText = expandedRow ? [expandedRow.body, expandedRow.sharedBody].filter(Boolean).join('\n').slice(0, 2000) : '';
    const expandedParts = Object.fromEntries((expandedText.match(/[\s\S]{1,200}/g) || []).map((part, index) => [`expandedMessagePart${index + 1}`, part]));
    dispatch(publishNavigationArea({
      areaId: area, source: 'ChatDialog',
      state: { tab, filter, paused, postId: postId ?? null, roomId: roomId ?? null, activeMemberId: member, unread, signedIn,
        busy, loading, draftLength: draft.length, replyId: reply?.id ?? null, sharedId: shared?.id ?? null,
        expandedMessageId: expanded ?? null, messageOptionsId: options?.id ?? null,
        isThread, threadRootId: threadRootId ?? null,
        hasMore: more, loadedMessageCount: messages.length, loadedNotificationCount: activity.length,
        loadedRoomCount: rooms.length, paginationRevision: paginationRevision.current,
        memberSearchOpen: showSearch, memberSearchLength: search.length, refreshRevision: epoch,
        ...Object.fromEntries(visibleRooms.slice(0, 12).map((row, index) => [`roomMember${index + 1}`, `[${roomActionId(row)}] @${row.username}`.slice(0, 100)])),
        ...Object.fromEntries(visibleActivity.slice(0, 12).map((row, index) => [
          `notificationPreview${index + 1}`,
          `[notification_${row.id}] ${notificationName(row)} ${row.kind} ${row.body || (row.postId ? `post ${row.postId} ${row.postTitle || ''}` : row.roomId ? `room ${row.roomId}` : '')}`.slice(0, 200),
        ])),
        ...previews, ...expandedParts },
      ...(viewport.viewport ? { scrolls: { list: viewport.viewport } } : {}),
      visibleControls: [
        name('close'),
        ...(isThread ? [name('back_from_thread')] : visibleTabs.map(item => name(`tab_${item.id}`, item.id !== tab))),
        ...(!isThread && tab === 'notifications' ? filters.map(item => name(`filter_${item.id}`, item.id !== filter)) : []),
        ...(showingMessages && signedIn ? [name(paused ? 'resume' : 'pause')] : []),
        ...(!isThread && tab === 'rooms' && roomId ? [name('room_list')] : []),
        ...(!isThread && tab === 'notifications' ? visibleActivity.flatMap(item => [
          ...(item.postId || item.roomId || item.kind === 'reply' || !item.seenAt ? [name(`notification_${item.id}`, !busy, Number(item.postId || item.roomId || item.id))] : []),
          name(`dismiss_${item.id}`, !busy, item.id),
        ]) : []),
        ...(selectRoom && signedIn ? [name('new_room'), ...(searching ? [{ ...name('member_search'), kind: 'text' as const }] : []),
          ...visibleRooms.map(row => name(roomActionId(row), !busy, Number('id' in row ? row.id : row.authorId)))] : []),
        ...(canCompose ? [{ ...name('compose', !busy), kind: 'text' as const }, name('send', !busy && Boolean(draft.trim() || shared)),
          ...(!isThread && (reply || shared) ? [name('remove_reference')] : [])] : []),
        ...visibleMessages.flatMap(row => [
          name(`reply_${row.id}`, !busy && reply?.id !== row.id, row.id),
          ...(!isThread ? [name(`thread_${row.id}`, !busy, row.id)] : []),
          ...(row.postId && (!isThread ? (tab === 'feeds' || row.sharedMessageId || tab === 'global') : Number(row.id) === Number(threadRootId)) ? [name(`post_${row.id}`, true, Number(row.postId))] : []),
          ...((tab === 'post' || tab === 'feeds') && !isThread ? [name(`share_${row.id}`, !busy, row.id)] : []),
          ...([row.body, row.sharedBody].filter(Boolean).join('\n').trim() !== previewText(row.body || row.sharedBody || '') ? [name(`expand_${row.id}`, true, row.id)] : []),
          name(`options_${row.id}`, !busy, row.id),
          ...(confirmDelete === row.id ? [name(`confirm_delete_${row.id}`, !busy, row.id)] : []),
          ...(options?.id === row.id && confirmDelete !== row.id ? [
            ...((Number(row.authorId) === member || (isDev && member === 1)) ? [name(`delete_prompt_${row.id}`, !busy, row.id)] : []),
            ...(Number(row.authorId) !== member ? [
              ...(tab !== 'rooms' && !isThread ? [name(`start_room_${row.id}`, !busy, row.authorId)] : []),
              name(`report_${row.id}`, !busy, row.id), name(`block_${row.id}`, !busy, row.authorId),
            ] : []),
          ] : []),
        ]),
        ...(canLoadOlder ? [name('load_older', !busy)] : []),
        ...(error ? [name('retry')] : []),
      ],
    }));
  }, [dispatch, tab, filter, postId, roomId, paused, member, unread, signedIn, showingMessages, activity,
    messages, rooms, matches, viewport.viewport, expanded, options, confirmDelete, searching, search, busy, draft, reply, shared, canLoadOlder, more, error, epoch, loading, isThread, threadRootId, isDev]);
  useEffect(() => () => { dispatch(removeNavigationArea({ areaId: area, source: 'ChatDialog' })); }, [dispatch]);

  useLayoutEffect(() => {
    if (composerTransfer.current !== scope) {
      setDraft('');
      setReply(undefined);
      setShared(undefined);
    }
    composerTransfer.current = undefined;
    setBusy(false);
    setOptions(undefined);
    setConfirmDelete(undefined);
    setNote('');
    setMessages([]); setActivity([]); setExpanded(undefined); setMore(false); setError(''); setLoading(signedIn);
    latestMessage.current = 0;
    paginationRevision.current = 0;
    messagePage.current = undefined;
    oldestActivity.current = undefined;
    oldestRoom.current = null;
    dismissedActivity.current.clear();
    pendingScroll.current = scrollPositions.get(scope) ?? 0;
    return () => { scopeGeneration.current += 1; };
  }, [scope, signedIn]);
  useEffect(() => {
    if (pendingScroll.current === undefined || loading || !listRef.current) return;
    listRef.current.scrollTop = pendingScroll.current;
    pendingScroll.current = undefined;
  }, [loading, messages, activity, rooms]);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let pending = false;
    let running = false;
    let reset = false;
    let fetchMessages = false;
    let fetchUnread = false;
    const refresh = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      const list = fetchMessages;
      const badge = fetchUnread;
      const replace = reset;
      const pageRevision = paginationRevision.current;
      fetchMessages = false;
      fetchUnread = false;
      reset = false;
      pending = false;
      try {
        if (list && !isThread && tab === 'notifications') {
          const boundary = replace ? undefined : oldestActivity.current;
          let before: number | undefined;
          let data: NotificationResponse;
          let rows: Activity[] = [];
          do {
            data = await request<NotificationResponse>(`notifications?filter=${filter}${before ? `&before=${before}` : ''}`, undefined, controller.signal);
            if (controller.signal.aborted) return;
            rows = mergeRows(rows, data.notifications);
            const last = data.notifications.at(-1)?.id;
            if (!last || (before !== undefined && last >= before)) break;
            before = last;
          } while (data.hasMore && boundary !== undefined && before > boundary);
          if (pageRevision !== paginationRevision.current) { fetchMessages = true; pending = true; return; }
          oldestActivity.current = before;
          setActivity(rows.filter(row => !dismissedActivity.current.has(row.id)).sort((left, right) => right.id - left.id));
          setUnread(data.unread);
          setMore(Boolean(before && data.hasMore));
        } else if (list && !isThread && selectRoom) {
          const boundary = replace ? null : oldestRoom.current;
          let cursor: RoomCursor | null = null;
          let data: RoomResponse;
          let rows: Room[] = [];
          do {
            data = await request<RoomResponse>(roomPagePath(cursor), undefined, controller.signal);
            if (controller.signal.aborted) return;
            rows = mergeRows(rows, data.rooms);
            const next = data.nextCursor || null;
            if (!next || (cursor && !roomCursorOlder(next, cursor))) break;
            cursor = next;
          } while (data.hasMore && boundary && roomCursorOlder(boundary, cursor));
          if (pageRevision !== paginationRevision.current) { fetchMessages = true; pending = true; return; }
          oldestRoom.current = cursor;
          setRooms(rows);
          setMore(Boolean(cursor && data.hasMore));
        } else if (list) {
          const previousId = replace ? 0 : latestMessage.current;
          const data = await request<FeedResponse>(messagePath, undefined, controller.signal);
          if (controller.signal.aborted) return;
          const fresh = [...data.messages, ...data.legacy];
          const firstId = Number(data.messages.at(-1)?.id) || 0;
          if (previousId && data.hasMore && firstId > previousId) {
            let after = previousId;
            while (after < firstId) {
              const page = await request<FeedResponse>(`${messagePath}&after=${after}`, undefined, controller.signal);
              if (controller.signal.aborted) return;
              fresh.push(...page.messages);
              const lastId = Number(page.messages.at(-1)?.id) || 0;
              if (!page.hasMore || lastId <= after) break;
              after = lastId;
            }
          }
          latestMessage.current = Math.max(previousId, Number(data.messages[0]?.id) || 0);
          setMessages(previous => mergeMessages(fresh, replace ? [] : previous));
          if (!messagePage.current || replace) {
            const ids = data.messages.map(row => Number(row.id)).filter(Number.isFinite);
            messagePage.current = { before: ids.length ? Math.min(...ids) : undefined,
              legacyBefore: data.legacyBefore || undefined, modernMore: data.hasMore, legacyMore: Boolean(data.legacyHasMore) };
          }
          setMore(messagePage.current.modernMore || messagePage.current.legacyMore);
          if (roomId && tab === 'rooms') await request('notifications/read', { roomId }, controller.signal);
        }
        if (badge && tab !== 'notifications' && (isDev || member !== 1)) {
          const data = await request<{ unread: number }>(unreadPath, undefined, controller.signal);
          if (!controller.signal.aborted) setUnread(data.unread);
        }
        if (!controller.signal.aborted) setError('');
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        running = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          if (pending) void refresh();
        }
      }
    };
    const queue = (list: boolean, badge: boolean, replace = false) => {
      fetchMessages ||= list;
      fetchUnread ||= badge;
      reset ||= replace;
      pending = true;
      void refresh();
    };
    const subscription = isThread ? (postId ? 'post' : 'global') : (selectRoom ? 'rooms' : channel);
    const connect = () => {
      if (controller.signal.aborted) return;
      socket = connectSocialChat(member, subscription, (isThread ? (postId ? postId : undefined) : tab === 'post' ? postId : roomId));
      socket.onmessage = ({ data }) => {
        if (controller.signal.aborted) return;
        let event: { scope?: string; deletedNotificationId?: number };
        try { event = JSON.parse(String(data)); } catch { return; }
        if (Number.isSafeInteger(event.deletedNotificationId) && Number(event.deletedNotificationId) > 0) {
          dismissedActivity.current.add(Number(event.deletedNotificationId));
          setActivity(previous => previous.filter(row => row.id !== event.deletedNotificationId));
        }
        if (event.scope === 'ready') {
          attempts = 0;
          queue(true, true);
        } else if (event.scope === 'notifications') queue(!isThread && tab === 'notifications', true);
        else if (event.scope === 'refresh') queue(true, true, true);
        else queue(true, false);
      };
      socket.onclose = event => {
        if (controller.signal.aborted || event.code === 1008) return;
        if (attempts === 0 && loading) queue(true, true);
        retry = setTimeout(connect, reconnectDelay(attempts++));
      };
    };
    const delay = resumeAt.current - Date.now();
    queue(true, true);
    if (!paused && delay > 0) retry = setTimeout(connect, delay);
    else if (!paused) connect();
    return () => { controller.abort(); clearTimeout(retry); socket?.close(); };
  }, [request, signedIn, member, scope, epoch, tab, filter, roomId, postId, channel, messagePath, selectRoom, paused, setUnread]);

  useEffect(() => {
    if (!searching || search.trim().length < 2 || !selectRoom) { setMatches([]); return; }
    const controller = new AbortController();
    const generation = searchGeneration.current;
    const timer = setTimeout(() => {
      void request<{ members: Person[] }>(`members?q=${encodeURIComponent(search.trim())}`, undefined, controller.signal)
        .then(data => { if (!controller.signal.aborted && generation === searchGeneration.current) setMatches(data.members); })
        .catch(err => { if (!controller.signal.aborted && generation === searchGeneration.current) setError(err.message); });
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [request, search, searching, selectRoom]);

  async function action(name: string, work: (isCurrent: () => boolean) => Promise<Record<string, string | number | boolean | null> | undefined>) {
    if (busy) return;
    const generation = scopeGeneration.current;
    const isCurrent = () => scopeGeneration.current === generation;
    setBusy(true); setError(''); setNote('');
    try {
      const patch = await work(isCurrent);
      if (patch && isCurrent()) record(name, patch, 'succeeded');
    }
    catch (err) {
      if (isCurrent()) {
        setError((err as Error).message);
        record(name, {}, 'failed');
      }
    }
    finally { if (isCurrent()) setBusy(false); }
  }
  const switchTab = (next: Tab, target?: number) => {
    setDraft(''); setReply(undefined); setShared(undefined); setOptions(undefined); setConfirmDelete(undefined);
    change({ tab: next, threadRootId: undefined, threadHighlightId: undefined, ...(target ? { postId: target } : {}) });
  };
  const enterRoom = (id: number) => {
    setDraft(''); setReply(undefined); setShared(undefined); setOptions(undefined); setConfirmDelete(undefined);
    change({ tab: 'rooms', roomId: Number(id), threadRootId: undefined, threadHighlightId: undefined });
  };
  const openThread = (rootId: number, highlightId?: number, returnTab: Tab = tab, threadPostId?: number) => {
    setDraft(''); setReply(undefined); setShared(undefined); setOptions(undefined); setConfirmDelete(undefined);
    change({
      threadRootId: rootId,
      threadHighlightId: highlightId,
      threadReturnTab: returnTab,
      postId: threadPostId ?? postId,
    });
  };
  const closeThread = () => {
    setDraft(''); setReply(undefined); setShared(undefined); setOptions(undefined); setConfirmDelete(undefined);
    change({
      threadRootId: undefined,
      threadHighlightId: undefined,
      tab: threadReturnTab || tab || 'feeds',
    });
  };
  useEffect(() => {
    if (isThread && threadHighlightId && !loading && listRef.current) {
      const el = listRef.current.querySelector(`[data-navigation-scroll-id="message_${threadHighlightId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isThread, threadHighlightId, loading]);
  const markActivity = (row: Activity) => {
    if (!row.seenAt) void request('notifications/read', { id: row.id }).catch(() => {});
    if (row.kind === 'reply') {
      const rootId = Number(row.replyId || row.messageId);
      if (rootId > 0) {
        openThread(rootId, Number(row.messageId), 'notifications', Number(row.postId) || undefined);
        return;
      }
    }
    if (row.postId) openPost(Number(row.postId), activity.flatMap(item => item.postId ? [Number(item.postId)] : []));
    else if (row.roomId) enterRoom(row.roomId);
  };
  const readActivity = (row: Activity) => void action(`notification_${row.id}`, async isCurrent => {
    await request('notifications/read', { id: row.id });
    if (!isCurrent()) return;
    setActivity(previous => previous.map(item => item.id === row.id ? { ...item, seenAt: new Date().toISOString() } : item));
    if (!row.seenAt) setUnread(previous => Math.max(0, previous - 1));
    return { readNotificationId: row.id };
  });
  const dismissActivity = (row: Activity) => void action(`dismiss_${row.id}`, async isCurrent => {
    await request<{ deleted: boolean }>('notifications/delete', { id: row.id });
    if (!isCurrent()) return;
    dismissedActivity.current.add(row.id);
    setActivity(previous => previous.filter(item => item.id !== row.id));
    reload(value => value + 1);
    return { dismissedNotificationId: row.id };
  });
  const startRoom = (id: number, actionId: string) => void action(actionId, async isCurrent => {
    const data = await request<{ id: number }>('rooms', { memberId: id });
    if (!isCurrent()) return;
    setSearching(false); enterRoom(data.id);
    return { tab: 'rooms', roomId: Number(data.id) };
  });
  const send = () => void action('send', async isCurrent => {
    if (!draft.trim() && !shared) return;
    const result = await request<{ id: number }>('messages', {
      channel: isThread ? (postId ? 'post' : 'global') : channel,
      body: draft,
      postId: isThread ? postId : (tab === 'post' ? postId : undefined),
      roomId: !isThread && tab === 'rooms' ? roomId : undefined,
      replyId: isThread ? threadRootId : reply?.id,
      sharedMessageId: !isThread ? shared?.id : undefined,
    });
    if (!isCurrent()) return;
    setDraft(''); setReply(undefined); setShared(undefined);
    if (listRef.current) listRef.current.scrollTop = 0;
    reload(v => v + 1);
    return { sentMessageId: result.id };
  });
  const loadMore = () => void action('load_older', async isCurrent => {
    if (!isThread && tab === 'notifications') {
      const before = oldestActivity.current;
      if (!before) return;
      const data = await request<NotificationResponse>(`notifications?filter=${filter}&before=${before}`);
      if (!isCurrent()) return;
      paginationRevision.current += 1;
      oldestActivity.current = data.notifications.at(-1)?.id;
      setActivity(previous => mergeRows(data.notifications, previous).filter(row => !dismissedActivity.current.has(row.id)).sort((left, right) => right.id - left.id));
      setMore(Boolean(oldestActivity.current && data.hasMore));
      return { loadedRows: data.notifications.length };
    } else if (!isThread && selectRoom) {
      const cursor = oldestRoom.current;
      if (!cursor) return;
      const data = await request<RoomResponse>(roomPagePath(cursor));
      if (!isCurrent()) return;
      paginationRevision.current += 1;
      oldestRoom.current = data.nextCursor || null;
      setRooms(previous => mergeRows(previous, data.rooms));
      setMore(Boolean(data.nextCursor && data.hasMore));
      return { loadedRows: data.rooms.length };
    } else {
      const page = messagePage.current;
      if (!page) return;
      const params = [page.modernMore && page.before ? `before=${page.before}` : 'skipMessages=1',
        page.legacyMore && page.legacyBefore ? `legacyBefore=${page.legacyBefore}` : 'skipLegacy=1'];
      const data = await request<FeedResponse>(`${messagePath}&${params.join('&')}`);
      if (!isCurrent()) return;
      paginationRevision.current += 1;
      const ids = data.messages.map(row => Number(row.id)).filter(Number.isFinite);
      messagePage.current = { before: ids.length ? Math.min(...ids) : undefined,
        legacyBefore: data.legacyBefore || undefined, modernMore: data.hasMore, legacyMore: Boolean(data.legacyHasMore) };
      setMessages(previous => mergeMessages([...data.messages, ...data.legacy], previous));
      setMore(data.hasMore || Boolean(data.legacyHasMore));
      return { loadedRows: data.messages.length + data.legacy.length };
    }
  });
  const replyTo = (row: Message) => {
    if (tab === 'feeds' && row.postId) {
      composerTransfer.current = chatScope({ ...entry, tab: 'post', postId: Number(row.postId) });
      switchTab('post', Number(row.postId));
    }
    setReply(row);
  };
  const share = (row: Message) => {
    composerTransfer.current = chatScope({ ...entry, tab: 'global' });
    switchTab('global'); setShared(row);
  };
  const deleteMessage = (row: Message) => void action(`delete_${row.id}`, async isCurrent => {
    await request('messages/delete', { messageId: row.id });
    if (!isCurrent()) return;
    setConfirmDelete(undefined);
    setOptions(undefined);
    setMessages(prev => prev.filter(m => m.id !== row.id));
    setNote('Message deleted.');
    return { deletedMessageId: row.id };
  });
  const mapped = (name: string) => `${area}.action.${name}`;
  return <Dialog open onClose={close} aria-labelledby="social-chat-heading" maxWidth={false} sx={{ zIndex: 11000,
    '@media (max-width: 600px)': { '& .MuiDialog-container': { alignItems: 'flex-end' } } }}
    classes={{ container: 'social-panel-container' }}
    slotProps={{ backdrop: { className: 'social-panel-backdrop' } }}
    PaperProps={{ className: `social-panel social-chat ${dark ? 'social-panel-dark' : ''}`,
      style: { '--chat-accent': accent, '--chat-accent-text': dark ? '#000' : '#fff' } as CSSProperties }}>
    <header className={`social-chat-header ${isThread ? 'social-chat-thread-header' : ''}`}>
      {isThread && <IconButton aria-label="Back" data-ai-action={mapped('back_from_thread')} onClick={() => move('back_from_thread', closeThread)}>
        <ArrowBackIcon />
      </IconButton>}
      <h2 id="social-chat-heading">{isThread ? 'Thread' : 'Chat'}</h2>
      {showingMessages && signedIn && <Tooltip title={paused ? 'Resume live messages' : 'Pause live messages'}>
        <IconButton aria-label={paused ? 'Resume live messages' : 'Pause live messages'} data-ai-action={mapped(paused ? 'resume' : 'pause')}
          onClick={() => move(paused ? 'resume' : 'pause', () => {
            setPaused(!paused);
          }, { paused: !paused })}>
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
      </Tooltip>}
      <IconButton aria-label="Close Chat" data-ai-action={mapped('close')} onClick={() => move('close', close)}><CloseIcon /></IconButton>
    </header>
    {!isThread && <nav className="social-chat-tabs" aria-label="Chat categories">
      {visibleTabs.map(({ id, label, Icon }) => <Tooltip key={id} title={label}>
        <button className="social-chat-pill" type="button" aria-label={label} aria-pressed={tab === id}
          data-ai-action={tab !== id ? mapped(`tab_${id}`) : undefined}
          onClick={() => { if (tab !== id) move(`tab_${id}`, () => switchTab(id, id === 'post' ? postId : undefined), { tab: id }); }}>
          <Icon fontSize="small" />{tab === id && <span>{label}</span>}{id === 'notifications' && unread > 0 && <b>{Math.min(unread, 99)}</b>}
        </button>
      </Tooltip>)}
    </nav>}
    {!isThread && tab === 'notifications' && <nav className="social-chat-subnav" aria-label="Notification filters">
      {filters.map(({ id, label, Icon }) => <Tooltip key={id} title={label}><IconButton
        aria-label={label} aria-pressed={filter === id} data-ai-action={filter !== id ? mapped(`filter_${id}`) : undefined}
        onClick={() => { if (filter !== id) move(`filter_${id}`, () => change({ filter: id }), { filter: id }); }}><Icon /></IconButton></Tooltip>)}
    </nav>}
    {!isThread && tab === 'rooms' && signedIn && <div className="social-chat-subnav">
      {roomId ? <IconButton aria-label="Back to room list" data-ai-action={mapped('room_list')}
        onClick={() => move('room_list', () => { setDraft(''); setReply(undefined); change({ roomId: undefined }); }, { roomId: null })}><ArrowBackIcon /></IconButton>
        : <button type="button" className="social-chat-pill" data-ai-action={mapped('new_room')} onClick={() => move('new_room', () => setSearching(!searching), { memberSearchOpen: !searching })}><PersonAddAltIcon fontSize="small" />New room</button>}
      {showSearch && <input aria-label="Find a member by username" data-ai-action={mapped('member_search')} maxLength={64} placeholder="Search username" value={search} onChange={event => {
        searchGeneration.current += 1;
        setMatches([]);
        setSearch(event.target.value);
      }} />}
    </div>}
    <div className="social-chat-list" ref={element => { listRef.current = element; viewport.ref.current = element; }}
      data-ai-scroll={`${area}:list`} tabIndex={0} aria-label="Chat activity"
      onScroll={event => {
        viewport.onScroll();
        scrollPositions.set(scope, event.currentTarget.scrollTop);
        if (scrollPositions.size > 100) scrollPositions.delete(scrollPositions.keys().next().value!);
      }}>
      {!signedIn && <p className="social-chat-empty">Sign in to use Chat.</p>}
      {signedIn && loading && <p className="social-chat-empty" role="status">Loading Chat…</p>}
      {signedIn && !loading && !error && showingMessages && !messages.length && <p className="social-chat-empty">No messages yet.</p>}
      {signedIn && !loading && !error && !isThread && tab === 'notifications' && !activity.length && <p className="social-chat-empty">No notifications yet.</p>}
      {signedIn && !loading && !error && !isThread && selectRoom && !showSearch && !rooms.length && <p className="social-chat-empty">Start a private conversation in New room.</p>}
      {signedIn && !isThread && selectRoom && (showSearch ? matches : rooms).map(row =>
        <button className="social-chat-row social-chat-row-button" key={row.authorId} type="button"
          data-navigation-scroll-id={roomScrollId(row)} data-ai-action={mapped(roomActionId(row))}
          onClick={() => {
            const name = roomActionId(row);
            if ('id' in row) {
              const target = Number((row as Room).id);
              move(name, () => enterRoom(target), { tab: 'rooms', roomId: target });
            } else startRoom(row.authorId, name);
          }} disabled={busy}>
          {avatar(row)}<strong>{row.username}</strong>{'unread' in row && Number(row.unread) > 0 && <b>{String(row.unread)}</b>}
        </button>)}
      {!isThread && tab === 'notifications' && activity.map(row => {
        const canOpen = Boolean(row.postId || row.roomId || row.kind === 'reply' || !row.seenAt);
        const system = row.kind === 'welcome' || row.kind === 'credit';
        return <article key={row.id} className="social-chat-notification" data-unread={!row.seenAt}
          data-navigation-scroll-id={`notification_${row.id}`}>
          <div className="social-chat-row social-chat-row-button social-chat-notification-open"
            {...(canOpen ? {
              role: 'button',
              tabIndex: 0,
              'data-ai-action': mapped(`notification_${row.id}`),
              onClick: () => row.postId || row.roomId || row.kind === 'reply' ? move(`notification_${row.id}`, () => markActivity(row)) : readActivity(row),
              onKeyDown: (e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.postId || row.roomId || row.kind === 'reply' ? move(`notification_${row.id}`, () => markActivity(row)) : readActivity(row); } },
            } : {})}>
            {system ? <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--chat-secondary)', color: 'inherit' }}><NotificationsNoneIcon fontSize="small" /></Avatar> :
              <button type="button" className="social-chat-author-btn" aria-label={`View ${row.username}'s profile`}
                onClick={e => { e.stopPropagation(); openProfile(Number(row.authorId)); }}>
                {avatar(row)}
              </button>}
            <span>
              {system ? <strong>{notificationName(row)}</strong> :
                <button type="button" className="social-chat-username-btn"
                  onClick={e => { e.stopPropagation(); openProfile(Number(row.authorId)); }}>
                  <strong>{notificationName(row)}</strong>
                </button>}{' '}
              {row.kind === 'like' ? 'liked your post' : row.kind === 'room' ? 'sent you a message' : row.kind === 'reply' ? 'replied to you' : ''}
              {row.body && <span className="social-chat-notification-body" data-ai-snapshot-ignore="true">{row.body}</span>}
              {row.kind !== 'reply' && row.postId && <small>{row.postTitle || 'Open post'}</small>}
            </span>
            <time>{time(row.createdAt)}</time>
          </div>
          <Tooltip title="Delete notification"><IconButton size="small" aria-label={`Delete notification ${row.id}`}
            data-ai-action={mapped(`dismiss_${row.id}`)} disabled={busy} onClick={() => dismissActivity(row)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
        </article>;
      })}
      {showingMessages && displayMessages.map(row => {
        const own = Number(row.authorId) === member;
        const canDelete = own || (isDev && member === 1);
        const text = [row.body, row.sharedBody].filter(Boolean).join('\n');
        const preview = previewText(row.body || row.sharedBody || '');
        const isExpanded = expanded === row.id;
        const isRoot = isThread && Number(row.id) === Number(threadRootId);
        const isHighlight = isThread && Number(row.id) === Number(threadHighlightId);
        const linkedPost = Boolean(row.postId && (!isThread ? (tab === 'feeds' || row.sharedMessageId || tab === 'global') : isRoot));
        const openLinkedPost = () => move(`post_${row.id}`, () => openPost(Number(row.postId), displayMessages.flatMap(item => item.postId ? [Number(item.postId)] : [])), { postId: Number(row.postId) });
        const replyCount = !row.replyId
          ? Math.max(Number(row.replyCount) || 0, localReplyCounts.get(Number(row.id)) || 0)
          : 0;
        return <article className={`social-chat-row ${isRoot ? 'social-chat-row-root' : ''}`} key={row.id}
          data-navigation-scroll-id={`message_${row.id}`} data-thread-highlight={isHighlight ? 'true' : undefined}>
          <button type="button" className="social-chat-author-btn" aria-label={`View ${row.username}'s profile`} onClick={() => openProfile(Number(row.authorId))}>
            {avatar(row)}
          </button>
          <div className="social-chat-message">
            <button type="button" className="social-chat-username-btn" onClick={() => openProfile(Number(row.authorId))}>
              <strong>{row.username}</strong>
            </button> <time>{time(row.createdAt)}</time>
            <div className={!isThread ? 'social-chat-comment-body social-chat-comment-body-clickable' : 'social-chat-comment-body'}
              {...(!isThread ? {
                role: 'button',
                tabIndex: 0,
                title: 'View thread',
                'data-ai-action': mapped(`thread_${row.id}`),
                onClick: () => move(`thread_${row.id}`, () => openThread(Number(row.replyId || row.id), Number(row.id), tab, Number(row.postId))),
                onKeyDown: (e: any) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    move(`thread_${row.id}`, () => openThread(Number(row.replyId || row.id), Number(row.id), tab, Number(row.postId)));
                  }
                },
              } : {})}>
              {row.replyId && <small className="social-chat-reply-attribution">
                Reply{row.replyUsername ? ` to @${row.replyUsername}` : ''}
              </small>}
              {text && <p data-ai-snapshot-ignore="true">{isExpanded ? text : preview}</p>}
            </div>
            {text.trim() !== preview && <button type="button" className="social-chat-post" aria-expanded={isExpanded}
              data-ai-action={mapped(`expand_${row.id}`)} onClick={() => move(`expand_${row.id}`, () => setExpanded(isExpanded ? undefined : row.id), { expandedMessageId: isExpanded ? null : row.id })}>
              {isExpanded ? 'Show less' : 'Read more'}
            </button>}
            {linkedPost && (row.postThumb ? <small>{row.postTitle || 'Linked post'}</small> :
              <button className="social-chat-post" type="button" data-ai-action={mapped(`post_${row.id}`)} onClick={openLinkedPost}>
                <OpenInNewIcon fontSize="inherit" />{row.postTitle || 'Open post'}
              </button>)}
            <div className="social-chat-actions">
              <div className="social-chat-action-group">
                {replyCount > 0 && <span className="social-chat-reply-count" title={`${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                  {...(!isThread ? {
                    role: 'button',
                    tabIndex: 0,
                    'data-ai-action': mapped(`thread_${row.id}`),
                    onClick: () => move(`thread_${row.id}`, () => openThread(Number(row.replyId || row.id), Number(row.id), tab, Number(row.postId))),
                    onKeyDown: (e: any) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        move(`thread_${row.id}`, () => openThread(Number(row.replyId || row.id), Number(row.id), tab, Number(row.postId)));
                      }
                    },
                  } : {})}>{replyCount}</span>}
                <IconButton size="small" disabled={busy || reply?.id === row.id} title="Reply" aria-label="Reply" data-ai-action={mapped(`reply_${row.id}`)} onClick={() => move(`reply_${row.id}`, () => replyTo(row), { replyId: row.id })}><ReplyIcon fontSize="inherit" /></IconButton>
              </div>
              {(tab === 'post' || tab === 'feeds') && !isThread && <IconButton size="small" disabled={busy} title="Share to Global" aria-label="Share to Global" data-ai-action={mapped(`share_${row.id}`)} onClick={() => move(`share_${row.id}`, () => share(row), { tab: 'global', sharedId: row.id })}><ShareIcon fontSize="inherit" /></IconButton>}
              <IconButton size="small" disabled={busy} aria-label="Message options" data-ai-action={mapped(`options_${row.id}`)} onClick={() => move(`options_${row.id}`, () => { setConfirmDelete(undefined); setOptions(options?.id === row.id ? undefined : row); }, { messageOptionsId: options?.id === row.id ? null : row.id })}><MoreHorizIcon fontSize="inherit" /></IconButton>
            </div>
            {confirmDelete === row.id && <div className="social-chat-confirm-delete" role="alertdialog" aria-label="Confirm message deletion">
              <p>Delete this message?</p>
              <div className="social-chat-confirm-actions">
                <button type="button" className="social-chat-confirm-yes" disabled={busy} data-ai-action={mapped(`confirm_delete_${row.id}`)} onClick={() => deleteMessage(row)}>Yes, delete</button>
                <button type="button" className="social-chat-confirm-no" disabled={busy} onClick={() => setConfirmDelete(undefined)}>Cancel</button>
              </div>
            </div>}
            {confirmDelete !== row.id && options?.id === row.id && <div className="social-chat-actions">
              {canDelete && <button type="button" className="social-chat-action-delete" disabled={busy} data-ai-action={mapped(`delete_prompt_${row.id}`)} onClick={() => setConfirmDelete(row.id)}>
                <DeleteOutlineIcon fontSize="inherit" style={{ verticalAlign: 'middle', marginRight: 4 }} />Delete
              </button>}
              {!own && <>
                {tab !== 'rooms' && !isThread && <button type="button" disabled={busy} data-ai-action={mapped(`start_room_${row.id}`)} onClick={() => startRoom(row.authorId, `start_room_${row.id}`)}>Start room</button>}
                <button type="button" disabled={busy} data-ai-action={mapped(`report_${row.id}`)} onClick={() => void action(`report_${row.id}`, async isCurrent => {
                  await request('report', { messageId: row.id });
                  if (!isCurrent()) return;
                  setOptions(undefined); setNote('Report sent.');
                  return { reportedMessageId: row.id };
                })}>Report</button>
                <button type="button" disabled={busy} data-ai-action={mapped(`block_${row.id}`)} onClick={() => void action(`block_${row.id}`, async isCurrent => {
                  await request('block', { memberId: row.authorId });
                  if (!isCurrent()) return;
                  setOptions(undefined); setMessages([]); setActivity([]); setRooms([]);
                  if (tab === 'rooms') change({ roomId: undefined });
                  reload(v => v + 1);
                  return { blockedMemberId: row.authorId };
                })}>Block</button>
              </>}
            </div>}
          </div>
          {linkedPost && row.postThumb && <button type="button" className="social-chat-post-thumb"
            aria-label={row.postTitle ? `Open ${row.postTitle}` : 'Open post'} data-ai-action={mapped(`post_${row.id}`)} onClick={openLinkedPost}>
            <OpenInNewIcon fontSize="small" /><img src={row.postThumb} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />
          </button>}
        </article>;
      })}
      {canLoadOlder && <button type="button" className="social-chat-load" data-ai-action={mapped('load_older')} disabled={busy} onClick={loadMore}>Load older activity</button>}
    </div>
    {error && <p role="alert" className="social-chat-status">{error} <button type="button" data-ai-action={mapped('retry')} onClick={() => move('retry', () => { setError(''); setLoading(true); reload(v => v + 1); }, { loading: true })}>Retry</button></p>}
    {note && <p role="status" className="social-chat-status">{note}</p>}
    {signedIn && showingMessages && (isThread || tab !== 'feeds') && <form className="social-chat-composer"
      onSubmit={event => { event.preventDefault(); send(); }}>
      {isThread ? <div className="social-chat-reference">
        <span>Replying in thread</span>
      </div> : (reply || shared) ? <div className="social-chat-reference">
        <span>{reply ? `Reply to ${reply.username}` : 'Share post comment to Global'}</span>
        <IconButton size="small" aria-label="Remove message reference" data-ai-action={mapped('remove_reference')} onClick={() => move('remove_reference', () => { setReply(undefined); setShared(undefined); }, { replyId: null, sharedId: null })}><CloseIcon fontSize="inherit" /></IconButton>
      </div> : null}
      <textarea aria-label="Message" data-ai-action={mapped('compose')} value={draft} disabled={busy} maxLength={2000} rows={2} onChange={event => setDraft(event.target.value)} placeholder={isThread ? 'Write a reply in thread…' : shared ? 'Add an optional message' : 'Write a message'} />
      <button className="social-chat-pill" type="submit" data-ai-action={mapped('send')} disabled={busy || (!draft.trim() && !shared)} aria-label="Send message"><SendIcon fontSize="small" /></button>
    </form>}
  </Dialog>;
}

function mergeRows<T extends { id: number | string }>(fresh: T[], previous: T[]) {
  const ids = new Set(fresh.map(row => String(row.id)));
  return [...fresh, ...previous.filter(row => !ids.has(String(row.id)))];
}

function mergeMessages(fresh: Message[], previous: Message[]) {
  const rows = mergeRows(fresh, previous);
  const promoted = new Set(rows.flatMap(row => row.legacyCommentId ? [`legacy-${row.legacyCommentId}`] : []));
  return rows.filter(row => !promoted.has(String(row.id))).sort(newestFirst);
}

function roomPagePath(cursor: RoomCursor | null) {
  return cursor ? `rooms?beforeLastMessage=${cursor.lastMessageId}&beforeRoom=${cursor.roomId}` : 'rooms';
}

function roomCursorOlder(left: RoomCursor, right: RoomCursor) {
  return left.lastMessageId < right.lastMessageId || (left.lastMessageId === right.lastMessageId && left.roomId < right.roomId);
}
