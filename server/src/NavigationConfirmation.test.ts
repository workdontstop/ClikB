import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedRelationshipTarget } from './NavigationConfirmation';

const areaId = 'clikb.navigation.relationship_row.42';
const snapshot = { navigation: { areas: { [areaId]: { state: { username: 'alice', viewerFollows: false } } } } };
const follow = { actionId: `${areaId}.action.follow`, controlId: `${areaId}.control.follow`, targetId: 42, requiresConfirmation: true };

test('relationship confirmation needs exact latest action and person', () => {
  assert.equal(confirmedRelationshipTarget('confirm follow @alice', snapshot, follow), 42);
  assert.equal(confirmedRelationshipTarget('I confirm follow alice.', snapshot, follow), 42);
  assert.equal(confirmedRelationshipTarget('confirm follow 42', snapshot, follow), 42);
  for (const message of ['yes', 'follow alice', 'confirm follow @bob', 'confirm unfollow @alice', 'do not confirm follow @alice', 'confirm follow @alice and bob']) {
    assert.equal(confirmedRelationshipTarget(message, snapshot, follow), null, message);
  }
});
