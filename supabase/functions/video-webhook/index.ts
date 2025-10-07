// deno-lint-ignore-file
declare const Deno: { env: { get(key: string): string | undefined } };
// @ts-expect-error remote import for Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
  const payload = await req.json() as Record<string, unknown>;
    // Expect payload: { provider_job_id, status, video_url, our_job_id }
    const providerJobId = payload?.provider_job_id || payload?.job_id || null;
    const status = payload?.status || null;
    const videoUrl = payload?.video_url || payload?.result_url || null;
    const ourJobId = payload?.our_job_id || null;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Find our job either by our id or provider_job_id
    let targetJobId = ourJobId;
    if (!targetJobId && providerJobId) {
      const lookup = await fetch(`${SUPABASE_URL}/rest/v1/video_jobs?provider_job_id=eq.${providerJobId}&select=id`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      const lookupData = await lookup.json();
      targetJobId = lookupData?.[0]?.id;
    }

    if (!targetJobId) {
      console.error('Webhook: no matching job', payload);
      return new Response(JSON.stringify({ error: 'no matching job' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  const patchBody: Record<string, unknown> = {};
    if (status) patchBody.status = status;
    if (videoUrl) patchBody.result_url = videoUrl;
    if (payload?.error) patchBody.error_text = payload.error;

    await fetch(`${SUPABASE_URL}/rest/v1/video_jobs?id=eq.${targetJobId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchBody)
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('video-webhook error', err);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
