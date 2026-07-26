import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { MotionProvider } from "./MotionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <MotionProvider>
              {children}
            </MotionProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
