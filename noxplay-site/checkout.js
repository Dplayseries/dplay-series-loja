"use strict";
const NoxCheckout = (() => {
  const API = "https://noxplay-api-stage.onrender.com";
  let enabled = false, serie = null, key = null, timer = null;
  let dialog, status;
  const PENDING_KEY = "noxplay-pending-v1";
  function pending() {
    try {
      const data=JSON.parse(localStorage.getItem(PENDING_KEY)||"[]");
      if(!Array.isArray(data))return [];
      return data.filter(x=>x && typeof x.checkout_key==="string" &&
        /^[0-9a-f-]{36}$/i.test(x.checkout_key) &&
        /^[0-9a-f-]{36}$/i.test(x.serie_id||"") &&
        typeof x.created==="number" && Date.now()-x.created<7*86400000).slice(-20);
    }catch{return [];}
  }
  function store(items) {
    try{localStorage.setItem(PENDING_KEY,JSON.stringify(items));}catch{}
    const count=document.getElementById("nox-pending-count");
    if(count)count.textContent=items.length?items.length+" compra(s) aguardando confirmação ou entrega.":"";
  }
  function remember() {
    if(!key||!serie)return;
    const items=pending().filter(x=>x.checkout_key!==key);
    items.push({checkout_key:key,serie_id:String(serie.id),titulo:String(serie.titulo||"Série"),created:Date.now()});
    store(items);
  }
  function removePending(id) {store(pending().filter(x=>x.checkout_key!==id));}
  async function resumePending() {
    for(const item of pending()){
      try{
        const reply=await fetch(API+"/noxplay/checkout/consultar",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({checkout_key:item.checkout_key})
        });
        if(!reply.ok)continue;
        const data=await reply.json();
        if(data.estado==="pago" && data.entrega_habilitada===true){
          NoxLibrary.save({id:item.serie_id,titulo:item.titulo},item.checkout_key);
          removePending(item.checkout_key);
        }else if(data.estado==="cancelado"){
          removePending(item.checkout_key);
        }
      }catch{}
    }
    store(pending());
  }
  async function initialize() {
    try {
      const res = await fetch(API+"/noxplay/checkout/prontidao", {cache:"no-store"});
      const data = res.ok ? await res.json() : {};
      enabled = data.loja_id === "noxplay" && data.checkout_habilitado === true && data.valor_centavos === 400;
    } catch { enabled = false; }
    return enabled;
  }
  function open(selected) {
    if (!enabled) return;
    serie = selected; key = null;
    dialog = document.getElementById("nox-checkout-dialog");
    status = document.getElementById("nox-checkout-message");
    status.textContent = "";
    document.getElementById("nox-checkout-title").textContent = "Comprar: " + selected.titulo;
    document.getElementById("nox-checkout-form").hidden = false;
    document.getElementById("nox-checkout-pix").hidden = true;
    if (timer) clearInterval(timer);
    dialog.showModal();
  }
  async function create(event) {
    event.preventDefault();
    if (!serie || !enabled) return;
    const button = document.getElementById("nox-checkout-submit");
    button.disabled = true;
    status.textContent = "Preparando cobrança Pix...";
    if (!key) key = crypto.randomUUID();
    remember();
    try {
      const res = await fetch(API+"/noxplay/checkout/iniciar", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({serie_id:serie.id,checkout_key:key,
          payer_email:document.getElementById("nox-checkout-email").value})
      });
      if (!res.ok) throw Error("Pix indisponível. Tente novamente mais tarde.");
      const data = await res.json();
      if (data.estado!=="aguardando" || data.valor_centavos!==400) throw Error("Retorno inválido do pagamento");
      document.getElementById("nox-checkout-form").hidden = true;
      document.getElementById("nox-checkout-pix").hidden = false;
      document.getElementById("nox-checkout-code").value = data.pix_copia_cola || "";
      const qr=document.getElementById("nox-checkout-qr");
      const base64=data.pix_qr_base64||"";
      qr.hidden = !base64 || !/^[A-Za-z0-9+/=]+$/.test(base64);
      if (!qr.hidden) qr.src="data:image/png;base64,"+base64;
      const link=document.getElementById("nox-checkout-ticket");
      link.hidden=!/^https:\/\/www\.mercadopago\.com\.br\//.test(data.pix_ticket_url||"");
      if (!link.hidden) link.href=data.pix_ticket_url;
      status.textContent="Pix gerado. Aguardando confirmação do banco.";
      timer=setInterval(check,10000);
    } catch(e) { status.textContent=e.message||"Não foi possível iniciar a compra."; }
    finally {button.disabled=false;}
  }
  async function check() {
    if (!key) return;
    try {
      const res=await fetch(API+"/noxplay/checkout/consultar", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({checkout_key:key})
      });
      if (!res.ok) return;
      const data=await res.json();
      if (data.estado==="pago") {
        clearInterval(timer);timer=null;
        if(data.entrega_habilitada===true){
          NoxLibrary.save(serie,key);
          removePending(key);
          status.textContent="Pagamento confirmado! Acesse Minha biblioteca para assistir.";
        }else{
          status.textContent="Pagamento confirmado. A liberação da série está sendo verificada.";
        }
      }
    } catch {}
  }
  function setup() {
    dialog=document.getElementById("nox-checkout-dialog");
    document.getElementById("nox-checkout-form").addEventListener("submit",create);
    dialog.addEventListener("close",()=>{if(timer)clearInterval(timer);timer=null;});
    document.getElementById("nox-checkout-copy").addEventListener("click",async()=>{
      const input=document.getElementById("nox-checkout-code");
      try { await navigator.clipboard.writeText(input.value);status.textContent="Pix copiado."; }
      catch { input.select(); }
    });
  }
  setup();
  store(pending());
  document.getElementById("nox-library-show")?.addEventListener("click",resumePending);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)resumePending();});
  setInterval(()=>{if(!document.hidden)resumePending();},60000);
  resumePending();
  return {initialize,open,get ready(){return enabled;}};
})();
