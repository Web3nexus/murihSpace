import { useNavigate, useLocation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SignIn as SignIn,
  UserPlus as UserPlus,
  Users as Users,
} from "@phosphor-icons/react";

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
      <DialogContent className="sm:max-w-md p-4 overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          <div className="h-14 w-14 rounded-lg bg-gradient-to-tr from-[#2164b6] to-[#102840] flex items-center justify-center text-white shadow-lg shadow-[#2164b6]/20">
            <Users weight="fill" className="h-7 w-7 text-white" />
          </div>

          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            <Button
              type="button"
              onClick={() => handleLogin()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/50 text-sm font-semibold transition-colors"
            >
              <SignIn weight="fill" className="h-4 w-4 mr-2" />
              Sign in with email
            </Button>
            <Button
              type="button"
              onClick={() => handleRegister()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              <UserPlus weight="fill" className="h-4 w-4 mr-2" />
              Create account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}