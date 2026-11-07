export const CONVERSATION_PROFILE_POLICY_VERSION = '2026-10-27.v2';

export const CONVERSATION_PROFILES = {
    luna_none: { model: 'gpt-6-luna', reasoningEffort: 'none', billingMode: 'free' },
    luna: { model: 'gpt-6-luna', reasoningEffort: 'low', billingMode: 'free' },
    // Retain the saved preference key; the user-facing Luna · Medium uses medium.
    luna_xhigh: { model: 'gpt-6-luna', reasoningEffort: 'medium', billingMode: 'metered' },
    terra: { model: 'gpt-6.1-terra', reasoningEffort: 'low', billingMode: 'metered' },
    sol_low: { model: 'gpt-6.1-sol', reasoningEffort: 'low', billingMode: 'metered' },
    // Legacy compatibility keys retained for in-flight or historical ledger resolution:
    luna_max: { model: 'gpt-6-luna', reasoningEffort: 'max', billingMode: 'metered' },
    sol: { model: 'gpt-6.1-sol', reasoningEffort: 'medium', billingMode: 'metered' },
    deepseek: { model: 'deepseek-ai/deepseek-v3.1', reasoningEffort: undefined, billingMode: 'free' },
    kimi: { model: 'moonshotai/kimi-k2.6', reasoningEffort: undefined, billingMode: 'free' },
} as const;

export type ConversationTier = keyof typeof CONVERSATION_PROFILES;
export type ConversationBillingMode = 'free' | 'metered';
export type ConversationProfile = {
    tier: ConversationTier | 'default';
    model: string;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    billingMode: ConversationBillingMode;
    policyMigrated?: boolean;
    requestedTier?: ConversationTier | 'default';
};

export const VISIBLE_CONVERSATION_TIERS: readonly ConversationTier[] = [
    'luna_none',
    'luna',
    'luna_xhigh',
    'terra',
] as const;

export function resolveConversationProfile(
    rawTier: unknown,
    defaultModel = process.env.BRAINSTORM_MODEL || CONVERSATION_PROFILES.luna.model,
): ConversationProfile | null {
    if (rawTier === undefined || rawTier === null || rawTier === '') {
        return {
            tier: 'default',
            model: defaultModel,
            reasoningEffort: defaultModel === CONVERSATION_PROFILES.luna.model ? 'low'
                : defaultModel === CONVERSATION_PROFILES.terra.model ? 'low'
                : defaultModel === CONVERSATION_PROFILES.sol.model ? 'medium' : undefined,
            billingMode: 'free',
        };
    }
    if (typeof rawTier !== 'string' || !Object.prototype.hasOwnProperty.call(CONVERSATION_PROFILES, rawTier)) {
        return null;
    }
    const tier = rawTier as ConversationTier;
    return { tier, ...CONVERSATION_PROFILES[tier] };
}

export function extractConversationPolicyVersion(reqOrPayload?: any): string | undefined {
    if (!reqOrPayload || typeof reqOrPayload !== 'object') return undefined;
    const direct =
        reqOrPayload.billingPolicyVersion ??
        reqOrPayload.policyVersion ??
        reqOrPayload.body?.billingPolicyVersion ??
        reqOrPayload.body?.policyVersion ??
        reqOrPayload.query?.billingPolicyVersion ??
        reqOrPayload.query?.policyVersion ??
        reqOrPayload.headers?.['x-clikb-billing-policy'] ??
        reqOrPayload.headers?.['X-ClikB-Billing-Policy'];
    if (typeof direct === 'string' && direct.trim()) {
        return direct.trim();
    }
    return undefined;
}

/**
 * Resolves a conversation profile for server admission, enforcing the active
 * billing policy version. If a client requests a metered tier without presenting
 * the current `CONVERSATION_PROFILE_POLICY_VERSION` (e.g. a stale pre-migration
 * browser tab or unversioned caller), admission safely downgrades to free `luna`
 * (`Luna · Low`) and marks `policyMigrated: true`.
 */
export function resolveAdmittedConversationProfile(
    rawTier: unknown,
    options?: {
        policyVersion?: unknown;
        defaultModel?: string;
    },
): ConversationProfile | null {
    const resolved = resolveConversationProfile(rawTier, options?.defaultModel);
    if (!resolved) return null;
    if (resolved.billingMode === 'metered') {
        const policyVersion = typeof options?.policyVersion === 'string' ? options.policyVersion.trim() : '';
        if (policyVersion !== CONVERSATION_PROFILE_POLICY_VERSION) {
            return {
                tier: 'luna',
                ...CONVERSATION_PROFILES.luna,
                policyMigrated: true,
                requestedTier: resolved.tier,
            };
        }
    }
    return resolved;
}

export function isPaidConversationProfile(profileOrTier: ConversationProfile | unknown): boolean {
    if (!profileOrTier) return false;
    if (typeof profileOrTier === 'object' && 'billingMode' in (profileOrTier as Record<string, unknown>)) {
        return (profileOrTier as ConversationProfile).billingMode === 'metered';
    }
    const resolved = resolveConversationProfile(profileOrTier);
    return resolved?.billingMode === 'metered';
}

/**
 * Unversioned or retired saved preferences must never silently place a returning
 * user onto a newly metered tier without explicit post-migration selection.
 */
export function migrateSavedConversationTier(rawTier: unknown, policyVersion?: unknown): ConversationTier {
    if (typeof rawTier !== 'string' || !VISIBLE_CONVERSATION_TIERS.includes(rawTier as ConversationTier)) {
        return 'luna';
    }
    const tier = rawTier as ConversationTier;
    if (policyVersion !== CONVERSATION_PROFILE_POLICY_VERSION && CONVERSATION_PROFILES[tier].billingMode === 'metered') {
        return 'luna';
    }
    return tier;
}
