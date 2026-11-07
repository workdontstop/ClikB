import { spatialArrowGeometry } from "../src/spatialArrowGeometry";
import { buildSpatialExperience, parseSpatialExperience } from "../src/spatialExperience";
import { validateSpatialPlan } from "../server/src/spatialPlanValidation";
import test from "node:test";
import assert from "node:assert/strict";

import {
    beginSpatialActionConnection,
    setSpatialActionLink,
    clearSpatialActionNavigation,
    setSpatialActionBacktrack,
    resolveSpatialSceneLink,
    buildIntelligentSpatialMovementPrompt,
    cutSpatialNodeThread,
    findSpatialNodeThread,
    findSpatialParentNodeId,
    findSpatialFailedReturn,
    spatialJoystickInput,
    spatialFrameClick,
    findSpatialTraversalForMovement,
    findSpatialTraversalToNode,
    reverseSpatialMovementDraft,
    resolveSpatialMotionContext,
    syncSpatialManifest,
    upsertSpatialMotionContext,
    type SpatialConnection,
    type SpatialMotionContext,
    type SpatialNode,
    type SpatialSceneState,
} from "../src/spatialStageModel";
import { buildSpatialVideoCachePlan } from "../src/spatialVideoCache";
import { buildSpatialExperienceStages } from "../src/spatialExperience";
import { spatialAction, spatialBackDestination, spatialDirections, spatialIsTerminalNode, spatialLinkReturn, spatialLinkReturnForDrive, spatialTraversalForDrive, spatialUnlockLinkReturn, spatialActionReplay, spatialActionForwardDestination } from "../src/spatialPlayerModel";
import { attachSpatialPlayback, type SpatialPlaybackClock } from "../src/spatialPlayback";
import { spatialRingDirection } from "../src/spatialRingInput";
import type { SpatialTraversal } from "../src/spatialStageModel";

const node = (id: string): SpatialNode => ({
    id,
    label: id,
    frameUrl: `${id}.webp`,
    createdAt: 1,
});

const connection = (id: string, sourceNodeId: string, targetNodeId: string): SpatialConnection => ({
    id,
    sourceNodeId,
    targetNodeId,
    movement: {
        id: `${id}-movement`,
        sourceNodeId,
        createdAt: 1,
        durationMs: 100,
        samples: [{ x: 1, y: 0, radius: 1, angle: 0, elapsedMs: 100 }],
    },
    forward: { videoUrl: `${id}.mp4`, durationMs: 1000, provider: "api" },
    backward: null,
    status: "ready",
});

const makeScene = (): SpatialSceneState => ({
    sceneId: "scene-2",
    activeNodeId: "branch-b",
    nodes: [node("root"), node("branch-a"), node("branch-b"), node("branch-c"), node("other-branch")],
    connections: [
        connection("root-a", "root", "branch-a"),
        connection("a-b", "branch-a", "branch-b"),
        connection("a-c", "branch-a", "branch-c"),
        connection("root-other", "root", "other-branch"),
    ],
    draftMovement: null,
});

const motionContext = (anchorNodeId: string, source: SpatialMotionContext["source"] = "scene-root"): SpatialMotionContext => ({
    id: `motion-${anchorNodeId}`,
    anchorNodeId,
    source,
    controlMode: anchorNodeId === "branch-a" ? "mounted" : "character",
    controlledSubject: anchorNodeId === "branch-a" ? "Mary riding the horse" : "Mary on foot",
    primaryMotion: "Move Mary in the requested direction while preserving her physical state.",
    ambientMotion: "Keep the horse moving independently and let grass and clothing react to motion.",
    userPriorityHint: "",
    sourceContextHash: "hash",
    createdAt: 1,
    updatedAt: anchorNodeId === "branch-a" ? 2 : 1,
});

test("finds a forward thread from connection truth rather than node order", () => {
    const thread = findSpatialNodeThread(makeScene(), "branch-a");
    assert.deepEqual([...thread].sort(), ["branch-a", "branch-b", "branch-c"]);
});

test("cuts the selected node and downstream thread while preserving unrelated branches", () => {
    const result = cutSpatialNodeThread(makeScene(), "branch-a");
    assert.ok(result);
    assert.deepEqual(result.scene.nodes.map(({ id }) => id), ["root", "other-branch"]);
    assert.deepEqual(result.scene.connections.map(({ id }) => id), ["root-other"]);
    assert.equal(result.scene.activeNodeId, "root");
});

test("cutting a leaf returns authoring to its incoming source", () => {
    const result = cutSpatialNodeThread(makeScene(), "branch-b");
    assert.ok(result);
    assert.equal(result.scene.activeNodeId, "branch-a");
    assert.equal(result.scene.nodes.some(({ id }) => id === "branch-b"), false);
    assert.equal(result.scene.nodes.some(({ id }) => id === "branch-c"), true);
});

test("explicit navigation moves to the immediate parent across movement and action edges", () => {
    const scene = makeScene();
    scene.nodes.push({ ...node("action-1"), kind: "action" });
    scene.connections.push({
        ...connection("b-action", "branch-b", "action-1"),
        kind: "action",
    });
    scene.activeNodeId = "action-1";

    assert.equal(findSpatialParentNodeId(scene), "branch-b");
    assert.equal(findSpatialParentNodeId(scene, "branch-b"), "branch-a");
    assert.equal(findSpatialParentNodeId(scene, "root"), null);
});

test("resetting the root preserves it and removes every forward node", () => {
    const scene = makeScene();
    scene.nodes.push(node("restored-orphan"));
    const result = cutSpatialNodeThread(scene, "root");
    assert.ok(result);
    assert.deepEqual(result.scene.nodes.map(({ id }) => id), ["root"]);
    assert.deepEqual(result.scene.connections, []);
    assert.equal(result.scene.activeNodeId, "root");
});

test("upgrades a Nano spatial root to the canonical HD frame before movement generation", () => {
    const scene: SpatialSceneState = {
        sceneId: "scene-hd",
        activeNodeId: "scene-hd:node-0",
        nodes: [{ ...node("scene-hd:node-0"), frameUrl: "nano.webp" }],
        connections: [],
        draftMovement: {
            id: "draft",
            sourceNodeId: "scene-hd:node-0",
            createdAt: 1,
            durationMs: 100,
            samples: [{ x: 1, y: 0, radius: 1, angle: 0, elapsedMs: 100 }],
            guidance: {
                mode: "automatic",
                instruction: "Old Nano-frame guidance that must not survive the frame replacement.",
                durationSeconds: 5,
                cacheKey: "nano-key",
                sourceFrameUrl: "nano.webp",
                generatedAt: 1,
            },
        },
    };
    const result = syncSpatialManifest(
        { version: 1, scenes: [scene] },
        [{ sceneId: "scene-hd", firstFrameUrl: "hd.webp" }],
    );

    assert.equal(result.scenes[0].nodes[0].frameUrl, "hd.webp");
    assert.equal(result.scenes[0].draftMovement?.guidance, undefined);
});

