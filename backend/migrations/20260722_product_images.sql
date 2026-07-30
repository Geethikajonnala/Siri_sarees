create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  image_url text not null,
  position integer not null default 0,
  created_at timestamptz default timezone('utc'::text, now()),
  constraint product_images_position_range check (position >= 0 and position < 4)
);

create unique index if not exists product_images_product_position_idx
  on public.product_images(product_id, position);

create index if not exists product_images_product_id_idx
  on public.product_images(product_id);

insert into public.product_images (product_id, image_url, position)
select p.id, p.image_url, 0
from public.products p
where p.image_url is not null
  and btrim(p.image_url) <> ''
  and not exists (
    select 1
    from public.product_images pi
    where pi.product_id = p.id
  );
