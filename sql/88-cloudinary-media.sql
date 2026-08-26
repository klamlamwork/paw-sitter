-- Cloudinary media identifiers only. Do not persist Cloudinary delivery URLs.

alter table public.profiles
  add column if not exists avatar_public_id text,
  add column if not exists avatar_version bigint;

alter table public.sitters
  add column if not exists profile_pic_public_id text,
  add column if not exists profile_pic_version bigint;

alter table public.shop_product_media
  add column if not exists public_id text,
  add column if not exists version bigint;

-- The old url column remains temporarily so existing external images continue
-- to render until they are replaced/migrated. New Cloudinary writes use only
-- public_id/version.

notify pgrst, 'reload schema';
