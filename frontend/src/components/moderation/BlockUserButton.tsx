import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserX, Check } from 'lucide-react';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

interface BlockUserButtonProps {
  userId: number;
  userName: string;
  isBlockedInitially?: boolean;
  onBlockStatusChange?: (blocked: boolean) => void;
}

export function BlockUserButton({
  userId,
  isBlockedInitially = false,
  onBlockStatusChange,
}: BlockUserButtonProps) {
  const [isBlocked, setIsBlocked] = useState(isBlockedInitially);
  const [isLoading, setIsLoading] = useState(false);

  const toggleBlock = async () => {
    setIsLoading(true);
    const token = getAuthToken();
    const endpoint = `${API_BASE}/users/${userId}/block`;
    const method = isBlocked ? 'DELETE' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const nextState = !isBlocked;
        setIsBlocked(nextState);
        if (onBlockStatusChange) onBlockStatusChange(nextState);
      }
    } catch {
      // Fail quietly
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isBlocked ? 'outline' : 'destructive'}
      size="sm"
      onClick={toggleBlock}
      disabled={isLoading}
      className="text-xs font-semibold gap-1.5 h-8 px-3 rounded-xl"
    >
      {isBlocked ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Blocked
        </>
      ) : (
        <>
          <UserX className="h-3.5 w-3.5" />
          Block User
        </>
      )}
    </Button>
  );
}
