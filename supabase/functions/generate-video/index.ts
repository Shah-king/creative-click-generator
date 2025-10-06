// deno-lint-ignore-file
// This file is a Deno function that calls the Lovable AI gateway to request video generation.
// It's a prototype: set LOVABLE_API_KEY and optionally LOVABLE_VIDEO_MODEL in your Supabase function env.
declare const Deno: { env: { get(key: string): string | undefined } };
// @ts-expect-error: Remote import for Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// We'll compute CORS headers per-request so we can echo the Origin header back
// (browsers reject wildcard origins when credentials are present). This is
// safer for client-side calls to deployed Supabase Edge Functions.
const baseCors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  // Compute dynamic CORS headers using the request origin, if present
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = Object.assign({}, baseCors, {
    'Access-Control-Allow-Origin': origin,
    // Only allow credentials if origin is specific
    'Access-Control-Allow-Credentials': origin === '*' ? 'false' : 'true',
  });

  if (req.method === 'OPTIONS') {
    // Reply to preflight with allowed methods and headers.
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
  interface GenRequest { prompt: string; imageUrl?: string | null; durationSeconds?: number }
  const { prompt, imageUrl, durationSeconds } = await req.json() as GenRequest;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const LOVABLE_VIDEO_MODEL = Deno.env.get('LOVABLE_VIDEO_MODEL') || 'google/gemini-2.5-flash-video-preview';

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating video with prompt:', prompt);

    // Create a job row in the database using Supabase REST (requires service role key)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let ourJobId: string | null = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const jobResp = await fetch(`${SUPABASE_URL}/rest/v1/video_jobs`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ prompt, status: 'pending', provider: LOVABLE_VIDEO_MODEL })
        });
        const jobData = await jobResp.json();
        ourJobId = jobData?.[0]?.id;
      } catch (dbErr) {
        console.error('Failed to create video job row:', dbErr);
      }
    }

  const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Create a short advertisement video based on this prompt: ${prompt}. Make it visually striking, modern, and suitable for social media marketing.`
      }
    ];

    if (imageUrl) {
      content.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    // Include a simple generation config. Providers differ; adjust as needed.
  const generationConfig: Record<string, unknown> = {};
    if (durationSeconds) generationConfig.duration = durationSeconds;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LOVABLE_VIDEO_MODEL,
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        modalities: ["video", "text"],
        generation: generationConfig
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Generation response received');

    // If provider returns an async job id, store it and return our job id to the client
    const providerJobId = data?.job_id || data?.id || data?.choices?.[0]?.id || null;

    // Update our job row with provider_job_id and mark processing if available
    if (ourJobId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/video_jobs?id=eq.${ourJobId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ provider_job_id: providerJobId, status: providerJobId ? 'processing' : 'pending' })
        });
      } catch (dbErr) {
        console.error('Failed to update video job with provider id:', dbErr);
      }
    }

    // If provider returned an immediate URL, return it; otherwise return our job id so client can poll
    const maybeVideoUrl =
      data?.choices?.[0]?.message?.videos?.[0]?.video_url?.url ||
      data?.choices?.[0]?.message?.videos?.[0]?.url ||
      data?.choices?.[0]?.message?.images?.[0]?.video_url?.url ||
      data?.choices?.[0]?.message?.content?.[0]?.video_url?.url ||
      null;

    if (maybeVideoUrl) {
      // Finalize job in DB
      if (ourJobId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/video_jobs?id=eq.${ourJobId}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'completed', result_url: maybeVideoUrl })
          });
        } catch (dbErr) {
          console.error('Failed to finalize video job with URL:', dbErr);
        }
      }

      return new Response(JSON.stringify({ videoUrl: maybeVideoUrl, jobId: ourJobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Otherwise return the job id and provider job id for polling
    return new Response(JSON.stringify({ jobId: ourJobId, providerJobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in generate-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
