-- Run this in the Supabase SQL Editor to enable configurable procedure prices and invoice line items.

CREATE TABLE IF NOT EXISTS public.procedure_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS procedure_prices_name_unique
  ON public.procedure_prices (lower(name));

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  procedure_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.procedure_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage procedure prices" ON public.procedure_prices;
CREATE POLICY "Authenticated users can manage procedure prices"
  ON public.procedure_prices FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can manage invoice items"
  ON public.invoice_items FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.procedure_prices (name, price)
SELECT defaults.name, 0
FROM (VALUES
  ('Composite Filling'),
  ('Extraction'),
  ('Crown'),
  ('Root Canal'),
  ('Dental Implant'),
  ('Scaling / Cleaning')
) AS defaults(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedure_prices
  WHERE lower(public.procedure_prices.name) = lower(defaults.name)
);
