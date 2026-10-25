import { authFetch } from "@/lib/api/authFetch";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TickSquare as Check } from "@/components/icons";
import { UserMinus } from "@/components/icons/rounded";;

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

  // Read the real block state, so the button never offers "Block" for someone already blocked.
  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_BASE}/blocked-users`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const list: Array<{ id: number }> = Array.isArray(json?.data?.data) ? json.data.data : Array.isArray(json?.data) ? json.data : [];
        if (!cancelled && list.some((u) => u.id === userId)) {
          setIsBlocked(true);
          onBlockStatusChange?.(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleBlock = async () => {
    setIsLoading(true);
    const endpoint = `${API_BASE}/users/${userId}/block`;
    const method = isBlocked ? 'DELETE' : 'POST';

    try {
      const res = await authFetch(endpoint, {
        method,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        toast.error(isBlocked ? 'Could not unblock this user. Please try again.' : 'Could not block this user. Please try again.');
        return;
      }
      const nextState = !isBlocked;
      setIsBlocked(nextState);
      if (onBlockStatusChange) onBlockStatusChange(nextState);
    } catch {
      toast.error('Network error. Please try again.');
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
      className="text-xs font-semibold gap-1.5 h-8 px-3 rounded-lg"
    >
      {isBlocked ? (
        <>
          <Check weight="fill" className="h-3.5 w-3.5 text-emerald-500" />
          Blocked
        </>
      ) : (
        <>
          <UserMinus weight="fill" className="h-3.5 w-3.5" />
          Block User
        </>
      )}
    </Button>
  );
}
