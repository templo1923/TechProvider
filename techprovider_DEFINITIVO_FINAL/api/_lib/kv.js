let memory = globalThis.__TP_MEM__ || (globalThis.__TP_MEM__ = new Map());
async function getVercelKv(){ try{ const { kv } = await import('@vercel/kv'); return kv; }catch(e){ return null; } }
function fileStore(){
  const fs = require('fs');
  const file = '/tmp/techprovider_kv.json';
  return {
    async get(key){ try{ if(!fs.existsSync(file)) return null; const data=JSON.parse(fs.readFileSync(file,'utf8')); return data[key]??null; }catch{ return memory.get(key)??null; } },
    async set(key,val){ try{ let data={}; if(fs.existsSync(file)) data=JSON.parse(fs.readFileSync(file,'utf8')); data[key]=val; fs.writeFileSync(file, JSON.stringify(data)); memory.set(key,val); return true; }catch{ memory.set(key,val); return true; } },
    async del(key){ try{ if(fs.existsSync(file)){ let data=JSON.parse(fs.readFileSync(file,'utf8')); delete data[key]; fs.writeFileSync(file, JSON.stringify(data)); } memory.delete(key); return true; }catch{ memory.delete(key); return true; } },
    async list(prefix){ try{ if(fs.existsSync(file)){ const data=JSON.parse(fs.readFileSync(file,'utf8')); const keys=Object.keys(data).filter(k=>k.startsWith(prefix)); return keys.map(k=>({key:k,value:data[k]})); } return [...memory.entries()].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>({key:k,value:v})); }catch{ return [...memory.entries()].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>({key:k,value:v})); } },
    async keys(prefix){ const l=await this.list(prefix); return l.map(x=>x.key); }
  };
}
async function getStore(){
  const vercelKv = await getVercelKv();
  if(vercelKv){
    return {
      async get(key){ try{ const v=await vercelKv.get(key); if(v===null||v===undefined) return memory.get(key)??null; return v; }catch{ return memory.get(key)??null; } },
      async set(key,val){ try{ await vercelKv.set(key,val); memory.set(key,val); return true; }catch{ memory.set(key,val); return fileStore().set(key,val); } },
      async del(key){ try{ await vercelKv.del(key); memory.delete(key); return true; }catch{ memory.delete(key); return fileStore().del(key); } },
      async list(prefix){ try{ const indexKey=`${prefix}__index`; let idx=await vercelKv.get(indexKey); if(!idx){ const mem=[...memory.entries()].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>({key:k,value:v})); if(mem.length) return mem; return fileStore().list(prefix); } const results=[]; for(const k of idx){ const v=await vercelKv.get(k); if(v) results.push({key:k,value:v}); } return results; }catch{ return fileStore().list(prefix); } },
      async keys(prefix){ const l=await this.list(prefix); return l.map(x=>x.key); },
      async addToIndex(prefix,key){ try{ const indexKey=`${prefix}__index`; let idx=await vercelKv.get(indexKey)||[]; if(!idx.includes(key)){ idx.push(key); await vercelKv.set(indexKey, idx); } }catch{} },
      async removeFromIndex(prefix,key){ try{ const indexKey=`${prefix}__index`; let idx=await vercelKv.get(indexKey)||[]; idx=idx.filter(k=>k!==key); await vercelKv.set(indexKey, idx); }catch{} }
    };
  }
  return fileStore();
}
module.exports={getStore};
