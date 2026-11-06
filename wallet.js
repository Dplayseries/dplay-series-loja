(()=>{
 'use strict';
 const API='https://dplay-series-api.onrender.com';
 const $=id=>document.getElementById(id);
 const store={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}};
 let code=store.get('dplay_wallet_v1')||'',balance=0,busy=false,order=null,poll=0;
 const requested=new URLSearchParams(location.search).get('serie');
 const sid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requested||'')?requested:null;
 const money=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 async function api(path,options={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(API+path,{...options,signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json',...(code?{'X-Dplay-Wallet':code}:{}),...options.headers}});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Não foi possível concluir. Tente novamente.');
   return data;
  }finally{clearTimeout(timeout)}
 }
 function state(message){$('wallet-status').textContent=message}
 function link(receipt){return './streaming.html#'+new URLSearchParams({pedido:receipt.pedido_id,resgate:receipt.resgate})}
 function savePurchase(receipt){
  try{
   const all=JSON.parse(store.get('dplay_receipts_v1')||'[]');
   const next=(Array.isArray(all)?all:[]).filter(item=>item.pedido_id!==receipt.pedido_id);
   next.unshift({pedido_id:receipt.pedido_id,resgate:receipt.resgate,titulo:receipt.titulo||'Minha série'});
   store.set('dplay_receipts_v1',JSON.stringify(next.slice(0,100)));
  }catch{}
 }
 function renderBalance(data){
  balance=data.creditos;$('balance').textContent=balance+(balance===1?' crédito':' créditos');
  $('spend').disabled=busy||balance<1;
  $('wallet-start').hidden=true;$('refresh').disabled=false;$('recovery-code').value=code;
  state(balance?'Escolha sua série e aproveite.':'Adicione créditos para escolher sua próxima história.');
  $('selected-access').hidden=true;$('spend').hidden=false;
  $('purchases').replaceChildren();
  for(const receipt of data.compras||[]){
   savePurchase(receipt);
   const a=document.createElement('a');a.className='wallet-entry';a.href=link(receipt);a.textContent=receipt.titulo+' · Assistir ↗';$('purchases').append(a);
   if(receipt.serie_id===sid){$('selected-access').href=link(receipt);$('selected-access').hidden=false;$('spend').hidden=true}
  }
  $('purchases-panel').hidden=!(data.compras||[]).length;
  $('history').replaceChildren();
  for(const item of data.extrato||[]){const p=document.createElement('p');p.className='wallet-entry';p.textContent=item.creditos+' crédito(s) · '+item.status+(item.status==='aprovado'?' · '+item.restante+' disponível(is)':'');$('history').append(p)}
  $('history-panel').hidden=!(data.extrato||[]).length;
 }
 async function refresh(){
  if(!code)return;
  const current=code;$('refresh').disabled=true;state('Conferindo seus créditos...');
  try{const data=await api('/carteira');if(code===current)renderBalance(data)}
  catch(error){if(code===current){state(error.message);$('spend').disabled=true;$('balance').textContent='Saldo indisponível';$('refresh').disabled=false}}
 }
 async function ensureWallet(){
  if(code)return;
  const data=await api('/carteira',{method:'POST'});code=data.codigo;
  const saved=store.set('dplay_wallet_v1',code);renderBalance({creditos:0});
  if(!saved){$('recovery-code').closest('details').open=true;state('Guarde seu código: este navegador não permite salvar a carteira.')}
 }
 $('create').addEventListener('click',async()=>{if(busy)return;busy=true;$('create').disabled=true;try{await ensureWallet()}catch(e){state(e.message)}finally{busy=false;$('create').disabled=false}});
 $('refresh').addEventListener('click',refresh);
 $('restore').addEventListener('click',async()=>{
  if(busy)return;
  const next=$('restore-code').value.trim();if(!/^[A-Za-z0-9_-]{43}$/.test(next)){$('recovery-status').textContent='Confira o código da carteira.';return}
  busy=true;const previous=code;code=next;
  try{const data=await api('/carteira');store.set('dplay_wallet_v1',code);poll++;order=null;$('payment').hidden=true;$('restore-code').value='';$('recovery-status').textContent='Carteira recuperada.';renderBalance(data)}
  catch(e){code=previous;$('recovery-status').textContent=e.message}finally{busy=false}
 });
 $('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);$('recovery-status').textContent='Código copiado. Guarde-o em um lugar seguro.'}catch{$('recovery-code').select();$('recovery-status').textContent='Selecione e copie seu código.'}});
 function rememberOrder(){if(order)store.set('dplay_wallet_pending_v1',JSON.stringify({...order,wallet:code.slice(-12)}))}
 async function generatePix(){
  const payment=await api('/publico/pix',{method:'POST',body:JSON.stringify({pedido_id:order.pedido_id,resgate:order.resgate})});
  $('pix-code').value=payment.pix_copia_cola;
  $('qr').hidden=!payment.pix_qr_code_base64;
  if(payment.pix_qr_code_base64)$('qr').src='data:image/png;base64,'+payment.pix_qr_code_base64;
  $('pix-content').hidden=false;$('pix-status').textContent='Pix de '+money(order.valor_centavos)+' pronto. Seus créditos entram após a confirmação.';
  $('retry-pix').hidden=true;
 }
 async function topup(pack){
  if(busy)return;busy=true;
  try{
   await ensureWallet();
   $('payment').hidden=false;$('pix-content').hidden=true;$('retry-pix').hidden=true;$('pix-status').textContent='Preparando seu Pix...';$('payment').scrollIntoView({behavior:'smooth',block:'start'});
   if(!order||order.pacote!==pack.codigo||order.wallet!==code.slice(-12)){
    order={...await api('/carteira/recarga',{method:'POST',body:JSON.stringify({pacote:pack.codigo})}),pacote:pack.codigo,wallet:code.slice(-12)};rememberOrder();
   }
   await generatePix();watch();
  }catch(e){$('payment').hidden=false;$('pix-status').textContent=e.message;$('retry-pix').hidden=!order}
  finally{busy=false;$('spend').disabled=balance<1}
 }
 async function check(){
  if(!order)return false;
  const current=order;
  const data=await api('/publico/pedido/status',{method:'POST',body:JSON.stringify({pedido_id:current.pedido_id,resgate:current.resgate})});
  if(order!==current)return false;
  if(data.status==='aprovado'){
   $('pix-content').hidden=true;$('retry-pix').hidden=true;$('pix-status').textContent='✓ Pagamento confirmado. Seus créditos estão disponíveis.';
   order=null;store.set('dplay_wallet_pending_v1','');poll++;await refresh();return true;
  }
  if(['cancelado','reembolsado'].includes(data.status)){$('pix-content').hidden=true;$('pix-status').textContent='Este pagamento foi encerrado. Escolha um pacote para gerar outro Pix.';order=null;store.set('dplay_wallet_pending_v1','');poll++;return true}
  $('pix-status').textContent='Aguardando a confirmação do Pix. Se já pagou, aguarde alguns instantes.';return false;
 }
 async function watch(){const generation=++poll;for(let i=0;i<60&&order&&generation===poll;i++){try{if(await check())break}catch{}await new Promise(resolve=>setTimeout(resolve,10000))}}
 $('check-payment').addEventListener('click',async()=>{try{await check()}catch(e){$('pix-status').textContent=e.message}});
 $('retry-pix').addEventListener('click',async()=>{if(busy||!order)return;busy=true;try{await generatePix();watch()}catch(e){$('pix-status').textContent=e.message}finally{busy=false}});
 $('copy-pix').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('pix-code').value);$('copy-pix').textContent='✓ Código copiado'}catch{$('pix-code').select()}});
 $('spend').addEventListener('click',async()=>{
  if(busy||!sid)return;busy=true;$('spend').disabled=true;
  const key='dplay_wallet_request_'+sid;
  let request=store.get(key);if(!request){request=crypto.randomUUID();store.set(key,request)}
  try{
   const receipt=await api('/carteira/comprar',{method:'POST',body:JSON.stringify({serie_id:sid,request_id:request})});
   savePurchase({...receipt,titulo:$('selected-title').textContent});$('selected-access').href=link(receipt);$('selected-access').hidden=false;$('spend').hidden=true;state('✓ Série liberada. Bom play!');await refresh();
  }catch(e){state(e.message)}finally{busy=false;$('spend').disabled=balance<1}
 });
 async function start(){
  try{
   const data=await api('/carteira/pacotes');
   for(const pack of data.pacotes){const card=document.createElement('article');card.className='combo-card';const badge=document.createElement('span');badge.className='eyebrow';badge.textContent='COMBO DPLAY';const title=document.createElement('h3');title.textContent=pack.creditos+(pack.creditos===1?' série':' séries');const price=document.createElement('strong');price.textContent=money(pack.valor_centavos);const text=document.createElement('p');text.textContent=pack.creditos+' crédito(s) para escolher quando quiser.';const button=document.createElement('button');button.className='buy';button.type='button';button.textContent='Comprar '+pack.creditos+' séries';button.addEventListener('click',()=>topup(pack));card.append(badge,title,price,text,button);$('packs').append(card)}
   $('packs').setAttribute('aria-busy','false');
  }catch(e){state(e.message)}
  if(code){await refresh();try{const pending=JSON.parse(store.get('dplay_wallet_pending_v1')||'null');if(pending?.wallet===code.slice(-12)){order=pending;$('payment').hidden=false;$('pix-status').textContent='Você tem um Pix iniciado. Verifique o pagamento ou continue abaixo.';$('retry-pix').hidden=false;watch()}}catch{}}
  if(sid){$('selected').hidden=false;try{const catalog=await api('/catalogo/series');const series=catalog.series.find(item=>item.id===sid);if(series)$('selected-title').textContent=series.titulo;else{$('selected-title').textContent='Série indisponível';$('spend').hidden=true}}catch{}}
 }
 start();
})();
