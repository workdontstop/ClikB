const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
function evaluateArrow(node, source, bindings) {
    bindings = { creationDraft: undefined, setImagesHdCloud() {}, ...require('./promptTestBindings.cjs'), ...bindings };
    const code=ts.transpileModule(`const handler=${node.getText(source)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    return new Function(...Object.keys(bindings),code+'return handler;')(...Object.values(bindings));
}
function creationHandlers() {
    const source=ts.createSourceFile('PromptInput.tsx',fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const handlers={};
    const visit=node=>{
        if(ts.isVariableDeclaration(node)&&['handleEditGenerationPlan','handleActualSubmit','StartStory','StartPlan','handlePromptsFinished'].includes(node.name.getText(source)))handlers[node.name.getText(source)]=ts.isCallExpression(node.initializer)?node.initializer.arguments[0]:node.initializer;
        ts.forEachChild(node,visit);
    };visit(source);return {source,handlers};
}
function submissionFixture(overrides={}) {
    const start=[],flags=[],errors=[],lock={current:false};
    const bindings={actualSubmitRef:{current:null},submitInFlightRef:lock,loggedUser:{id:2},allowSpin:false,isSubmittingKick:true,APP_STATE:'test',dispatch:()=>{},setLogin:()=>{},setIsSubmittingKick:value=>flags.push(value),setshowButton:()=>{},GeneratedImage:[],setGotIm:()=>{},type:3,getPixel:async()=>1000,calcModelPixels:()=>5,modelz:'fixture',StartStory:async(...args)=>{start.push(args);return true;},selectedStyle:'test-style',prompt:'Stale React state',setError:value=>errors.push(value),alert:()=>assert.fail('unexpected alert'),callAudio:()=>assert.fail('wrong media type'),...overrides};
    const {source,handlers}=creationHandlers();
    return {actual:evaluateArrow(handlers.handleActualSubmit,source,bindings),start,flags,errors,lock};
}
test('Edit Go restarts creation with edited text even when the ready screen retains the submitting flag', async () => {
    const {source,handlers}=creationHandlers(), calls=[],dispatches=[];
    const fixture=submissionFixture();
    const handler=evaluateArrow(handlers.handleEditGenerationPlan,source,{planEditText:'  Stop at the cup  ',prompt:'Original spaceship',isPlanEditSubmitting:false,submitInFlightRef:fixture.lock,allowSpin:false,setIsPlanEditSubmitting:value=>calls.push(['editing',value]),setPrompt:value=>calls.push(['prompt',value]),handleCloseOverlay:value=>calls.push(['close',value]),setShowPathChoiceOverlay:value=>calls.push(['choice',value]),setPlanx:value=>calls.push(['plan',value]),setPostId:value=>calls.push(['post',value]),setPlanEditText:value=>calls.push(['instruction',value]),dispatch:value=>dispatches.push(value),setCreationConfirmationOpen:open=>({open}),interactionExperienceMode:'spatial',handleActualSubmit:fixture.actual,resetMagicMirror:()=>assert.fail('deleted input assets'),handleStartSubmit:()=>assert.fail('reopened setup')});
    await handler();
    assert.deepEqual(calls,[['editing',true],['close',true],['choice',false],['plan',null],['post',0],['prompt',"Update: 'Stop at the cup', Original prompt:'Original spaceship'"],['instruction',''],['editing',false]]);
    assert.deepEqual(dispatches,[{open:false}]);
    assert.equal(fixture.start[0][0],"Update: 'Stop at the cup', Original prompt:'Original spaceship'");assert.equal(fixture.start[0][4],'spatial');
    assert.equal(fixture.lock.current,false);assert.equal(fixture.flags.at(-1),false);
});
test('Go owns the entire request, prevents double submission, and releases the lock after failure', async () => {
    let release;const waiting=new Promise(resolve=>release=resolve),start=[];
    const fixture=submissionFixture({StartStory:async(...args)=>{start.push(args);await waiting;return false;}});
    const first=fixture.actual('spatial','Fresh edited prompt');
    await Promise.resolve();assert.equal(fixture.lock.current,true);
    assert.equal(await fixture.actual('spatial','Duplicate edit'),false);assert.equal(start.length,1);
    release();assert.equal(await first,false);assert.equal(fixture.lock.current,false);assert.equal(fixture.flags.at(-1),false);
    assert.equal(await fixture.actual('spatial','Retry edited prompt'),false);assert.equal(start.length,2);
});
test('Failed balance check leaves Go retryable and does not tear down creation', async () => {
    const fixture=submissionFixture({getPixel:async()=>{throw new Error('Balance unavailable');}});
    let accepted=false;assert.equal(await fixture.actual('spatial','Edited prompt',()=>accepted=true),false);
    assert.equal(accepted,false);assert.equal(fixture.start.length,0);assert.equal(fixture.lock.current,false);assert.equal(fixture.flags.at(-1),false);assert.equal(fixture.errors.at(-1),'Balance unavailable');
});
test('Normal submit still guards active scene preparation, and ready callback clears that flag', async () => {
    const fixture=submissionFixture();assert.equal(await fixture.actual('spatial'),false);assert.equal(fixture.start.length,0);
    const {source,handlers}=creationHandlers(),flags=[];
    evaluateArrow(handlers.handlePromptsFinished,source,{setIsSubmittingKick:value=>flags.push(value),markPromptPrepFinishedForCurrentRun:()=>{},setEditGenSnapshot:()=>{},setCreationProgressRunKey:()=>{},cancelAutomaticGuideCall:()=>{},creationProgressCallId:'test',parsedKeyPoints:['ready'],isRevisitingCharacter:false,magicMode:false,setShowPathChoiceOverlay:()=>{},setDoubleCheckResult:()=>{}})();
    assert.deepEqual(flags,[false]);
});
test('StartStory waits for the full plan request and reports either stage failure', async () => {
    const {source,handlers}=creationHandlers();
    const start=[];
    const base={protectedVipCharacterUrlsRef:{current:null},Vipcharacters:[],cancelAutomaticGuideCall:()=>{},sceneDoubleCheckCallId:'test',setDoubleCheckResult:()=>{},finalCreationReviewStartedAtRef:{current:null},resetVideoModeRunGuard:()=>{},finalCreationReviewSentRef:{current:false},setCreationProgressRunKey:()=>{},setIsSubmittingKick:()=>{},setParsedKeyPoints:()=>{},setParsedKeyPoints2:()=>{},setParsedKeyPointsb:()=>{},setPlanInfo:()=>{},setallowSpin:()=>{},setError:()=>{},remixData:'world guide',promptMusicUrl:'',countAuthoredScenes:()=>0,resetCreationLedger:()=>{},CLIK_URL:'/api',type:3,setParsedKeyPointsx:()=>{},setshowButton:()=>{},StartPlan:async()=>false};
    const story=evaluateArrow(handlers.StartStory,source,{...base,axios:{post:async(url,body)=>{start.push({url,body});return {data:{initialSteps:{keyPoints:['one','two']}}};}}});
    assert.equal(await story('Edited scenario',{id:2},'Auto',3,'spatial'),false);assert.equal(start[0].url,'/api/startInteractions');assert.equal(start[0].body.pp,'Edited scenario');assert.equal(start[0].body.interactionExperienceMode,'spatial');
    const failed=evaluateArrow(handlers.StartStory,source,{...base,axios:{post:async()=>{throw new Error('request failed');}}});assert.equal(await failed('Edited scenario',{id:2},'Auto',3,'spatial'),false);
});
function load(file, mocks = {}, cache = new Map()) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.VITE_APPX_STATE', "'prod'"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const pose = t => ({ t, position: [t, .5, 0], rotation: [0, t / 2, 0], scale: [1, 1, 1] });
const plan = { version: 1, duration: 5, background: '#111111', objects: [{ id: 'girl', shape: 'box', color: '#ffffff', keys: [pose(0), pose(.5), pose(1)], parts: [{id:'head',shape:'sphere',color:'#ffffff',keys:[pose(0),pose(1)]}] }], camera: [0, 1].map(t => ({ t, position: [0, 2, 6], target: [t, .5, 0], fov: 45 })) };

function driveFixture() {
    const complete=load('src/spatialTiming.ts').finishMovementTiming(plan,1);
    return load('server/src/spatialWorld.ts').validateWorld({ version:2, model:'luna', plan:complete, controlledObject:'girl', controlMode:'character', walkable:[{min:[-.5,0,-.5],max:[.5,2,.5]}], obstacles:[{min:[-1,0,-1],max:[1,2,1]}], approved:true });
}
test('creation stick moves through approximate AI boxes without spinning on forward; strength is applied once', () => {
    const { creationDriveStep } = load('src/spatialCreationDrive.ts');
    const world = driveFixture(), state = world.initialState, initial = state.objects.girl.transform;
    const before = JSON.stringify(world);
    assert.deepEqual(load('server/src/spatialWorld.ts').moveInWorld(world,initial.position,0,-.1),initial.position,'fixture must reproduce the trapped scene');
    const full = creationDriveStep(world,state,initial,{x:0,y:1,active:true},.05);
    const small = creationDriveStep(world,state,initial,{x:0,y:.2,active:true},.05);
    assert.ok(full.position[2]<initial.position[2]);
    assert.ok(Math.abs((small.position[2]-initial.position[2])/(full.position[2]-initial.position[2])-.2)<1e-9);
    assert.deepEqual(small.rotation,initial.rotation,'small forward input spun the actor');
    assert.equal(JSON.stringify(world),before,'world/parts mutated');
});
test('creation forward/right are camera-relative and preserve the authored facing axis', () => {
    const { creationDriveStep } = load('src/spatialCreationDrive.ts');
    for (const yaw of [0,Math.PI,-Math.PI/2]) for (const camera of [[0,2,6],[6,2,0],[-3,2,-5]]) {
        const world = driveFixture(); world.initialState.camera.position=camera; world.initialState.camera.target=[0,.5,0];
        const state=world.initialState, initial=state.objects.girl.transform; initial.rotation[1]=yaw;
        const forward=creationDriveStep(world,state,initial,{x:0,y:.2,active:true},.05);
        const right=creationDriveStep(world,state,initial,{x:.2,y:0,active:true},.05);
        const displacement=key=>[key.position[0]-initial.position[0],key.position[2]-initial.position[2]];
        const a=displacement(forward), b=displacement(right);
        assert.ok(a[0]*-camera[0]+a[1]*-camera[2]>0,'forward moved toward camera');
        assert.ok(Math.abs(a[0]*b[0]+a[1]*b[1])<1e-9,'right was not perpendicular');
        assert.ok(Math.abs(Math.atan2(Math.sin(forward.rotation[1]-yaw),Math.cos(forward.rotation[1]-yaw)))<1e-9,'forward replaced authored facing');
    }
});
test('neutral stick jitter cannot rotate or travel; a renderer-boundary stop cannot turn in place', () => {
    const { creationDriveStep } = load('src/spatialCreationDrive.ts');
    const world=driveFixture(), state=world.initialState, initial=state.objects.girl.transform;
    for (const sample of [{x:.02,y:.02,active:true},{x:NaN,y:1,active:true},{x:1,y:0,active:false}]) assert.equal(creationDriveStep(world,state,initial,sample,.05),initial);
    const edge={...initial,position:[0,.5,-100]};
    assert.equal(creationDriveStep(world,state,edge,{x:0,y:1,active:true},.05),edge);
});

test('short movement stretches timing only, preserving path, turns, parts and endpoint', () => {
    const { finishMovementTiming } = load('src/spatialTiming.ts');
    const finished = finishMovementTiming(plan, 1);
    assert.equal(finished.duration, 5);
    assert.deepEqual(finished.objects[0].keys.map(key => key.t), [0, 2.5, 5]);
    assert.deepEqual(finished.objects[0].keys.map(({t,...key})=>key), plan.objects[0].keys.map(({t,...key})=>key));
    assert.equal(finished.camera.at(-1).t, 5);
    assert.equal(finished.objects[0].parts[0].keys.at(-1).t, 5);
    assert.equal(plan.objects[0].keys.at(-1).t, 1, 'input was mutated');
    assert.equal(load('server/src/motionGuidePlan.ts').validateMotionPlan(finished).duration, 5);
});
test('captured heading crosses both PI boundaries continuously, never a full-turn replay jump', () => {
    const { creationDriveStep } = load('src/spatialCreationDrive.ts');
    for (const sign of [-1,1]) {
        const world=driveFixture(), state=world.initialState, initial=state.objects.girl.transform;
        initial.rotation[1]=sign*(Math.PI-.04);
        let key=structuredClone(initial), crossed=false;
        for (let i=0;i<30;i++) {
            const next=creationDriveStep(world,state,key,{x:-sign,y:0,active:true},.05);
            assert.ok(Math.abs(next.rotation[1]-key.rotation[1])<=.15+1e-9,'captured angle wrapped by a full revolution');
            if(Math.abs(next.rotation[1])>Math.PI) crossed=true;
            key=next;
        }
        assert.equal(crossed,true,'fixture did not cross the heading boundary');
    }
});

test('old raw recording preview repairs wrapped yaw without mutating saved data, parts or intentional AI tracks', () => {
    const { recordedMovementPreview } = load('src/spatialTiming.ts');
    for (const sign of [-1,1]) {
        const recorded=structuredClone(plan);
        recorded.objects[0].keys=[3.05,3.13,-3.12,-3].map((yaw,i)=>({...pose(i),rotation:[.2,sign*yaw,.3]}));
        recorded.objects.push({id:'prop',shape:'box',color:'#fff',keys:[{...pose(0),rotation:[0,0,0]},{...pose(5),rotation:[0,Math.PI*2,0]}]});
        const before=JSON.stringify(recorded), preview=recordedMovementPreview(recorded,'girl');
        assert.equal(JSON.stringify(recorded),before,'saved recording was mutated');
        const keys=preview.objects[0].keys;
        for(let i=1;i<keys.length;i++) assert.ok(Math.abs(keys[i].rotation[1]-keys[i-1].rotation[1])<.13);
        assert.deepEqual(keys.map(({rotation,...key})=>key),recorded.objects[0].keys.map(({rotation,...key})=>key));
        assert.ok(keys.every(key=>key.rotation[0]===.2&&key.rotation[2]===.3));
        assert.deepEqual(preview.objects[0].parts,recorded.objects[0].parts);
        assert.deepEqual(preview.objects[1],recorded.objects[1]);
        assert.equal(preview.duration,recorded.duration);
    }
    const studio=fs.readFileSync(path.join(root,'src/components/SpatialStudio.tsx'),'utf8');
    assert.match(studio,/setPreview\(recordedMovementPreview\(draft, world.controlledObject\)\)/);
    assert.match(studio,/setPreview\(pending.forward!.plan\)/,'AI animation must retain authored turns');
});

test('inline notices have bounded reading time and theme-switch concealment is UI-only', () => {
    const { spatialNoticeDuration } = load('src/spatialNoticeTiming.ts');
    assert.equal(spatialNoticeDuration('Short note'),4500);
    assert.equal(spatialNoticeDuration('The AI changed the proxy geometry. Preview it before saving; you can revise the instructions and try again.'),7500);
    assert.equal(spatialNoticeDuration('word '.repeat(100)),14000);
    const host=fs.readFileSync(path.join(root,'src/EditStory.tsx'),'utf8');
    assert.match(host,/:has\(\[data-spatial-controls-hidden="true"\]\)\s+\[data-spatial-media-overlay\]/);
    assert.match(host,/oppositeAppColor=\{spatialConnectorColor\}/);
    assert.match(fs.readFileSync(path.join(root,'src/MediaPromptVideo.tsx'),'utf8'),/data-spatial-media-overlay/);
});

test('five-second cutoff does not speed up an overlong recording and bounds sampling', () => {
    const { finishMovementTiming } = load('src/spatialTiming.ts');
    const input = structuredClone(plan); input.objects[0].keys = Array.from({length:61},(_,i)=>pose(i/10));
    const finished = finishMovementTiming(input, 6);
    assert.deepEqual(finished.objects[0].keys.at(-1).position, pose(5).position);
    assert.equal(finished.objects[0].keys.at(-1).t, 5);
    assert.ok(finished.objects[0].keys.length <= 48);
});
test('duration check accepts a rounded final frame, not 4.59s or invalid metadata', () => {
    const { motionExportComplete } = load('src/motionExportTiming.ts');
    assert.equal(motionExportComplete(4.99, 5), true);
    for (const measured of [4.59, 0, NaN, Infinity]) assert.equal(motionExportComplete(measured, 5), false);
    assert.equal(motionExportComplete(9.99, 10), true);
    assert.equal(motionExportComplete(5, 10), false);
});
test('two automatic workers skip a manual completion without duplicate rendering; VIP needs its scene render', async () => {
    const { ReferenceRenderClaims, runReferenceWorkers } = load('src/referenceRenderQueue.ts');
    const claims = new ReferenceRenderClaims();
    const manual = claims.begin('dog', 'manual');
    assert.equal(claims.begin('dog','automatic'), undefined);
    assert.equal(claims.done('vip'), false, 'uploaded VIP identity is not a storyboard render');
    let active = 0, peak = 0; const rendered = [];
    const work = runReferenceWorkers(['dog','girl','vip','sword','tree'], async id => {
        if (claims.working(id)) await claims.wait(id);
        if (claims.done(id)) return;
        const token = claims.begin(id,'automatic'); assert.ok(token);
        active++; peak=Math.max(peak,active); rendered.push(id);
        await new Promise(resolve=>setTimeout(resolve,5));
        active--; claims.finish(id,token,true);
    });
    claims.finish('dog',manual,true);
    await work;
    assert.equal(peak,2); assert.equal(rendered.length,4); assert.ok(!rendered.includes('dog')); assert.equal(claims.done('vip'),true);
    const failed=claims.begin('failed','manual'); claims.finish('failed',failed,false); assert.equal(claims.done('failed'),false); assert.ok(claims.begin('failed','automatic'));
});
test('late casting results preserve manual image, prompt, ID and active state', () => {
    const { preserveOwnedReferences } = load('src/referenceRenderQueue.ts');
    const current=[{name:'Zuri',clientReferenceId:'z',imageUrl:'manual.png',prompt:'my edit',isGenerating:true}];
    const merged=preserveOwnedReferences([{name:'Zuri',imageUrl:'',prompt:''}],current,id=>id==='z',(a,b)=>a===b);
    assert.deepEqual(merged,current);
});

test('manual generation can claim a queued character while both automatic workers are busy', async () => {
    const { ReferenceRenderClaims, runReferenceWorkers } = load('src/referenceRenderQueue.ts');
    const claims=new ReferenceRenderClaims(), renders=[];
    let release; const paused=new Promise(resolve=>release=resolve);
    const auto=runReferenceWorkers(['A','B','C','D'],async id=>{
        if(claims.working(id)) await claims.wait(id);
        if(claims.done(id)) return;
        const token=claims.begin(id,'automatic'); assert.ok(token); renders.push(id);
        if(id==='A'||id==='B') await paused;
        claims.finish(id,token,true);
    });
    assert.deepEqual(renders,['A','B']);
    const manual=claims.begin('C','manual'); assert.ok(manual,'queue disabled manual generation');
    claims.finish('C',manual,true); release(); await auto;
    assert.deepEqual(renders,['A','B','D'],'automatic queue duplicated the manual character');
    const source=fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8');
    assert.match(source,/await proceedToImageGeneration\(/,'casting ended before prompt preparation completed');
    assert.match(source,/referenceGenerationRunRef\.current === generationRun/,'stale queue could release newer work');
});
test('concierge expansion survives unrelated settings updates and snapshots/replies', () => {
    const settings = load('src/settingsSlice.ts');
    let state = settings.default(undefined,{type:'init'});
    state = settings.default(state,settings.setConciergeResponseExpanded(true));
    state = settings.default(state,{type:'brainstorm/setBrainstormChatHistory',payload:[{content:'new reply'}]});
    assert.equal(state.conciergeResponseExpanded,true);
    const guide=fs.readFileSync(path.join(root,'src/components/GlobalBrainstormGuide.tsx'),'utf8');
    assert.ok(guide.includes('state.settings.conciergeResponseExpanded'));
    const input=fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8');
    assert.ok(input.includes('finalCreationReviewSentRef.current = true'));
    assert.ok(input.includes('await runReferenceImageGeneration(castingPrompts, castingId)'));
    const manual = input.slice(input.indexOf('const handleRegenerateReference ='), input.indexOf('const handleRegenerateReference =') + 14000);
    assert.ok(!manual.includes('billingReference: refItem.name'), 'manual request uses an undefined target');
    assert.match(manual,/Character image retained; balance refresh failed/,'balance refresh can retry an already-created paid manual image');
    assert.match(input,/Automatic character image retained; balance refresh failed/,'balance refresh can lose a completed automatic render claim');
});
test('accent fill foreground and disabled/hover states follow the product theme rule', () => {
    const { appAccentButtonSx } = load('src/appAccentStyles.ts');
    for (const dark of [true,false]) {
        const style=appAccentButtonSx('#4059cc',dark), colour=dark?'#000':'#fff';
        assert.equal(style.color,colour); assert.equal(style['&:hover'].color,colour); assert.equal(style['&.Mui-disabled'].color,colour);
        assert.equal(style['&.Mui-disabled'].boxShadow,'none');
    }
});

test('actual model picker uses black on dark accent fills and white on light; neutral/pro styling and selection remain intact', () => {
    const React = require('react');
    const registry = load('src/imageModels.ts');
    // Inspect the real component's rendered button props without mounting the app,
    // invoking concierge effects, or loading remote model example images.
    for (const darkMode of [true, false]) for (const matchMobile of [true, false]) {
        const appColor = darkMode ? '#6ed8ee' : '#4059cc';
        const updates = [];
        const ModelPicker = load('src/ModelSelectionModal.tsx', {
            react: { ...React, useState: initial => [initial, () => {}], useEffect: () => {}, useRef: value => ({current:value}), useMemo: create => create() },
            '@mui/material': Object.fromEntries(['Modal', 'Box', 'IconButton', 'Typography', 'Button', 'Stack'].map(name => [name, name])),
            '@mui/material/styles': { ...require('@mui/material/styles'), useTheme: () => ({ zIndex: { modal: 1300 } }) },
            '@mui/icons-material/Close': () => null,
            'react-redux': { useSelector: selector => selector({ settings: { appColorDark: appColor, appColorLight: appColor, languageModel: 'luna' }, imageModelExamples: { sets: [] } }), useDispatch: () => () => {} },
            './ImageModelExampleDialogs': { ImageModelExampleSetManager: () => null },
            './ImageModelExampleViewer': () => null,
            './settingsSlice': { setLanguageModel: () => {} },
            './languageModels': { LANGUAGE_MODELS: [] },
            './ModelPixels': () => null,
            './ConversationModelPicker': () => null,
            './LanguageModelCostInfo': { __esModule: true, default: () => null, LanguageModelCostButton: () => null },
            './openAiSelection': { notifyOpenAiSelected: () => {} },
            './useCreationControls': { useCreationControls: () => {} },
        }).default;
        const tree = ModelPicker({ open: true, setOpen: () => {}, handleSelect: () => {}, models: ['Imagen', 'Gpt Image', 'minimax'].map(name => ({ name, img: 'fixture.png' })), currentImage: '', darkModeReducer: darkMode, matchMobile, darkMode, gradient: '', labelsByIndex: {}, colorsByLabel: {}, activeModelName: registry.GPT_IMAGE_25_FLARE, updateModelWithoutClosing: (...args) => updates.push(args) });
        const buttons = [];
        function visit(node) {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) return node.forEach(visit);
            if (node.type === 'Button') buttons.push(node.props);
            visit(node.props?.children);
        }
        visit(tree);
        const lite = buttons.filter(button => button['data-creation-control']?.includes('.lite_'));
        assert.equal(lite.length, 3, 'LITE/FAST family buttons disappeared');
        for (const button of lite) {
            assert.equal(button.variant, 'contained');
            assert.equal(button.sx.backgroundColor, appColor);
            assert.equal(button.sx.color, darkMode ? '#000' : '#fff');
            assert.equal(button.sx['&:hover'].backgroundColor, appColor);
        }
        const pro = buttons.find(button => button['data-creation-control'].endsWith('.pro_Gpt%20Image'));
        assert.equal(pro.variant, 'outlined');
        assert.equal(pro.sx.backgroundColor, 'transparent');
        assert.equal(pro.sx.color, darkMode ? '#e53935' : 'rgba(0,0,0,0.7)', 'non-accent Pro marker changed');
        const fast = lite.find(button => button.children === 'Fast');
        assert.ok(fast);
        let stopped = false;
        fast.onClick({ stopPropagation: () => { stopped = true; } });
        assert.equal(stopped, true);
        assert.equal(updates[0][0], registry.GPT_IMAGE_25_FLARE, 'styling changed image-model selection');
    }
});

test('GPT image baseline quotes and server deductions agree; reference inputs do not add a surcharge', () => {
    const registry = load('src/imageModels.ts');
    const { expectedMediaCharge } = load('src/mediaPricing.ts');
    const { mediaChargeFor } = load('server/src/mediaPricing.ts', {
        './sourceMediaDuration': { SERVER_MEASURED_DURATION_FIELD: '__measured', SOURCE_MEDIA_MAX_SECONDS: 10 },
    });
    for (const [model, quality, pixels] of [[registry.GPT_IMAGE_25_FLARE, 'medium', 6], [registry.GPT_IMAGE_25_SUNBURST, 'high', 24]]) {
        const route = '/' + registry.getGptImageRoute(model);
        assert.equal(registry.IMAGE_MODEL_REGISTRY[model].quality, quality);
        assert.equal(registry.getImageModelPixelCost(model), pixels);
        for (const ty of [1, 2, 3]) for (const count of [0, 1, 16]) {
            const body = { ty, sampleImages: Array.from({length:count}, (_,i) => `https://assets.test/ref-${i}.png`), billingAction: 'character-image', billingReference: 'Zuri' };
            const client = expectedMediaCharge(route + '?test=1', body);
            const server = mediaChargeFor(route + '?test=1', body);
            assert.equal(client.pixels, pixels);
            assert.equal(server.pixels, client.pixels);
            assert.equal(client.label, 'Character Image · Zuri');
            assert.equal(server.kind, 'image');
        }
    }
    assert.equal(registry.IMAGE_MODEL_REGISTRY[registry.GPT_IMAGE_2_LEGACY].quality, 'medium');
    assert.equal(registry.getImageModelPixelCost(registry.GPT_IMAGE_2_LEGACY), 17);
    assert.equal(expectedMediaCharge('/GptImage', {}).pixels, 17);
    assert.equal(mediaChargeFor('/GptImage', {}).pixels, 17);
    assert.equal(expectedMediaCharge('/DenoiseImage', {}).pixels, 27);
    assert.equal(mediaChargeFor('/UpscaleImage', {}).pixels, 2);
});

