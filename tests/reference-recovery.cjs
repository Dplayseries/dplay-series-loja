const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('public reference snapshot contains no customer, channel or payment fields',()=>{
 const snapshot=JSON.parse(fs.readFileSync('catalogo-recuperado.json','utf8'));
 assert.equal(snapshot.mode,'reference_only');assert.ok(snapshot.series.length>=600);
 assert.equal(new Set(snapshot.series.map(x=>x.id)).size,snapshot.series.length);
 for(const row of snapshot.series){assert.deepEqual(Object.keys(row).sort(),['id','title']);assert.ok(row.title.length<=250);}
});
test('reference browsing routes to support before any checkout action',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const source=html.slice(html.indexOf('function abrirCheckout('),html.indexOf('function fecharCheckout('));
 const context={catalogoReferencia:true,location:{href:''}};vm.createContext(context);vm.runInContext(source,context);
 context.abrirCheckout({id:'reference',titulo:'Archived title'});
 assert.equal(context.location.href,'https://t.me/dplaysuporteoficial');
});
