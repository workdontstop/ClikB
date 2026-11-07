const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/worldCharacterDescription.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { getWorldCharacterImagePrompt, getWorldCharacterPersonality } = mod.exports;

const visual = 'show one character from my image: Terra, a young adult woman with long white hair.\nWhite trousers, brown boots and a cropped jacket.';
const personality = 'Protective and patient. Wants to reunite the group; hides her fears with dry humour. Speaks softly to Cuzon.';
const description = `Visual description:\n${visual}\n\nPersonality:\n${personality}`;

function handler(file, name, bindings) {
    bindings = { ...require('./promptTestBindings.cjs'), ...bindings };
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let arrow;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
            arrow = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(arrow, `Missing actual ${file} ${name} handler`);
    const code = ts.transpileModule(`const handler = ${arrow.getText(source)};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return new Function(...Object.keys(bindings), `${code}\nreturn handler;`)(...Object.values(bindings));
}

test('legacy character descriptions remain byte-for-byte unchanged for images', () => {
    for (const legacy of ['', '  show one character from my image: tall man with dreadlocks.\n\n', 'A woman whose personality is reflected in her elegant posture.']) {
        assert.equal(getWorldCharacterImagePrompt(legacy), legacy);
    }
});

test('missing generated or fetched descriptions are empty for image and personality extraction', () => {
    for (const missing of [null, undefined]) {
        assert.equal(getWorldCharacterImagePrompt(missing), '');
        assert.equal(getWorldCharacterPersonality(missing), '');
    }
    assert.equal(getWorldCharacterImagePrompt(), '');
    assert.equal(getWorldCharacterPersonality(), '');
});

test('structured description preserves the full visual prompt and excludes narrative traits', () => {
    assert.equal(getWorldCharacterImagePrompt(description), visual);
    assert.ok(!getWorldCharacterImagePrompt(description).includes(personality));
});

test('plain and markdown headings are case-insensitive and allow same-line content', () => {
    for (const structured of [
        `vIsUaL dEsCrIpTiOn: ${visual}\nPeRsOnAlItY: ${personality}`,
        `**Visual description:**\n${visual}\n\n**Personality:**\n${personality}`,
        `## VISUAL DESCRIPTION:\n${visual}\n\n## Personality:\n${personality}`,
        `__Visual description__: ${visual}\n__Personality__: ${personality}`,
    ]) assert.equal(getWorldCharacterImagePrompt(structured), visual);
});

test('personality can precede the visual section without leaking into image prompts', () => {
    assert.equal(getWorldCharacterImagePrompt(`Personality:\n${personality}\n\nVisual description:\n${visual}`), visual);
    assert.equal(getWorldCharacterImagePrompt(`## Personality: ${personality}\n## Visual description: ${visual}`), visual);
});

test('visual-only structured descriptions still generate, without sending the heading', () => {
    assert.equal(getWorldCharacterImagePrompt(`Visual description:\n${visual}`), visual);
});

test('removing the visual heading does not send the personality section to the image model', () => {
    assert.equal(getWorldCharacterImagePrompt(`${visual}\n\nPersonality:\n${personality}`), visual);
    assert.equal(getWorldCharacterImagePrompt(`Personality:\n${personality}`), '');
});

test('empty visual sections produce no image prompt rather than falling back to personality', () => {
    for (const empty of [
        `Visual description:\n\nPersonality:\n${personality}`,
        `Personality:\n${personality}\nVisual description:  `,
        'Visual description:   ',
    ]) assert.equal(getWorldCharacterImagePrompt(empty), '');
});

test('Character Lab request receives only visuals and retains the complete saved description', async () => {
    const sourcePlan = Object.freeze({
        Characters: Object.freeze([Object.freeze({ name: 'Terra', description })]),
        CharacterImages: Object.freeze(['original-reference']),
    });
    let state = sourcePlan;
    let loading = [];
    const requests = [];
    const generateImage = handler('src/WorldCreationEdits.tsx', 'handleSubmitFluxImageNew', {
        Seed: 123, ratioKey: '9:16', modelz: 'Schnell', pixels: 1000, CLIK_URL: '/fixture-api', remixPlan: sourcePlan,
        getGptImageRoute: () => null,
        expectedMediaCharge: () => null,
        axios: { post: async (url, payload) => { requests.push({ url, payload }); return { status: 200, data: { imageBase64: 'data:image/png;base64,fixture' } }; } },
        setRemixPlan: update => { state = update(state); },
        setLoadingIndices: update => { loading = update(loading); },
    });
    const trigger = handler('src/WorldCreationEdits.tsx', 'triggerGeneration', {
        getWorldCharacterImagePrompt,
        setLoadingIndices: update => { loading = update(loading); },
        handleSubmitFluxImageNew: generateImage,
    });
    const pending = [];
    const click = handler('src/WorldImage.tsx', 'handleGenerateClick', {
        charIndex: 0,
        characterData: sourcePlan.Characters[0],
        selectedAsset: { imageUrl: 'original-reference' },
        getWorldCharacterImagePrompt,
        onGenerateTrigger: (...args) => pending.push(trigger(...args)),
    });
    click();
    await Promise.all(pending);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.inputs, visual);
    assert.equal(requests[0].payload.sampleImage, 'original-reference');
    assert.equal(requests[0].payload.billingReference, 'Terra');
    assert.equal(state.Characters[0].description, description, 'personality was lost from story state');
    assert.equal(sourcePlan.Characters[0].description, description, 'source description was mutated');
    assert.deepEqual(sourcePlan.CharacterImages, ['original-reference']);
    assert.equal(state.CharacterImages[0], 'data:image/png;base64,fixture');
    assert.deepEqual(loading, []);
});

