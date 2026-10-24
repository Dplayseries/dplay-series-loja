const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('streaming.html','utf8').split('<script>')[1].split('</script>')[0];
class Element{
 constructor(){this.hidden=false;this.disabled=false;this.children=[];this.listeners={};this.textContent='';this.href='';}
 replaceChildren(...children){this.children=children;}
 append(child){this.children.push(child);}
 addEventListener(name,callback){this.listeners[name]=callback;}
 scrollIntoView(){}
}
async function scenario(order,library,{receipt=true,saved=[]}={}){
 const ids=new Map();
 const element=id=>{if(!ids.has(id)){const node=new Element();node.hidden=['retry','save','telegram'].includes(id);ids.set(id,node);}return ids.get(id);};
 const calls=[];
 const location={href:'https://dplayseries.github.io/dplay-series-loja/streaming.html'+(receipt?'#pedido=22222222-2222-4222-8222-222222222222&resgate=receipt-secret-for-tests':''),hash:receipt?'#pedido=22222222-2222-4222-8222-222222222222&resgate=receipt-secret-for-tests':'',assign(){}};
 const storage=new Map([['dplay_receipts_v1',JSON.stringify(saved)]]);
 const context={
  URL,URLSearchParams,AbortController,Promise,Date,console,location,
  setTimeout:()=>1,clearTimeout:()=>{},
  navigator:{clipboard:{writeText:async()=>{}}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  window:{},
  document:{getElementById:element,createElement:()=>new Element(),head:{append(){}}},
  fetch:async(url)=>{
   calls.push(url);
   if(url.includes('/publico/pedido/status')){if(order===null)throw new Error('offline');return {ok:true,json:async()=>order};}
   if(url.endsWith('/streaming/compra'))return {ok:true,json:async()=>library};
   throw new Error('unexpected fetch: '+url);
  }
 };
 vm.runInNewContext(code,context,{filename:'streaming.html'});
 for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve));
 return {element,calls,storage};
}
(async()=>{
 const pending=await scenario({status:'pendente'},null);
 assert.match(pending.element('status').textContent,/Aguardando a confirmação do Pix/);
 assert.equal(pending.element('retry').hidden,false);
 assert.equal(pending.calls.filter(x=>x.endsWith('/streaming/compra')).length,0);
 const waiting=await scenario({status:'aprovado',rota_entrega:'aguardando_nuvem'},null);
 assert.match(waiting.element('status').textContent,/temporariamente indisponível/);
 assert.equal(waiting.element('telegram').hidden,true);
 assert.equal(waiting.calls.filter(x=>x.endsWith('/streaming/compra')).length,0);
 const cloud=await scenario({status:'aprovado',rota_entrega:'nuvem'}, {titulo:'Série Teste',episodios:[{chave:'e1',titulo:'Episódio 1'}]});
 assert.equal(cloud.element('title').textContent,'Série Teste');
 assert.equal(cloud.element('episodes').children.length,1);
 assert.equal(cloud.element('telegram').hidden,true);
 const telegram=await scenario({status:'aprovado',rota_entrega:'telegram',resgate_url:'https://t.me/DPlayEpisodiosBot?start=r_test',nuvem_url:null},null);
 assert.equal(telegram.element('telegram').hidden,false);
 assert.equal(telegram.element('episodes').children.length,0);
 const offline=await scenario(null,null);
 assert.match(offline.element('status').textContent,/Não conseguimos consultar/);
 assert.equal(offline.element('retry').hidden,false);
 const saved=await scenario(null,null,{receipt:false,saved:[{pedido_id:'saved',resgate:'secret',titulo:'Compra salva'}]});
 assert.equal(saved.element('purchases').children.length,1);
 assert.equal(saved.calls.length,0);
 console.log('6 cenários de compra e acesso passaram, sem cobrar nem liberar conteúdo real.');
})().catch(error=>{console.error(error);process.exitCode=1;});
