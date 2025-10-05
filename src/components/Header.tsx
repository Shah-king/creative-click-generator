import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import type { User } from '@supabase/supabase-js';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HeaderProps {
  user?: User | null;
}

export const Header = ({ user }: HeaderProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm fixed top-0 w-full z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => navigate("/")}
        >
          <div className="p-2 rounded-lg bg-gradient-primary">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
            AdGen AI
          </span>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/generate")}
              >
                Generate
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/gallery")}
              >
                Gallery
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate("/auth")}
              >
                Get Started
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};