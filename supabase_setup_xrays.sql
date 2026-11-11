-- Run this in your Supabase SQL Editor to set up X-Ray & Document Storage and Tables

-- 1. Create patient_documents table
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on patient_documents
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Policies for patient_documents
CREATE POLICY "Authenticated users can select patient documents"
  ON public.patient_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert patient documents"
  ON public.patient_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete patient documents"
  ON public.patient_documents FOR DELETE
  TO authenticated
  USING (true);

-- 2. Create the patient_files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient_files', 'patient_files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS policies for patient_files bucket
CREATE POLICY "Authenticated users can select patient files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient_files');

CREATE POLICY "Authenticated users can upload patient files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patient_files');

CREATE POLICY "Authenticated users can delete patient files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'patient_files');
