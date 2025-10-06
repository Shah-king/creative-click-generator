-- Create video_jobs table to track async video generation jobs
CREATE TABLE IF NOT EXISTS public.video_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  provider text,
  provider_job_id text,
  status text NOT NULL DEFAULT 'pending', -- pending, processing, failed, completed
  result_url text,
  error_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger to set updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_timestamp_on_video_jobs ON public.video_jobs;
CREATE TRIGGER set_timestamp_on_video_jobs
  BEFORE UPDATE OR INSERT ON public.video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();
