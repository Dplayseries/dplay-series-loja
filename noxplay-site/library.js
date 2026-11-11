"use strict";
/* Biblioteca local: guarda somente o identificador opaco de compra, nunca chaves do gateway. */
const NoxLibrary = (() => {
  const API="https://noxplay-api-stage.onrender.com";
  const STORAGE="noxplay-paid-series-v1";
  let records={};
  try {
    const v=JSON.parse(localStorage.getItem(STORAGE)||"{}");
    if(v && typeof v==="object" && !Array.isArray(v))records=v;
  } catch {}
  const safeId=id=>typeof id==="string" && /^[0-9a-f-]{36}$/i.test(id);
  const list=()=>Object.values(records).filter(x=>x && safeId(x.serie_id) && safeId(x.checkout_key));
  function render(){
    const container=document.getElementById("nox-library-list");
    if(!container)return;
    container.replaceChildren();
    const entries=list();
    document.getElementById("nox-library-empty").hidden=entries.length>0;
    for(const row of entries){
      const button=document.createElement("button");
      button.type="button";button.textContent="Assistir: "+String(row.titulo||"Série");
      button.style.cssText="display:block;padding:12px;margin:8px 0;background:#6846a2;color:#fff;border:0;border-radius:8px;cursor:pointer";
      button.addEventListener("click",()=>open(row));
      container.append(button);
    }
  }
  function save(serie,key){
    if(!serie || !safeId(String(serie.id)) || !safeId(String(key)))return;
    records[String(serie.id)]={serie_id:String(serie.id),titulo:String(serie.titulo||"Série"),checkout_key:String(key)};
    try{localStorage.setItem(STORAGE,JSON.stringify(records));}catch{}
    render();
  }
  async function open(row){
    const dialog=document.getElementById("nox-player-dialog");
    const status=document.getElementById("nox-player-status");
    const list=document.getElementById("nox-player-episodes");
    const frame=document.getElementById("nox-player-video");
    frame.removeAttribute("src");list.replaceChildren();
    document.getElementById("nox-player-title").textContent=row.titulo;
    status.textContent="Verificando sua compra e carregando os episódios...";
    dialog.showModal();
    try{
      const result=await fetch(API+"/noxplay/player/episodios",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({checkout_key:row.checkout_key,serie_id:row.serie_id})
      });
      if(!result.ok)throw Error("Ainda não foi possível validar o acesso. Tente novamente mais tarde.");
      const data=await result.json();
      if(!Array.isArray(data.episodios) || !data.episodios.length){
        status.textContent="Nenhum episódio disponível para esta série.";
        return;
      }
      status.textContent="Selecione um episódio:";
      for(const ep of data.episodios){
        const button=document.createElement("button");button.type="button";
        button.textContent=String(ep.titulo||ep.chave);
        button.style.cssText="padding:9px;margin:4px;border:1px solid #8252c7;color:#fff;background:#352556;border-radius:8px;cursor:pointer";
        button.addEventListener("click",()=>play(row,String(ep.chave)));
        list.append(button);
      }
    }catch(error){status.textContent=error.message||"Biblioteca temporariamente indisponível.";}
  }
  async function play(row,episode){
    const status=document.getElementById("nox-player-status");
    status.textContent="Preparando reprodução segura...";
    try{
      const res=await fetch(API+"/noxplay/player/assistir",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({checkout_key:row.checkout_key,serie_id:row.serie_id,episodio_chave:episode})
      });
      if(!res.ok)throw Error("Não foi possível liberar o episódio.");
      const data=await res.json();
      if(typeof data.embed_url!=="string" || !data.embed_url.startsWith("https://player.mediadelivery.net/embed/")){
        throw Error("Endereço do vídeo inválido");
      }
      document.getElementById("nox-player-video").src=data.embed_url;
      status.textContent="Reproduzindo episódio selecionado.";
    }catch(error){status.textContent=error.message||"Falha na reprodução";}
  }
  document.getElementById("nox-library-show").addEventListener("click",()=>{
    const area=document.getElementById("nox-library-area");
    area.hidden=!area.hidden;
    render();
  });
  document.getElementById("nox-player-dialog").addEventListener("close",()=>{
    document.getElementById("nox-player-video").removeAttribute("src");
  });
  render();
  return {save,render};
})();
