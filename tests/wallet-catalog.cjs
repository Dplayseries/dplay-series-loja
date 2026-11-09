const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const id='5911a47b-9b24-4143-8ecb-a51fb3b4ad4e';
async function scenario(available){
 const elements=new Map(),calls=[];
 const element=key=>{if(!elements.has(key))elements.set(key,{hidden:false,textContent:'',addEventListener(){},setAttribute(){},append(){}});return elements.get(key)};
 vm.runInNewContext(fs.readFileSync('wallet.js','utf8'),{
  URLSearchParams,AbortController,console,location:{search:'?serie='+id},
  setTimeout:()=>1,clearTimeout(){},localStorage:{getItem(){return null}},
  document:{getElementById:element,createElement:()=>element(Symbol())},
  fetch:async(url,options)=>{
   assert.equal(options.method,undefined,'Opening an old link must not create a payment or spend credits');
   calls.push(url);
   if(url.endsWith('/carteira/pacotes'))return {ok:true,json:async()=>({pacotes:[]})};
   assert.ok(url.endsWith('/catalogo/series/'+id));
   return {ok:available,json:async()=>available?{id,titulo:'Existing active series'}:{detail:'Nao encontrada'}};
  }
 });
 for(let i=0;i<8;i++)await new Promise(setImmediate);
 return {element,calls};
}
(async()=>{
 const active=await scenario(true);
 assert.equal(active.element('selected-title').textContent,'Existing active series');
 assert.equal(active.calls.length,2);
 const missing=await scenario(false);
 assert.equal(missing.element('spend').hidden,true);
 assert.match(missing.element('selected-title').textContent,/Não foi possível conferir/);
 console.log('Wallet links preserve active IDs and fail closed, without payments.');
})().catch(error=>{console.error(error);process.exitCode=1});
