import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import type { User } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  // New form state matching the 'Create New Advertisement' template
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [adFormat, setAdFormat] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

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
    // Build an enriched prompt from the new form fields when the old `prompt` field is empty
    const builtParts: string[] = [];
    if (productName.trim()) builtParts.push(`Product: ${productName.trim()}`);
    if (productDescription.trim()) builtParts.push(`Description: ${productDescription.trim()}`);
    if (targetAudience.trim()) builtParts.push(`Target audience: ${targetAudience.trim()}`);
    if (adFormat) builtParts.push(`Format: ${adFormat}`);
    if (visualStyle) builtParts.push(`Style: ${visualStyle}`);
    if (additionalNotes.trim()) builtParts.push(`Notes: ${additionalNotes.trim()}`);

    const promptToUse = prompt.trim() || builtParts.join('. ');

    if (!promptToUse.trim()) {
      toast.error("Please enter a prompt or fill out the ad details");
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

      // Call edge function to generate ad (use the assembled prompt)
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: {
          prompt: promptToUse,
          imageUrl: uploadedImageUrl,
        },
      });

      if (error) throw error;

      setGeneratedUrl(data.imageUrl);

      // Save to database (keep same columns as before but store the assembled prompt)
      await supabase.from('generated_ads').insert({
        user_id: user.id,
        prompt: promptToUse,
        original_image_url: uploadedImageUrl,
        generated_image_url: data.imageUrl,
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

  // video generation removed — focusing on image generation

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <Header user={user} />

      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 text-white">
            <h1 className="text-4xl font-extrabold mb-2">Create New Advertisement</h1>
            <p className="opacity-90">Fill in the details and let AI create your perfect ad</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Form card */}
            <div className="bg-white/95 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Ad Details</h2>
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

                <div className="pt-2">
                  <div className="grid gap-3">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        className={`px-4 py-2 rounded-lg transition-all duration-150 ${mediaType === 'image'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg border-transparent'
                          : 'bg-white/10 text-white/80 border border-white/30'} `}
                        onClick={() => setMediaType('image')}
                      >
                        Image Ad
                      </button>
                      <button
                        type="button"
                        disabled
                        className={`px-4 py-2 rounded-lg bg-gray-300 text-gray-700 border-gray-300 cursor-not-allowed`}
                      >
                        Video Ad (Coming Soon)
                      </button>
                    </div>

                    <Input
                      id="product-name"
                      placeholder="e.g., Premium Wireless Headphones"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="h-12 bg-black text-white placeholder-gray-400 rounded-md px-4"
                    />

                    <Textarea
                      id="product-description"
                      placeholder="Describe your product, its features, benefits, and unique selling points..."
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      className="h-28 bg-black text-white placeholder-gray-400 rounded-md p-4"
                    />

                    <Input
                      id="target-audience"
                      placeholder="e.g., Tech-savvy millennials, 25-40 years old"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="h-12 bg-black text-white placeholder-gray-400 rounded-md px-4"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <select value={adFormat} onChange={(e) => setAdFormat(e.target.value)} className="bg-black text-white rounded-md p-3 border border-white/10">
                        <option value="">Select format</option>
                        <option value="square">Square (1:1)</option>
                        <option value="portrait">Portrait (4:5)</option>
                        <option value="landscape">Landscape (16:9)</option>
                      </select>

                      <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className="bg-black text-white rounded-md p-3 border border-white/10">
                        <option value="">Select style</option>
                        <option value="minimal">Minimal</option>
                        <option value="vibrant">Vibrant</option>
                        <option value="luxury">Luxury</option>
                        <option value="retro">Retro</option>
                      </select>
                    </div>

                    <Textarea
                      id="additional-notes"
                      placeholder="Any specific colors, themes, or elements you'd like to include..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="h-20 bg-black text-white placeholder-gray-400 rounded-md p-4"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 mt-6">
                  <Button 
                    onClick={handleGenerate} 
                    disabled={loading}
                    className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-95"
                    size="lg"
                  >
                    {loading ? (
                      "Generating..."
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        Generate Ad with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Preview card */}
            <div className="bg-white/95 rounded-2xl shadow-xl p-6 flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Preview</h3>
              <div className="flex-1 bg-gray-50 rounded-lg p-4 flex items-center justify-center overflow-hidden">
                {generatedUrl ? (
                  <div className="w-full h-full relative">
                    <img src={generatedUrl} alt="Generated ad" className="w-full h-full object-cover rounded-md" />
                    <div className="absolute bottom-4 right-4">
                      <Button onClick={handleDownload} size="sm" className="bg-white/90">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">Your generated ad will appear here</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generate;