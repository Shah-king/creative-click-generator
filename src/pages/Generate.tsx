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

  // video feature removed

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

          {/* Video generation removed */}
        </div>
      </div>
    </div>
  );
};

export default Generate;