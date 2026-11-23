import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/site.js';
import {whatsApp} from '../lib/catalog.js';

async function call(url,method='GET'){
  const result={headers:{},body:''};
  const response={
    setHeader(name,value){result.headers[name]=value;},
    writeHead(status,headers={}){result.status=status;Object.assign(result.headers,headers);return this;},
    end(body=''){result.body=body;}
  };
  await handler({url,method},response);
  return result;
}
test('public catalogue and dashboard entry points', async ()=>{
  process.env.DEMO_MODE='true';
  const home=await call('/');
  assert.equal(home.status,200);
  assert.match(home.body,/Mobil pilihan/);
  const catalogue=await call('/mobil?brand=BMW&min_price=500000000');
  assert.match(catalogue.body,/1 mobil ditemukan/);
  assert.match(catalogue.body,/BMW Seri 3/);
  assert.doesNotMatch(catalogue.body,/Volkswagen Tiguan Allspace/);
  assert.match((await call('/mobil?brand=BMW&max_price=100000000')).body,/Mobil belum ditemukan/);
  assert.match((await call('/mobil/volkswagen-tiguan-2021')).body,/RM-001/);
  assert.equal((await call('/mobil/unit-absen')).status,404);
  assert.match((await call('/sitemap.xml')).body,/volkswagen-tiguan-2021/);
  assert.match((await call('/admin')).body,/data-examples=.*RM-001/);
  assert.match((await call('/admin')).body,/noindex/);
  assert.equal((await call('/','POST')).status,405);
  assert.equal((await call('/','HEAD')).body,'');
  assert.match((await call('/api/site?__site_route=mobil&brand=BMW')).body,/1 mobil ditemukan/);
  assert.equal((await call('/api/site?__site_route=')).status,200);
});
test('production reads published stock and generates signed photo and WhatsApp links', async t=>{
  process.env.DEMO_MODE='false';
  process.env.SUPABASE_URL='https://project.example';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_example';
  const car={slug:'toyota-avanza',brand:'Toyota',model:'Avanza',year:2020,stock_code:'RM-10',price:150000000,mileage_km:50000,status:'available',vehicle_images:[{object_path:'test/photo.jpg',is_primary:true}]};
  t.mock.method(globalThis,'fetch',async (url,init)=>{
    assert.equal(init.headers.apikey,'sb_publishable_example');
    if(url.includes('/site_settings?'))return Response.json([{company_name:'Showroom','whatsapp_number':'081234567890'}]);
    if(url.includes('/vehicles?')){
      const query=new URL(url).searchParams;
      assert.equal(query.get('publication_status'),'eq.published');
      assert.equal(query.get('status'),'in.(available,reserved)');
      if(query.has('min_price'))assert.fail('unexpected filter');
      return Response.json([car]);
    }
    if(url.endsWith('/object/sign/vehicle-photos')){
      assert.deepEqual(JSON.parse(init.body),{paths:['test/photo.jpg'],expiresIn:300});
      return Response.json([{path:'test/photo.jpg',signedURL:'/object/sign/vehicle-photos/test/photo.jpg?token=123'}]);
    }
    assert.fail('Unknown endpoint: '+url);
  });
  const response=await call('/mobil/toyota-avanza');
  assert.equal(response.status,200);
  assert.match(response.body,/project\.example\/storage\/v1\/object\/sign/);
  assert.match(response.body,/wa\.me\/6281234567890/);
  assert.match(response.body,/Toyota%20Avanza%202020/);
});
test('WhatsApp link omits unconfigured number',()=>{
  assert.equal(whatsApp({whatsapp_number:''}),'');
});