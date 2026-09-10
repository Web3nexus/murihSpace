import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useConfirm } from '@/components/ui/DialogProvider';
import {
  Calendar,
  Clock,
  VideoCamera,
  Spinner,
  Plus,
  Trash,
  Check,
  X,
  MapPin,
  CreditCard,
  Pencil,
  CaretRight,
  HandHeart,
  WarningCircle,
  Users,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";
import { SuccessBanner } from '@/components/ui/SuccessBanner';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';
import { LiveKitVideoConference } from '@/components/video/LiveKitVideoConference';

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface CoachingService {
  id: number;
  creator_id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  location_type: string;
  meeting_url: string | null;
  is_active: boolean;
  buffer_minutes: number;
  max_daily_bookings: number | null;
  creator?: { id: number; name: string; username: string; avatar_url: string | null };
  upcoming_bookings?: number;
  available_slots?: number;
  created_at?: string;
}

interface CoachingSlot {
  id: number;
  service_id: number;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

interface CoachingBooking {
  id: number;
  service_id: number;
  booker_id: number;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  meeting_url: string | null;
  price_paid: number;
  currency: string;
  service?: {
    id: number;
    name: string;
    duration_minutes: number;
    location_type: string;
    meeting_url: string | null;
    creator?: { id: number; name: string; username: string; avatar_url: string | null };
  };
  booker?: { id: number; name: string; username: string; avatar_url: string | null };
}

type Tab = 'browse' | 'my-services' | 'my-bookings' | 'my-sessions';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({
  service,
  onBook,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  service: CoachingService;
  onBook?: (s: CoachingService) => void;
  onEdit?: (s: CoachingService) => void;
  onDelete?: (id: number) => void;
  onToggleActive?: (s: CoachingService) => void;
}) {
  const isOnline = service.location_type === 'online' || !service.location_type;
  return (
    <div className="group flex flex-col rounded-3xl border border-border/70 bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 p-5">
      {service.creator && (
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden border border-primary/20">
            {service.creator.avatar_url ? (
              <img src={service.creator.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              service.creator.name.charAt(0)
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-foreground block truncate">{service.creator.name}</span>
            {service.creator.username && (
              <span className="text-[10px] text-muted-foreground block -mt-0.5">@{service.creator.username}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-base font-black text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {service.name}
        </h3>
        <span
          className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            service.is_active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-muted text-muted-foreground border-border/60'
          }`}
        >
          {service.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {service.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{service.description}</p>
      )}

      {/* Feature Pills */}
      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted/60 text-foreground border border-border/60">
          <Clock weight="fill" className="h-3 w-3 text-primary shrink-0" />
          {service.duration_minutes} min
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {isOnline ? (
            <>
              <VideoCamera weight="fill" className="h-3 w-3 shrink-0" />
              MurihSpace Meeting
            </>
          ) : (
            <>
              <MapPin weight="fill" className="h-3 w-3 shrink-0" />
              In Person
            </>
          )}
        </span>
        <span className="ml-auto text-sm font-black text-foreground">
          {service.price === 0 ? 'Free' : formatPrice(service.price, service.currency)}
        </span>
      </div>

      {service.available_slots !== undefined && (
        <p className="text-[11px] text-muted-foreground mt-2.5 flex items-center gap-1 font-medium">
          <Calendar weight="bold" className="h-3 w-3 text-primary" />
          {service.available_slots} slot{service.available_slots !== 1 ? 's' : ''} available
        </p>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40">
        {onBook && (
          <Button
            onClick={() => onBook(service)}
            className="flex-1 h-10 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <CreditCard weight="fill" className="mr-1.5 h-3.5 w-3.5" />
            Book Consultation
          </Button>
        )}
        {onEdit && (
          <Button onClick={() => onEdit(service)} variant="outline" size="sm" className="h-10 w-10 p-0 rounded-2xl" title="Edit Service">
            <Pencil weight="fill" className="h-4 w-4" />
          </Button>
        )}
        {onToggleActive && (
          <Button
            onClick={() => onToggleActive(service)}
            variant="outline"
            size="sm"
            className={`h-10 w-10 p-0 rounded-2xl ${
              service.is_active ? 'text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10' : 'text-muted-foreground'
            }`}
            title={service.is_active ? 'Deactivate' : 'Activate'}
          >
            <Check weight="bold" className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => onDelete(service.id)}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete"
          >
            <Trash weight="fill" className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Booking Row (with Native MurihSpace Meeting Button) ────────────────────────
function BookingRow({
  booking,
  isCreator,
  onCancel,
  onComplete,
  onJoinMeeting,
}: {
  booking: CoachingBooking;
  isCreator: boolean;
  onCancel: (id: number) => void;
  onComplete: (id: number) => void;
  onJoinMeeting: (b: CoachingBooking) => void;
}) {
  const person = isCreator ? booking.booker : booking.service?.creator;
  const statusStyle: Record<string, string> = {
    confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    completed: 'bg-primary/10 text-primary border-primary/20',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };

  const isOnline = booking.service?.location_type === 'online' || !booking.service?.location_type;

  return (
    <div className="p-4 sm:p-5 rounded-3xl border border-border/70 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden">
          {person?.avatar_url ? (
            <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            person?.name?.charAt(0) ?? '?'
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm sm:text-base font-bold text-foreground truncate">{booking.service?.name ?? 'Coaching Session'}</p>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${statusStyle[booking.status] ?? 'bg-muted text-muted-foreground border-border/60'}`}>
              {booking.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">with {person?.name ?? 'Unknown'}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-primary font-semibold">
              <Calendar weight="fill" className="h-3.5 w-3.5 shrink-0" />
              {formatDateTime(booking.start_time)}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <Clock weight="fill" className="h-3.5 w-3.5 shrink-0" />
              {booking.service?.duration_minutes ?? 30} min
            </span>
            <span className="flex items-center gap-1 font-semibold text-foreground">
              {isOnline ? 'MurihSpace Video Conference' : 'In Person'}
            </span>
          </div>
          {booking.notes && (
            <p className="text-[11px] text-muted-foreground/70 italic bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40 mt-1 max-w-lg">
              "{booking.notes}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 justify-end flex-wrap">
        {/* Built-in MurihSpace Video Meeting Button */}
        {booking.status === 'confirmed' && isOnline && (
          <Button
            onClick={() => onJoinMeeting(booking)}
            className="h-10 px-4 rounded-2xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold gap-2 shadow-sm shadow-[#1877f2]/20"
          >
            <VideoCamera weight="fill" className="h-4 w-4 animate-pulse" />
            Join MurihSpace Meeting
          </Button>
        )}

        {booking.status === 'confirmed' && isCreator && (
          <Button
            onClick={() => onComplete(booking.id)}
            variant="outline"
            size="sm"
            className="h-10 px-3 rounded-2xl text-xs font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
            title="Mark complete"
          >
            <Check weight="bold" className="h-4 w-4 mr-1" /> Complete
          </Button>
        )}

        {booking.status === 'confirmed' && (
          <Button
            onClick={() => onCancel(booking.id)}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Cancel booking"
          >
            <X weight="bold" className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export function CoachingPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('browse');

  const [services, setServices] = useState<CoachingService[]>([]);
  const [myServices, setMyServices] = useState<CoachingService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [myBookings, setMyBookings] = useState<CoachingBooking[]>([]);
  const [mySessions, setMySessions] = useState<CoachingBooking[]>([]);

  // Active in-page meeting state
  const [activeMeetingBooking, setActiveMeetingBooking] = useState<CoachingBooking | null>(null);

  // Service form states
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<CoachingService | null>(null);
  const [sfName, setSfName] = useState('');
  const [sfDesc, setSfDesc] = useState('');
  const [sfDuration, setSfDuration] = useState('30');
  const [sfPrice, setSfPrice] = useState('0');
  const [sfLocation, setSfLocation] = useState<'online' | 'in_person'>('online');
  const [sfVenue, setSfVenue] = useState('');
  const [sfBuffer, setSfBuffer] = useState('10');
  const [sfMaxDaily, setSfMaxDaily] = useState('');

  // Booking states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<CoachingService | null>(null);
  const [availableSlots, setAvailableSlots] = useState<CoachingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const browsePage = 1;
  const servicesPage = 1;
  const bookingsPage = 1;
  const sessionsPage = 1;

  // ── Data fetching ──────────────────────────────────────────────
  const fetchPublicServices = useCallback(async () => {
    try {
      const res = await authFetch(`/coaching/services?page=${browsePage}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        setServices(json.data?.data ?? []);
      }
    } catch { /* silent */ }
  }, [browsePage]);

  const fetchMyServices = useCallback(async () => {
    try {
      const res = await authFetch(`/coaching/my-services?page=${servicesPage}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        setMyServices(json.data?.data ?? []);
      }
    } catch { /* silent */ }
  }, [servicesPage]);

  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await authFetch(`/coaching/my-bookings?page=${bookingsPage}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        setMyBookings(json.data?.data ?? []);
      }
    } catch { /* silent */ }
  }, [bookingsPage]);

  const fetchMySessions = useCallback(async () => {
    try {
      const res = await authFetch(`/coaching/my-sessions?page=${sessionsPage}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        setMySessions(json.data?.data ?? []);
      }
    } catch { /* silent */ }
  }, [sessionsPage]);

  useEffect(() => { fetchPublicServices().finally(() => setIsLoadingServices(false)); }, [fetchPublicServices]);
  useEffect(() => { fetchMyServices(); }, [fetchMyServices]);
  useEffect(() => { fetchMyBookings(); }, [fetchMyBookings]);
  useEffect(() => { fetchMySessions(); }, [fetchMySessions]);

  // ── Service CRUD ───────────────────────────────────────────────
  const resetServiceForm = () => {
    setSfName('');
    setSfDesc('');
    setSfDuration('30');
    setSfPrice('0');
    setSfLocation('online');
    setSfVenue('');
    setSfBuffer('10');
    setSfMaxDaily('');
    setEditingService(null);
  };

  const openEditService = (s: CoachingService) => {
    setSfName(s.name);
    setSfDesc(s.description ?? '');
    setSfDuration(String(s.duration_minutes));
    setSfPrice(String(s.price / 100));
    setSfLocation(s.location_type === 'in_person' ? 'in_person' : 'online');
    setSfVenue(s.meeting_url?.startsWith('/app') ? '' : (s.meeting_url ?? ''));
    setSfBuffer(String(s.buffer_minutes ?? 10));
    setSfMaxDaily(s.max_daily_bookings ? String(s.max_daily_bookings) : '');
    setEditingService(s);
    setShowServiceForm(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const body = {
      name: sfName.trim(),
      description: sfDesc.trim() || null,
      duration_minutes: parseInt(sfDuration),
      price: Math.round(parseFloat(sfPrice || '0') * 100),
      location_type: sfLocation,
      meeting_url: sfLocation === 'in_person' && sfVenue ? sfVenue.trim() : null,
      buffer_minutes: parseInt(sfBuffer) || 0,
      max_daily_bookings: sfMaxDaily ? parseInt(sfMaxDaily) : null,
    };

    try {
      const endpoint = editingService ? `/coaching/services/${editingService.id}` : `/coaching/services`;
      const res = await authFetch(endpoint, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save service.');
      setShowServiceForm(false);
      resetServiceForm();
      setMessage({ type: 'success', text: editingService ? 'Service updated successfully!' : 'Service created successfully!' });
      fetchMyServices();
      fetchPublicServices();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred.' });
    }
    setIsSubmitting(false);
  };

  const handleDeleteService = async (id: number) => {
    if (!await confirm({ title: 'Delete Service', message: 'Delete this service? This cannot be undone.', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/coaching/services/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Delete failed.');
      setMyServices((prev) => prev.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: 'Service deleted.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  const openBooking = async (service: CoachingService) => {
    setSelectedServiceForBooking(service);
    setSelectedSlotId(null);
    setBookingNotes('');
    setShowBookingModal(true);
    try {
      const res = await authFetch(`/coaching/services/${service.id}`);
      if (res.ok) {
        const json = await res.json();
        setAvailableSlots((json.data?.data ?? json.data)?.available_slots ?? []);
      }
    } catch { setAvailableSlots([]); }
  };

  const handleBook = async () => {
    if (!selectedServiceForBooking || !selectedSlotId) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await authFetch(`/coaching/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selectedServiceForBooking.id, slot_id: selectedSlotId, notes: bookingNotes || null }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setMessage({ type: 'error', text: `${json.message} Required: ${formatPrice(json.required)}, Balance: ${formatPrice(json.balance)}` });
      } else if (!res.ok) {
        throw new Error(json.message ?? 'Booking failed.');
      } else {
        setShowBookingModal(false);
        setMessage({ type: 'success', text: 'Session booked! You can join the MurihSpace video room when the meeting starts.' });
        fetchMyBookings();
        setTab('my-bookings');
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Booking failed.' });
    }
    setIsSubmitting(false);
  };

  const handleCancelBooking = async (id: number) => {
    if (!await confirm({ title: 'Cancel Booking', message: 'Cancel this booking? You will be refunded if paid.', variant: 'warning' })) return;
    try {
      const res = await authFetch(`/coaching/bookings/${id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Cancellation failed.');
      setMessage({ type: 'success', text: json.message });
      fetchMyBookings();
      fetchMySessions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cancellation failed.' });
    }
  };

  const handleCompleteSession = async (id: number) => {
    try {
      const res = await authFetch(`/coaching/bookings/${id}/complete`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to complete session.');
      setMessage({ type: 'success', text: json.message });
      fetchMySessions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to complete session.' });
    }
  };

  // Launch in-page MurihSpace Video Meeting
  const handleJoinMeeting = (booking: CoachingBooking) => {
    setActiveMeetingBooking(booking);
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'browse', label: 'Browse Services', icon: HandHeart },
    { key: 'my-services', label: 'My Services', icon: Calendar, count: myServices.length },
    { key: 'my-bookings', label: 'My Bookings', icon: CreditCard, count: myBookings.length },
    { key: 'my-sessions', label: 'Client Sessions', icon: Users, count: mySessions.length },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      {/* ── ACTIVE MEETING BANNER / EMBEDDED CONFEENCE ─────── */}
      {activeMeetingBooking && (
        <div className="space-y-4 p-4 sm:p-6 bg-card border-2 border-primary/40 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
              <div>
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {activeMeetingBooking.service?.name ?? '1:1 Coaching Meeting'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  MurihSpace Native Video Room · Google Meet Style
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveMeetingBooking(null)}
              className="rounded-xl text-xs font-bold"
            >
              Minimize Meeting
            </Button>
          </div>

          <LiveKitVideoConference
            tokenEndpoint={`/coaching/bookings/${activeMeetingBooking.id}/livekit-token`}
            roomTitle={activeMeetingBooking.service?.name ?? '1:1 Coaching Meeting'}
            onLeave={() => setActiveMeetingBooking(null)}
          />
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <VideoCamera weight="fill" className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-foreground">
              1:1 Consultations &amp; Meetings
            </h1>
          </div>
          <p className="text-sm sm:text-[15px] text-muted-foreground pl-14">
            Offer paid 1-on-1 advice sessions, video consultations, and instant video meetings with your community.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto ml-14 md:ml-0 flex-wrap">
          {/* Instant Meeting Button */}
          <Button
            asChild
            variant="outline"
            className="h-10 px-4 rounded-2xl text-xs font-bold gap-2 border-border/80 hover:bg-muted"
          >
            <Link to="/app/meetings">
              <VideoCamera weight="fill" className="h-4 w-4 text-emerald-500" />
              Instant Meeting
            </Link>
          </Button>

          {/* New Service Button */}
          <Button
            onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
            className="h-10 px-5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
          >
            <Plus weight="bold" className="h-4 w-4" /> New Service
          </Button>
        </div>
      </div>

      {/* ── MESSAGES ────────────────────────────────────────── */}
      {message?.type === 'success' && (
        <SuccessBanner message={message.text} onClose={() => setMessage(null)} />
      )}
      {message?.type === 'error' && (
        <FormErrorSummary errors={[message.text]} className="mb-1" />
      )}

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-border/60 overflow-x-auto scrollbar-none gap-1">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground font-medium",
            ].join(" ")}
          >
            <Icon weight="fill" className="h-4 w-4" />
            {label}
            {typeof count === 'number' && count > 0 && (
              <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: BROWSE SERVICES
      ══════════════════════════════════════════════════════ */}
      {tab === 'browse' && (
        <div className="space-y-5">
          {isLoadingServices ? (
            <div className="py-24 text-center space-y-3">
              <Spinner weight="bold" className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">Loading services…</p>
            </div>
          ) : services.filter((s) => s.is_active).length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <HandHeart weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No services listed yet</h3>
              <p className="text-sm text-muted-foreground">
                Creators haven't listed any 1:1 consultation sessions yet.
              </p>
              <Button
                onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
                className="h-9 px-4 rounded-2xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Plus weight="bold" className="h-3.5 w-3.5" /> Offer Your Own Service
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.filter((s) => s.is_active).map((s) => (
                <ServiceCard key={s.id} service={s} onBook={openBooking} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: MY SERVICES (CREATOR)
      ══════════════════════════════════════════════════════ */}
      {tab === 'my-services' && (
        <div className="space-y-5">
          {myServices.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <Calendar weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No coaching services created</h3>
              <p className="text-sm text-muted-foreground">
                Set up 1:1 advice sessions, portfolio reviews, or strategy meetings.
              </p>
              <Button
                onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
                className="h-9 px-4 rounded-2xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Plus weight="bold" className="h-3.5 w-3.5" /> Create First Service
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myServices.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onEdit={openEditService}
                  onDelete={handleDeleteService}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: MY BOOKINGS (ATTENDEE)
      ══════════════════════════════════════════════════════ */}
      {tab === 'my-bookings' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <CreditCard weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No bookings yet</h3>
              <p className="text-sm text-muted-foreground">
                Browse creator services to book a 1-on-1 consultation.
              </p>
              <Button
                onClick={() => setTab('browse')}
                className="h-9 px-4 rounded-2xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <HandHeart weight="fill" className="h-3.5 w-3.5" /> Browse Services
              </Button>
            </div>
          ) : (
            myBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                isCreator={false}
                onCancel={handleCancelBooking}
                onComplete={() => {}}
                onJoinMeeting={handleJoinMeeting}
              />
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: CLIENT SESSIONS (HOST)
      ══════════════════════════════════════════════════════ */}
      {tab === 'my-sessions' && (
        <div className="space-y-3">
          {mySessions.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <Users weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No upcoming client sessions</h3>
              <p className="text-sm text-muted-foreground">
                When members book consultations with you, they will appear here with your MurihSpace meeting room link.
              </p>
              <Button
                onClick={() => setTab('my-services')}
                variant="outline"
                className="h-9 px-4 rounded-2xl text-xs font-semibold gap-1.5"
              >
                <Calendar weight="fill" className="h-3.5 w-3.5 text-primary" /> Manage Services
              </Button>
            </div>
          ) : (
            mySessions.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                isCreator={true}
                onCancel={handleCancelBooking}
                onComplete={handleCompleteSession}
                onJoinMeeting={handleJoinMeeting}
              />
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          REDESIGNED NEW/EDIT SERVICE POPUP MODAL
      ══════════════════════════════════════════════════════ */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="border border-border/80 rounded-3xl bg-card max-w-xl w-full shadow-2xl my-6 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <VideoCamera weight="fill" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    {editingService ? 'Edit Consultation Service' : 'New 1:1 Service'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Native MurihSpace Video Room · No external links required
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowServiceForm(false)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveService} className="p-6 space-y-5">
              {/* Service Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Service Title *
                </label>
                <Input
                  value={sfName}
                  onChange={(e) => setSfName(e.target.value)}
                  required
                  placeholder="e.g. 30-min Strategy Consultation"
                  className="text-sm rounded-2xl h-11 bg-muted/30 border-border/70"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={sfDesc}
                  onChange={(e) => setSfDesc(e.target.value)}
                  placeholder="What topics will you cover in this session?"
                  rows={3}
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-2xl bg-muted/30 border border-border/70 text-foreground outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
                />
              </div>

              {/* Location Type / Meeting Mode Visual Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Meeting Location *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* MurihSpace Meeting */}
                  <button
                    type="button"
                    onClick={() => setSfLocation('online')}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
                      sfLocation === 'online'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                        : 'border-border/70 bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                        <VideoCamera weight="fill" className="h-5 w-5" />
                      </div>
                      {sfLocation === 'online' && (
                        <span className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check weight="bold" className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">MurihSpace Meeting</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Built-in HD video, screen sharing, &amp; crystal audio
                      </p>
                    </div>
                  </button>

                  {/* In-Person Meeting */}
                  <button
                    type="button"
                    onClick={() => setSfLocation('in_person')}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
                      sfLocation === 'in_person'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                        : 'border-border/70 bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                        <MapPin weight="fill" className="h-5 w-5" />
                      </div>
                      {sfLocation === 'in_person' && (
                        <span className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check weight="bold" className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">In-Person Meeting</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Physical venue, coffee shop, or studio location
                      </p>
                    </div>
                  </button>
                </div>

                {/* If online: Explain no URL needed */}
                {sfLocation === 'online' && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <Check weight="bold" className="h-4 w-4 shrink-0" />
                    <span>MurihSpace automatically generates a private Google Meet-style video room for every confirmed booking.</span>
                  </div>
                )}

                {/* If in_person: Show venue input */}
                {sfLocation === 'in_person' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Meeting Venue / Address
                    </label>
                    <Input
                      value={sfVenue}
                      onChange={(e) => setSfVenue(e.target.value)}
                      placeholder="e.g. Starbucks, Victoria Island, Lagos"
                      className="text-xs rounded-xl h-10 bg-muted/30"
                    />
                  </div>
                )}
              </div>

              {/* Duration & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Duration (Minutes) *
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['15', '30', '45', '60'].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSfDuration(mins)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          sfDuration === mins
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-muted/50 border border-border/70 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                    <div className="flex-1 min-w-[70px]">
                      <Input
                        type="number"
                        value={sfDuration}
                        onChange={(e) => setSfDuration(e.target.value)}
                        min={10}
                        max={480}
                        required
                        className="text-xs rounded-xl h-9 text-center bg-muted/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Price (NGN ₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                      ₦
                    </span>
                    <Input
                      type="number"
                      value={sfPrice}
                      onChange={(e) => setSfPrice(e.target.value)}
                      min={0}
                      step={100}
                      placeholder="0 (Free)"
                      className="text-sm font-bold rounded-2xl h-11 pl-8 bg-muted/30 border-border/70"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Enter 0 to offer this consultation free of charge.
                  </span>
                </div>
              </div>

              {/* Scheduling Settings */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Buffer Time (min)
                  </label>
                  <Input
                    type="number"
                    value={sfBuffer}
                    onChange={(e) => setSfBuffer(e.target.value)}
                    min={0}
                    max={120}
                    className="text-xs rounded-xl h-9 bg-muted/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Daily Limit
                  </label>
                  <Input
                    type="number"
                    value={sfMaxDaily}
                    onChange={(e) => setSfMaxDaily(e.target.value)}
                    min={1}
                    max={50}
                    placeholder="Unlimited"
                    className="text-xs rounded-xl h-9 bg-muted/30"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowServiceForm(false)}
                  className="text-xs h-11 px-5 rounded-2xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-11 px-6 rounded-2xl gap-2 shadow-sm"
                >
                  {isSubmitting ? <Spinner weight="bold" className="h-4 w-4 animate-spin" /> : <Check weight="bold" className="h-4 w-4" />}
                  {editingService ? 'Update Service' : 'Create Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BOOKING MODAL ──────────────────────────────────── */}
      {showBookingModal && selectedServiceForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="border border-border/80 rounded-3xl bg-card max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
              <div>
                <h3 className="text-base font-bold text-foreground">{selectedServiceForBooking.name}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock weight="fill" className="h-3.5 w-3.5 text-primary" />
                    {selectedServiceForBooking.duration_minutes} min
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedServiceForBooking.price === 0 ? 'Free' : formatPrice(selectedServiceForBooking.price, selectedServiceForBooking.currency)}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {availableSlots.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <WarningCircle weight="fill" className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-foreground">No available slots</p>
                  <p className="text-xs text-muted-foreground">The creator hasn't published upcoming available times yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider">Select a time slot</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={[
                          "w-full flex items-center justify-between p-3.5 rounded-2xl text-xs border transition-all",
                          selectedSlotId === slot.id
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-border/70 bg-card hover:bg-muted/60 text-foreground font-medium",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar weight="fill" className="h-3.5 w-3.5 shrink-0" />
                          {formatDateTime(slot.start_time)}
                        </span>
                        <CaretRight weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Notes for host (optional)</label>
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="What would you like to discuss during this session?"
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-card border border-border/70 outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowBookingModal(false)} className="text-xs h-10 px-4 rounded-2xl">Cancel</Button>
                <Button
                  onClick={handleBook}
                  disabled={!selectedSlotId || isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 rounded-2xl px-5 gap-1.5"
                >
                  {isSubmitting ? <Spinner weight="bold" className="h-4 w-4 animate-spin" /> : <CreditCard weight="fill" className="h-4 w-4" />}
                  {selectedServiceForBooking.price > 0
                    ? `Pay ${formatPrice(selectedServiceForBooking.price, selectedServiceForBooking.currency)}`
                    : 'Book Free Session'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoachingPage;
