-- Run in Supabase SQL Editor. Existing prescription rows remain valid.

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS prescription_id UUID;

CREATE INDEX IF NOT EXISTS prescriptions_prescription_id_idx
  ON public.prescriptions (prescription_id);

UPDATE public.prescriptions
SET prescription_id = gen_random_uuid()
WHERE prescription_id IS NULL;
