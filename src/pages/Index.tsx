import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import type { User } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Zap, Image as ImageIcon, Rocket } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Generation",
      description: "Transform product images into professional ads using cutting-edge AI technology"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Generate stunning ads in seconds, not hours. Perfect for rapid marketing campaigns"
    },
    {
      icon: ImageIcon,
      title: "High Quality Output",
      description: "Get production-ready, high-resolution images optimized for all platforms"
    },
    {
      icon: Rocket,
      title: "Easy to Use",
      description: "No design skills needed. Just upload, describe, and download your perfect ad"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-20">
        <div className="absolute inset-0 bg-gradient-hero opacity-50" />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8 animate-float">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI-Powered Ad Generation</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent leading-tight">
              Turn Products into
              <br />
              Scroll-Stopping Ads
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Create professional product advertisements in seconds using the power of AI. 
              No design skills required.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8 h-14 shadow-glow"
                onClick={() => navigate(user ? "/generate" : "/auth")}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Creating Free
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 h-14"
                onClick={() => navigate("/gallery")}
              >
                View Examples
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose AdGen AI?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to create stunning product ads that convert
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-glow transition-smooth">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-primary mb-4">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto p-8 md:p-12 text-center bg-gradient-primary relative overflow-hidden">
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to Transform Your Marketing?
              </h2>
              <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                Join thousands of marketers creating stunning ads with AI. 
                Start free today, no credit card required.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 h-14"
                onClick={() => navigate(user ? "/generate" : "/auth")}
              >
                Get Started Now
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 AdGen AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;