test("does not replace a root frame after spatial videos depend on it", () => {
    const scene = makeScene();
    scene.activeNodeId = "root";
    scene.nodes[0] = { ...scene.nodes[0], frameUrl: "nano.webp" };
    const result = syncSpatialManifest(
        { version: 1, scenes: [scene] },
        [{ sceneId: scene.sceneId, firstFrameUrl: "hd.webp" }],
    );

    assert.equal(result.scenes[0].nodes[0].frameUrl, "nano.webp");
    assert.equal(result.scenes[0].pendingRootFrameUrl, "hd.webp");
});

test("removing the final movement adopts a pending Storybook base image", () => {
    const scene: SpatialSceneState = {
        sceneId: "scene-replacement",
        activeNodeId: "next",
        nodes: [node("root"), node("next")],
        connections: [connection("root-next", "root", "next")],
        draftMovement: null,
        pendingRootFrameUrl: "new-hd.webp",
    };

    const result = cutSpatialNodeThread(scene, "next");

    assert.ok(result);
    assert.equal(result.scene.connections.length, 0);
    assert.equal(result.scene.nodes[0].frameUrl, "new-hd.webp");
    assert.equal(result.scene.pendingRootFrameUrl, undefined);
});

test("keeps a pending base while another old-root branch still survives", () => {
    const scene = makeScene();
    scene.pendingRootFrameUrl = "new-hd.webp";

    const result = cutSpatialNodeThread(scene, "branch-b");

    assert.ok(result);
    assert.equal(result.scene.nodes[0].frameUrl, "root.webp");
    assert.equal(result.scene.pendingRootFrameUrl, "new-hd.webp");
    assert.ok(result.scene.connections.length > 0);
});

test("creates a fresh mirrored stick path for the physical return map", () => {
    const original = connection("return-map", "root", "next").movement;
    original.samples = [
        { x: 0.75, y: -0.4, radius: 0.85, angle: -0.49, elapsedMs: 120 },
        { x: -0.2, y: 0.9, radius: 0.92, angle: 1.79, elapsedMs: 240 },
    ];

    const reversed = reverseSpatialMovementDraft(original);

    assert.notEqual(reversed, original);
    assert.notEqual(reversed.samples, original.samples);
    assert.deepEqual(reversed.samples.map(({ x, y }) => ({ x, y })), [
        { x: -0.75, y: 0.4 },
        { x: 0.2, y: -0.9 },
    ]);
    assert.equal(original.samples[0].x, 0.75);
    assert.equal(reversed.samples[0].angle, Math.atan2(0.4, -0.75));
});

test("builds five forward and five backward slots around the active node", () => {
    const nodes = Array.from({ length: 13 }, (_, index) => node(`n${index}`));
    const connections = Array.from({ length: 12 }, (_, index) => connection(`c${index}`, `n${index}`, `n${index + 1}`));
    const scene: SpatialSceneState = {
        sceneId: "scene-cache",
        activeNodeId: "n6",
        nodes,
        connections,
        draftMovement: null,
    };
    const plan = buildSpatialVideoCachePlan(scene, 7);

    assert.equal(plan.sceneIndex, 7);
    assert.deepEqual(plan.forwardConnectionIds, ["c6", "c7", "c8", "c9", "c10"]);
    assert.deepEqual(plan.backwardConnectionIds, ["c5", "c4", "c3", "c2", "c1"]);
});

test("forward cache follows the selected branch without loading its sibling", () => {
    const scene = makeScene();
    scene.activeNodeId = "root";
    const plan = buildSpatialVideoCachePlan(scene, 2, { root: "root-a", "branch-a": "a-c" });

    assert.deepEqual(plan.forwardConnectionIds, ["root-a", "a-c"]);
    assert.equal(plan.forwardConnectionIds.includes("root-other"), false);
    assert.equal(plan.forwardConnectionIds.includes("a-b"), false);
});

test("a failed authentic return does not disable the successful forward movement", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-a";
    const forwardOnly = scene.connections.find((item) => item.id === "a-b")!;
    forwardOnly.status = "failed";
    forwardOnly.error = "Return provider timed out";
    forwardOnly.backward = null;

    const traversal = findSpatialTraversalToNode(scene, "branch-b");
    assert.ok(traversal);
    assert.equal(traversal.video.videoUrl, "a-b.mp4");

    const cachePlan = buildSpatialVideoCachePlan(scene, 2, { "branch-a": "a-b" });
    assert.equal(cachePlan.forwardConnectionIds.includes("a-b"), true);
});

test("resolves the nearest motion state on the actual node path", () => {
    const scene = makeScene();
    const contexts = [motionContext("root"), motionContext("branch-a", "action-transition")];

    assert.equal(resolveSpatialMotionContext(scene, "branch-b", contexts)?.controlledSubject, "Mary riding the horse");
    assert.equal(resolveSpatialMotionContext(scene, "other-branch", contexts)?.controlledSubject, "Mary on foot");
});

test("creates an action edge with a triangle target and no return video", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-b";
    const begun = beginSpatialActionConnection(scene, "Mary mounts the white horse.", 10);

    assert.ok(begun);
    assert.equal(begun.connection.kind, "action");
    assert.equal(begun.connection.actionPrompt, "Mary mounts the white horse.");
    assert.equal(begun.connection.backward, null);
    assert.equal(begun.connection.movement.samples[0].radius, 0);
});

test("joystick traversal ignores action connections", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-b";
    const begun = beginSpatialActionConnection(scene, "Mary mounts the white horse.", 10);
    assert.ok(begun);
    begun.connection.forward = { videoUrl: "action.mp4", durationMs: 5000, provider: "api" };
    begun.scene.connections = begun.scene.connections.map((item) => item.id === begun.connection.id ? begun.connection : item);
    const movement = {
        id: "up",
        sourceNodeId: "branch-b",
        createdAt: 11,
        durationMs: 100,
        samples: [{ x: 0, y: 1, radius: 1, angle: Math.PI / 2, elapsedMs: 100 }],
    };

    assert.equal(findSpatialTraversalForMovement(begun.scene, movement), null);
});

