import type {MotionPlan} from '../motionGuide';
import {createAuthoringDraft} from '../../server/src/sceneAuthoringPrototype';
import {createPrototypeStudio} from './sceneAuthoringStudio';

/** Vite fixture substitution only. Production continues importing its own renderer. */
export function createNativePreviewRenderer(canvas:HTMLCanvasElement,plan:MotionPlan,width:number,height:number){
    const studio=createPrototypeStudio(canvas,createAuthoringDraft(plan,'native-ui-preview'),width,height,false);
    return{draw:studio.drawLegacy,dispose:studio.dispose};
}