test('flat GPT baseline prices cover output estimates for the existing three custom image sizes', () => {
    // OpenAI's published GPT Image 2.5 calculator: medium/high long-edge grids 24/48,
    // short-edge grid rounded ties-to-even, then ceil(grid area * (2M + pixels) / 4M).
    const registry = load('src/imageModels.ts');
    const models = [
        [24, registry.GPT_IMAGE_25_FLARE_PIXEL_COST, [[1440, 1440, 587, 6], [1920, 1088, 344, 4], [1088, 1920, 344, 4]]],
        [48, registry.GPT_IMAGE_25_SUNBURST_PIXEL_COST, [[1440, 1440, 2347, 24], [1920, 1088, 1325, 14], [1088, 1920, 1325, 14]]],
    ];
    for (const [grid, flat, estimates] of models) for (const [width, height, expectedTokens, expectedPixels] of estimates) {
        const short = grid * Math.min(width, height) / Math.max(width, height);
        const floor = Math.floor(short);
        const rounded = short - floor === .5 ? floor + floor % 2 : Math.round(short);
        const tokens = Math.ceil(grid * rounded * (2000000 + width * height) / 4000000);
        const roundedDollars = Math.ceil((tokens * 30 / 1000000 - Number.EPSILON) * 10000) / 10000;
        const pixels = Math.ceil(333 * roundedDollars);
        assert.equal(tokens, expectedTokens);
        assert.equal(pixels, expectedPixels);
        assert.ok(pixels <= flat);
    }
    const route = fs.readFileSync(path.join(root, 'server/src/fluxSchnellRoute.ts'), 'utf8');
    const size = route.slice(route.indexOf('const imageSize ='), route.indexOf('// --- CONVERSATIONAL ENGINE:', route.indexOf('const imageSize =')));
    for (const [width, height] of models[0][2]) assert.ok(size.includes(`{ width: ${width}, height: ${height} }`));
});

