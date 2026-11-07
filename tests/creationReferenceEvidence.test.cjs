const test=require('node:test'),assert=require('node:assert/strict');
const {referenceEditEvidence:evidence,generatedReferenceProvenance:generated,upscaledReferenceProvenance:upscaled}=require('./loadTs.cjs')('src/creationReferenceEvidence.ts');
test('retained prompts and historical media carry no inferred render provenance',()=>{
 const alice={clientReferenceId:'alice-id',prompt:'Realistic Alice',imageUrl:'old-image'};
 assert.equal(evidence(alice).renderedPromptRevision,null);
 assert.equal(evidence(alice,'Updated Alice').renderedPromptRevision,null);
 assert.equal(evidence({...alice,imageUrl:'new-image'}).renderedPromptRevision,null);
});
test('known render provenance survives prompt edits, but cannot follow an unrelated media replacement',()=>{
 const alice={clientReferenceId:'alice-id',prompt:'Realistic Alice',imageUrl:'old-image',renderProvenance:generated('old-image','Realistic Alice')};
 const rendered=evidence(alice),draft=evidence(alice,'Updated Alice');
 assert.equal(rendered.promptRevision,rendered.renderedPromptRevision);
 assert.equal(draft.draftOnly,true);assert.notEqual(draft.promptRevision,draft.renderedPromptRevision);
 assert.notEqual(evidence({...alice,prompt:'Updated Alice'}).promptRevision,rendered.renderedPromptRevision);
 assert.equal(evidence({...alice,imageUrl:'unrelated-image'}).renderedPromptRevision,null);
 const next={...alice,imageUrl:'upscaled-image',renderProvenance:upscaled(alice,'upscaled-image')};
 assert.equal(evidence(next).renderedPromptRevision,rendered.renderedPromptRevision);
 assert.notEqual(evidence(next).mediaRevision,rendered.mediaRevision);
 assert.equal(upscaled({...alice,renderProvenance:null},'upscaled-image'),null);
 assert.equal(draft.referenceId,'alice-id');assert.equal(draft.field,'reference_appearance');
});
