import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { MotionProvider } from "./MotionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { PopChatProvider } from "@/context/PopChatContext";
import { Toaster } from "sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider defaultTheme="system">
          <TooltipProvider>
            <MotionProvider>
              <DialogProvider>
                <PopChatProvider>
                  {children}
                  <Toaster richColors position="top-right" toastOptions={{ duration: 4000 }} />
                </PopChatProvider>
              </DialogProvider>
            </MotionProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
