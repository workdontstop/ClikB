const assert = require('node:assert/strict');

// A shared store with isolated module/connection factories. Transactions serialize
// and roll back ALL writes on failure; SQL we do not model is an error, not success.
function createMeteredSqlHarness(initialBalances = [['101', 100]]) {
  const state = { members: new Map(initialBalances), sessions: new Map(), events: new Map(), receipts: new Map(), builds: new Map(), queries: [], failQuery: null, beforeCommit: null, failNextTransaction: false, trySpendCalled: 0 };
  let tail = Promise.resolve();
  const clone = () => Object.fromEntries(['members', 'sessions', 'events', 'receipts', 'builds'].map(key => [key, structuredClone(state[key])]));
  const query = async (sql, params = []) => {
    const norm = String(sql).replace(/\s+/g, ' ').trim();
    state.queries.push(norm);
    if (state.failQuery) await state.failQuery(norm, params);
    if (norm.startsWith('CREATE TABLE')) return [];
    if (/^INSERT (?:IGNORE )?INTO ai_metered_billing_sessions/.test(norm)) {
      const [sk, user, workload, profile, model, cumulative, settled, carry, seq, policy] = params;
      if (norm.startsWith('INSERT IGNORE') && state.sessions.has(sk)) return { affectedRows: 0 };
      state.sessions.set(sk, { session_key: sk, user_id: user, workload, profile, model, cumulative_subunits: cumulative, settled_whole_pixels: settled, carry_subunits: carry, receipt_seq: seq, policy_version: policy });
      return { affectedRows: 1 };
    }
    if (/^SELECT .* FROM ai_metered_billing_sessions/.test(norm)) return state.sessions.has(params[0]) ? [{ ...state.sessions.get(params[0]) }] : [];
    if (/^SELECT .* FROM ai_metered_billing_events/.test(norm)) {
      const row = state.events.get(`${params[0]}::${params[1]}`);
      return row ? [{ ...row }] : [];
    }
    if (/^INSERT (?:IGNORE )?INTO ai_metered_billing_events/.test(norm)) {
      const [sk, id, user, workload, profile, model, cost, policy] = params;
      const key = `${sk}::${id}`;
      if (state.events.has(key)) throw Object.assign(new Error('Duplicate event'), { code: 'ER_DUP_ENTRY' });
      state.events.set(key, { session_key: sk, event_id: id, user_id: user, workload, profile, model, cost_subunits: cost, policy_version: policy });
      return { affectedRows: 1 };
    }
    if (/^SELECT .* FROM ai_metered_billing_receipts/.test(norm)) {
      if (norm.includes('WHERE session_key = ?')) return [...state.receipts.values()]
        .filter(row => row.session_key === params[0] && row.user_id === params[1] && row.receipt_seq > params[2])
        .sort((a, b) => a.receipt_seq - b.receipt_seq).slice(0, params[3]).map(row => ({ ...row }));
      const row = state.receipts.get(params[0]);
      return row ? [{ ...row }] : [];
    }
    if (norm.startsWith('INSERT INTO ai_metered_billing_receipts')) {
      const [key, rid, sk, uid, seq, workload, profile, model, charged, settled, carry, cumulative, balance, zero, policy] = params;
      if (state.receipts.has(key)) throw Object.assign(new Error('Duplicate receipt'), { code: 'ER_DUP_ENTRY' });
      state.receipts.set(key, { idempotency_key: key, receipt_id: rid, session_key: sk, user_id: uid, receipt_seq: seq, workload, profile, model, pixels_charged: charged, total_settled_pixels: settled, carry_subunits: carry, cumulative_subunits: cumulative, remaining_pixels: balance, zero_balance_reached: zero, policy_version: policy });
      return { affectedRows: 1 };
    }
    if (/^SELECT .* FROM members/.test(norm)) return state.members.has(params[0]) ? [{ pixels: state.members.get(params[0]) }] : [];
    if (norm.startsWith('UPDATE members SET pixels')) {
      const [cost, user, minimum = cost] = params;
      const balance = state.members.get(user);
      if (balance === undefined || balance < minimum) return { affectedRows: 0 };
      state.members.set(user, balance - cost);
      return { affectedRows: 1 };
    }
    if (/^SELECT .* FROM scene_live_builds/.test(norm)) {
      const row = state.builds.get(params[0]);
      if (!row || (params[1] && row.user_id !== params[1])) return [];
      const fields = norm.slice(7, norm.indexOf(' FROM ')).split(',').map(s => s.trim());
      return [fields.includes('*') ? { ...row } : Object.fromEntries(fields.map(field => [field, row[field]]))];
    }
    if (norm.startsWith('INSERT INTO scene_live_builds')) {
      const [id, uid, kind, operation, target, tier, status, body, checkpoint, final, charged, segments] = params;
      const prev = state.builds.get(id);
      state.builds.set(id, { build_id: id, user_id: uid, kind, operation, target_key: target, tier, status, request_body: body, checkpoint, final_result: final || prev?.final_result || null, charged: charged || prev?.charged || 0, segments });
      return { affectedRows: 1 };
    }
    if (norm.startsWith('UPDATE scene_live_builds')) {
      if (norm.startsWith('UPDATE scene_live_builds SET checkpoint=?')) {
        const finalizing = norm.includes('charged=1');
        const [checkpoint, second, third, fourth] = params;
        const id = finalizing ? third : second, uid = finalizing ? fourth : third;
        const row = state.builds.get(id);
        assert.ok(row && row.user_id === uid);
        row.checkpoint = checkpoint;
        if (finalizing) Object.assign(row, { charged: 1, status: 'completed', final_result: second });
        return { affectedRows: 1 };
      }
      // Existing finalization statement.
      if (norm.includes("charged=1,status='completed',final_result=?")) {
        const [final, id, uid] = params;
        const row = state.builds.get(id);
        assert.ok(row && row.user_id === uid);
        Object.assign(row, { charged: 1, status: 'completed', final_result: final });
        return { affectedRows: 1 };
      }
    }
    throw new Error(`Unmodelled SQL: ${norm}`);
  };
  const makeEnv = () => {
    const execQuery = Object.assign(async (...args) => query(...args), {
      withTransaction: async work => {
        const previous = tail;
        let release;
        tail = new Promise(resolve => { release = resolve; });
        await previous;
        if (state.failNextTransaction) {
          state.failNextTransaction = false;
          release();
          throw new Error('simulated SQL transaction failure');
        }
        const before = clone();
        try {
          const result = await work(query);
          if (state.beforeCommit) await state.beforeCommit();
          return result;
        } catch (error) {
          Object.assign(state, before);
          throw error;
        } finally { release(); }
      },
    });
    const db = { getPixelsForUser: async user => state.members.get(user), trySpendPixels: async () => { state.trySpendCalled++; throw new Error('Unreceipted debit is forbidden'); } };
    return { execQuery, db };
  };
  return { state, makeEnv };
}
module.exports = { createMeteredSqlHarness };
