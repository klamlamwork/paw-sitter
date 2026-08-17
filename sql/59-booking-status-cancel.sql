-- Allow both spellings and refund payment statuses. Paste into the Supabase SQL editor.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'booking_status' AND e.enumlabel = 'cancelled'
     ) THEN
    ALTER TYPE public.booking_status ADD VALUE 'cancelled';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'booking_status' AND e.enumlabel = 'canceled'
     ) THEN
    ALTER TYPE public.booking_status ADD VALUE 'canceled';
  END IF;
END $$;

DO $$
DECLARE
  label text;
BEGIN
  FOREACH label IN ARRAY ARRAY['refunded', 'partially_refunded', 'canceled', 'cancelled']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status')
       AND NOT EXISTS (
         SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'payment_status' AND e.enumlabel = label
       ) THEN
      EXECUTE format('ALTER TYPE public.payment_status ADD VALUE %L', label);
    END IF;
  END LOOP;
END $$;

notify pgrst, 'reload schema';
