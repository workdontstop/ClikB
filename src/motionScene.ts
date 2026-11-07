import * as THREE from 'three';
import { motionSegment, validateMotionPlan, type MotionPlan } from './motionGuide';
import { interpolateBoxSpan, type MotionPart } from '../server/src/motionGuidePlan';
import type { SceneLightingRig } from '../server/src/sceneCamera';

/** Locally painted literal text; preview and MP4 use this exact canvas. */
export function createMotionTextCanvas(part: MotionPart): HTMLCanvasElement {
    const text = part.text!;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot draw Motion Guide text.');
    const fontSize = text.fontSize ?? 64;
    const font = `${text.italic ? 'italic ' : ''}${text.fontWeight ?? 400} ${fontSize}px ${text.fontFamily || 'sans-serif'}`;
    context.font = font;
    const lines = text.content.split(/\r\n|\r|\n/);
    const padding = (text.padding ?? 4) + (text.strokeWidth ?? 0) + 2;
    const lineHeight = fontSize * (text.lineHeight ?? 1.2);
    const width = Math.max(1, ...lines.map(line => context.measureText(line).width)) + padding * 2;
    const height = Math.max(fontSize * 1.4, (lines.length - 1) * lineHeight + fontSize * 1.4) + padding * 2;
    const ratio = Math.min(1, 2048 / width, 2048 / height);
    canvas.width = Math.max(2, Math.ceil(width * ratio));
    canvas.height = Math.max(2, Math.ceil(height * ratio));
    context.scale(ratio, ratio);
    if (text.background) { context.fillStyle = text.background; context.fillRect(0, 0, width, height); }
    context.font = font; context.textBaseline = 'top'; context.textAlign = text.align ?? 'center';
    context.fillStyle = part.color; context.lineJoin = 'round';
    const x = text.align === 'left' ? padding : text.align === 'right' ? width - padding : width / 2;
    lines.forEach((line, i) => {
        if (text.strokeColor && text.strokeWidth) {
            context.strokeStyle = text.strokeColor; context.lineWidth = text.strokeWidth;
            context.strokeText(line, x, padding + i * lineHeight);
        }
        context.fillText(line, x, padding + i * lineHeight);
    });
    return canvas;
}

export const BLOCKOUT_PALETTE = { material: '#dce7f3', actor: '#6686B3', joint: '#8DE5FF', ground: '#eef5ff', edge: '#384960', background: '#edf5fc', grid: '#F4F6FA' } as const;

// Stable IDs keep subject colors independent of object order, animation time,
// and AI-authored per-part colors. Preview and exported references share this.
const SUBJECT_COLORS = ['#6686B3', '#9480AE', '#6F9B86', '#AD925F', '#669DA5', '#B582A0', '#B87870', '#919B65'];
export function subjectColor(id: string): string {
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return SUBJECT_COLORS[(hash >>> 0) % SUBJECT_COLORS.length];
}

