import assert from 'node:assert/strict';
import test from 'node:test';
import { conciergeTaskBoundary, conciergeBoundaryReached, crossesConciergeTaskBoundary } from './ConciergeTaskBoundary';

const gridPublish = 'clikb.creation.storybook_grid.action.publish';
const musicPublish = 'clikb.creation.storybook_studio_selector.action.publish_music_video';
const observed = (actionId: string, enabled = true) => ({ creation: { controls: { areas: { current: { controls: [{ actionId, enabled }] } } } } });

test('stop before publication is retained through refinements and bare Continue', () => {
  for (const instruction of ['stop at Publish', 'stop a t publish', 'stop before publishing', 'do not publish', 'without publishing', 'leave it at publish', 'stop when ready to publish', 'let me know when ready to publish', "don't post"]) {
    const goal = `Create two realistic dinosaur images and ${instruction}\nStanding under a street lamp post in the rain.\nUser refinement: continue\nUser refinement: enter studio`;
    assert.deepEqual(conciergeTaskBoundary(goal), { destination: 'publish', stopBeforePublication: true });
    assert.equal(conciergeTaskBoundary(`${goal}\nUser refinement: yes publish it`), undefined);
    assert.ok(conciergeTaskBoundary(`${goal}\nUser refinement: I will publish later`));
  }
  assert.equal(conciergeTaskBoundary('Search for cars'), undefined);
});

test('Publish destination requires an enabled live branch control, not images or ordinary studio entry', () => {
  const boundary = conciergeTaskBoundary('Create images and stop at publish');
  assert.equal(conciergeBoundaryReached(boundary, { creation: { hdImageCount: 2, stage: 'storybook' } }), false);
  assert.equal(conciergeBoundaryReached(boundary, observed('clikb.creation.storybook_studio_selector.action.enter_studio')), false);
  assert.equal(conciergeBoundaryReached(boundary, observed(gridPublish, false)), false);
  for (const id of [gridPublish, musicPublish, 'clikb.creation.storybook_publish.action.process_video']) {
    assert.equal(conciergeBoundaryReached(boundary, observed(id)), true);
    assert.equal(crossesConciergeTaskBoundary(boundary, { kind: 'click', actionId: id }), true);
  }
  assert.equal(crossesConciergeTaskBoundary(boundary, { kind: 'click', actionId: 'clikb.creation.thumbnail.action.save_post' }), true);
  assert.equal(crossesConciergeTaskBoundary(boundary, { kind: 'click', actionId: 'clikb.creation.storybook_studio_selector.action.enter_studio' }), false);
  assert.equal(crossesConciergeTaskBoundary(undefined, { kind: 'click', actionId: gridPublish }), false);
});
