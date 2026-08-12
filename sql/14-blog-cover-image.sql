-- Cover image for public blog posts (URL only; no file upload).
alter table public.blog_posts
  add column if not exists cover_image_url text not null default '';
