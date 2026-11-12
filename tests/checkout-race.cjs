const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('async function gerarPix(){');
const end=html.indexOf("btnPix.addEventListener('click',gerarPix);",start);
async function scenario(phase,change){
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,value:'',textContent:'',href:''});return elements.get(id);};
 let resolveResponse;
 const pending=new Promise(resolve=>resolveResponse=resolve);
 const saved=[],calls=[];
 const context={
  serieSelecionada:{id:'A',titulo:'Serie A'},vipSelecionado:false,pollGeneration:1,
  modal:{hidden:false},btnPix:{disabled:false},tentarPix:{},confirmar:{},pix:{},statusEl:{},
  acompanharLink:{},copiarAcesso:{},pedidoAtual:null,API:'https://example.test',
  document:{getElementById:el},window:{},
  guardarPedido:(order,title)=>saved.push({order,title}),linkDoPedido:o=>'receipt:'+o.pedido_id,
  acompanharPedido(){},
  fetch:async(url)=>{
   calls.push(url);
   if((phase==='order'&&url.endsWith('/pedido'))||(phase==='pix'&&url.endsWith('/pix')))await pending;
   return {ok:true,json:async()=>url.endsWith('/pedido')?{pedido_id:'order-A',resgate:'test-only'}:{pix_copia_cola:'PIX-A'}};
  }
 };
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const task=context.gerarPix();
 for(let n=0;n<5;n++)await Promise.resolve();
 if(change==='switch'){context.serieSelecionada={id:'B',titulo:'Serie B'};context.pollGeneration++;}
 if(change==='reopen'){context.pollGeneration++;}
 if(change==='close')context.modal.hidden=true;
 resolveResponse();await task;
 assert.equal(context.btnPix.disabled,false);
 assert.equal(saved[0].title,'Serie A');
 assert.equal(saved[0].order.pedido_id,'order-A');
 if(change){
  assert.notEqual(el('pix-codigo').value,'PIX-A');
  if(phase==='order'){assert.equal(context.pedidoAtual,null);assert.equal(calls.length,1);}
 }else{
  assert.equal(el('pix-codigo').value,'PIX-A');
  assert.equal(context.pedidoAtual.produto_local,'A');
 }
}
(async()=>{
 for(const phase of ['order','pix'])for(const change of ['switch','reopen','close',null])await scenario(phase,change);
 console.log('8 checkout race scenarios passed without real payments.');
})().catch(error=>{console.error(error);process.exitCode=1;});
