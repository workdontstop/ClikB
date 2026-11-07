type Point = { x: number; y: number; z: number };
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";

/** Validate Terra's declared bounded 3D plan. This does not verify generated video pixels. */
export function validateSpatialPlan(value: unknown, input: { x: number; y: number } | undefined, pov: boolean): void {
  if (!record(value) || value.cameraMode !== (pov ? "pov-translation" : "fixed")) {
    throw new Error("Movement plan must preserve the established camera mode");
  }
  if (value.unitStaysInside !== true || value.preservesControlState !== true || value.inventsEnvironment !== false) {
    throw new Error("Movement must preserve control state and remain inside the existing scene");
  }
  if (!Array.isArray(value.path) || value.path.length < 2 || value.path.length > 12) {
    throw new Error("Movement plan needs 2 to 12 bounded 3D waypoints");
  }
  const path = value.path.map((p): Point => {
    if (!record(p) || ![p.x, p.y, p.z].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) {
      throw new Error("Movement waypoint leaves the scene bounds");
    }
    return p as Point;
  });
  if (input) {
    const dx = path[path.length - 1].x - path[0].x;
    const dz = path[path.length - 1].z - path[0].z;
    if (Math.abs(input.x) >= 0.18 && dx * input.x < -0.0001
      || Math.abs(input.y) >= 0.18 && dz * input.y < -0.0001) {
      throw new Error("Movement endpoint contradicts the joystick direction");
    }
    if (Math.hypot(dx, dz) < 0.001 && value.boundaryLimited !== true) {
      throw new Error("A stationary plan needs an explicit boundary limit");
    }
  }
}
