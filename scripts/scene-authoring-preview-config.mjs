/** Serve the actual SpatialStudio with an isolated presentation adapter. */
export const sceneAuthoringPreviewPlugin={
    name:'clikb-scene-authoring-preview',
    enforce:'pre',
    load(id){
        if(!id.replaceAll('\\','/').endsWith('/src/motionGuideRenderer.ts'))return;
        return `export {motionRecordingMime,verifyMotionRecording,recordMotionGuide} from '/src/motionGuideRenderer.ts?original';
            export {createNativePreviewRenderer as createMotionRenderer} from '/src/prototypes/nativeScenePreviewRenderer.ts';`;
    }
};
