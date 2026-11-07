import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCharacterInjection } from './characterInjection';
import { normalizeDetectedCharacterNames, normalizeDetectedEnvironmentNames } from './castingNames';

test('character injection respects full handle boundaries', () => {
  const result = applyCharacterInjection('@Anna beside @Annette and @Ann', [
    { name: 'Ann', url: 'https://example.test/ann.png' },
  ], 'flux');
  assert.equal(result.newPrompt, '@Anna beside @Annette and <image_1>');
  assert.equal(result.updatedInputs.length, 1);
});

test('character injection accepts compact and spaced handles with punctuation', () => {
  const result = applyCharacterInjection('@MrFox and @Mr. Fox', [
    { name: 'Mr. Fox', url: 'https://example.test/fox.png' },
  ], 'flux');
  assert.equal(result.newPrompt, '<image_1> and <image_1>');
  assert.equal(result.updatedInputs.length, 1);
});

test('automatic names use one existing scene word and the saved name injects its image', () => {
  const scenes = ['An adventurer chases a white horse through the garden.'];
  const normalized = normalizeDetectedCharacterNames([
    { name: 'Space Adventurer', description: 'Colorful armor.' },
    { name: 'White Horse', description: 'A white coat.' },
  ], scenes);
  assert.equal(normalized[0].name, 'adventurer');
  assert.equal(normalized[1].name, 'horse');
  assert.equal(normalized[0].description, 'Colorful armor.');
  assert.deepEqual(scenes, ['An adventurer chases a white horse through the garden.']);
  const injected = applyCharacterInjection('@Adventurer chases @Horse', normalized.map(character => ({
    name: character.name, url: `https://example.test/${character.name}.png`,
  })), 'flux');
  assert.equal(injected.newPrompt, '<image_1> chases <image_2>');
  assert.deepEqual(injected.updatedInputs, [
    'https://example.test/adventurer.png', 'https://example.test/horse.png',
  ]);
});

test('automatic labels stay one word without adding a saving restriction', () => {
  const normalized = normalizeDetectedCharacterNames([
    { name: 'Space Adventurer Girl' },
    { name: 'Dark Witch' },
    { name: 'Unmatched Label' },
  ], ['The Adventurer meets a dark witch.']);
  assert.deepEqual(normalized.map(character => character.name), ['Adventurer', 'witch', 'Label']);
});

test('automatic environments use the first existing identifying word and inject its image', () => {
  const scenes = ['The girl and horse meet in a beautiful meadow garden beside a rose arch.'];
  const environments = [
    { name: 'The Meadow Garden', description: 'A bright garden with flowers.' },
    { name: 'Rose Arch', description: 'A stone arch covered with roses.' },
  ];
  const normalized = normalizeDetectedEnvironmentNames(environments, scenes);
  assert.deepEqual(normalized.map(environment => environment.name), ['meadow', 'rose']);
  assert.equal(normalized[0].description, environments[0].description);
  assert.equal(environments[0].name, 'The Meadow Garden');
  assert.deepEqual(scenes, ['The girl and horse meet in a beautiful meadow garden beside a rose arch.']);
  const injected = applyCharacterInjection('@meadow beside @rose', normalized.map(environment => ({
    name: environment.name, url: `https://example.test/${environment.name}.png`,
  })), 'flux');
  assert.equal(injected.newPrompt, '<image_1> beside <image_2>');
  assert.deepEqual(injected.updatedInputs, [
    'https://example.test/meadow.png', 'https://example.test/rose.png',
  ]);
});

test('automatic environment labels retain the existing permissive save behavior', () => {
  const normalized = normalizeDetectedEnvironmentNames([{ name: 'Unmatched Place' }], ['A meadow.']);
  assert.equal(normalized[0].name, 'Unmatched');
});