test("an action result is a fresh node with no inherited movement exits", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-b";
    const begun = beginSpatialActionConnection(scene, "Mary mounts the white horse.", 10);
    assert.ok(begun);
    begun.connection.forward = { videoUrl: "action.mp4", durationMs: 5000, provider: "api" };
    begun.scene.connections = begun.scene.connections.map((item) => item.id === begun.connection.id ? begun.connection : item);
    begun.scene.nodes.push({ ...node(begun.connection.targetNodeId), kind: "action" });
    begun.scene.activeNodeId = begun.connection.targetNodeId;

    const traversal = findSpatialTraversalForMovement(begun.scene, {
        id: "back-from-action",
        sourceNodeId: begun.scene.activeNodeId,
        createdAt: 11,
        durationMs: 100,
        samples: [{ x: -1, y: 0, radius: 1, angle: Math.PI, elapsedMs: 100 }],
    });

    assert.equal(traversal, null);
    assert.ok(beginSpatialActionConnection(begun.scene, "Mary waves from the saddle.", 12));
});

test("an action node does not inherit stale pre-action movement state", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-b";
    const begun = beginSpatialActionConnection(scene, "Mary mounts the white horse.", 10);
    assert.ok(begun);
    begun.scene.nodes.push({ ...node(begun.connection.targetNodeId), kind: "action" });

    assert.equal(resolveSpatialMotionContext(begun.scene, begun.connection.targetNodeId, [motionContext("branch-a", "action-transition")]), null);
    const actionState = { ...motionContext(begun.connection.targetNodeId, "action-transition"), controlledSubject: "Mary riding the horse" };
    assert.equal(resolveSpatialMotionContext(begun.scene, begun.connection.targetNodeId, [motionContext("branch-a"), actionState])?.controlledSubject, "Mary riding the horse");
});

test("upserts one anchored entry inside a scene-indexed context slot", () => {
    const initial = [motionContext("root")];
    const updated = upsertSpatialMotionContext(initial, { ...initial[0], userPriorityHint: "Goalkeeper jumps." });

    assert.equal(updated.length, 1);
    assert.equal(updated[0].userPriorityHint, "Goalkeeper jumps.");
    assert.equal(initial[0].userPriorityHint, "");
});

test("intelligent movement prompt isolates the controlled subject and user priority", () => {
    const context = { ...motionContext("root"), userPriorityHint: "The goalkeeper jumps with both arms raised." };
    const prompt = buildIntelligentSpatialMovementPrompt(context, connection("test", "root", "branch-a").movement);

    assert.match(prompt, /Controlled subject: Mary on foot/);
    assert.match(prompt, /USER PRIORITY MOTION/);
    assert.doesNotMatch(prompt, /Primary motion:/);
    assert.doesNotMatch(prompt, /Ambient motion:/);
    assert.match(prompt, /RECORDED STICK INPUT/);
});


test("return retry finds the same edge at either endpoint and ignores other branches", () => {
    const scene = makeScene();
    const failed = scene.connections.find((entry) => entry.id === "a-b")!;
    failed.status = "failed";
    failed.backward = null;
    failed.forward = { videoUrl: "forward.mp4", durationMs: 5000, provider: "api" };
    for (const activeNodeId of [failed.sourceNodeId, failed.targetNodeId]) {
        scene.activeNodeId = activeNodeId;
        assert.equal(findSpatialFailedReturn(scene)?.id, failed.id);
    }
    scene.activeNodeId = "other-branch";
    assert.equal(findSpatialFailedReturn(scene), null);
    scene.activeNodeId = failed.sourceNodeId;
    failed.kind = "action";
    assert.equal(findSpatialFailedReturn(scene), null);
    failed.kind = "movement";
    failed.backward = { videoUrl: "return.mp4", durationMs: 5000, provider: "api" };
    assert.equal(findSpatialFailedReturn(scene), null);
    failed.backward = null;
    failed.status = "generating-backward";
    assert.equal(findSpatialFailedReturn(scene), null);
});


test("joystick coordinates preserve direction and manual image anchor", () => {
    const draft = connection("input", "root", "target").movement;
    draft.startPoint = { x: 0.3, y: 0.8 };
    for (const [x, y, expected] of [[1, 0, "RIGHT"], [-1, 0, "LEFT"], [0, 1, "FORWARD"], [0, -1, "BACKWARD"], [0.7, 0.7, "FORWARD_RIGHT"]] as const) {
        draft.samples = [{ x, y, radius: 1, angle: Math.atan2(y, x), elapsedMs: 100 }];
        assert.equal(spatialJoystickInput(draft).direction, expected);
        assert.deepEqual(spatialJoystickInput(draft).startPoint, { x: 0.3, y: 0.8 });
    }
    const reverse = reverseSpatialMovementDraft(draft);
    assert.equal(spatialJoystickInput(reverse).direction, "BACKWARD_LEFT");
    assert.equal(reverse.startPoint, undefined);
    assert.deepEqual(draft.startPoint, { x: 0.3, y: 0.8 });
});

test("start-point clicks account for contain-fit letterboxing", () => {
    assert.deepEqual(spatialFrameClick(100, 100, 200, 200, 100, 200), { x: 0.5, y: 0.5 });
    assert.equal(spatialFrameClick(20, 100, 200, 200, 100, 200), null);
    assert.deepEqual(spatialFrameClick(100, 100, 200, 200, 200, 100), { x: 0.5, y: 0.5 });
    assert.equal(spatialFrameClick(100, 20, 200, 200, 200, 100), null);
    assert.equal(spatialFrameClick(0, 0, 0, 0, 100, 200), null);
});


test("bounded movement plans reject wrong direction, camera changes and invented space", () => {
    const plan = { cameraMode: "fixed", unitStaysInside: true, preservesControlState: true,
        inventsEnvironment: false, boundaryLimited: false,
        path: [{x: 0.4, y: 0.5, z: 0.3}, {x: 0.6, y: 0.5, z: 0.6}] };
    assert.doesNotThrow(() => validateSpatialPlan(plan, {x: 1, y: 1}, false));
    assert.throws(() => validateSpatialPlan(plan, {x: -1, y: 0}, false));
    assert.throws(() => validateSpatialPlan({...plan, cameraMode: "tracking"}, {x: 1, y: 1}, false));
    assert.throws(() => validateSpatialPlan({...plan, inventsEnvironment: true}, undefined, false));
    assert.throws(() => validateSpatialPlan({...plan, unitStaysInside: false}, undefined, false));
    assert.throws(() => validateSpatialPlan({...plan, path: [{x: 0, y: 0, z: 0}, {x: 2, y: 0, z: 0}]}, undefined, false));
    const held = {...plan, path: [plan.path[0], plan.path[0]], boundaryLimited: true};
    assert.doesNotThrow(() => validateSpatialPlan(held, {x: 1, y: 0}, false));
    assert.doesNotThrow(() => validateSpatialPlan({...plan, cameraMode: "pov-translation"}, {x: 1, y: 1}, true));
});


