import { useNavigate, useLocation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Sparkles } from "lucide-react";

interface AuthPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function AuthPromptModal({
  open,
  onOpenChange,
  title = "Join the Conversation on MurihSpace",
  description = "Log in or create a free account to join communities, follow creators, participate in live discussions, and access exclusive content.",
}: AuthPromptModalProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = () => {
    onOpenChange(false);
    navigate("/login", { state: { from: location } });
  };

  const handleRegister = () => {
    onOpenChange(false);
    navigate("/register", { state: { from: location } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#2164b6] to-[#102840] flex items-center justify-center text-white shadow-lg shadow-[#2164b6]/20">
            <Sparkles className="h-7 w-7 text-white animate-pulse" />
          </div>

          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col w-full gap-2.5 pt-2">
            <Button
              onClick={handleRegister}
              className="w-full h-10 font-bold text-xs bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create Free Account
            </Button>

            <Button
              variant="outline"
              onClick={handleLogin}
              className="w-full h-10 font-semibold text-xs border-border hover:bg-muted gap-2"
            >
              <LogIn className="h-4 w-4 text-secondary" />
              Sign In to Your Account
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/75 pt-1">
            Free forever. No credit card required to start.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
