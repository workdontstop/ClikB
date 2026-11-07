// FollowPanel.tsx
import * as React from "react";
import { Box } from "@mui/material";

// ⬇️ use your existing components/paths
import FollowButton from "./FollowButton";
import FollowersButton from "./FollowersButton";
import StartFollowButton from "./FollowStartButton";
import { useDispatch } from 'react-redux';
import { recordNavigationTransition } from './brainstormSlice';

export type FollowPanelProps = {
    /** The profile being viewed */
    userProfile: any;
    /** The logged-in user */
    loggedUser: { id: number } | null | undefined;

    /** Are we already connected (i.e., status.following boolean)? */
    connected: boolean;
    /** Setter from parent so StartFollowButton can flip it after success */
    setConnected?: (next: boolean) => void;

    /** Counts from /fan/list when connected */
    counts: any;

    /** Fallback counts (from your Redux reducers) when not connected or viewing self */
    followersReducer: number;
    followingReducer: number;

    /** Called by StartFollowButton after success (to refetch lists, etc.) */
    refresh: () => void;

    /** Optional: parent can handle followers list open */
    onFollowersClick?: () => void;

    /** Optional: pass through to FollowButton/StartFollowButton */
    onFollowToggle?: (next: boolean) => void;
    type: any;
    typex: any;
    setShowEmotions: any;
    setfollowType: any;
    onSnapshotState?: (state: { following: boolean; loading: boolean }) => void;
    onProfileFollowed?: () => void;
    followDisabled?: boolean;


};





/**
 * Renders your two-button block with the same branching as your snippet:
 * - If no userProfile.id → show pair with reducer counts
 * - If viewing self (loggedUser.id === userProfile.id OR userProfile.id === 0) → show pair with reducer counts
 * - Else (viewing someone else):
 *     - if connected → show pair with counts from /fan/list
 *     - else → show StartFollowButton (loader + backend call), using loggedUser.id → userProfile.id
 *
 * NOTE: This component returns the two <Box> items (or one in the StartFollow case).
 * Place <FollowPanel /> inside your own row/grid container to align side-by-side.
 */
export default function FollowPanel(props: FollowPanelProps) {
    const dispatch = useDispatch();
    const {
        userProfile,
        loggedUser,
        connected,
        setConnected,
        counts,
        followersReducer,
        followingReducer,
        refresh,
        onFollowersClick,
        onFollowToggle,
        type,
        typex = false,
        setShowEmotions,
        setfollowType,
        onSnapshotState,
        onProfileFollowed,
        followDisabled,


    } = props;

    const userProfileId = userProfile ?? 0;
    const loggedUserId = loggedUser?.id ?? 0;

    const followOpen = () => {
        /// setShowEmotions(true);
        setShowEmotions();
        setfollowType(1)
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'area',
            before: { areaId: 'clikb.profile_header', entityId: userProfileId, state: { relationshipsOpen: false } },
            after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.profile_header.control.following', entityId: userProfileId, state: { relationshipsOpen: true, view: 'following' } },
            outcome: 'succeeded', authoritativeSource: 'FollowPanel following-open handler',
        }));
    }


    const followingOpen = () => {
        //setShowEmotions(true);

        setShowEmotions();
        setfollowType(0)
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'area',
            before: { areaId: 'clikb.profile_header', entityId: userProfileId, state: { relationshipsOpen: false } },
            after: { areaId: 'clikb.navigation.relationships', controlId: 'clikb.profile_header.control.followers', entityId: userProfileId, state: { relationshipsOpen: true, view: 'followers' } },
            outcome: 'succeeded', authoritativeSource: 'FollowPanel followers-open handler',
        }));
    }

    if (type === 0) {
        // Branch 1: no profile id at all
        if (!userProfileId) {
            return (
                <>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowButton
                            aiActionId={!typex ? 'clikb.profile_header.action.following' : undefined}
                            initialFollowing={false}
                            initialCount={followingReducer}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton
                            aiActionId={!typex ? 'clikb.profile_header.action.followers' : undefined}
                            count={followersReducer}
                            onClick={followingOpen}
                        />
                    </Box>
                </>
            );
        }

        // Branch 2: viewing self (or profile id is 0)
        if (loggedUser && (loggedUserId === userProfileId || userProfileId === 0)) {
            return (
                <>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowButton
                            aiActionId={!typex ? 'clikb.profile_header.action.following' : undefined}
                            initialFollowing={false}
                            initialCount={followingReducer}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton
                            aiActionId={!typex ? 'clikb.profile_header.action.followers' : undefined}
                            count={followersReducer}
                            onClick={followingOpen}
                        />
                    </Box>
                </>
            );
        }

        // Branch 3: viewing someone else
        if (connected) {
            // already know follow status + counts
            return (
                <>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowButton
                            aiActionId={!typex ? 'clikb.profile_header.action.following' : undefined}
                            initialFollowing={false}
                            initialCount={counts.following}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton
                            aiActionId={!typex ? 'clikb.profile_header.action.followers' : undefined}

                            count={counts.followers}
                            onClick={followingOpen}
                        />
                    </Box>
                </>
            );
        }

        // Not connected yet → show your StartFollowButton
        return (
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <StartFollowButton
                    aiActionAreaId={!typex ? 'clikb.profile_header' : `clikb.navigation.relationship_row.${userProfileId}`}
                    connected={connected}
                    typex={typex}
                    type={type}
                    refresh={refresh}
                    setConnected={setConnected}
                    userid={loggedUserId}
                    favid={userProfileId}
                    initialFollowing={false}

                    initialCount={counts.followers}
                    onToggle={onFollowToggle ?? (() => { })}
                    onSnapshotState={onSnapshotState}
                    onProfileFollowed={onProfileFollowed}
                    disabled={followDisabled}
                />
            </Box>
        );
    }

    if (type === 1) {

        // Branch 1: no profile id at all
        if (!userProfileId) {
            return (
                <>
                </>
            );
        }

        // Branch 2: viewing self (or profile id is 0)
        if (loggedUser && (loggedUserId === userProfileId || userProfileId === 0)) {
            return (
                <>

                </>
            );
        }

        // Branch 3: viewing someone else
        if (connected) {
            // already know follow status + counts
            return (
                <Box sx={{ flex: 1, width: '1vw' }}>
                    <StartFollowButton
                        aiActionAreaId={`clikb.navigation.relationship_row.${userProfileId}`}
                        connected={connected}
                        typex={typex}
                        type={2}
                        refresh={refresh}
                        setConnected={setConnected}
                        userid={loggedUserId}
                        favid={userProfileId}
                        initialFollowing={false}
                        initialCount={counts.followers /* or any seed you prefer */}
                        onToggle={onFollowToggle ?? (() => { })}
                        onSnapshotState={onSnapshotState}
                    />
                </Box>
            );
        }

        // Not connected yet → show your StartFollowButton
        return (
            <Box sx={{ flex: 1, width: '1vw' }}>
                <StartFollowButton
                    aiActionAreaId={`clikb.navigation.relationship_row.${userProfileId}`}
                    connected={connected}
                    typex={typex}
                    type={type}
                    refresh={refresh}
                    setConnected={setConnected}
                    userid={loggedUserId}
                    favid={userProfileId}
                    initialFollowing={false}
                    initialCount={counts.followers /* or any seed you prefer */}
                    onToggle={onFollowToggle ?? (() => { })}
                    onSnapshotState={onSnapshotState}
                />
            </Box>
        );

    }


}
