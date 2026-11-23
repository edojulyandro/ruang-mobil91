export const hero = 'https://images.unsplash.com/photo-1566347238843-0782a8526e49?auto=format&fit=crop&w=1800&q=84';
const photo = id => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=900&q=82';
const examples = [
  ['Volkswagen','Tiguan','Allspace',2021,365000000,42000,'Bensin','SUV',hero],
  ['BMW','Seri 3','330i',2020,535000000,31500,'Bensin','Sedan',photo('photo-1555215695-3004980ad54e')],
  ['Mercedes-Benz','C-Class','C 200',2019,455000000,51200,'Bensin','Sedan',photo('photo-1618843479313-40f8afb4b4d8')],
  ['Porsche','911','Carrera',2018,1595000000,27500,'Bensin','Coupe',photo('photo-1503376780353-7e6692767b70')]
];
export const demoCars = examples.map(([brand,model,variant,year,price,mileage_km,fuel_type,body_type,image],i) => ({
  id:String(i+1),stock_code:'RM-00'+(i+1),slug:(brand+'-'+model+'-'+year).toLowerCase().replaceAll(' ','-'),
  brand,model,variant,year,price,mileage_km,fuel_type,body_type,transmission:'Otomatis',
  status:i===3?'reserved':'available',publication_status:'published',is_featured:i<3,
  created_at:new Date(2026,10,20-i).toISOString(),image,photos:[{url:image,alt_text:brand+' '+model}],
  description:'Unit contoh untuk memperlihatkan cara katalog dan halaman detail bekerja.',
  condition_notes:'Informasi kondisi unit akan diisi setelah pemeriksaan showroom.'
}));
export const defaults = {company_name:'Ruang Mobil',address:'',whatsapp_number:'',map_url:'',business_hours:'',about:'Temukan mobil bekas sesuai kebutuhan dan anggaran Anda. Hubungi tim showroom untuk menanyakan stok dan mengatur kunjungan.'};
export const labels = {available:'Tersedia',reserved:'Dipesan',sold:'Terjual',draft:'Draf',published:'Terbit',archived:'Arsip'};
export const rupiah = n => 'Rp' + new Intl.NumberFormat('id-ID').format(n);
export const km = n => new Intl.NumberFormat('id-ID').format(n) + ' km';
export const title = v => [v.brand,v.model,v.variant].filter(Boolean).join(' ');
export const sortOptions = {newest:'Terbaru',price_asc:'Harga terendah',price_desc:'Harga tertinggi',year_desc:'Tahun terbaru',km_asc:'Kilometer terendah'};
export const sortOrder = {newest:'created_at.desc',price_asc:'price.asc',price_desc:'price.desc',year_desc:'year.desc',km_asc:'mileage_km.asc'};
export function filters(params) {
  const f = Object.fromEntries(['q','brand','model','body_type','transmission','fuel_type','status','min_price','max_price','min_year','max_year','sort','page'].map(key=>[key,(params.get(key)||'').trim().slice(0,100)]));
  for (const key of ['min_price','max_price','min_year','max_year']) if (!/^\d{1,12}$/.test(f[key])) f[key]='';
  f.q=f.q.replace(/[^\p{L}\p{N} -]/gu,'').trim();
  if (!['available','reserved'].includes(f.status)) f.status='';
  if (!Object.hasOwn(sortOrder,f.sort)) f.sort='newest';
  f.page=Math.min(10000,Math.max(1,Number.parseInt(f.page,10)||1));
  return f;
}
export function filterDemo(cars,f) {
  const items=cars.filter(v =>
    title(v).toLowerCase().includes(f.q.toLowerCase()) &&
    ['brand','model','body_type','transmission','fuel_type','status'].every(k=>!f[k]||f[k]===v[k]) &&
    (!f.min_price||v.price>=+f.min_price) && (!f.max_price||v.price<=+f.max_price) &&
    (!f.min_year||v.year>=+f.min_year) && (!f.max_year||v.year<=+f.max_year));
  const [field,direction]=sortOrder[f.sort].split('.');
  return items.sort((a,b)=>(typeof a[field]==='number'?a[field]-b[field]:a[field].localeCompare(b[field]))*(direction==='asc'?1:-1));
}
export function whatsApp(settings,car) {
  const phone=String(settings.whatsapp_number||'').replace(/\D/g,'').replace(/^0/,'62');
  if (!/^[1-9]\d{7,14}$/.test(phone)) return '';
  const message=car?'Halo, saya tertarik dengan '+title(car)+' '+car.year+' (unit '+car.stock_code+'). Apakah masih tersedia?':'Halo, saya ingin bertanya tentang stok mobil.';
  return 'https://wa.me/'+phone+'?text='+encodeURIComponent(message);
}