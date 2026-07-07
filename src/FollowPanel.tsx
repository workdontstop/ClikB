// FollowPanel.tsx
import * as React from "react";
import { Box } from "@mui/material";

// â¬‡ï¸ use your existing components/paths
import FollowButton from "./FollowButton";
import FollowersButton from "./FollowersButton";
import StartFollowButton from "./FollowStartButton";

export type FollowPanelProps = {
    /** The profile being viewed */
    userProfile: any;
    /** The logged-in user */
    loggedUser: { id: number } | null | undefined;

    /** Are we already connected (i.e., status.following boolean)? */
    connected: boolean;
    /** Setter from parent so StartFollowButton can flip it after success */
    setConnected: (next: boolean) => void;

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


};





/**
 * Renders your two-button block with the same branching as your snippet:
 * - If no userProfile.id â†’ show pair with reducer counts
 * - If viewing self (loggedUser.id === userProfile.id OR userProfile.id === 0) â†’ show pair with reducer counts
 * - Else (viewing someone else):
 *     - if connected â†’ show pair with counts from /fan/list
 *     - else â†’ show StartFollowButton (loader + backend call), using loggedUser.id â†’ userProfile.id
 *
 * NOTE: This component returns the two <Box> items (or one in the StartFollow case).
 * Place <FollowPanel /> inside your own row/grid container to align side-by-side.
 */
export default function FollowPanel(props: FollowPanelProps) {
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


    } = props;

    const userProfileId = userProfile ?? 0;
    const loggedUserId = loggedUser?.id ?? 0;

    const followOpen = () => {
        /// setShowEmotions(true);
        setShowEmotions();
        setfollowType(1)
    }


    const followingOpen = () => {
        //setShowEmotions(true);

        setShowEmotions();
        setfollowType(0)
    }

    if (type === 0) {
        // Branch 1: no profile id at all
        if (!userProfileId) {
            return (
                <>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowButton
                            initialFollowing={false}
                            initialCount={followingReducer}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton
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
                            initialFollowing={false}
                            initialCount={followingReducer}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton
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
                            initialFollowing={false}
                            initialCount={loggedUser ? loggedUser.id === userProfile.id ? followingReducer : counts.following : 0}
                            onToggle={followOpen}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FollowersButton

                            count={loggedUser ? loggedUser.id === userProfile.id ? followersReducer : counts.followers : 0}
                            onClick={followingOpen}
                        />
                    </Box>
                </>
            );
        }

        // Not connected yet â†’ show your StartFollowButton
        return (
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <StartFollowButton
                    connected={connected}
                    typex={typex}
                    type={type}
                    refresh={refresh}
                    setConnected={setConnected}
                    userid={loggedUserId}
                    favid={userProfileId}
                    initialFollowing={false}

                    initialCount={loggedUser ? loggedUser.id === userProfile.id ? followersReducer : counts.followers : 0}
                    onToggle={onFollowToggle ?? (() => { })}
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
                    />
                </Box>
            );
        }

        // Not connected yet â†’ show your StartFollowButton
        return (
            <Box sx={{ flex: 1, width: '1vw' }}>
                <StartFollowButton
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
                />
            </Box>
        );

    }


}
