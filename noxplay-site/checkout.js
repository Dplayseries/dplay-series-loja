"use strict";
const NoxCheckout = (() => {
  const API = "https://noxplay-api-stage.onrender.com";
  let enabled = false, serie = null, key = null, timer = null;
  let dialog, status;
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
        status.textContent="Pagamento confirmado. Acesse sua biblioteca para assistir.";
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
  return {initialize,open,get ready(){return enabled;}};
})();