test('actual GPT route sends the priced baseline quality for both text and reference edits', async () => {
    // Execute the actual handler with a fake provider; do not initialize other API clients
    // from this large route module or make paid/network calls.
    const filename = path.join(root, 'server/src/fluxSchnellRoute.ts');
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const handler = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'GptImageRoute');
    assert.ok(handler);
    const calls = [];
    const fixtures = {
        cleanPromptLiterals: require('./promptTestBindings.cjs').cleanPromptLiterals,
        fal: { subscribe: async (endpoint, request) => {
            calls.push({ endpoint, ...request });
            return { data: { images: [{ url: 'data:image/png;base64,fixture' }] } };
        } },
        injectConversational: prompt => prompt,
        sendImageLinkIfRequested: () => false,
        console: { log() {}, error() {} },
    };
    const mod = new Module(filename, module);
    mod.require = name => { assert.equal(name, 'route-fixtures'); return fixtures; };
    mod._compile('const { cleanPromptLiterals, fal, injectConversational, sendImageLinkIfRequested, console } = require("route-fixtures");\n' +
        ts.transpileModule(handler.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    const registry = load('src/imageModels.ts');
    for (const [model, quality, endpoint] of [
        [registry.GPT_IMAGE_25_FLARE, 'medium', 'openai/gpt-image-2.6/flare'],
        [registry.GPT_IMAGE_25_SUNBURST, 'high', 'openai/gpt-image-2.6/sunburst'],
        [registry.GPT_IMAGE_2_LEGACY, 'medium', 'openai/gpt-image-2'],
    ]) for (const ty of [1, 2, 3]) for (const count of [0, 1, 16]) {
        const images = Array.from({length:count}, (_,i) => `https://assets.test/ref-${i}.png`);
        let status, response;
        await mod.exports.GptImageRoute({ route: { path: '/' + registry.getGptImageRoute(model) }, body: { inputs: 'Fixture prompt', ty, model, quality: 'max', sampleImages: images } }, {
            status(value) { status = value; return this; }, json(value) { response = value; return this; },
        });
        assert.equal(status, 200, JSON.stringify(response));
        const call = calls.at(-1);
        assert.equal(call.endpoint, endpoint + (count ? '/edit' : model === registry.GPT_IMAGE_2_LEGACY ? '' : '/text-to-image'));
        assert.equal(call.input.quality, quality);
        assert.equal(call.input.num_images, 1);
        assert.deepEqual(call.input.image_size, ty === 2 ? {width:1440,height:1440} : ty === 3 ? {width:1920,height:1088} : {width:1088,height:1920});
        assert.deepEqual(call.input.image_urls, count ? images : undefined);
        assert.equal(response.quality, quality);
        assert.equal(response.modelName, registry.IMAGE_MODEL_REGISTRY[model].displayName);
    }
    assert.equal(calls.length, 27);
});
