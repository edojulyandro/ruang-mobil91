const menu=document.querySelector('.menu-toggle');
menu?.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')==='true';
  menu.setAttribute('aria-expanded',String(!open));
});
const filter=document.querySelector('.filter-panel');
if(filter&&matchMedia('(max-width: 760px)').matches)filter.open=false;
document.querySelector('[data-sort]')?.addEventListener('change',event=>event.target.form.requestSubmit());
document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{
  const image=document.querySelector('#main-photo');
  image.src=button.dataset.photo;
  image.alt=button.dataset.alt;
  document.querySelectorAll('[data-photo]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
}));
const ga=document.body.dataset.ga;
if(ga){
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  const script=document.createElement('script');
  script.async=true;
  script.src='https://www.googletagmanager.com/gtag/js?id='+ga;
  document.head.append(script);
  window.gtag('js',new Date());
  window.gtag('config',ga);
  const unit=document.querySelector('[data-unit]')?.dataset.unit;
  if(unit)window.gtag('event','vehicle_detail_view',{stock_code:unit});
  if(location.pathname==='/mobil'&&location.search)window.gtag('event','catalog_search');
  document.querySelectorAll('[data-whatsapp]').forEach(link=>link.addEventListener('click',()=>window.gtag('event','whatsapp_click',{stock_code:link.dataset.whatsapp})));
}