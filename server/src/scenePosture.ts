export type BipedPosture = 'standing' | 'kneeling' | 'seated';

/** Shared by recipe construction and timed state authoring. */
export function bipedPosture(posture: BipedPosture) {
    if (!['standing', 'kneeling', 'seated'].includes(posture)) throw new Error('Unsupported posture; use explicit local poses for custom anatomy.');
    const rotations: Record<string, number> = posture === 'standing'
        ? { left_hip: 0, right_hip: 0, left_knee: 0, right_knee: 0, left_ankle: 0, right_ankle: 0 }
        : posture === 'kneeling'
            ? { left_hip: 0, right_hip: 0, left_knee: Math.PI / 2, right_knee: Math.PI / 2, left_ankle: -Math.PI / 2, right_ankle: -Math.PI / 2 }
            : { left_hip: -Math.PI / 2, right_hip: -Math.PI / 2, left_knee: Math.PI / 2, right_knee: Math.PI / 2, left_ankle: 0, right_ankle: 0 };
    return { pelvisHeight: posture === 'standing' ? .91 : .48, rotations };
}
