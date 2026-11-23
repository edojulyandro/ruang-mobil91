import {carPage,catalog,home,layout,information,adminPage,e} from '../lib/views.js';
import {config,demo,detail,inventory,options,settings,sitemapSlugs} from '../lib/supabase.js';
import {defaults,filters,title,demoCars} from '../lib/catalog.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(!['GET','HEAD'].includes(req.method)){
    res.setHeader('Allow','GET, HEAD');
    res.writeHead(405).end();
    return;
  }
  let status=200,body='',heading='',description,image;
  let s=defaults;
  const url=new URL(req.url,'http://localhost');
  const routed=url.pathname==='/api/site' ? url.searchParams.get('__site_route') : null;
  const path=(routed===null?url.pathname:'/'+routed).replace(/\/$/,'')||'/';
  const origin=process.env.SITE_URL?.replace(/\/$/,'')|| (process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000');
  const admin=/^\/admin(?:\/|$)/.test(path);
  const noindex=demo()||process.env.VERCEL_ENV==='preview';
  if(noindex)res.setHeader('X-Robots-Tag','noindex');
  const send=(content,type)=>res.writeHead(status,{'Content-Type':type+'; charset=utf-8'}).end(req.method==='HEAD'?undefined:content);
  try {
    if(path==='/robots.txt') return send(noindex?'User-agent: *\nDisallow: /\n':'User-agent: *\nDisallow: /admin\nSitemap: '+origin+'/sitemap.xml\n','text/plain');
    if(path==='/sitemap.xml'){
      const paths=['/','/mobil','/tentang-kami','/kontak',...(await sitemapSlugs()).map(slug=>'/mobil/'+encodeURIComponent(slug))];
      return send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+e(origin+p)+'</loc></url>').join('')+'</urlset>','application/xml');
    }
    if(!admin)s=await settings();
    if(path==='/'||path==='/mobil'){
      const f=filters(url.searchParams);
      const [results,brands]=await Promise.all([inventory(path==='/'?filters(new URLSearchParams()):f),options()]);
      heading=path==='/'?'Katalog mobil bekas':'Katalog mobil';
      body=path==='/'?home(s,results.cars,brands):catalog(f,results,brands);
    }else if(path.startsWith('/mobil/')&&/^\/mobil\/[a-z0-9-]+$/.test(path)){
      const v=await detail(path.slice(7));
      if(v){
        heading=title(v)+' '+v.year;
        description=v.description||'Lihat foto, harga, dan spesifikasi '+heading+'.';
        image=v.image;
        body=carPage(s,v);
      }
    }else if(['/tentang-kami','/kontak','/kebijakan-privasi'].includes(path)){
      const [name,content]=information(s,path.slice(1));
      heading=name;body='<section class="wrap section info"><h1>'+e(name)+'</h1>'+content+'</section>';
    }else if(['/admin','/admin/login','/admin/mobil','/admin/mobil/tambah','/admin/pengaturan'].includes(path)||/^\/admin\/mobil\/[a-f0-9-]+\/edit$/.test(path)){
      heading='Dashboard admin';body=adminPage(config(),demo(),demo()?demoCars:[]);
    }
    if(!body){
      status=404;heading='Halaman tidak ditemukan';
      body='<section class="wrap section empty"><h1>'+heading+'</h1><a href="/mobil">Kembali ke katalog ↗</a></section>';
    }
  } catch(error){
    console.error(error.message);
    status=503;heading='Layanan sedang tidak tersedia';
    body='<section class="wrap section empty"><h1>'+heading+'</h1><p>Silakan coba kembali beberapa saat lagi.</p></section>';
  }
  return send(layout({s,heading,description,body,url:status===200&&!admin?origin+path:'',image,admin,demo:demo(),analytics:noindex||admin?'':process.env.GA_MEASUREMENT_ID}),'text/html');
}