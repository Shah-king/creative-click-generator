// Deno Supabase Edge Function: generate-video (Replicate -> Supabase Storage -> DB)
declare const Deno: { env: { get(key: string): string | undefined } };
// @ts-expect-error remote import for Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const baseCors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = Object.assign({}, baseCors, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': origin === '*' ? 'false' : 'true',
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    interface GenReq { prompt: string; imageUrl?: string | null; durationSeconds?: number }
    const { prompt, imageUrl, durationSeconds } = await req.json() as GenReq;

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const IMAGEKIT_BASE_URL = Deno.env.get('IMAGEKIT_BASE_URL');

    if (!REPLICATE_API_TOKEN) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Call Replicate (image->video model)
    const replicateResp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'replicate/video-model:latest',
        input: { prompt, image: imageUrl || null, duration: durationSeconds || 6 }
      })
    });

    if (!replicateResp.ok) {
      const text = await replicateResp.text();
      console.error('Replicate error', replicateResp.status, text);
      return new Response(JSON.stringify({ error: 'Provider error' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await replicateResp.json();

    // Replicate may return an immediate URL or require polling; check common fields
    const possibleUrl = data?.output?.[0] || data?.result || data?.output_url || null;
    let finalUrl: string | null = null;
    if (possibleUrl && typeof possibleUrl === 'string' && possibleUrl.startsWith('http')) finalUrl = possibleUrl;

    if (finalUrl && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      // download and upload to Supabase storage
      const vResp = await fetch(finalUrl);
      const blob = await vResp.arrayBuffer();
      const fileName = `videos/${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`;

      try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/put/public/${encodeURIComponent(fileName)}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'video/mp4'
          },
          body: new Uint8Array(blob)
        });

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(fileName)}`;
        const imagekitUrl = IMAGEKIT_BASE_URL ? `${IMAGEKIT_BASE_URL}/${fileName}` : null;

        // Insert metadata into DB
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify({ prompt, original_image_url: imageUrl || null, provider: 'replicate', status: 'completed', result_url: publicUrl })
          });
        } catch (dbErr) {
          console.error('Failed to insert video metadata', dbErr);
        }

        return new Response(JSON.stringify({ videoUrl: publicUrl, imageKitUrl: imagekitUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (uploadErr) {
        console.error('Failed to upload video to storage', uploadErr);
        return new Response(JSON.stringify({ error: 'Failed to store video' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Fallback: return job id for client-side polling or future webhook handling
    const predictionId = data?.id || data?.prediction_id || null;
    return new Response(JSON.stringify({ jobId: predictionId, raw: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-video error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
