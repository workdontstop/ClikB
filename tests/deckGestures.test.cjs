const test = require('node:test'), assert = require('node:assert/strict');
const { loadTypeScript } = require('./promptTestBindings.cjs');
const { deckGestureAxis, deckVerticalTarget, createDeckWheelGesture, consumeDeckWheel } = loadTypeScript('src/deckGestures.ts');

test('regular and Search vertical rings wrap without crossing contexts, including empty collections', () => {
  assert.equal(deckVerticalTarget('all', undefined, 1), 'games');
  assert.equal(deckVerticalTarget('games', undefined, -1), 'all');
  assert.equal(deckVerticalTarget('shorts', undefined, 1), 'cinema');
  assert.equal(deckVerticalTarget('search', 'cinema', 1), 'games');
  assert.equal(deckVerticalTarget('search', 'games', -1), 'cinema');
  assert.equal(deckVerticalTarget('page', undefined, 1), null);
});

test('axis detection ignores jitter/ambiguous diagonals and wheel momentum fires only once until quiet', () => {
  assert.equal(deckGestureAxis(4, 7), null);
  assert.equal(deckGestureAxis(40, 42), null);
  assert.equal(deckGestureAxis(70, 30), 'x');
  const state = createDeckWheelGesture();
  assert.equal(consumeDeckWheel(state, 2, 30, 0), null);
  assert.deepEqual(consumeDeckWheel(state, 2, 35, 20), { axis: 'y', direction: 1 });
  for (let now = 40; now < 1800; now += 20) assert.equal(consumeDeckWheel(state, 90, 90, now), null);
  assert.deepEqual(consumeDeckWheel(state, -80, 0, 2100), { axis: 'x', direction: -1 });
});
