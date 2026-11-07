import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { JoystickDriveSample } from "./VirtualJoystickDrive";

import type { SpatialCapturedTrail } from "../spatialStageModel";

interface ThreeSpatialOverlayProps {
    onTrail?: (trail: SpatialCapturedTrail) => void;
    active: boolean;
    drive: JoystickDriveSample;
}

const ThreeSpatialOverlay: React.FC<ThreeSpatialOverlayProps> = ({ active, drive, onTrail }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const driveRef = useRef(drive);
    const onTrailRef = useRef(onTrail);
    onTrailRef.current = onTrail;

    useEffect(() => {
        driveRef.current = drive;
    }, [drive]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host || !active) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 3.4, 6.8);
        camera.lookAt(0, 0, -1.5);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        host.appendChild(renderer.domElement);

        const grid = new THREE.GridHelper(16, 16, 0x8edbff, 0x4d7890);
        grid.position.y = -1.25;
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.28;
        scene.add(grid);

        const rig = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.52, 4),
            new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.92 })
        );
        body.rotation.x = -Math.PI / 2;
        rig.add(body);

        const direction = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 1.1, 0x78d7ff, 0.28, 0.16);
        rig.add(direction);
        scene.add(rig);

        const pathPoints: THREE.Vector3[] = [new THREE.Vector3(0, -1.18, 0)];
        const pathGeometry = new THREE.BufferGeometry();
        const pathPositions = new THREE.Float32BufferAttribute(new Float32Array(160 * 3), 3);
        pathGeometry.setAttribute("position", pathPositions);
        const updatePath = () => {pathPoints.forEach((point,i)=>pathPositions.setXYZ(i,point.x,point.y,point.z));pathPositions.needsUpdate=true;pathGeometry.setDrawRange(0,pathPoints.length);pathGeometry.computeBoundingSphere();};
        updatePath();
        const pathMaterial = new THREE.LineBasicMaterial({ color: 0x8edbff, transparent: true, opacity: 0.86 });
        const path = new THREE.Line(pathGeometry, pathMaterial);
        scene.add(path);

        const resize = () => {
            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        let lastFrameTime = performance.now();
        let animationFrame = 0;
        let pathAccumulator = 0;
        let wasDriving = false;

        const resetDraftPreview = () => {
            rig.position.set(0, 0, 0);
            rig.rotation.set(0, 0, 0);
            pathAccumulator = 0;
            pathPoints.splice(0, pathPoints.length, new THREE.Vector3(0, -1.18, 0));
            updatePath();
        };

        const render = () => {
            const now = performance.now();
            const delta = Math.min((now-lastFrameTime)/1000,0.05); lastFrameTime=now;
            const sample = driveRef.current;

            // Every press is a replacement preview until CREATE confirms it.
            // This prevents separate, unconfirmed drags accumulating visually.
            if (sample.active && !wasDriving) resetDraftPreview();
            wasDriving = sample.active;

            const speed = sample.active ? sample.radius * 1.65 : 0;
            rig.position.x += sample.x * speed * delta;
            rig.position.z -= sample.y * speed * delta;
            rig.rotation.y = THREE.MathUtils.lerp(rig.rotation.y, -sample.x * 0.55, 0.12);

            if (sample.active && speed > 0.03) {
                pathAccumulator += delta;
                if (pathAccumulator >= 0.08) {
                    pathAccumulator = 0;
                    pathPoints.push(new THREE.Vector3(rig.position.x, -1.18, rig.position.z));
                    if (pathPoints.length > 160) pathPoints.shift();
                    updatePath();
                }
            }

            renderer.render(scene, camera);
            if (sample.active) {
                // Capture the rendered line itself, never the elevated compass marker.
                onTrailRef.current?.({ width: host.clientWidth, height: host.clientHeight,
                    points: pathPoints.map(point => {
                        const projected = point.clone().project(camera);
                        return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
                    })
                });
            }
            animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrame);
            observer.disconnect();
            pathGeometry.dispose();
            pathMaterial.dispose();
            body.geometry.dispose();
            (body.material as THREE.Material).dispose();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [active]);

    return (
        <div
            ref={hostRef}
            aria-hidden="true"
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 24,
                pointerEvents: "none",
                opacity: active ? 1 : 0,
                transition: "opacity 180ms ease",
                background: "linear-gradient(to top, rgba(2,12,18,0.30), transparent 48%)",
            }}
        />
    );
};

export default ThreeSpatialOverlay;