test('both image entry points reject personality-only descriptions before any request or loading change', async () => {
    const empty = `Visual description:\n\nPersonality:\n${personality}`;
    const unexpected = () => assert.fail('attempted to generate an image without a visual description');
    handler('src/WorldImage.tsx', 'handleGenerateClick', {
        charIndex: 0, characterData: { name: 'Terra', description: empty }, selectedAsset: null,
        getWorldCharacterImagePrompt, onGenerateTrigger: unexpected,
    })();
    await handler('src/WorldCreationEdits.tsx', 'triggerGeneration', {
        getWorldCharacterImagePrompt, setLoadingIndices: unexpected, handleSubmitFluxImageNew: unexpected,
    })(0, empty, null);
});

test('the existing character image request path retains legacy prompt whitespace and reference choices', async () => {
    const legacy = `  ${visual}\n\n`;
    const calls = [];
    const trigger = handler('src/WorldCreationEdits.tsx', 'triggerGeneration', {
        getWorldCharacterImagePrompt,
        setLoadingIndices: () => {},
        handleSubmitFluxImageNew: async (...args) => calls.push(args),
    });
    await trigger(2, legacy, null);
    assert.deepEqual(calls, [[null, legacy, 2]]);
});

test('story personality extraction excludes visuals in either section order and supports markdown headings', () => {
    for (const structured of [
        description,
        `Personality:\n${personality}\n\nVisual description:\n${visual}`,
        `**VISUAL DESCRIPTION:** ${visual}\n**personality:** ${personality}`,
        `## PERSONALITY: ${personality}\n## Visual description: ${visual}`,
    ]) assert.equal(getWorldCharacterPersonality(structured), personality);
});

test('unlabelled and empty descriptions do not invent personality traits', () => {
    for (const absent of [
        '',
        visual,
        'A patient woman with white hair and a calm posture.',
        `Visual description:\n${visual}`,
        `Visual description:\n${visual}\n\nPersonality:\n`,
    ]) assert.equal(getWorldCharacterPersonality(absent), '');
    assert.equal(getWorldCharacterPersonality('Personality:\nNot yet established.'), 'Not yet established.');
});

function storyFixture(characters, remixData = 'Use a busy repair workshop.', prompt = 'Terra is a mechanic wearing blue coveralls and carrying no weapons.') {
    const requests = [];
    const protectedUrls = { current: null };
    const planned = [];
    const start = handler('src/PromptInput.tsx', 'StartStory', {
        Vipcharacters: characters,
        protectedVipCharacterUrlsRef: protectedUrls,
        getWorldCharacterPersonality,
        cancelAutomaticGuideCall: () => {}, sceneDoubleCheckCallId: 'fixture', setDoubleCheckResult: () => {},
        finalCreationReviewStartedAtRef: { current: null }, finalCreationReviewSentRef: { current: false },
        resetVideoModeRunGuard: () => {}, setIsSubmittingKick: () => {}, setCreationProgressRunKey: () => {},
        setParsedKeyPoints: () => {}, setParsedKeyPoints2: () => {}, setParsedKeyPointsb: () => {},
        setParsedKeyPointsx: () => {}, setPlanInfo: () => {}, setallowSpin: () => {}, setError: () => {},
        remixData, type: 3, promptMusicUrl: '', promptMusicSceneCount: 0,
        countAuthoredScenes: () => 0, resetCreationLedger: () => {}, CLIK_URL: '/fixture-api',
        axios: { post: async (url, body, config) => {
            requests.push({ url, body, config });
            return { data: { initialSteps: { keyPoints: ['Terra repairs an engine.'] } } };
        } },
        StartPlan: async (...args) => { planned.push(args); return true; },
        console: { log: () => {} },
    });
    return { run: () => start(prompt, { id: 1 }, 'Cinematic', 3, 'spatial'), requests, protectedUrls, planned, prompt };
}

