import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import type { User } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload, Wand2, Download } from "lucide-react";
import { toast } from "sonner";

const Generate = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      setUser(session.user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setLoading(true);
    setGeneratedUrl(null);

    try {
      let uploadedImageUrl = null;

      // Upload image if provided
      if (imageFile && user) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        uploadedImageUrl = data.publicUrl;
      }

      // Call edge function to generate ad
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: { 
          prompt,
          imageUrl: uploadedImageUrl 
        }
      });

      if (error) throw error;

      setGeneratedUrl(data.imageUrl);

      // Save to database
      await supabase.from('generated_ads').insert({
        user_id: user.id,
        prompt,
        original_image_url: uploadedImageUrl,
        generated_image_url: data.imageUrl
      });

      toast.success("Ad generated successfully!");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to generate ad");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedUrl;
    link.download = 'generated-ad.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Video generation flow
  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setVideoProcessing(true);
    setVideoUrl(null);
    setVideoJobId(null);

    try {
      let uploadedImageUrl = null;
      if (imageFile && user) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
        uploadedImageUrl = data.publicUrl;
      }

      let res;
      try {
        res = await supabase.functions.invoke('generate-video', {
          body: { prompt, imageUrl: uploadedImageUrl, durationSeconds: 6 }
        });
      } catch (invokeErr) {
        console.error('Failed to call generate-video function (invoke error):', invokeErr);
        toast.error('Failed to contact the video function. See console for details.');
        setVideoProcessing(false);
        return;
      }

      if (res?.error) {
        console.error('generate-video returned error:', res.error);
        toast.error(res.error?.message || 'Video function returned an error');
        setVideoProcessing(false);
        return;
      }

      // If immediate video URL returned
      if (res.data?.videoUrl) {
        setVideoUrl(res.data.videoUrl);
        setVideoProcessing(false);
        // Optionally save to DB under user's videos
        return;
      }

      const jobId = res.data?.jobId;
      if (jobId) {
        setVideoJobId(jobId);
        // Poll for status
        const poll = async () => {
          try {
            const statusRes = await supabase.functions.invoke('video-status', { body: { jobId } });
            if (statusRes.error) throw statusRes.error;
            const job = statusRes.data?.job;
            if (job?.status === 'completed' && job?.result_url) {
              setVideoUrl(job.result_url);
              setVideoProcessing(false);
              setVideoJobId(null);
              return;
            }
            if (job?.status === 'failed') {
              toast.error('Video generation failed');
              setVideoProcessing(false);
              setVideoJobId(null);
              return;
            }
          } catch (pollErr) {
            console.error('Polling error', pollErr);
          }
          setTimeout(poll, 3000);
        };
        setTimeout(poll, 1500);
      } else {
        throw new Error('No job id returned');
      }
    } catch (err) {
      console.error('Video generation error', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate video');
      setVideoProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Generate Product Ads
            </h1>
            <p className="text-muted-foreground text-lg">
              Transform your products into scroll-stopping ads with AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="image-upload" className="text-lg font-semibold mb-4 block">
                    Upload Product Image (Optional)
                  </Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-smooth">
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-h-48 mx-auto rounded-lg"
                        />
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            Click to upload or drag and drop
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="prompt" className="text-lg font-semibold mb-4 block">
                    Ad Prompt
                  </Label>
                  <Input
                    id="prompt"
                    placeholder="e.g., Modern tech product with vibrant colors, social media style"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-12"
                  />
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={loading}
                  className="w-full h-12 text-lg"
                  size="lg"
                >
                  {loading ? (
                    "Generating..."
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Ad
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Generated Ad</h3>
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                {generatedUrl ? (
                  <>
                    <img 
                      src={generatedUrl} 
                      alt="Generated ad" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      onClick={handleDownload}
                      className="absolute bottom-4 right-4"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Your generated ad will appear here
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Video generation section */}
          <div className="mt-8 max-w-6xl mx-auto">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Generate Video</h3>
                <Button onClick={handleGenerateVideo} disabled={videoProcessing}>
                  {videoProcessing ? 'Processing...' : 'Generate Video'}
                </Button>
              </div>
              <div className="bg-black/5 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
                {videoUrl ? (
                  <video controls src={videoUrl} className="w-full h-auto rounded" />
                ) : videoProcessing ? (
                  <p className="text-muted-foreground">Video is being generated. This can take a while...</p>
                ) : (
                  <p className="text-muted-foreground">Your generated video will appear here</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generate;