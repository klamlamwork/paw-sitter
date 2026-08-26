-- Cloudinary media normalization for the existing product-create flow.
-- Some existing client code still inserts a Cloudinary delivery URL into url
-- while creating a product. This trigger extracts public_id/version and clears
-- url before storage, so the database never retains a Cloudinary URL.

alter table public.shop_product_media
  alter column url drop not null;

create or replace function public.normalize_cloudinary_product_media()
returns trigger
language plpgsql
as $$
declare
  parsed_version text;
  parsed_public_id text;
begin
  if new.public_id is null
     and new.url is not null
     and new.url like 'https://res.cloudinary.com/%/image/upload/%/v%/%' then
    parsed_version := substring(new.url from '/v([0-9]+)/');
    parsed_public_id := substring(new.url from '/v[0-9]+/(.+)$');
    if parsed_version is not null and parsed_public_id is not null then
      new.public_id := parsed_public_id;
      new.version := parsed_version::bigint;
      new.url := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_product_media_cloudinary_normalize on public.shop_product_media;
create trigger shop_product_media_cloudinary_normalize
  before insert or update on public.shop_product_media
  for each row execute function public.normalize_cloudinary_product_media();

notify pgrst, 'reload schema';