test('StartStory sends selected world personalities without the saved outfit or image prompt', async () => {
    const savedVisual = 'show one character from my image: Terra wearing CEREMONIAL_SILVER_PLATE_ARMOUR with a huge glow hammer.';
    const savedDescription = `Visual description:\n${savedVisual}\n\nPersonality:\n${personality}`;
    const characters = Object.freeze([Object.freeze({ name: 'Terra', source: 'world', imageUrl: 'https://fixture.invalid/terra.png', description: savedDescription })]);
    const fixture = storyFixture(characters);
    assert.equal(await fixture.run(), true);
    assert.equal(fixture.requests.length, 1);
    const { body } = fixture.requests[0];
    assert.equal(body.pp, fixture.prompt, 'current user wardrobe brief changed');
    assert.match(body.remixData, /^Use a busy repair workshop\./);
    assert.ok(body.remixData.includes(`- Terra: ${personality}`));
    assert.match(body.remixData, /VIP CHARACTER PERSONALITIES FOR STORY AND DIALOGUE/);
    assert.match(body.remixData, /unless the current user brief overrides them/);
    assert.match(body.remixData, /Express relevant traits through scene actions, character decisions, and any dialogue/);
    assert.ok(!JSON.stringify(body).includes(savedVisual));
    assert.ok(!JSON.stringify(body).includes('CEREMONIAL_SILVER_PLATE_ARMOUR'));
    assert.ok(!JSON.stringify(body).includes('show one character from my image'));
    assert.match(body.remixData, /DYNAMIC VIP APPEARANCE RULES/);
    assert.match(body.remixData, /The current user scenario is authoritative for role, wardrobe, and equipment\./);
    assert.match(body.remixData, /replace the default clothing\/gear completely with the scenario-appropriate look/);
    assert.match(body.remixData, /gives no conflicting wardrobe context, retain the saved look/);
    assert.equal(characters[0].description, savedDescription, 'saved description overwritten with narrative-only text');
    assert.deepEqual([...fixture.protectedUrls.current], ['https://fixture.invalid/terra.png']);
    assert.deepEqual(fixture.planned[0], [fixture.prompt, ['Terra repairs an engine.'], 'Cinematic']);
});

test('uploaded, plain, missing and unestablished descriptions preserve the existing identity and outfit guidance', async () => {
    const variants = [
        { source: 'upload' },
        { source: 'upload', description: 'A smiling patient woman in silver plate armour.' },
        { source: 'world', description: visual },
        { source: 'world', description: `Visual description:\n${visual}` },
        { source: 'world', description: `Visual description:\n${visual}\n\nPersonality:\nNot yet established.` },
        { source: 'world', description: `Visual description:\n${visual}\n\nPersonality:\n` },
    ];
    let originalBody;
    for (const extra of variants) {
        const fixture = storyFixture([{ name: 'Terra', imageUrl: 'https://fixture.invalid/terra.png', ...extra }]);
        assert.equal(await fixture.run(), true);
        const body = fixture.requests[0].body;
        assert.ok(!body.remixData.includes('VIP CHARACTER PERSONALITIES'));
        assert.ok(!body.remixData.includes('Not yet established.'));
        assert.match(body.remixData, /- Terra: identity from uploaded input image only/);
        assert.match(body.remixData, /DYNAMIC VIP APPEARANCE RULES/);
        if (!originalBody) originalBody = body;
        else assert.deepEqual(body, originalBody, 'non-personality character changed existing story request');
    }
});

test('StartStory without selected characters leaves the world context and request unchanged', async () => {
    for (const characters of [undefined, []]) {
        const fixture = storyFixture(characters, 'A snowy kingdom.', 'Explore the city.');
        assert.equal(await fixture.run(), true);
        assert.deepEqual(fixture.requests[0].body, {
            pp: 'Explore the city.', remixData: 'A snowy kingdom.', interactionExperienceMode: 'spatial',
        });
        assert.deepEqual([...fixture.protectedUrls.current], []);
    }
});

