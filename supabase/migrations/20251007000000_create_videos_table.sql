-- Create videos table to store generated video metadata
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  original_image_url text,
  provider text,
  provider_job_id text,
  status text NOT NULL DEFAULT 'pending', -- pending, processing, failed, completed
  result_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_timestamp_on_videos ON public.videos;
CREATE TRIGGER set_timestamp_on_videos
  BEFORE UPDATE OR INSERT ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();
