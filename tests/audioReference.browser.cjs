const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function wav(seconds) {
  const rate=8000, bytes=seconds*rate*2, out=Buffer.alloc(44+bytes);
  out.write('RIFF',0); out.writeUInt32LE(36+bytes,4); out.write('WAVEfmt ',8);
  out.writeUInt32LE(16,16); out.writeUInt16LE(1,20); out.writeUInt16LE(1,22);
  out.writeUInt32LE(rate,24); out.writeUInt32LE(rate*2,28);
  out.writeUInt16LE(2,32); out.writeUInt16LE(16,34); out.write('data',36);
  out.writeUInt32LE(bytes,40); return out;
}
(async () => {
  const {createServer}=await import('vite');
  const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve('.tmp/concierge-browser-deps/node_modules/playwright'));
  const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},plugins:[{
    name:'audio-fixture',configureServer(server) {
      for (const [url,file] of [['/__audio','audioReference.browser.tsx'],['/__studio','spatialStudio.responsive.tsx']]) {
        server.middlewares.use(url,(req,res)=>{
          res.setHeader('Content-Type','text/html');
          res.end('<div id="root"></div><script type="module" src="/tests/'+file+'"></script>');
        });
      }
    }
  }],server:{host:'127.0.0.1',port:5213,strictPort:true}});
  await server.listen();
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('UI error:',error.message);});
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5213/') ? route.continue() : route.request().url()==='https://assets.test/original.mp3' ? route.fulfill({status:200,contentType:'audio/wav',body:wav(10)}) : route.abort());
    const upload = async () => {
      await page.getByLabel('Upload audio reference').setInputFiles({name:'leaper.wav',mimeType:'audio/wav',buffer:wav(10)});
      await page.waitForFunction(()=>document.querySelector('audio')?.duration===10);
    };
    await page.goto('http://127.0.0.1:5213/__audio',{waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('button',{name:'Lipsync A'}).click(); await upload();
    const rail=page.locator('.MuiSlider-root');await rail.waitFor(); const box=await rail.boundingBox();
    await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:8});await page.mouse.up();
    await page.getByRole('button',{name:'Use audio',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.audioReferences).A);
    const trim=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.trim));
    assert.ok(trim.start>1,'trim window did not move');assert.ok(Math.abs(trim.end-trim.start-5)<.001);
    const refs=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.audioReferences));
    assert.equal(refs.A.duration,5);assert.equal(refs.B,undefined);
    const calls=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.audioCalls));
    assert.ok(calls.some(call=>call.endsWith('/create-lipsync-trimaudio')));
    assert.ok(!calls.some(call=>/gpt|savemusic|transcrib/i.test(call)));
    const cleanup=await page.evaluate(()=>JSON.parse(localStorage.getItem('helperaudiosprompt')));
    assert.equal(cleanup.length,2);
    await page.getByRole('button',{name:'Lipsync A'}).click();
    await page.waitForFunction(()=>document.querySelector('audio')?.duration===10);
    await page.getByRole('button',{name:'Use audio',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[role="dialog"]')===null);
    const reopenedTrim=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.trim));
    assert.ok(Math.abs(reopenedTrim.start-trim.start)<.002,'reopening changed the selected audio section');
    await page.getByRole('button',{name:'Lipsync A'}).click();
    await page.getByRole('button',{name:'Remove audio'}).click();
    await page.waitForFunction(()=>!JSON.parse(document.documentElement.dataset.audioReferences).A);
    console.log('7 normal audio reference browser checks passed');

    await page.evaluate(()=>localStorage.setItem('helperaudiosprompt',JSON.stringify([{url:'https://assets.test/unrelated.mp3',timestamp:0}])));
    await page.goto('http://127.0.0.1:5213/__studio?w=390&h=844&ready=1&audioRef=1&light=1',{waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('button',{name:'Lipsync',exact:true}).click();await upload();
    await page.getByRole('button',{name:'Use audio',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene || '{}').ledger?.actionAudioReferences?.root);
    const saved=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.savedScene));
    assert.equal(saved.ledger.actionAudioReferences.root.url,'https://assets.test/action.mp3');
    assert.equal(saved.ledger.actionAudioReferences.root.duration,5);
    assert.equal(saved.ledger.actionAudioReferences.root.sourceUrl,'https://assets.test/original.mp3');
    await page.getByRole('button',{name:'Using Audio',exact:true}).waitFor();
    const protectedCleanup=await page.evaluate(()=>JSON.parse(localStorage.getItem('helperaudiosprompt')));
    assert.deepEqual(protectedCleanup.map(item=>item.url),['https://assets.test/unrelated.mp3']);
    await page.getByRole('button',{name:'Using Audio',exact:true}).click();
    await page.getByRole('button',{name:'Remove audio'}).click();
    await page.waitForFunction(()=>!JSON.parse(document.documentElement.dataset.savedScene).ledger.actionAudioReferences.root);
    console.log('3 action draft audio save, protection and removal checks passed');

    await page.goto('http://127.0.0.1:5213/__studio?w=390&h=844&ready=1&audioRef=1&imageMode=1&light=1',{waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('button',{name:'Cancel action',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/^(Lipsync|Using Audio)$/}).count(),0);
    assert.equal(await page.getByLabel('Upload audio reference').count(),0);
    console.log('Image mode hides audio reference controls');
    assert.deepEqual(errors,[]);fs.mkdirSync('.tmp/audio-reference-browser',{recursive:true});
    await page.screenshot({path:'.tmp/audio-reference-browser/complete.png'});
    fs.writeFileSync('.tmp/audio-reference-browser/report.json',JSON.stringify({passed:11,errors,trim,reopenedTrim,calls,protectedCleanup},null,2));
    console.log('11 audio reference browser checks passed');
  } finally { if(browser) await browser.close();await server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