test("action slot holds a link or video and links do not traverse during creation", () => {
    const scene = makeScene();
    const linked = setSpatialActionLink(scene, scene.activeNodeId, {sceneId: "scene-7", bShotIndex: 0, bShotIdentity: "b"});
    assert.equal(linked.activeNodeId, scene.activeNodeId);
    assert.equal(linked.connections.length, scene.connections.length);
    assert.equal(linked.nodes.find(node => node.id === linked.activeNodeId)?.actionLink?.sceneId, "scene-7");
    assert.equal(beginSpatialActionConnection(linked, "open gate"), null);
    const reset = cutSpatialNodeThread(linked, linked.nodes[0].id)!;
    assert.equal(reset.scene.nodes[0].actionLink, undefined);
    const begun = beginSpatialActionConnection(scene, "open gate")!;
    assert.equal(setSpatialActionLink(begun.scene, begun.connection.sourceNodeId, {sceneId:"scene-7"}), begun.scene);
});


test("saved action links resolve A and B array slots independently of display order", () => {
    const a = makeScene(); a.sceneId = "scene-a";
    const b = makeScene(); b.sceneId = "scene-b";
    assert.deepEqual(resolveSpatialSceneLink({sceneId:"scene-b"}, [a,b], []), {sceneIndex:1,bShotIndex:null});
    const link = {sceneId:"scene-b", bShotIndex:0, bShotIdentity:"b-id"};
    assert.deepEqual(resolveSpatialSceneLink(link,[a,b],[[],["b-id"]]), {sceneIndex:1,bShotIndex:0});
    assert.deepEqual(resolveSpatialSceneLink(link,[b],[["b-id"]]), {sceneIndex:0,bShotIndex:0});
    assert.equal(resolveSpatialSceneLink(link,[a],[]),null);
    assert.equal(resolveSpatialSceneLink(link,[a,b],[[],["replacement"]]),null);
    const saved = JSON.parse(JSON.stringify(setSpatialActionLink(a,a.activeNodeId,link)));
    assert.deepEqual(saved.nodes.find((node: SpatialNode) => node.id === a.activeNodeId).actionLink, link);
});


test("backtrack is a saved exclusive action slot and dangling targets are cleared on cut", () => {
    const scene = makeScene();
    const source = scene.nodes.find(node => node.id === "other-branch")!;
    const target = scene.nodes.find(node => node.id === "branch-b")!;
    const saved = setSpatialActionBacktrack(scene, source.id, target.id);
    assert.equal(saved.nodes.find(node => node.id === source.id)?.actionBacktrack?.targetNodeId, target.id);
    assert.equal(saved.activeNodeId, scene.activeNodeId);
    assert.equal(saved.connections.length, scene.connections.length);
    assert.equal(setSpatialActionBacktrack(scene, source.id, source.id), scene);
    assert.equal(setSpatialActionBacktrack(scene, source.id, "missing"), scene);
    const active = {...saved, activeNodeId:source.id};
    assert.equal(beginSpatialActionConnection(active,"wave"),null);
    assert.equal(setSpatialActionLink(active,source.id,{sceneId:"elsewhere"}).nodes.find(node=>node.id===source.id)?.actionLink,undefined);
    const cut = cutSpatialNodeThread(saved,target.id)!;
    assert.equal(cut.scene.nodes.find(node=>node.id===source.id)?.actionBacktrack,undefined);
});


