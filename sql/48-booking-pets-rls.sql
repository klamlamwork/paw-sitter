-- Enable RLS on booking_pets if not already
alter table public.booking_pets enable row level security;

-- Allow inserts when the booking belongs to the current user
create policy "Users can insert booking pets for own bookings"
  on public.booking_pets
  for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_pets.booking_id
        and b.customer_id = auth.uid()
    )
  );

-- Allow viewing booking pets for own bookings
create policy "Users can view booking pets for own bookings"
  on public.booking_pets
  for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_pets.booking_id
        and b.customer_id = auth.uid()
    )
  );

-- Allow deleting booking pets for own bookings
create policy "Users can delete booking pets for own bookings"
  on public.booking_pets
  for delete
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_pets.booking_id
        and b.customer_id = auth.uid()
    )
  );
