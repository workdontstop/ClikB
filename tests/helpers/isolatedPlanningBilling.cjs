/** Geometry/route suites use an explicit in-memory billing adapter. Durable
 * wallet/SQL behavior is exercised separately by threeJsMeteredBilling.test.cjs. */
function withIsolatedPlanningBilling(mocks, load) {
    if (mocks['./meteredUsageBilling'] || !mocks['./db']) return mocks;
    const db = mocks['./db'];
    const blockedSql = Object.assign(async () => { throw new Error('Unexpected SQL in isolated planning test'); }, {
        withTransaction: async () => { throw new Error('Unexpected transaction in isolated planning test'); },
    });
    const metered = load('server/src/meteredUsageBilling.ts', { ...mocks, './execQuery': blockedSql });
    metered.__setMeteredBillingTestAdapter({
        getBalance: user => db.getPixelsForUser(user),
        spendPixels: async (user, pixels) => {
            const balance = Number(await db.getPixelsForUser(user));
            const ok = await db.trySpendPixels(user, pixels);
            if (!ok) throw Object.assign(new Error('Balance changed before settlement'), { status: 402, code: 'INSUFFICIENT_PIXELS' });
            return { ok, balance: ok ? balance - pixels : balance };
        },
    });
    const auth = mocks['./requestAuth'];
    return { ...mocks, './meteredUsageBilling': metered, './execQuery': mocks['./execQuery'] || blockedSql,
        ...(auth ? { './requestAuth': { ...auth, authenticatedUserId: req => String(auth.authenticatedUserId(req) || '') } } : {}),
        './aiUsageLedger': { providerUsageCursor: () => 0, providerPixelsSince: () => 1.2, ...mocks['./aiUsageLedger'] },
    };
}
module.exports = { withIsolatedPlanningBilling };
