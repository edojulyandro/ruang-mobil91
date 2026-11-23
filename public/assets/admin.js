const root=document.querySelector('#admin');
const feedback=document.querySelector('#admin-feedback');
const login=document.querySelector('#login');
const workspace=document.querySelector('#workspace');
const editor=document.querySelector('#edit-car');
const settingsForm=document.querySelector('#settings');
const isDemo=root.dataset.demo==='true';
const base=root.dataset.url;
const key=root.dataset.key;
const tokenKey='ruang-mobil-session:'+base;
let token=sessionStorage.getItem(tokenKey);
let vehicles=[];
let selectedId=null;

const fail=error=>{feedback.textContent=error.message;};
const say=text=>{feedback.textContent=text;};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusNames={available:'Tersedia',reserved:'Dipesan',sold:'Terjual',draft:'Draf',published:'Terbit',archived:'Arsip'};
const carName=car=>[car.brand,car.model,car.variant].filter(Boolean).join(' ');
const currency=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
const settingsFields=[['company_name','Nama showroom'],['whatsapp_number','WhatsApp sales'],['address','Alamat'],['business_hours','Jam operasional'],['map_url','Tautan Google Maps','url'],['phone','Telepon','tel'],['email','Email','email'],['about','Profil showroom','textarea']];
const carFields=[
  ['stock_code','Kode unit','text',true],['brand','Merek','text',true],['model','Model','text',true],['variant','Varian'],['year','Tahun','number',true],
  ['price','Harga (Rp)','number',true],['mileage_km','Kilometer','number',true],['transmission','Transmisi',['Otomatis','Manual'],true],
  ['fuel_type','Bahan bakar',['Bensin','Diesel','Hybrid','Listrik','Lainnya'],true],['body_type','Tipe bodi',['SUV','Sedan','MPV','Hatchback','Coupe','Pickup','Lainnya'],true],
  ['color','Warna'],['engine_capacity_cc','Kapasitas mesin (cc)','number'],['plate_region','Wilayah pelat'],['tax_expiry','Pajak berlaku hingga','date'],
  ['document_summary','Kelengkapan dokumen'],['location','Lokasi unit'],['description','Deskripsi','textarea'],['condition_notes','Catatan kondisi publik','textarea'],
  ['status','Status stok',['available','reserved','sold'],true],['publication_status','Publikasi',['draft','published','archived'],true]
];
function control([name,label,type='text',required=false],value=''){
  const req=required?' required':'';
  const input=Array.isArray(type)
    ?'<select name="'+name+'"'+req+'>'+type.map(v=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+escape(statusNames[v]||v)+'</option>').join('')+'</select>'
    :type==='textarea'?'<textarea name="'+name+'">'+escape(value)+'</textarea>'
    :'<input name="'+name+'" type="'+type+'" value="'+escape(value)+'"'+req+(type==='number'?' min="0"':'')+'>';
  return '<label>'+label+input+'</label>';
}
async function db(path,{method='GET',body,headers={},authenticated=true}={}){
  const binary=body instanceof File;
  const res=await fetch(base+path,{method,headers:{apikey:key,...(authenticated&&token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':binary?body.type:'application/json'}:{}),...headers},body:body?(binary?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(20000)});
  const data=await res.json().catch(()=>null);
  if(!res.ok){
    if(res.status===401&&authenticated){token=null;sessionStorage.removeItem(tokenKey);showLogin();}
    throw new Error(data?.message||data?.msg||data?.error_description||'Permintaan gagal ('+res.status+').');
  }
  return data;
}
function showLogin(){workspace.hidden=true;login.hidden=false;}
function renderStock(){
  const filter=document.querySelector('#admin-filter').value;
  const search=document.querySelector('#admin-search').value.trim().toLowerCase();
  const rows=vehicles.filter(v=>(!filter||v.status===filter)&&(!search||(carName(v)+' '+v.stock_code).toLowerCase().includes(search)));
  document.querySelector('#stats').innerHTML=[['Total stok',vehicles.length],...['available','reserved','sold'].map(k=>[statusNames[k],vehicles.filter(v=>v.status===k).length])].map(([name,count])=>'<div><span>'+name+'</span><strong>'+count+'</strong></div>').join('');
  document.querySelector('#stock-list').innerHTML='<table><thead><tr><th>Mobil</th><th>Kode</th><th>Harga</th><th>Stok</th><th>Publikasi</th><th></th></tr></thead><tbody>'+rows.map(v=>'<tr><td>'+escape(carName(v))+' <small>'+escape(v.year)+'</small></td><td>'+escape(v.stock_code)+'</td><td>'+currency(v.price)+'</td><td>'+statusNames[v.status]+'</td><td>'+statusNames[v.publication_status]+'</td><td><button type="button" data-edit="'+escape(v.id)+'">Edit</button></td></tr>').join('')+'</tbody></table>'+(rows.length?'':'<p>Belum ada unit yang cocok.</p>');
  document.querySelectorAll('[data-edit]').forEach(button=>{button.hidden=isDemo;button.addEventListener('click',()=>openEditor(button.dataset.edit));});
}
async function refresh(){
  const rows=[];
  for(let offset=0;;offset+=200){
    const page=await db('/rest/v1/vehicles?select=*,vehicle_images(*)&order=created_at.desc,id.asc&limit=200&offset='+offset);
    rows.push(...page);
    if(page.length<200)break;
  }
  vehicles=rows;
  renderStock();
}
function openEditor(id){
  selectedId=id;
  const v=vehicles.find(car=>car.id===id)||{};
  editor.hidden=false;
  const photos=(v.vehicle_images||[]).toSorted((a,b)=>a.sort_order-b.sort_order);
  editor.innerHTML='<h2>'+(id?'Edit unit':'Tambah unit')+'</h2><div class="form-grid">'+carFields.filter(([name])=>id||name!=='publication_status').map(field=>control(field,v[field[0]])).join('')+'</div><label class="check"><input type="checkbox" name="is_featured" '+(v.is_featured?'checked':'')+'> Tampilkan sebagai mobil pilihan</label>'+(id?'<div class="photo-tools"><h3>Foto kendaraan</h3><label>Unggah foto (JPG, PNG, WebP, maks. 5 MB per file)<input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><button type="button" id="upload-photo">Unggah foto</button><ul>'+photos.map(p=>'<li>'+escape(p.alt_text||'Foto')+(p.is_primary?' · Utama':' <button type="button" data-primary="'+escape(p.id)+'">Jadikan utama</button>')+' <button type="button" data-remove="'+escape(p.id)+'">Hapus foto</button></li>').join('')+'</ul></div>':'<p>Simpan draf untuk menambahkan foto dan menerbitkan unit.</p>')+'<button class="button">Simpan '+(id?'perubahan':'draf')+'</button> <button type="button" id="close-editor">Tutup</button>';
  editor.querySelector('#close-editor').onclick=()=>{editor.hidden=true;selectedId=null;};
  editor.querySelector('#upload-photo')?.addEventListener('click',event=>run(event.currentTarget,async()=>{
    const files=[...editor.querySelector('#photo-file').files];
    if(!files.length)throw new Error('Pilih foto terlebih dahulu.');
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    if(files.some(file=>!types[file.type]||file.size>5242880||!file.size))throw new Error('Gunakan JPG, PNG atau WebP dengan ukuran hingga 5 MB.');
    let order=Math.max(0,...photos.map(p=>p.sort_order+1));
    let hasPrimary=photos.some(p=>p.is_primary);
    try{
      for(const file of files){
        const object_path=id+'/'+crypto.randomUUID()+'.'+types[file.type];
        await db('/storage/v1/object/vehicle-photos/'+object_path,{method:'POST',body:file});
        try{
          await db('/rest/v1/vehicle_images',{method:'POST',body:{vehicle_id:id,object_path,alt_text:carName(v)+' – foto '+(order+1),sort_order:order++,is_primary:!hasPrimary}});
          hasPrimary=true;
        }catch(error){
          await db('/storage/v1/object/vehicle-photos',{method:'DELETE',body:{prefixes:[object_path]}}).catch(()=>{});
          throw error;
        }
      }
      say('Foto berhasil diunggah.');
    }finally{await refresh();openEditor(id);}
  }));
  editor.querySelectorAll('[data-primary]').forEach(button=>button.onclick=()=>run(button,async()=>{
    await db('/rest/v1/rpc/set_primary_photo',{method:'POST',body:{unit_id:id,photo_id:button.dataset.primary}});
    await refresh();openEditor(id);say('Foto utama diperbarui.');
  }));
  editor.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>run(button,async()=>{
    if(!confirm('Hapus foto ini dari galeri?'))return;
    const photo=photos.find(item=>item.id===button.dataset.remove);
    await db('/rest/v1/vehicle_images?id=eq.'+photo.id,{method:'DELETE'});
    await refresh();openEditor(id);
    await db('/storage/v1/object/vehicle-photos',{method:'DELETE',body:{prefixes:[photo.object_path]}});
    say('Foto dihapus.');
  }));
}
async function run(button,fn){
  if(button)button.disabled=true;
  say('');
  try{await fn();}catch(error){fail(error);}finally{if(button)button.disabled=false;}
}
async function switchTab(tab){
  document.querySelector('#stock').hidden=tab!=='stock';
  settingsForm.hidden=tab!=='settings';
  if(tab!=='settings')return;
  const [s]=await db('/rest/v1/site_settings?id=eq.1');
  settingsForm.innerHTML='<h2>Pengaturan showroom</h2><div class="form-grid">'+settingsFields.map(field=>control(field,s[field[0]])).join('')+'</div><button class="button">Simpan pengaturan</button>';
}
async function enter(){
  if(!await db('/rest/v1/rpc/is_catalog_admin'))throw new Error('Akun ini belum memiliki akses admin.');
  await refresh();
  await switchTab(location.pathname==='/admin/pengaturan'?'settings':'stock');
  if(location.pathname.endsWith('/tambah'))openEditor(null);
  const editing=location.pathname.match(/\/mobil\/([a-f0-9-]+)\/edit$/);
  if(editing&&vehicles.some(v=>v.id===editing[1]))openEditor(editing[1]);
  workspace.hidden=false;
  login.hidden=true;
}
login.addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const credentials=Object.fromEntries(new FormData(login));
    const result=await db('/auth/v1/token?grant_type=password',{method:'POST',body:credentials,authenticated:false});
    token=result.access_token;
    await enter();
    sessionStorage.setItem(tokenKey,token);
    login.reset();
  });
});
editor.addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const body=Object.fromEntries(new FormData(editor));
    for(const [name,,type] of carFields)if(type==='number'||type==='date')body[name]=body[name]===''||body[name]===undefined?null:type==='number'?Number(body[name]):body[name];
    body.is_featured=editor.elements.is_featured.checked;
    const id=selectedId;
    if(!id){
      body.publication_status='draft';
      const prefix=(body.brand+'-'+body.model+'-'+body.year).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      body.slug=(prefix?prefix+'-':'')+crypto.randomUUID().slice(0,8);
    }
    const [saved]=await db('/rest/v1/vehicles'+(id?'?id=eq.'+id:''),{method:id?'PATCH':'POST',body,headers:{Prefer:'return=representation'}});
    await refresh();openEditor(saved.id);say('Unit berhasil disimpan.');
  });
});
settingsForm.addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const body=Object.fromEntries(new FormData(settingsForm));
    if(!body.company_name.trim())throw new Error('Nama showroom wajib diisi.');
    if(body.whatsapp_number&&!/^[1-9]\d{7,14}$/.test(body.whatsapp_number.replace(/\D/g,'').replace(/^0/,'62')))throw new Error('Nomor WhatsApp belum valid.');
    if(body.map_url&&!/^https:\/\//i.test(body.map_url))throw new Error('Tautan peta harus menggunakan HTTPS.');
    await db('/rest/v1/site_settings?id=eq.1',{method:'PATCH',body});say('Pengaturan berhasil disimpan.');
  });
});
document.querySelector('#logout').onclick=()=>run(null,async()=>{
  try{await db('/auth/v1/logout?scope=local',{method:'POST'});}finally{
    token=null;sessionStorage.removeItem(tokenKey);vehicles=[];selectedId=null;editor.hidden=true;showLogin();
  }
});
document.querySelector('#add-car').onclick=()=>openEditor(null);
document.querySelector('#admin-search').oninput=renderStock;
document.querySelector('#admin-filter').onchange=renderStock;
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>run(button,()=>switchTab(button.dataset.tab)));
if(isDemo||!base||!key){
  say('Pengelolaan stok diaktifkan setelah Supabase dikonfigurasi.');
  if(isDemo){
    vehicles=JSON.parse(root.dataset.examples);
    workspace.hidden=false;renderStock();
    root.querySelectorAll('#add-car,#logout,[data-tab]').forEach(button=>button.hidden=true);
  }
}else if(token){
  enter().catch(error=>{sessionStorage.removeItem(tokenKey);token=null;showLogin();fail(error);});
}else showLogin();