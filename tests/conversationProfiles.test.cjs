const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./loadTs.cjs'),{
  resolveConversationProfile,
  isPaidConversationProfile,
  migrateSavedConversationTier,
  CONVERSATION_PROFILE_POLICY_VERSION,
}=load('server/src/conversationModels.ts');
const {ConciergeResponseSession}=load('server/src/ConciergeInference.ts');
const assetMocks=Object.fromEntries([...fs.readFileSync('src/conversationModels.ts','utf8').matchAll(/from "(\.\/assets\/[^"]+)"/g)].map(match=>[match[1],'portrait']));
const browser=load('src/conversationModels.ts',assetMocks);

test('four visible Concierge profiles preserve defaults, billing modes, Terra 6.1 and exact Responses API efforts',async()=>{
 const expected={
   luna_none:['gpt-6-luna','none','free'],
   luna:['gpt-6-luna','low','free'],
   luna_xhigh:['gpt-6-luna','medium','metered'],
   terra:['gpt-6.1-terra','low','metered'],
 };
 assert.deepEqual(browser.CONVERSATION_MODELS.map(item=>item.id),['luna_none','luna','luna_xhigh','terra']);
 for(const [tier,[model,effort,billingMode]] of Object.entries(expected)){
  const profile=resolveConversationProfile(tier),calls=[];
  const client={responses:{create:async request=>{calls.push(request);return {output_text:'Hello',output:[],usage:{input_tokens:1,output_tokens:1}};}},chat:{completions:{create:()=>{throw Error('Reasoning profile used Chat Completions');}}}};
  const stream=await new ConciergeResponseSession().start(client,{profile,messages:[{role:'user',content:'Hello'}],tools:[],bypassOpenAi:false,maxCompletionTokens:300});for await(const _chunk of stream){}
  assert.equal(calls.length,1);assert.equal(calls[0].model,model);assert.deepEqual(calls[0].reasoning,{effort});
  assert.equal(profile.billingMode,billingMode);
  assert.equal(isPaidConversationProfile(tier),billingMode==='metered');
  assert.equal(browser.isPaidConversationTier(tier),billingMode==='metered');
  const visible=browser.CONVERSATION_MODELS.find(item=>item.id===tier);
  assert.equal(visible.reasoningEffort,effort);
  assert.equal(visible.billingMode,billingMode);
  assert.equal(browser.isOpenAiConversationProfile(tier),true);
 }
 assert.equal(browser.DEFAULT_CONVERSATION_MODEL,'luna');
 assert.equal(resolveConversationProfile().reasoningEffort,'low');
 assert.equal(resolveConversationProfile().billingMode,'free');
 assert.equal(resolveConversationProfile('terra').tier,'terra');
 assert.equal(resolveConversationProfile('terra').model,'gpt-6.1-terra');
 assert.equal(resolveConversationProfile('terra').reasoningEffort,'low');
 assert.equal(resolveConversationProfile('unknown'),null);
 // Unversioned or retired preferences migrate safely to free 'luna'
 assert.equal(migrateSavedConversationTier('terra',undefined),'luna');
 assert.equal(migrateSavedConversationTier('terra',CONVERSATION_PROFILE_POLICY_VERSION),'terra');
 assert.equal(migrateSavedConversationTier('deepseek',CONVERSATION_PROFILE_POLICY_VERSION),'luna');
 assert.equal(browser.migrateSavedConversationModel('sol_low',undefined),'luna');
 assert.equal(browser.migrateSavedConversationModel('sol_low',browser.CONVERSATION_PROFILE_POLICY_VERSION),'luna');
});
