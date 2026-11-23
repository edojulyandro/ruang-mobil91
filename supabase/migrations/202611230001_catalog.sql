begin;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_users where user_id = (select auth.uid())); $$;
revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to authenticated;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  stock_code text not null unique check (length(btrim(stock_code)) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text not null check (length(btrim(brand)) between 1 and 70),
  model text not null check (length(btrim(model)) between 1 and 70),
  variant text not null default '',
  year integer not null check (year between 1900 and 2100),
  price bigint not null check (price between 1 and 999999999999),
  mileage_km integer not null check (mileage_km >= 0),
  transmission text not null check (transmission in ('Manual','Otomatis')),
  fuel_type text not null check (fuel_type in ('Bensin','Diesel','Hybrid','Listrik','Lainnya')),
  body_type text not null check (body_type in ('SUV','Sedan','MPV','Hatchback','Coupe','Pickup','Lainnya')),
  color text not null default '',
  engine_capacity_cc integer check (engine_capacity_cc > 0),
  plate_region text not null default '',
  tax_expiry date,
  document_summary text not null default '',
  location text not null default '',
  description text not null default '',
  condition_notes text not null default '',
  status text not null default 'available' check (status in ('available','reserved','sold')),
  publication_status text not null default 'draft' check (publication_status in ('draft','published','archived')),
  is_featured boolean not null default false,
  search_text text generated always as (brand || ' ' || model || ' ' || variant) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  object_path text not null unique check (split_part(object_path,'/',1)=vehicle_id::text),
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false
);
create unique index vehicle_images_primary on public.vehicle_images(vehicle_id) where is_primary;
create index vehicle_images_vehicle on public.vehicle_images(vehicle_id);
create index vehicles_public_created on public.vehicles(created_at desc,id) where publication_status='published' and status in ('available','reserved');

create table public.site_settings (
  id integer primary key default 1 check (id=1),
  company_name text not null default 'Ruang Mobil',
  about text not null default '',
  whatsapp_number text not null default '',
  address text not null default '',
  business_hours text not null default '',
  map_url text not null default '',
  phone text not null default '',
  email text not null default ''
);
insert into public.site_settings default values;

alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.vehicles, public.vehicle_images, public.site_settings from anon, authenticated;
grant select on public.vehicles, public.vehicle_images, public.site_settings to anon, authenticated;
grant insert, update on public.vehicles to authenticated;
grant insert, update, delete on public.vehicle_images to authenticated;
grant update on public.site_settings to authenticated;

create policy vehicles_public on public.vehicles for select to anon, authenticated
using (publication_status='published' and status in ('available','reserved'));
create policy vehicles_admin on public.vehicles for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy images_public on public.vehicle_images for select to anon, authenticated
using (exists (select 1 from public.vehicles v where v.id=vehicle_id and v.publication_status='published' and v.status in ('available','reserved')));
create policy images_admin on public.vehicle_images for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy settings_public on public.site_settings for select to anon, authenticated using (true);
create policy settings_admin on public.site_settings for update to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('vehicle-photos','vehicle-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy storage_photo_public on storage.objects for select to anon, authenticated
using (bucket_id='vehicle-photos' and exists (
  select 1 from public.vehicle_images i join public.vehicles v on v.id=i.vehicle_id
  where i.object_path=name and v.publication_status='published' and v.status in ('available','reserved')
));
create policy storage_photo_admin on storage.objects for all to authenticated
using (bucket_id='vehicle-photos' and (select public.is_catalog_admin()))
with check (bucket_id='vehicle-photos' and (select public.is_catalog_admin()));

create function public.catalog_brands()
returns table (brand text) language sql stable security invoker set search_path=''
as $$ select distinct v.brand from public.vehicles v where v.publication_status='published' and v.status in ('available','reserved') order by v.brand; $$;
revoke all on function public.catalog_brands() from public;
grant execute on function public.catalog_brands() to anon, authenticated;

create function public.prepare_vehicle_write()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at=now();
  if new.publication_status='published' and not exists (
    select 1 from public.vehicle_images i join storage.objects o on o.bucket_id='vehicle-photos' and o.name=i.object_path
    where i.vehicle_id=new.id and i.is_primary
  ) then
    raise exception 'Tambahkan foto utama sebelum menerbitkan unit.';
  end if;
  return new;
end;
$$;
create trigger vehicle_write before insert or update on public.vehicles
for each row execute function public.prepare_vehicle_write();

create function public.set_primary_photo(unit_id uuid, photo_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not (select public.is_catalog_admin()) then raise exception 'Akses ditolak'; end if;
  perform 1 from public.vehicles where id=unit_id for update;
  if not exists (select 1 from public.vehicle_images where id=photo_id and vehicle_id=unit_id) then
    raise exception 'Foto tidak ditemukan';
  end if;
  update public.vehicle_images set is_primary=false where vehicle_id=unit_id and is_primary and id<>photo_id;
  update public.vehicle_images set is_primary=true where id=photo_id;
end;
$$;
revoke all on function public.set_primary_photo(uuid,uuid) from public;
grant execute on function public.set_primary_photo(uuid,uuid) to authenticated;

create function public.guard_primary_delete()
returns trigger language plpgsql set search_path='' as $$
begin
  perform 1 from public.vehicles where id=old.vehicle_id for update;
  if old.is_primary and exists (select 1 from public.vehicles where id=old.vehicle_id and publication_status='published') then
    raise exception 'Pilih foto utama lain sebelum menghapus foto ini.';
  end if;
  return old;
end;
$$;
create trigger guard_primary_delete before delete on public.vehicle_images
for each row execute function public.guard_primary_delete();

commit;