test('selected World environments and objects stay separate from VIP character guidance', async () => {
    const workshop = Object.freeze({ name: 'Workshop', assetKind: 'environment', source: 'world',
        imageUrl: 'https://fixture.invalid/workshop.png', description: 'Tall windows and a timber roof.' });
    const engine = Object.freeze({ name: 'Engine', assetKind: 'object', source: 'world',
        imageUrl: 'https://fixture.invalid/engine.png', description: 'Four-cylinder aluminum engine.' });
    const fixture = storyFixture(Object.freeze([workshop, engine]));
    assert.equal(await fixture.run(), true);
    const { remixData } = fixture.requests[0].body;
    assert.match(remixData, /SELECTED WORLD PLACES AND OBJECTS:/);
    assert.match(remixData, /Workshop \(environment\): Tall windows and a timber roof/);
    assert.match(remixData, /Engine \(object\): Four-cylinder aluminum engine/);
    assert.doesNotMatch(remixData, /VIP CHARACTER|DYNAMIC VIP APPEARANCE/);
    assert.deepEqual([...fixture.protectedUrls.current], [workshop.imageUrl, engine.imageUrl]);
});

test('ordinary direct-upload story request exactly matches the previous identity-only request', async () => {
    // Request snapshot from StartStory at 6215a72dfbcc01da50bb885a6cf43a1eedc84a26.
    // Keep this literal baseline so subsequent commits cannot silently update the expectation.
    const previousGuidance = `VIP CHARACTER IDENTITY REFERENCES:
- Terra: identity from uploaded input image only; do not use saved clothing/gear text as the active look.

DYNAMIC VIP APPEARANCE RULES:
- Preserve each VIP's identity: face, hair, age, body type, and other inherent physical traits.
- Treat clothing, armor, uniforms, weapons, props, and equipment in the saved description as the character's DEFAULT look, not a permanent requirement.
- The current user scenario is authoritative for role, wardrobe, and equipment.
- If the scenario requests or clearly implies a different look, replace the default clothing/gear completely with the scenario-appropriate look; do not merge incompatible old and new outfits.
- If the scenario asks for the character "as is", their original/default look, or gives no conflicting wardrobe context, retain the saved look.
- Always describe the final context-appropriate appearance while identifying the face as coming from the input image.`;
    const fixture = storyFixture([{ name: 'Terra', source: 'upload', imageUrl: 'https://fixture.invalid/terra.png' }]);
    assert.equal(await fixture.run(), true);
    assert.deepEqual(fixture.requests[0], {
        url: '/fixture-api/startInteractions',
        body: {
            pp: fixture.prompt,
            remixData: `Use a busy repair workshop.\n\n${previousGuidance}`,
            interactionExperienceMode: 'spatial',
        },
        config: { withCredentials: true },
    });
});

test('GenerateWorldRemix retries incomplete output and returns all three catalogue groups', async () => {
    const expected = {
        title: 'Haven',
        description: 'A snowy kingdom where the crew faces a new threat.',
        Characters: [{ name: 'Terra', description }],
        Environments: [{ name: 'Workshop', description: 'Timber walls and a concrete floor.' }],
        Objects: [{ name: 'Engine', description: 'Four-cylinder engine on a steel frame.' }],
        'Plan Summary': 'Cinematic winter light.',
    };
    let messages;
    let response;
    let attempts = 0;
    const generate = handler('server/src/GptApi.ts', 'GenerateWorldRemix', {
        generateGPT4oPrompt5B: async initialMessages => {
            messages = initialMessages;
            if (++attempts === 1) return JSON.stringify({ ...expected, Objects: undefined });
            return JSON.stringify(expected);
        },
        console: { log: () => {}, warn: () => {}, error: () => {} },
    });
    await generate({ body: {
        originalPrompt: 'Terra is protective and speaks softly to Cuzon.',
        rawPlan: { characters: [{ name: 'Terra', description: visual }] },
        sceneSteps: ['Terra reassures Cuzon while shielding him.'],
    } }, {
        send: value => { response = value; },
        status: () => assert.fail('unexpected world-generation failure'),
    });
    assert.deepEqual(response, expected);
    assert.equal(response.Characters[0].description, description);
    assert.deepEqual(Object.keys(response.Characters[0]), ['name', 'description']);
    assert.equal(attempts, 2);
    const systemPrompt = messages.find(message => message.role === 'system').content;
    const jsonExample = systemPrompt.match(/\{[\s\S]*\}/)?.[0];
    assert.ok(jsonExample, 'world model was not given its JSON output example');
    const example = JSON.parse(jsonExample);
    assert.match(example.Characters[0].description, /^Visual description:\nshow one character from my image/);
    assert.ok(example.Characters[0].description.includes('\n\nPersonality:\n'));
    assert.deepEqual(Object.keys(example.Characters[0]), ['name', 'description']);
    assert.match(systemPrompt, /do not infer personality solely from appearance or clothing/);
    assert.match(systemPrompt, /Not yet established\./);
    assert.ok(messages.find(message => message.role === 'user').content.includes('Terra reassures Cuzon while shielding him.'));
});
