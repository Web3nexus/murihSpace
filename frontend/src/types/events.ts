export interface EventData {
  id: number;
  community_id: number;
  creator_id: number;
  title: string;
  slug: string;
  description: string | null;
  event_type: "online" | "in_person" | "hybrid";
  start_date: string;
  end_date: string;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  cover_url: string | null;
  capacity: number | null;
  registration_deadline: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  community?: { id: number; name: string; slug: string; logo_url: string | null };
  creator?: { id: number; name: string; username: string; avatar: string | null };
  registration_count?: number;
  is_full?: boolean;
  is_registration_open?: boolean;
}

export interface EventRegistrationData {
  id: number;
  event_id: number;
  user_id: number;
  status: string;
  registered_at: string;
  attended_at: string | null;
  cancelled_at: string | null;
  event?: EventData;
  user?: { id: number; name: string; username: string; avatar: string | null };
}
