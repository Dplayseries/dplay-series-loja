const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.existsSync('web/storefront.js')?fs.readFileSync('web/storefront.js','utf8'):fs.readFileSync('index.html','utf8').split('<script>')[1];
const helper=source.slice(source.indexOf('function rankTitleMatches'),source.indexOf('function wireTitleSuggestions'));
function setup(){
 const node=tag=>({tag,children:[],events:{},hidden:false,attrs:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;}});
 const ctx={document:{createElement:node},URL};vm.createContext(ctx);vm.runInContext(helper,ctx);return {ctx,node};
}
const items=[
 {title:'A Filha Esquecida do John',id:'exact'},
 {title:'Filha do Destino',id:'prefix'},
 {title:'Minha Filha Esquecida',id:'related'},
 {title:'O Bobinho Cativo do Dragão',id:'dragon'},
 {title:'Amor Sem Limites',id:'unrelated'}
];
test('full title, prefix, accents and reordered words find real catalog titles first',()=>{
 const {ctx}=setup(),rank=q=>ctx.rankTitleMatches(items,q,x=>x.title);
 assert.equal(rank('a filha esquecida do john')[0].item.id,'exact');
 assert.equal(rank('O Cativo Bobinho do Dragao')[0].item.id,'dragon');
 assert.deepEqual(Array.from(rank('Filha'),x=>x.item.id),['exact','prefix','related']);
 assert.equal(rank('Filha')[0].kind,'direct');
 assert.equal(rank('Filha Esquecida do John').find(x=>x.item.id==='related').kind,'similar');
 assert.equal(rank('Dragao')[0].item.id,'dragon');
 assert.equal(rank('Dragoa')[0].kind,'similar');
 assert.equal(rank('zzzzzzzzz').length,0);assert.equal(rank('   ').length,0);
});
test('preview uses thumbnails, plain text and safe selection without creating a purchase',()=>{
 const {ctx,node}=setup(),panel=node('section'),input=node('input');input.value='Filha';
 let selected=null,more=0;
 ctx.showTitleSuggestions({input,panel,items,titleOf:x=>x.title,coverOf:x=>'https://example.test/'+x.id+'.jpg',onSelect:x=>selected=x.id,onMore:()=>more++});
 const row=panel.children.find(x=>x.className==='search-preview-item');
 assert.equal(row.children[0].children[0].src,'https://example.test/exact.jpg');
 assert.equal(row.children[1].textContent,items[0].title);
 row.events.click();assert.equal(selected,'exact');
 panel.children.at(-1).events.click();assert.equal(more,1);assert.equal(panel.hidden,true);
 input.value='';ctx.showTitleSuggestions({input,panel,items,titleOf:x=>x.title});assert.equal(panel.hidden,true);
 input.value='literal';
 ctx.showTitleSuggestions({input,panel,items:[{title:'<img src=x onerror=steal()> literal'}],titleOf:x=>x.title,coverOf:()=> 'javascript:steal()',hrefOf:()=>'/safe',onMore(){}});
 const safe=panel.children.find(x=>x.className==='search-preview-item');assert.equal(safe.href,'/safe');assert.equal(safe.children[0].children.length,0);assert.match(safe.children[1].textContent,/<img/);
});