test("preview JSON keeps A/B identity and isolates navigation from creation", () => {
    const a = {sceneId: "a", activeNodeId: "n", nodes: [node("n")], connections: [], draftMovement: null} as SpatialSceneState;
    const b = {...a, sceneId: "a:b:0:hash"};
    const payload = buildSpatialExperience([
        {sceneId:"a",label:"Scene 1",frameUrl:"frame"},
        {sceneId:"a",bShotIndex:0,bShotIdentity:"hash",label:"B",frameUrl:"frame"}
    ], [a], [[b]], [], []);
    assert.equal(payload.version, 1);
    assert.equal(payload.stages.length, 2);
    assert.equal(payload.stages[1].address.bShotIdentity, "hash");
    payload.stages[0].scene.activeNodeId = "changed";
    assert.equal(a.activeNodeId, "n");
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test("feed parser accepts a published spatial document and rejects malformed graph data", () => {
    const scene = makeScene();
    const published = {
        version: 1 as const,
        stages: [{
            id: scene.sceneId,
            label: "Scene 1",
            address: { sceneId: scene.sceneId },
            scene,
            contexts: [],
        }],
        entry: { stageId: scene.sceneId, nodeId: "root" },
    };
    assert.deepEqual(parseSpatialExperience(JSON.stringify(published)), published);
    assert.equal(parseSpatialExperience({ ...published, entry: { stageId: scene.sceneId, nodeId: "missing" } }), null);
    assert.equal(parseSpatialExperience("not-json"), null);
});


test("arrow keeps the clicked origin and preserves diagonal direction at frame edges", () => {
  const arrow=spatialArrowGeometry(256,256,{x:245,y:128},{x:1,y:1});
  assert.deepEqual(arrow.start,{x:245,y:128});
  assert.equal(arrow.tip.x,256);
  assert.equal(arrow.tip.y,117);
  assert.ok(arrow.left.x < arrow.tip.x);
  assert.ok(arrow.length>0);
  const edge=spatialArrowGeometry(256,256,{x:256,y:128},{x:1,y:0});
  assert.equal(edge.length,0); // Never draw an arrow pointing inward for an outward request.
});

test("return reference arrow points in the inverse direction", () => {
  const draft={id:"d",sourceNodeId:"n",createdAt:0,durationMs:1,samples:[{x:1,y:0,radius:1,angle:0,elapsedMs:1}]};
  const reverse=reverseSpatialMovementDraft(draft);
  const arrow=spatialArrowGeometry(256,256,{x:128,y:128},reverse.samples[0]);
  assert.ok(arrow.tip.x<arrow.start.x);
  assert.equal(arrow.tip.y,arrow.start.y);
});

import { spatialCompassPath } from "../src/spatialCompassPath";
test("compass path preserves origin and bends with scale-independent projection",()=>{
 const samples=[{x:0,y:1,radius:1,angle:1.57,elapsedMs:1000},{x:1,y:0,radius:1,angle:0,elapsedMs:2000}];
 const a=spatialCompassPath(256,512,{x:90,y:400},samples);
 const b=spatialCompassPath(512,1024,{x:180,y:800},samples);
 assert.deepEqual(a.start,{x:90,y:400});assert.equal(a.points.length,3);
 assert.ok(a.points[1].y<a.start.y);assert.ok(a.tip.x>a.points[1].x);
 assert.ok(Math.abs(b.tip.x-a.tip.x*2)<1e-8);
 assert.ok(Math.abs(b.tip.y-a.tip.y*2)<1e-8);
 const bounded=spatialCompassPath(256,512,{x:250,y:10},samples);
 assert.ok(bounded.points.every(p=>p.x>=0 && p.x<=256 && p.y>=0 && p.y<=512));
 const reverse=spatialCompassPath(256,512,{x:128,y:256},samples.map(s=>({...s,x:-s.x,y:-s.y})),true);
 assert.ok(reverse.points[1].x<reverse.start.x);assert.ok(reverse.tip.y>reverse.points[1].y);
});


test("smooth join avoids backward lead-in and preserves destination", () => {
  const samples=[{x:0,y:1,radius:1,angle:0,elapsedMs:1000}];
  const trail={width:400,height:400,points:[{x:0.5,y:0.8},{x:0.55,y:0.6},{x:0.6,y:0.4}]};
  // Portrait image is letterboxed horizontally in this square viewport.
  const result=spatialCompassPath(200,400,{x:30,y:300},samples,false,trail);
  assert.deepEqual(result.points[0],{x:30,y:300});
  assert.ok(result.points.every((p,i)=>i===0 || p.y<=result.points[i-1].y));
  assert.deepEqual(result.tip,{x:140,y:160});
  const moved=spatialCompassPath(200,400,{x:80,y:350},samples,false,trail);
  assert.deepEqual(moved.tip,result.tip);
  const tiny=spatialCompassPath(100,200,{x:15,y:150},samples,false,trail);
  assert.deepEqual(tiny.tip,{x:70,y:80});
});

test("live stage adapter preserves scene/draft identity while preview snapshots remain independent", () => {
    const scene = makeScene();
    scene.draftMovement = scene.connections[0].movement;
    const options = [{sceneId: scene.sceneId, label: "A", frameUrl: scene.nodes[0].frameUrl}];
    const live = buildSpatialExperienceStages(options, [scene], [], [], []);
    assert.equal(live[0].scene, scene);
    assert.equal(live[0].scene.activeNodeId, "branch-b");
    assert.equal(live[0].scene.draftMovement, scene.draftMovement);
    const preview = buildSpatialExperience(options, [scene], [], [], []);
    assert.equal(preview.stages[0].scene.activeNodeId, "root");
    assert.equal(preview.stages[0].scene.draftMovement, null);
    assert.equal(scene.activeNodeId, "branch-b");
    assert.notEqual(preview.stages[0].scene.nodes, scene.nodes);
});

test("shared controls expose only playable movements and the active traversal axis", () => {
    const scene = makeScene(); scene.activeNodeId = "root";
    const edge = connection("action", "root", "branch-a"); edge.kind = "action";
    scene.connections = [edge];
    const drive = {x: 1, y: 0, radius: 1, active: true, angle: 0};
    assert.equal(spatialTraversalForDrive(scene, drive), null);
    assert.deepEqual(spatialDirections(scene, null), {top:false,right:false,bottom:false,left:false});
    const action = spatialAction(scene, []);
    assert.equal(action?.kind, "video");
    scene.connections = [connection("move", "root", "branch-a")];
    const clip = spatialTraversalForDrive(scene, drive)!;
    assert.equal(clip.destinationNodeId, "branch-a");
    assert.deepEqual(spatialDirections(scene, clip), {top:false,right:true,bottom:false,left:true});
    scene.nodes = scene.nodes.filter(n => n.id !== "branch-a");
    assert.equal(spatialTraversalForDrive(scene, drive), null);
});

test("donut drive stops in the hollow centre and preserves diagonal routes", () => {
    const bounds = {left: 0, top: 0, width: 132, height: 132};
    assert.equal(spatialRingDirection(bounds, 66, 66, false), null);
    assert.deepEqual(spatialRingDirection(bounds, 66, 12, false), {x: 0, y: 1, radius: 1, angle: Math.PI / 2});
    const diagonal = spatialRingDirection(bounds, 104, 28, false)!;
    assert.ok(diagonal.x > 0.7 && diagonal.y > 0.7);
    assert.equal(spatialRingDirection(bounds, 66, 38, false), null);
    assert.ok(spatialRingDirection(bounds, 66, 38, true));
    assert.equal(spatialRingDirection(bounds, 66, 43, true), null);
    assert.equal(spatialRingDirection(bounds, 66, -10, true), null);
});

test("Back follows movement/action parents before returning to the exact followed-link source", () => {
    const scene = makeScene();
    const action = connection("action", "root", "branch-a"); action.kind = "action";
    scene.connections = [action, connection("move", "branch-a", "branch-b")];
    const history = [{source:{stageId:"original-b-shot",nodeId:"door-node"},destination:{stageId:scene.sceneId,nodeId:"root"}}];
    assert.deepEqual(spatialBackDestination(scene, history), {position:{stageId:scene.sceneId,nodeId:"branch-a"},popLink:false});
    scene.activeNodeId = "branch-a";
    assert.equal(spatialBackDestination(scene, history)?.position.nodeId, "root");
    scene.activeNodeId = "root";
    assert.deepEqual(spatialBackDestination(scene, history), {position:history[0].source,popLink:true});
    assert.equal(spatialBackDestination(scene, []), null);
});

test("backward drive at a linked entry returns to the actual visit source and follows the scene movement axis", () => {
    const destination = makeScene(); destination.sceneId = "destination"; destination.activeNodeId = "root";
    const sources = ["source-a", "source-b"].map(sceneId => ({ ...makeScene(), sceneId }));
    const stages = [...sources, destination].map(scene => ({ id: scene.sceneId, label: scene.sceneId, address: { sceneId: scene.sceneId }, scene, contexts: [] }));
    const backward = { x: -1, y: 0, radius: 1, active: true, angle: Math.PI };
    for (const source of sources) {
        const visit = { source: { stageId: source.sceneId, nodeId: "branch-b" }, destination: { stageId: "destination", nodeId: "root" } };
        assert.deepEqual(spatialLinkReturnForDrive(destination, [visit], stages, backward), visit.source);
        assert.equal(spatialLinkReturnForDrive(destination, [visit], stages, { ...backward, x: 1 }), null);
        assert.equal(spatialLinkReturnForDrive(destination, [visit], stages, { ...backward, active: false }), null);
        assert.equal(spatialDirections(destination, null, spatialLinkReturn(destination, [visit], stages)!.axes).left, true);
        destination.activeNodeId = "branch-a";
        assert.equal(spatialLinkReturnForDrive(destination, [visit], stages, backward), null);
        destination.activeNodeId = "root";
    }
    assert.equal(spatialLinkReturnForDrive(destination, [], stages, backward), null);
    const visits = sources.map(source => ({ source: { stageId: source.sceneId, nodeId: "branch-b" }, destination: { stageId: "destination", nodeId: "root" } }));
    assert.deepEqual(spatialLinkReturnForDrive(destination, visits, stages, backward), visits[1].source);
    assert.equal(spatialLinkReturnForDrive(destination, visits, [stages[0], stages[2]], backward), null);
    destination.connections = [];
    assert.equal(spatialDirections(destination, null, spatialLinkReturn(destination, visits, stages)!.axes).left, true);
});

test("viewer Back skips chained action results but preserves later movement checkpoints", () => {
    const source = makeScene();
    source.sceneId = "source";
    source.nodes = [node("movement-a"), node("action-1"), node("action-2"), node("movement-b")];
    const first = connection("action-1", "movement-a", "action-1"); first.kind = "action";
    const second = connection("action-2", "action-1", "action-2"); second.kind = "action";
    source.connections = [first, second, connection("move-after-actions", "action-2", "movement-b")];
    const destination = makeScene();
    destination.sceneId = "destination";
    destination.activeNodeId = "root";
    const stages = [source, destination].map(scene => ({
        id: scene.sceneId, label: scene.sceneId, address: { sceneId: scene.sceneId }, scene, contexts: [],
    }));
    const options = { skipActionResults: true, stages };

    source.activeNodeId = "movement-b";
    assert.deepEqual(spatialBackDestination(source, [], options), {
        position: { stageId: "source", nodeId: "movement-a" }, popLink: false,
    });

    const fromAction = [{ source: { stageId: "source", nodeId: "action-2" }, destination: { stageId: "destination", nodeId: "root" } }];
    const returnDrive = { x: -1, y: 0, radius: 1, active: true, angle: Math.PI };
    assert.deepEqual(spatialLinkReturn(destination, fromAction, stages)?.position, fromAction[0].source);
    assert.deepEqual(spatialLinkReturnForDrive(destination, fromAction, stages, returnDrive), fromAction[0].source);
    assert.equal(spatialDirections({ ...destination, connections: [] }, null,
        spatialLinkReturn(destination, fromAction, stages)?.axes).left, true);
    const fromSingleAction = [{ ...fromAction[0], source: { stageId: 'source', nodeId: 'action-1' } }];
    assert.deepEqual(spatialLinkReturnForDrive(destination, fromSingleAction, stages, returnDrive), fromSingleAction[0].source);
    const locked = [{ ...fromAction[0], returnLocked: true }];
    assert.equal(spatialLinkReturnForDrive(destination, locked, stages, returnDrive), null);
    assert.equal(spatialUnlockLinkReturn(locked, 'elsewhere'), locked);
    const unlocked = spatialUnlockLinkReturn(locked, 'destination');
    assert.equal(locked[0].returnLocked, true, 'movement must not mutate an earlier visit');
    assert.deepEqual(spatialLinkReturnForDrive(destination, unlocked, stages, returnDrive), fromAction[0].source);
    assert.deepEqual(spatialBackDestination(destination, locked, options), {
        position: { stageId: 'source', nodeId: 'movement-a' }, popLink: true,
    }, 'the entry guard must not affect the explicit Back gesture');
    source.activeNodeId = 'action-1'; first.actionPlayback = 'hold';
    assert.equal(spatialActionReplay(source)?.connection.actionPlayback, 'tap');
    assert.equal(first.actionPlayback, 'hold', 'review does not change the authored hold setting');
    assert.equal(spatialActionReplay(source)?.destinationNodeId, 'action-1');
    assert.equal(spatialActionReplay(source)?.video.videoUrl, first.forward?.videoUrl);
    assert.deepEqual(spatialActionForwardDestination(source, stages), { stageId: 'source', nodeId: 'action-2' });
    assert.deepEqual(spatialBackDestination(destination, fromAction, options), {
        position: { stageId: "source", nodeId: "movement-a" }, popLink: true,
    });

    const fromMovement = [{ source: { stageId: "source", nodeId: "movement-b" }, destination: { stageId: "destination", nodeId: "root" } }];
    assert.deepEqual(spatialLinkReturnForDrive(destination, fromMovement, stages, returnDrive), fromMovement[0].source);
    assert.deepEqual(spatialBackDestination(destination, fromMovement, options), {
        position: { stageId: "source", nodeId: "movement-b" }, popLink: true,
    });
});

test("viewer completion treats only childless playable nodes as terminal", () => {
    const scene = makeScene();
    scene.activeNodeId = "branch-b";
    assert.equal(spatialIsTerminalNode(scene, []), true);

    scene.activeNodeId = "branch-a";
    assert.equal(spatialIsTerminalNode(scene, []), false);

    scene.activeNodeId = "branch-b";
    const action = connection("ending-action", "branch-b", "branch-c"); action.kind = "action";
    scene.connections.push(action);
    assert.equal(spatialIsTerminalNode(scene, []), false);

    scene.connections = scene.connections.filter(connection => connection.id !== action.id);
    scene.nodes.find(node => node.id === "branch-b")!.actionBacktrack = { targetNodeId: "root" };
    assert.equal(spatialIsTerminalNode(scene, []), false);
});

test("links resolve B-shot identity and saved backtracks without replaying action videos", () => {
    const scene = makeScene(); scene.activeNodeId = "root";
    scene.nodes[0].actionLink = {sceneId:"a",bShotIndex:1,bShotIdentity:"current"};
    const destination = {...makeScene(),sceneId:"a:b:1:current"};
    const stages = [{id:destination.sceneId,label:"B",address:{sceneId:"a",bShotIndex:1,bShotIdentity:"current"},scene:destination,contexts:[]}];
    assert.deepEqual(spatialAction(scene, stages), {kind:"link",destination:{stageId:destination.sceneId,nodeId:"root"}});
    stages[0].address.bShotIdentity = "replacement";
    assert.deepEqual(spatialAction(scene, stages), {kind:"link",destination:null});
    delete scene.nodes[0].actionLink;
    scene.nodes[0].actionBacktrack = {targetNodeId:"branch-b"};
    assert.deepEqual(spatialAction(scene, stages), {kind:"backtrack",destination:{stageId:scene.sceneId,nodeId:"branch-b"}});
});

class TestMedia extends EventTarget {
    readyState = 4; duration = 10; currentTime = 0; muted = false; paused = true; seeking = false;
    error: {code:number;message:string} | null = null;
    playCalls = 0;
    async play() { this.playCalls++; this.paused = false; }
    pause() { this.paused = true; }
    load() {}
    fire(name: string) { this.dispatchEvent(new Event(name)); }
}
class TestClock implements SpatialPlaybackClock {
    time = 0;
    ticks = new Set<() => void>(); timeouts = new Set<() => void>();
    now = () => this.time;
    every = (callback: () => void) => { this.ticks.add(callback); return () => {this.ticks.delete(callback);}; };
    delays = new Map<() => void, number>();
    after = (callback: () => void, ms: number) => { this.timeouts.add(callback); this.delays.set(callback, ms); return () => {this.timeouts.delete(callback); this.delays.delete(callback);}; };
    tick() { this.time += 40; for (const tick of [...this.ticks]) tick(); }
}
const playbackFixture = (edge = connection("move", "root", "target"), direction: "forward" | "backward" = "forward") => {
    const media = new TestMedia(), clock = new TestClock();
    const traversal: SpatialTraversal = {connection:edge,direction,destinationNodeId:direction === "forward" ? "target" : "root",video:direction === "backward" ? edge.backward || edge.forward! : edge.forward!};
    let drive = {x:direction === "forward" ? 1 : -1,y:0,radius:1,active:true,angle:0};
    const finished:string[] = [], errors:string[] = [], switches:Array<{clip:SpatialTraversal;progress:number}> = [];
    const attach = (clip=traversal, progress:number|null=null, waitForSeekBeforePlayback=false, onVisualReady?:()=>void) => attachSpatialPlayback({video:media as unknown as HTMLVideoElement,
        traversal:clip,progress,drive:()=>drive,clock,onFinish:n=>finished.push(n),onError:reason=>errors.push(reason),
        waitForSeekBeforePlayback,onVisualReady,
        onDirection:(clip,progress)=>switches.push({clip,progress})});
    return {media,clock,traversal,finished,errors,switches,attach,setDrive:(x:number,active=true)=>{drive={...drive,x,radius:Math.abs(x),active};}};
};

test("shared media pauses on release and reverses a generated return at matching route progress", async () => {
    const edge = connection("move", "root", "target"); edge.backward = {videoUrl:"return.mp4",durationMs:10000,provider:"api"};
    const f = playbackFixture(edge); let stop = f.attach();
    f.clock.tick(); await Promise.resolve(); assert.equal(f.media.paused, false);
    f.media.currentTime = 4; f.setDrive(0,false); f.clock.tick(); assert.equal(f.media.paused,true);
    f.setDrive(-1); f.clock.tick(); assert.equal(f.switches[0].progress,0.4); assert.equal(f.switches[0].clip.video.videoUrl,"return.mp4");
    stop(); stop=f.attach(f.switches[0].clip,f.switches[0].progress); assert.equal(f.media.currentTime,6);
    f.media.currentTime=7; f.setDrive(1); f.clock.tick(); assert.ok(Math.abs(f.switches[1].progress-0.3)<1e-8);
    stop(); stop=f.attach(f.switches[1].clip,f.switches[1].progress); assert.ok(Math.abs(f.media.currentTime-3)<1e-8);
    f.media.fire("ended"); assert.deepEqual(f.finished,["target"]); stop();
});

test("fallback return seeks the forward video backward and finishes once at source", () => {
    const f=playbackFixture(undefined,"backward"), stop=f.attach(undefined,0.009);
    f.clock.tick(); f.clock.tick(); f.clock.tick();
    assert.deepEqual(f.finished,["root"]); assert.equal(f.media.muted,true);
    f.media.fire("ended"); assert.deepEqual(f.finished,["root"]); stop();
});

test("action playback ignores joystick release and activates its result only after ending", async () => {
    const edge=connection("action","root","target"); edge.kind="action";
    const f=playbackFixture(edge); f.setDrive(0,false); const stop=f.attach(); await Promise.resolve();
    assert.equal(f.media.paused,false); assert.deepEqual(f.finished,[]);
    f.clock.tick(); assert.equal(f.media.paused,false);
    f.media.fire("ended"); assert.deepEqual(f.finished,["target"]); stop();
});

test("hold actions pause on release, resume at the same time and clean up listeners", async () => {
    const edge = connection("hold", "root", "target"); edge.kind = "action"; edge.actionPlayback = "hold";
    const f = playbackFixture(edge); let held = false;
    const stop = attachSpatialPlayback({ video: f.media as unknown as HTMLVideoElement, traversal: f.traversal,
        progress: null, drive: () => null, actionHeld: () => held, clock: f.clock,
        onFinish: n => f.finished.push(n), onError: reason => f.errors.push(reason), onDirection: () => {} });
    f.clock.tick(); assert.equal(f.media.paused, true);
    held = true; f.clock.tick(); await Promise.resolve(); assert.equal(f.media.paused, false);
    f.media.currentTime = 3.5; held = false; f.clock.tick(); assert.equal(f.media.paused, true);
    held = true; f.clock.tick(); await Promise.resolve(); assert.equal(f.media.currentTime, 3.5); assert.equal(f.media.paused, false);
    assert.deepEqual(f.finished, []);
    f.media.fire("ended"); f.media.fire("ended"); assert.deepEqual(f.finished, ["target"]);
    stop(); f.clock.tick(); assert.equal(f.clock.ticks.size, 0); assert.equal(f.clock.timeouts.size, 0);
    assert.deepEqual(f.errors, []);
});

test("viewer playback waits for a reused video to seek before revealing or starting it", async () => {
    const edge=connection("action","root","target"); edge.kind="action";
    const f=playbackFixture(edge); f.media.currentTime=7;
    let visualReady=0;
    const stop=f.attach(undefined,null,true,()=>{visualReady+=1;});
    await Promise.resolve();
    assert.equal(f.media.currentTime,0);
    assert.equal(f.media.playCalls,0);
    assert.equal(visualReady,0);
    f.media.fire("seeked"); await Promise.resolve();
    assert.equal(visualReady,1);
    assert.equal(f.media.playCalls,1);
    stop();
});

test("viewer playback waits for the presented frame after seeked and cancels pending frame callbacks", async () => {
    const edge=connection("action","root","target");edge.kind="action";
    for (const cancel of [false,true]) {
        const f=playbackFixture(edge);f.media.currentTime=7;
        let presented: (()=>void)|undefined,visualReady=0,cancelled=0;
        Object.assign(f.media,{requestVideoFrameCallback:(callback:()=>void)=>{presented=callback;return 1;},cancelVideoFrameCallback:()=>{cancelled++;}});
        const stop=f.attach(undefined,null,true,()=>{visualReady++;});
        f.media.fire("seeked");await Promise.resolve();
        assert.equal(visualReady,0);assert.equal(f.media.muted,true);assert.equal(f.media.playCalls,1);assert.ok(presented);
        f.media.fire('ended');assert.deepEqual(f.finished,[],'hidden frame preparation must not navigate');
        if(cancel)stop();
        presented!();await Promise.resolve();
        assert.equal(visualReady,cancel?0:1);assert.equal(f.media.playCalls,cancel?1:2);
        if(cancel)assert.equal(cancelled,1);
        stop();
    }
});

test("a cached video already at the target time still waits for its presented frame", () => {
    const f=playbackFixture();let presented:(()=>void)|undefined,visualReady=0;
    Object.assign(f.media,{requestVideoFrameCallback:(callback:()=>void)=>{presented=callback;return 1;},cancelVideoFrameCallback:()=>{}});
    const stop=f.attach(undefined,null,true,()=>{visualReady++;});
    assert.equal(visualReady,0);assert.ok(presented);
    presented!();assert.equal(visualReady,1);stop();
});

test("a presented target frame before seeked is retained, while unrelated cached frames are rejected", () => {
    const f=playbackFixture(); f.media.currentTime=7;
    let presented: ((now:number,metadata:{mediaTime:number})=>void)|undefined,visualReady=0;
    Object.assign(f.media,{requestVideoFrameCallback:(callback:typeof presented)=>{presented=callback;return 1;},cancelVideoFrameCallback:()=>{}});
    const stop=f.attach(undefined,null,true,()=>{visualReady++;});
    assert.ok(presented,'callback must be registered before seeked');
    presented!(0,{mediaTime:7});assert.equal(visualReady,0);
    presented!(0,{mediaTime:0});assert.equal(visualReady,0);
    f.media.fire('seeked');assert.equal(visualReady,1);
    stop();
});

test("cancelled or failed media cannot navigate later through stale listeners", () => {
    const f=playbackFixture(); const stop=f.attach(); stop();
    f.media.fire("ended"); f.media.fire("error"); f.clock.tick();
    assert.deepEqual(f.finished,[]); assert.deepEqual(f.errors,[]); assert.equal(f.clock.ticks.size,0);
    const failed=playbackFixture(); const stopFailed=failed.attach(); failed.media.fire("error"); failed.media.fire("ended");
    assert.deepEqual(failed.errors,["media-error"]); assert.deepEqual(failed.finished,[]); stopFailed();
    const loading=playbackFixture(); loading.media.readyState=0; const stopLoading=loading.attach();
    for (const timeout of loading.clock.timeouts) timeout();
    assert.deepEqual(loading.errors,["load-timeout"]); stopLoading();
});

test('covered video uses a decoded seek when the browser withholds its compositor callback', () => {
    const f = playbackFixture(); let ready = 0, cancelled = 0;
    Object.assign(f.media, { requestVideoFrameCallback: () => 1, cancelVideoFrameCallback: () => { cancelled++; } });
    const stop = f.attach(undefined, null, true, () => { ready++; });
    assert.equal(ready, 0);
    const fallback = [...f.clock.delays].find(([, ms]) => ms === 1500)![0];
    f.media.currentTime = 2;
    fallback();
    assert.equal(ready, 0, 'unrelated cached frame was revealed');
    assert.equal(f.media.currentTime, 0);
    f.media.fire('seeked');
    assert.equal(ready, 1); assert.equal(cancelled, 1);
    assert.equal(f.clock.timeouts.size, 0, 'decoded clip still has a load timeout');
    assert.deepEqual(f.errors, []); stop();
});

test('decoded-seek fallback cannot rescue unavailable data or navigate after cancellation', () => {
    const f = playbackFixture(); let ready = 0;
    Object.assign(f.media, { requestVideoFrameCallback: () => 1, cancelVideoFrameCallback: () => {} });
    const stop = f.attach(undefined, null, true, () => { ready++; });
    const fallback = [...f.clock.delays].find(([, ms]) => ms === 1500)![0];
    f.media.readyState = 0; fallback(); f.media.fire('seeked');
    assert.equal(ready, 0); stop();
    f.media.readyState = 4; fallback(); f.media.fire('seeked');
    assert.equal(ready, 0); assert.deepEqual(f.finished, []);
});


test("resetting navigation preserves movement videos and frees only its action slot", () => {
    const base: SpatialSceneState = { sceneId: "A", activeNodeId: "child", nodes: [node("root"), node("child")], connections: [connection("move", "root", "child")], draftMovement: null };
    for (const linked of [setSpatialActionLink(base, "child", {sceneId: "B"}), setSpatialActionBacktrack(base, "child", "root")]) {
        const reset = clearSpatialActionNavigation(linked, "child");
        assert.equal(reset.connections, base.connections);
        assert.equal(reset.activeNodeId, "child");
        assert.equal(reset.nodes.length, 2);
        assert.equal(reset.nodes[0], base.nodes[0]);
        assert.equal(reset.nodes[1].frameUrl, base.nodes[1].frameUrl);
        assert.equal(reset.nodes[1].actionLink, undefined);
        assert.equal(reset.nodes[1].actionBacktrack, undefined);
        assert.ok(setSpatialActionLink(reset, "child", {sceneId: "C"}).nodes[1].actionLink);
        assert.equal(clearSpatialActionNavigation(reset, "missing"), reset);
        assert.ok(linked.nodes[1].actionLink || linked.nodes[1].actionBacktrack);
    }
});
