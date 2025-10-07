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
    let jobId = null;
    if (req.method === 'POST') {
      const body = await req.json();
      jobId = body?.jobId || null;
    }
    if (!jobId) {
      const url = new URL(req.url);
      jobId = url.searchParams.get('jobId');
    }
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/video_jobs?id=eq.${jobId}&select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const data = await resp.json();
    const job = data?.[0] || null;
    if (!job) return new Response(JSON.stringify({ error: 'job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ job }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('video-status error', err);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
