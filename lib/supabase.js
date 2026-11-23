import {defaults,demoCars,filterDemo,sortOrder} from './catalog.js';
const size=9;
export const config=()=>({url:process.env.SUPABASE_URL?.replace(/\/$/,'')||'',key:process.env.SUPABASE_PUBLISHABLE_KEY||''});
export const demo=()=>process.env.DEMO_MODE==='true'||(!process.env.VERCEL&&!config().url&&!config().key);
async function request(path,init={}) {
  const {url,key}=config();
  if (!url||!key) throw new Error('Konfigurasi Supabase belum tersedia.');
  const res=await fetch(url+path,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(8000)});
  if(!res.ok) throw new Error('Supabase merespons HTTP '+res.status);
  return res;
}
export async function settings(){
  if(demo()) return defaults;
  const rows=await (await request('/rest/v1/site_settings?id=eq.1&select=*')).json();
  return {...defaults,...rows[0]};
}
async function withPhotos(rows){
  const paths=[...new Set(rows.flatMap(v=>v.vehicle_images.map(p=>p.object_path)))];
  if(!paths.length)return rows;
  const signed=await (await request('/storage/v1/object/sign/vehicle-photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths,expiresIn:300})})).json();
  const urls=new Map(signed.flatMap(p=>p.signedURL?[[p.path,config().url+'/storage/v1'+p.signedURL]]:[]));
  return rows.map(v=>{
    const photos=v.vehicle_images.toSorted((a,b)=>Number(b.is_primary)-Number(a.is_primary)||a.sort_order-b.sort_order).flatMap(p=>urls.has(p.object_path)?[{url:urls.get(p.object_path),alt_text:p.alt_text}]:[]);
    return {...v,photos,image:photos[0]?.url};
  });
}
export async function inventory(f){
  if(demo()){
    const rows=filterDemo(demoCars,f);
    return {cars:rows.slice((f.page-1)*size,f.page*size),total:rows.length,size};
  }
  const query=new URLSearchParams({select:'*,vehicle_images(*)',publication_status:'eq.published',order:sortOrder[f.sort]+',id.asc',limit:String(size),offset:String((f.page-1)*size)});
  query.set('status',f.status?'eq.'+f.status:'in.(available,reserved)');
  if(f.q) query.set('search_text','ilike.*'+f.q+'*');
  for(const k of ['brand','model','body_type','transmission','fuel_type']) if(f[k]) query.set(k,'eq.'+f[k]);
  for(const [key,field,op] of [['min_price','price','gte'],['max_price','price','lte'],['min_year','year','gte'],['max_year','year','lte']]) if(f[key]) query.append(field,op+'.'+f[key]);
  const response=await request('/rest/v1/vehicles?'+query,{headers:{Prefer:'count=exact'}});
  return {cars:await withPhotos(await response.json()),total:Number(response.headers.get('content-range')?.split('/')[1])||0,size};
}
export async function detail(slug){
  if(demo())return demoCars.find(v=>v.slug===slug);
  const params=new URLSearchParams({slug:'eq.'+slug,publication_status:'eq.published',status:'in.(available,reserved)',select:'*,vehicle_images(*)'});
  return (await withPhotos(await (await request('/rest/v1/vehicles?'+params)).json()))[0];
}
export async function sitemapSlugs(){
  if(demo())return demoCars.map(v=>v.slug);
  const result=[];
  for(let offset=0;;offset+=500){
    const data=await (await request('/rest/v1/vehicles?select=slug&order=id.asc&limit=500&offset='+offset)).json();
    result.push(...data.map(v=>v.slug));
    if(data.length<500)return result;
  }
}
export async function options(){
  if(demo())return [...new Set(demoCars.map(v=>v.brand))];
  const brands=await (await request('/rest/v1/rpc/catalog_brands')).json();
  return brands.map(v=>v.brand);
}