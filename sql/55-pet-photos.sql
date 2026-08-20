-- Public pet photo bucket used by /account My Paw Kids

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

drop policy if exists pet_photos_public_read on storage.objects;
create policy pet_photos_public_read on storage.objects
  for select using (bucket_id = 'pet-photos');

drop policy if exists pet_photos_auth_write on storage.objects;
create policy pet_photos_auth_write on storage.objects
  for insert to authenticated with check (bucket_id = 'pet-photos');

drop policy if exists pet_photos_auth_update on storage.objects;
create policy pet_photos_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'pet-photos');

notify pgrst, 'reload schema';
