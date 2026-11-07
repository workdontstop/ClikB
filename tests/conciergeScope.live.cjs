const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// One explicitly opted-in Sol/xhigh call, no retries, tools, media or mutations.
// This checks conversational interpretation, not live browser/RAG integration.
(async()=>{
 if(process.env.CLIKB_RUN_LIVE_CONCIERGE!=='1'){console.log('SKIP live scope smoke: opt-in required');return;}
 require('../server/node_modules/dotenv').config({path:path.resolve('server/.env')});
 if(!process.env.DALLE_KEY){console.log('SKIP live scope smoke: backend OpenAI credential unavailable');return;}
 const OpenAI=require('../server/node_modules/openai');
 const {CONCIERGE_RESPONSE_POLICY}=require('./loadTs.cjs')('server/src/conciergeResponsePolicy.ts');
 const started=Date.now(),client=new OpenAI({apiKey:process.env.DALLE_KEY,maxRetries:0,timeout:120000});
 let receipt={calls:1,model:'gpt-6.1-sol',reasoningEffort:'xhigh',maxOutputTokens:2048,tools:0,mediaGenerations:0,browserMutations:0};
 try{
  const response=await client.responses.create({model:'gpt-6.1-sol',reasoning:{effort:'xhigh'},max_output_tokens:2048,store:false,input:[
   {role:'system',content:CONCIERGE_RESPONSE_POLICY+' This is a read-only response-policy evaluation with controlled current-state evidence. No app actions have been performed by this call. Answer the user in at most two short natural sentences. Current facts outrank older failed attempts.'},
   {role:'user',content:'Earlier I asked to fix Alice’s character reference to look realistic. You failed to open its editor, so I manually fixed and regenerated it. Alice’s reference now has matching committed/rendered prompt revision realistic-v2 and a new image. The scene prompt still says silhouettes against the sunset, which I approve, and the scene images are already complete. My retained task is to continue to the visible Publish stage for my review, stopping before publication. Tell me what you will keep and what you will do next when I say Continue.'},
  ]});
  const usage=response.usage||{},input=usage.input_tokens||0,cached=usage.input_tokens_details?.cached_tokens||0,output=usage.output_tokens||0;
  const text=String(response.output_text||'');receipt={...receipt,status:response.status,latencyMs:Date.now()-started,inputTokens:input,cachedInputTokens:cached,outputTokens:output,reasoningTokens:usage.output_tokens_details?.reasoning_tokens||0,
   estimatedCostUsd:((input-cached)*2+cached*.1+output*10)/1e6,costBasis:'Provider-reported tokens at repository Sol rates ($2 input/$0.10 cached/$10 output per million); estimate, not invoice',text};
  assert.equal(response.status,'completed');assert.ok(text.trim());assert.match(text,/publish/i);assert.match(text,/keep|leave|preserv|retain/i);assert.doesNotMatch(text,/Jev|virtualGate|stateVersion|second brain/i);
  receipt.passed=true;
 }catch(error){receipt={...receipt,passed:false,latencyMs:Date.now()-started,errorCode:error.code||error.status||error.name};process.exitCode=1;}
 fs.mkdirSync('.tmp/concierge-execution',{recursive:true});fs.writeFileSync('.tmp/concierge-execution/live-scope-receipt.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt,null,2));
})().catch(error=>{console.error(error.name,error.code||'');process.exitCode=1;});
