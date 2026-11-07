const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..'),baseline=process.env.CLIKB_FOCUS_BASELINE==='1';
const source=baseline?execFileSync('git',['show','696df9c:src/PromptInput.tsx'],{encoding:'utf8'}):fs.readFileSync('src/PromptInput.tsx','utf8');
const opening=source.slice(source.indexOf('<Modal',source.indexOf('{/* Reference Editor Popup */}'))).match(/^<Modal[\s\S]*?\n        >/)[0];
const fixture=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {Modal,Box} from '@mui/material';
function App(){const [editingRefIdx,setIndex]=useState(null),[guideEnabled,setGuide]=useState(true);const closeReferenceEditor=()=>setIndex(null);window.focusTest={open:()=>setIndex(0),guide:setGuide};
return <><button id='open' onClick={()=>setIndex(0)}>Open reference</button><textarea aria-label='Message to Guide' style={{position:'fixed',bottom:20,left:20,zIndex:1000001}}/>
${opening}<Box tabIndex={-1} sx={{position:'absolute',top:'20%',left:'20%',p:3,bgcolor:'white'}}><input aria-label='Reference prompt' defaultValue='Realistic Alice'/></Box></Modal></>;}
createRoot(document.getElementById('root')).render(<App/>);`;
(async()=>{const built=await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const html='<div id="root"></div><script>'+built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1200,390,320]){const page=await browser.newPage({viewport:{width,height:850}});await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());await page.goto('http://fixture.test/focus');await page.locator('#open').click();const guide=page.getByRole('textbox',{name:'Message to Guide',includeHidden:true});await guide.click();await page.keyboard.type('Hello Guide');
if(baseline){assert.equal(await guide.inputValue(),'');console.log('REPRODUCED reference Modal redirects Guide typing',width);}
else{assert.equal(await guide.inputValue(),'Hello Guide');await guide.evaluate(el=>el.setSelectionRange(6,11));await page.keyboard.type('Alice');assert.equal(await guide.inputValue(),'Hello Alice');await guide.evaluate(el=>el.setRangeText(' pasted',el.selectionStart,el.selectionEnd,'end'));assert.equal(await guide.inputValue(),'Hello Alice pasted');assert.equal(await page.getByRole('textbox',{name:'Reference prompt'}).inputValue(),'Realistic Alice');await page.getByRole('textbox',{name:'Reference prompt'}).press('Escape');await page.waitForFunction(()=>!document.querySelector('[role="presentation"]'));console.log('PASS reference Modal source policy: Guide typing, selection, paste, unchanged reference, Escape',width);}
await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
