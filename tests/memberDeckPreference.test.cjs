const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');

test('Deck preference uses the authenticated member and survives independent reads', async () => {
 const members = new Map([[7,1],[8,1]]), queries=[];
 const api=load('server/src/AppDeckRoutes.ts',{
  './requestAuth':{authenticatedUserId:req=>req.authenticatedUserId||null},
  './execQuery':async(sql,values)=>{queries.push({sql,values});if(sql.startsWith('UPDATE')){members.set(Number(values[1]),values[0]);return{};}return[{deck_enabled:members.get(values[0])}];},
 });
 const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 let res=response();await api.saveMemberDeckEnabled({authenticatedUserId:'7',body:{enabled:false,userId:8}},res);
 assert.equal(res.code,200);assert.equal(await api.readMemberDeckEnabled(7),false);assert.equal(await api.readMemberDeckEnabled(8),true);
 assert.deepEqual(queries[0].values,[0,'7']);
 res=response();await api.saveMemberDeckEnabled({body:{enabled:true,userId:7}},res);assert.equal(res.code,401);
 res=response();await api.saveMemberDeckEnabled({authenticatedUserId:'7',body:{enabled:'false'}},res);assert.equal(res.code,400);
 res=response();await api.saveMemberDeckEnabled({authenticatedUserId:'7',body:{enabled:true}},res);assert.equal(await api.readMemberDeckEnabled(7),true);
});

test('Missing additive column cannot break login; other database errors are not hidden',async()=>{
 let code='ER_BAD_FIELD_ERROR';
 const api=load('server/src/AppDeckRoutes.ts',{'./requestAuth':{authenticatedUserId:()=>null},'./execQuery':async()=>{throw Object.assign(new Error('fixture'),{code});}});
 assert.equal(await api.readMemberDeckEnabled(7),true);
 code='ECONNREFUSED';await assert.rejects(api.readMemberDeckEnabled(7));
});

test('All Feeds startup follows the exact view and saved Deck setting',()=>{
 const {shouldOpenAllFeedsComposer:open}=load('src/allFeedsLanding.ts');
 for(const deck of [true,false]){
  for(const pathname of ['/', '/feeds','/Feeds'])assert.equal(open({pathname,search:'',state:null},deck),true);
  assert.equal(open({pathname:'/feeds',search:'?deck=5',state:{clikbDeck:{tier:'deck'}}},deck),true);
  assert.equal(open({pathname:'/feeds',search:'',state:{clikbDeckGrid:{sessionId:'grid'}}},deck),!deck);
  for(const search of ['?story=5','?post=5','?before=5'])assert.equal(open({pathname:'/feeds',search,state:null},deck),false);
  assert.equal(open({pathname:'/feeds',search:'',state:{fullscreen:true}},deck),false);
  assert.equal(open({pathname:'/feeds',search:'',state:{clikbDeck:{tier:'story'}}},deck),false);
  for(const pathname of ['/images','/kickit','/clikit','/pages','/search','/settings','/experience/5'])assert.equal(open({pathname,search:'',state:null},deck),false);
 }
});
