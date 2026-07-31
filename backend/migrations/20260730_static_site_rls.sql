-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- BEFORE switching the frontend to call Supabase directly with the anon key.
-- Without this, RLS is off and the anon key would grant full read/write to
-- everyone, which is just as bad as leaking the service_role key.

-- 1. Products: public can read, only signed-in admins can write.
alter table public.products enable row level security;

create policy "Public can read products"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert products"
  on public.products for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update products"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete products"
  on public.products for delete
  to authenticated
  using (true);

-- 2. product_images (only relevant if you query this table directly).
alter table public.product_images enable row level security;

create policy "Public can read product images"
  on public.product_images for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can manage product images"
  on public.product_images for all
  to authenticated
  using (true)
  with check (true);

-- 3. admins table: the app no longer uses this once login moves to Supabase
-- Auth (see README note below). Lock it down completely so the anon key can
-- never read password hashes out of it.
revoke all on public.admins from anon, authenticated;
-- Once you've created your Supabase Auth admin user and confirmed login
-- works end to end, you can drop this table entirely:
-- drop table public.admins;

-- 4. Storage bucket "saree_images": public read, signed-in upload/replace/delete.
-- The bucket itself must already exist (Storage tab) before running this.
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'saree_images');

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'saree_images');

create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'saree_images');

create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'saree_images');

-- 5. Admin login: create your admin user under
-- Authentication > Users > Add user (email + password) in the Supabase
-- dashboard. The frontend admin login now signs in with that email/password
-- via supabase.auth.signInWithPassword -- no custom admins table needed.
