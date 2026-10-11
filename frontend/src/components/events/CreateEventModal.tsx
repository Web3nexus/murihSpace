import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { env } from "@/config/env";
import { ImageUploader } from "@/components/upload/ImageUploader";
import {
  Calendar as Calendar
} from "@phosphor-icons/react";
import { getAuthToken } from "@/lib/auth/token";
import type { EventData } from "@/types/events";

const API = env.VITE_API_BASE_URL;

interface Community {
  id: number;
  name: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Renders an ISO timestamp as the `YYYY-MM-DDTHH:mm` a datetime-local wants. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  community_id: "",
  title: "",
  description: "",
  event_type: "online",
  start_date: "",
  end_date: "",
  timezone: "UTC",
  location: "",
  meeting_url: "",
  capacity: "",
  cover_url: "",
  registration_deadline: "",
};

/** Seeds the form from an existing event, or a blank one when creating. */
function formFromEvent(event?: EventData | null) {
  if (!event) return { ...EMPTY_FORM };
  return {
    community_id: String(event.community_id ?? ""),
    title: event.title ?? "",
    description: event.description ?? "",
    event_type: event.event_type ?? "online",
    start_date: toLocalInput(event.start_date),
    end_date: toLocalInput(event.end_date),
    timezone: event.timezone ?? "UTC",
    location: event.location ?? "",
    meeting_url: event.meeting_url ?? "",
    capacity: event.capacity == null ? "" : String(event.capacity),
    cover_url: event.cover_url ?? "",
    registration_deadline: toLocalInput(event.registration_deadline),
  };
}

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When provided the modal edits this event instead of creating a new one. */
  event?: EventData | null;
}

export function CreateEventModal({ open, onClose, onCreated, event }: CreateEventModalProps) {
  const isEdit = Boolean(event);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => formFromEvent(event));

  useEffect(() => {
    if (!open) return;
    fetch(`${API}/my-communities`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((body) => setCommunities(body.data?.data ?? body.data ?? []))
      .catch(() => {});
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        timezone: form.timezone,
      };
      if (!isEdit) payload.community_id = Number(form.community_id);
      if (form.location) payload.location = form.location;
      if (form.meeting_url) payload.meeting_url = form.meeting_url;
      if (form.capacity) payload.capacity = Number(form.capacity);
      if (form.cover_url) payload.cover_url = form.cover_url;
      payload.registration_deadline = form.registration_deadline
        ? new Date(form.registration_deadline).toISOString()
        : null;

      const res = await fetch(
        isEdit ? `${API}/my-events/${event!.id}` : `${API}/my-events`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json();

      if (!res.ok) {
        setError(body.message || `Failed to ${isEdit ? "update" : "create"} event`);
        return;
      }

      onCreated();
      onClose();
      setForm({ ...EMPTY_FORM });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg p-4 sm:p-5">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Calendar weight="fill" className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEdit ? "Edit Event" : "Create Event"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {isEdit
                  ? "Update the details for your community event."
                  : "Schedule a new event for your community."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community">Community *</Label>
            <Select
              value={form.community_id}
              onValueChange={(v) => setForm((f) => ({ ...f, community_id: v }))}
              required
              disabled={isEdit}
            >
              <SelectTrigger id="community">
                <SelectValue placeholder="Select community" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                The hosting community cannot be changed after creation.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_type">Event Type *</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}
              >
                <SelectTrigger id="event_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start *</Label>
              <Input
                id="start_date"
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End *</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registration_deadline">
              Registration Deadline (optional)
            </Label>
            <Input
              id="registration_deadline"
              type="datetime-local"
              value={form.registration_deadline}
              onChange={(e) =>
                setForm((f) => ({ ...f, registration_deadline: e.target.value }))
              }
            />
          </div>

          {form.event_type !== "online" && (
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Venue address"
              />
            </div>
          )}

          {form.event_type !== "in_person" && (
            <div className="space-y-2">
              <Label htmlFor="meeting_url">Meeting URL</Label>
              <Input
                id="meeting_url"
                type="url"
                value={form.meeting_url}
                onChange={(e) => setForm((f) => ({ ...f, meeting_url: e.target.value }))}
                placeholder="https://zoom.us/j/..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (leave empty for unlimited)</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>

          <ImageUploader
            value={form.cover_url}
            onChange={(v) => setForm((f) => ({ ...f, cover_url: v }))}
            folder="events/covers"
            label="Event Cover Image"
          />

          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