/** The same inexpensive scene graph drives spatial authoring and Motion Guides. */
export function createMotionScene(input: MotionPlan, aspect: number, initialize = true) {
    const plan = validateMotionPlan(input);
    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x697386, 1.55);
    scene.add(hemi);
    const light = new THREE.DirectionalLight(0xffffff, 3.0);
    light.position.set(-4, 8, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -14; light.shadow.camera.right = 14;
    light.shadow.camera.top = 14; light.shadow.camera.bottom = -14;
    light.shadow.normalBias = .035;
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xb5dbff, 1.4);
    rim.position.set(5, 5, -6);
    scene.add(rim);
    const applyLighting = (lighting?: SceneLightingRig) => {
        if (!lighting) {
            hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x697386); hemi.intensity = 1.55;
            light.color.setHex(0xffffff); light.intensity = 3.0; light.position.set(-4, 8, 6);
            rim.color.setHex(0xb5dbff); rim.intensity = 1.4; rim.position.set(5, 5, -6);
            return;
        }
        const scale = Math.max(0.25, Math.min(2.5, Number.isFinite(lighting.intensity) ? lighting.intensity : 1));
        const az = ((Number.isFinite(lighting.azimuthDeg) ? lighting.azimuthDeg : -34) * Math.PI) / 180;
        const el = (Math.max(8, Math.min(88, Number.isFinite(lighting.elevationDeg) ? lighting.elevationDeg : 48)) * Math.PI) / 180;
        const dist = 10.8;
        light.position.set(
            Math.sin(az) * Math.cos(el) * dist,
            Math.max(1.2, Math.sin(el) * dist),
            Math.cos(az) * Math.cos(el) * dist,
        );
        rim.position.set(-light.position.x * 0.75, Math.max(3.5, light.position.y * 0.65), -light.position.z * 0.75);
        switch (lighting.preset) {
            case 'golden':
                hemi.color.setHex(0xffe7c7); hemi.groundColor.setHex(0x5e5468); hemi.intensity = 1.35 * scale;
                light.color.setHex(0xffd29d); light.intensity = 3.4 * scale;
                rim.color.setHex(0x8ec5ff); rim.intensity = 1.3 * scale;
                break;
            case 'noon':
                hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x7a8699); hemi.intensity = 1.75 * scale;
                light.color.setHex(0xffffff); light.intensity = 3.7 * scale;
                rim.color.setHex(0xd6ecff); rim.intensity = 1.1 * scale;
                break;
            case 'dramatic':
                hemi.color.setHex(0xd8e4f5); hemi.groundColor.setHex(0x303846); hemi.intensity = 0.85 * scale;
                light.color.setHex(0xfff4e6); light.intensity = 4.0 * scale;
                rim.color.setHex(0x6fb5ff); rim.intensity = 2.0 * scale;
                break;
            case 'moonlight':
                hemi.color.setHex(0x7fa6e0); hemi.groundColor.setHex(0x283347); hemi.intensity = 0.95 * scale;
                light.color.setHex(0x9ec5ff); light.intensity = 2.4 * scale;
                rim.color.setHex(0xd0e4ff); rim.intensity = 1.8 * scale;
                break;
            case 'backlit':
                hemi.color.setHex(0xdbe8f8); hemi.groundColor.setHex(0x455063); hemi.intensity = 1.1 * scale;
                light.color.setHex(0xfff0db); light.intensity = 3.6 * scale;
                rim.color.setHex(0x9ccaff); rim.intensity = 2.2 * scale;
                break;
            case 'studio':
            default:
                hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x697386); hemi.intensity = 1.55 * scale;
                light.color.setHex(0xffffff); light.intensity = 3.0 * scale;
                rim.color.setHex(0xb5dbff); rim.intensity = 1.4 * scale;
                break;
        }
    };
    const camera = new THREE.PerspectiveCamera(45, aspect, .05, 500);
    const geometries = new Map<string, THREE.BufferGeometry>();
    const material = new THREE.MeshStandardMaterial({ color: BLOCKOUT_PALETTE.material, roughness: .72, metalness: .025 });
    const actorMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const subjectMaterial = (id: string, sourceColor?: string) => {
        const color = sourceColor || subjectColor(id);
        if (!actorMaterials.has(color)) actorMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .04 }));
        return actorMaterials.get(color)!;
    };
    const jointMaterial = new THREE.MeshBasicMaterial({ color: BLOCKOUT_PALETTE.joint });
    const jointGeometry = new THREE.SphereGeometry(1, 12, 8);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: BLOCKOUT_PALETTE.ground, roughness: .76, metalness: .02 });
    // Renderer-owned, world-space white/ice-blue tile studio grid on upward environment faces.
    for (const surfaceMaterial of [material, groundMaterial]) {
        surfaceMaterial.userData.physicalGrid = true;
        surfaceMaterial.onBeforeCompile = shader => {
            shader.vertexShader = 'varying vec3 studioWorld; varying vec3 studioNormal;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
                studioWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                studioNormal = normalize(mat3(modelMatrix) * normal);`);
            shader.fragmentShader = 'varying vec3 studioWorld; varying vec3 studioNormal;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
                float tile = mod(floor(studioWorld.x) + floor(studioWorld.z), 2.0);
                vec3 tileColor = mix(vec3(0.955, 0.975, 1.0), vec3(0.40, 0.65, 0.90), tile);
                vec2 p = studioWorld.xz * 5.0;
                vec2 edge = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(0.0001));
                float line = 1.0 - min(1.0, min(edge.x, edge.y));
                float fade = 1.0 - smoothstep(8.0, 24.0, distance(studioWorld.xz, cameraPosition.xz));
                float top = smoothstep(0.7, 0.95, studioNormal.y);
                diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.92, 0.96, 1.0), tileColor, fade) * mix(1.0, 0.83, line * fade), top);`);
        };
        surfaceMaterial.customProgramCacheKey = () => 'clikb-studio-white-blue-grid-v1';
    }
    const edgeMaterial = new THREE.LineBasicMaterial({ color: BLOCKOUT_PALETTE.edge, transparent: true, opacity: .14 });
    const edges = new Map<string, THREE.EdgesGeometry>();
    const textMaterials = new Set<THREE.MeshBasicMaterial>();
    const disposeText = () => { textMaterials.forEach(value => { value.map?.dispose(); value.dispose(); }); textMaterials.clear(); };
    const roots = new Map<string, THREE.Group>();
    const parts = new Map<string, Map<string, THREE.Mesh>>();
    let signature = '';
    const geometry = (part: MotionPart) => {
        const key = JSON.stringify([part.shape, part.geometry]);
        if (geometries.has(key)) return geometries.get(key)!;
        const g = part.geometry;
        let result: THREE.BufferGeometry;
        switch (part.shape) {
            case 'anchor': result = new THREE.BufferGeometry(); break;
            case 'bone': result = new THREE.CylinderGeometry(.5, .5, 1, 12); break;
            case 'box': result = new THREE.BoxGeometry(1, 1, 1); break;
            case 'sphere': result = new THREE.SphereGeometry(.5, 12, 8); break;
            case 'cone': result = new THREE.ConeGeometry(.5, 1, 8); break;
            case 'capsule': result = new THREE.CapsuleGeometry(.25, .5, 4, 8); break;
            case 'extrude': {
                const outline = new THREE.Shape(g!.outline!.map(point => new THREE.Vector2(...point)));
                result = new THREE.ExtrudeGeometry(outline, { depth: g?.depth ?? .1, bevelEnabled: false, curveSegments: 4 });
                result.translate(0, 0, -(g?.depth ?? .1) / 2); break;
            }
            case 'tube': result = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(g!.path!.map(point => new THREE.Vector3(...point))), Math.min(96, g!.path!.length * 4), g?.radius ?? .05, 6, false); break;
            case 'text': result = new THREE.PlaneGeometry(1, 1); break;
            default: result = new THREE.CylinderGeometry(g?.radiusTop ?? .5, g?.radiusBottom ?? .5, 1, 8);
        }
        geometries.set(key, result); return result;
    };
    const node = (part: MotionPart, actor?: THREE.MeshStandardMaterial) => {
        let nodeMaterial: THREE.Material = part.surface === 'ground' ? groundMaterial : actor || material;
        if (part.shape === 'text') {
            const texture = new THREE.CanvasTexture(createMotionTextCanvas(part)); texture.colorSpace = THREE.SRGBColorSpace;
            const lettering = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
            textMaterials.add(lettering); nodeMaterial = lettering;
        }
        const mesh = new THREE.Mesh(geometry(part), nodeMaterial); mesh.name = part.id; mesh.matrixAutoUpdate = false;
        mesh.castShadow = part.surface !== 'ground' && part.id !== 'ground' && part.shape !== 'text';
        mesh.receiveShadow = part.shape !== 'text';
        if (part.shape === 'bone') {
            for (const sign of [-1, 1]) {
                const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                joint.userData.boneEnd = sign; mesh.add(joint);
            }
        } else if (part.shape !== 'anchor' && part.shape !== 'text') {
            const key = JSON.stringify([part.shape, part.geometry]);
            if (!edges.has(key)) edges.set(key, new THREE.EdgesGeometry(mesh.geometry, 30));
            mesh.add(new THREE.LineSegments(edges.get(key), edgeMaterial));
        }
        return mesh;
    };
    const isActor = (object: MotionPlan['objects'][number]) => object.role === 'actor' || !!object.attachment || !object.role && (
        !!object.parts?.some(part => /(^|_)(torso|head|muzzle|neck|foreleg|hindleg)(_|$)/i.test(part.id)) ||
        [object, ...(object.parts || [])].some(node => node.keys.some(key => (['position', 'rotation', 'scale'] as const)
            .some(field => key[field].some((n, axis) => n !== node.keys[0][field][axis])))));
    const configure = (frame: MotionPlan) => {
        const next = JSON.stringify(frame.objects.map(({ keys: _keys, parts: children, ...object }, i) => ({ ...object, actorMaterial: isActor(frame.objects[i]), parts: children?.map(({ keys: _track, ...part }) => part) })));
        if (next === signature) return;
        const wanted = new Set(frame.objects.map(object => object.id));
        // Keep stable root objects and untouched geometry through streamed commits.
        // Reparent attached roots before changing their parent's render subtree.
        const discardLetters = (root: THREE.Object3D) => root.traverse(child => {
            if (child instanceof THREE.Mesh) for (const value of Array.isArray(child.material) ? child.material : [child.material]) {
                if (textMaterials.has(value as THREE.MeshBasicMaterial)) { const text = value as THREE.MeshBasicMaterial; text.map?.dispose(); text.dispose(); textMaterials.delete(text); }
            }
        });
        for (const [id, root] of roots) if (!wanted.has(id)) {
            for (const childRoot of roots.values()) if (childRoot !== root && root.getObjectById(childRoot.id)) scene.add(childRoot);
            discardLetters(root); root.removeFromParent(); roots.delete(id); parts.delete(id);
        }
        for (const object of frame.objects) {
            let root = roots.get(object.id);
            if (!root) { root = new THREE.Group(); root.name = object.id; root.matrixAutoUpdate = false; roots.set(object.id, root); }
            const { keys: _track, parts: children, ...header } = object;
            const objectSignature = JSON.stringify({ ...header, actor: isActor(object), parts: children?.map(({ keys: _keys, ...part }) => part) });
            if (root.userData.renderSignature === objectSignature) continue;
            for (const childRoot of roots.values()) if (childRoot !== root && root.getObjectById(childRoot.id)) scene.add(childRoot);
            discardLetters(root); root.clear(); parts.delete(object.id);
            const actor = object.role !== 'prop' && isActor(object) ? subjectMaterial(object.id, object.subjectColor) : undefined;
            if (!children?.length) root.add(node(object, actor));
            else {
                const nodes = new Map(children.map(part => [part.id, node(part, actor)])); parts.set(object.id, nodes);
                for (const part of children) (part.parentId ? nodes.get(part.parentId)! : root).add(nodes.get(part.id)!);
            }
            root.userData.renderSignature = objectSignature;
        }
        for (const object of frame.objects) {
            const anchor = object.attachment;
            const parent = anchor ? (anchor.partId ? parts.get(anchor.objectId)?.get(anchor.partId) : roots.get(anchor.objectId)) : scene;
            if (!parent) throw new Error('The motion attachment anchor is missing.');
            parent.add(roots.get(object.id)!);
        }
        // A changed scene does not retain geometry/materials it no longer uses.
        const usedGeometry = new Set<string>();
        for (const object of frame.objects) for (const part of object.parts?.length ? object.parts : [object]) {
            usedGeometry.add(JSON.stringify([part.shape, part.geometry]));
        }
        for (const [key, value] of geometries) if (!usedGeometry.has(key)) { value.dispose(); geometries.delete(key); }
        for (const [key, value] of edges) if (!usedGeometry.has(key)) { value.dispose(); edges.delete(key); }
        const usedMaterials = new Set<THREE.Material>();
        roots.forEach(root => root.traverse(child => {
            if (child instanceof THREE.Mesh) for (const value of Array.isArray(child.material) ? child.material : [child.material]) usedMaterials.add(value);
        }));
        for (const [key, value] of actorMaterials) if (!usedMaterials.has(value)) { value.dispose(); actorMaterials.delete(key); }
        signature = next;
    };
    const fromRotation = new THREE.Quaternion(), toRotation = new THREE.Quaternion(), rotation = new THREE.Quaternion();
    const position = new THREE.Vector3(), scale = new THREE.Vector3(), euler = new THREE.Euler(), shift = new THREE.Matrix4();
    const lerp = (a: number[], b: number[], t: number) => a.map((n, i) => n + (b[i] - n) * t) as [number, number, number];
    const pose = (group: THREE.Object3D, part: MotionPart, time: number) => {
        let [a, b, t] = motionSegment(part.keys, time);
        if (part.interpolation === 'step') { b = a; t = 0; }
        if (part.shape === 'anchor' && group.parent?.userData.boneLength !== undefined) {
            const parent = group.parent;
            a = { t: time, position: [0, parent.userData.boneLength / (2 * parent.scale.y), 0],
                rotation: [0, 0, 0], scale: [1 / parent.scale.x, 1 / parent.scale.y, 1 / parent.scale.z] };
            b = a; t = 0;
        }
        if (a.span || b.span) { a = interpolateBoxSpan(a, b, t); b = a; t = 0; }
        position.set(...lerp(a.position, b.position, t)); scale.set(...lerp(a.scale, b.scale, t));
        if (part.rotationMode === 'quaternion') {
            fromRotation.setFromEuler(euler.set(...a.rotation)); toRotation.setFromEuler(euler.set(...b.rotation));
            rotation.slerpQuaternions(fromRotation, toRotation, t);
            group.quaternion.copy(rotation);
        } else {
            // Keep authored, unwrapped angles on the object as well as its matrix.
            // Converting back from a quaternion loses the recorded turn count.
            group.rotation.set(...lerp(a.rotation, b.rotation, t));
            rotation.copy(group.quaternion);
        }
        group.position.copy(position); group.scale.copy(scale);
        group.matrix.compose(position, rotation, scale);
        if (part.pivot) {
            // Explicit matrices preserve arbitrary scales, including articulated
            // nonuniformly scaled parents. Object3D.attach cannot handle those.
            const [x, y, z] = part.pivot;
            group.matrix.premultiply(shift.makeTranslation(x, y, z)).multiply(shift.makeTranslation(-x, -y, -z));
        }
        group.matrixWorldNeedsUpdate = true;
        if (part.shape === 'text') {
            const opacity = (a.opacity ?? 1) + ((b.opacity ?? 1) - (a.opacity ?? 1)) * t;
            group.visible = opacity > 0;
            const mesh = group instanceof THREE.Mesh ? group : group.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh | undefined;
            if (mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        }
        if (part.shape === 'bone' || part.shape === 'box' && a.span) {
            const radius = Math.max(scale.x, scale.z) * .68;
            const length = a.span ? Math.hypot(...a.span.end.map((n, i) => n - a.span!.start[i])) : scale.y;
            group.userData.boneLength = length;
            for (const child of group.children) if (child.userData.boneEnd) {
                child.position.set(0, child.userData.boneEnd * length / (2 * scale.y), 0);
                child.scale.set(radius / scale.x, radius / scale.y, radius / scale.z);
            }
        } else delete group.userData.boneLength;
    };
    const draw = (time: number, frame = plan, lighting?: SceneLightingRig) => {
        configure(frame); scene.background = new THREE.Color(BLOCKOUT_PALETTE.background);
        applyLighting(lighting || frame.lightingRig);
        for (const object of frame.objects) {
            pose(roots.get(object.id)!, object, time);
            for (const part of object.parts || []) pose(parts.get(object.id)!.get(part.id)!, part, time);
        }
        const [a, b, t] = motionSegment(frame.camera, time);
        camera.position.set(...lerp(a.position, b.position, t));
        const target = new THREE.Vector3(...lerp(a.target, b.target, t));
        const direction = target.clone().sub(camera.position).normalize();
        camera.up.set(...lerp(a.up || [0,1,0], b.up || [0,1,0], t));
        if (camera.up.lengthSq() < 1e-12) camera.up.set(...(a.up || [0,1,0]));
        camera.up.normalize();
        if (Math.abs(camera.up.dot(direction)) > .9999) {
            const axes = [new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)];
            axes.sort((x,y)=>Math.abs(x.dot(direction))-Math.abs(y.dot(direction)));
            camera.up.copy(axes[0]);
        }
        camera.lookAt(target);
        if (a.roll !== undefined || b.roll !== undefined) {
            const roll = (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * t;
            if (roll !== 0) camera.rotateZ(roll);
        }
        camera.fov = a.fov + (b.fov - a.fov) * t; camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
    };
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        roots.forEach(root => root.removeFromParent()); roots.clear(); parts.clear();
        disposeText();
        geometries.forEach(value => value.dispose()); geometries.clear(); material.dispose(); actorMaterials.forEach(value => value.dispose()); actorMaterials.clear(); groundMaterial.dispose(); jointGeometry.dispose(); jointMaterial.dispose(); edgeMaterial.dispose();
        edges.forEach(value => value.dispose()); edges.clear();
    };
    try { if (initialize) draw(0); }
    catch (error) { dispose(); throw error; }
    return { scene, camera, roots, parts, draw, dispose };
}
