import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Video, Loader2, Plus, Trash2, Check, AlertCircle, X, MapPin, CreditCard, ExternalLink, Edit, ChevronRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  service?: { id: number; name: string; duration_minutes: number; location_type: string; meeting_url: string | null; creator?: { id: number; name: string; username: string; avatar_url: string | null } };
  booker?: { id: number; name: string; username: string; avatar_url: string | null };
}

type Tab = 'browse' | 'my-services' | 'my-bookings' | 'my-sessions';

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
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
      {service.creator && (
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {service.creator.name.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-foreground truncate">{service.creator.name}</span>
          {service.creator.username && <span className="text-[10px] text-muted-foreground">@{service.creator.username}</span>}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold text-foreground">{service.name}</h3>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${service.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
          {service.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      {service.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{service.duration_minutes} min</span>
        <span className="flex items-center gap-1">{service.location_type === 'online' ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{service.location_type}</span>
        <span className="flex items-center gap-1 font-bold text-foreground">
          {service.price === 0 ? 'Free' : formatPrice(service.price, service.currency)}
        </span>
      </div>
      {service.available_slots !== undefined && (
        <p className="text-[10px] text-muted-foreground mt-2">
          {service.available_slots} available slot{service.available_slots !== 1 ? 's' : ''}
        </p>
      )}
      <div className="flex items-center gap-2 mt-4">
        {onBook && (
          <button
            onClick={() => onBook(service)}
            className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 transition-all"
          >
            Book Session
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(service)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Edit className="h-4 w-4" />
          </button>
        )}
        {onToggleActive && (
          <button onClick={() => onToggleActive(service)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={service.is_active ? 'Deactivate' : 'Activate'}>
            <Check className={`h-4 w-4 ${service.is_active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(service.id)} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BookingRow({ booking, isCreator, onCancel, onComplete }: {
  booking: CoachingBooking;
  isCreator: boolean;
  onCancel: (id: number) => void;
  onComplete: (id: number) => void;
}) {
  const person = isCreator ? booking.booker : booking.service?.creator;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {person?.name?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{booking.service?.name ?? 'Coaching Session'}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            with {person?.name ?? 'Unknown'}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(booking.start_time)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.service?.duration_minutes ?? '?'} min</span>
          </div>
          {booking.notes && <p className="text-[11px] text-muted-foreground/70 mt-1 italic">"{booking.notes}"</p>}
          {booking.status === 'confirmed' && booking.meeting_url && (
            <a href={booking.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:underline mt-1.5">
              <ExternalLink className="h-3 w-3" /> Join Meeting
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
          booking.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600' :
          booking.status === 'completed' ? 'bg-blue-500/10 text-blue-600' :
          booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
          'bg-muted text-muted-foreground'
        }`}>
          {booking.status}
        </span>
        {booking.status === 'confirmed' && isCreator && (
          <button onClick={() => onComplete(booking.id)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-colors" title="Mark complete">
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        {booking.status === 'confirmed' && (
          <button onClick={() => onCancel(booking.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Cancel booking">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CoachingPage() {
  const [tab, setTab] = useState<Tab>('browse');

  // Services
  const [services, setServices] = useState<CoachingService[]>([]);
  const [myServices, setMyServices] = useState<CoachingService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // My bookings / sessions
  const [myBookings, setMyBookings] = useState<CoachingBooking[]>([]);
  const [mySessions, setMySessions] = useState<CoachingBooking[]>([]);

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<CoachingService | null>(null);
  const [sfName, setSfName] = useState('');
  const [sfDesc, setSfDesc] = useState('');
  const [sfDuration, setSfDuration] = useState('30');
  const [sfPrice, setSfPrice] = useState('0');
  const [sfLocation, setSfLocation] = useState('online');
  const [sfMeetingUrl, setSfMeetingUrl] = useState('');
  const [sfBuffer, setSfBuffer] = useState('0');
  const [sfMaxDaily, setSfMaxDaily] = useState('');

  // Slot management
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [selectedServiceForSlots, _setSelectedServiceForSlots] = useState<CoachingService | null>(null);
  const [slotDates, setSlotDates] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');

  // Booking
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<CoachingService | null>(null);
  const [availableSlots, setAvailableSlots] = useState<CoachingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');

  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchPublicServices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/coaching/services`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setServices(json.data ?? []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchMyServices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/coaching/my-services`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setMyServices(json.data ?? []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/coaching/my-bookings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setMyBookings(json.data ?? []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchMySessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/coaching/my-sessions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setMySessions(json.data ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPublicServices(); fetchMyServices(); fetchMyBookings(); fetchMySessions(); setIsLoadingServices(false); }, [fetchPublicServices, fetchMyServices, fetchMyBookings, fetchMySessions]);

  // ── Service CRUD ───────────────────────────────────────────────

  const resetServiceForm = () => {
    setSfName(''); setSfDesc(''); setSfDuration('30'); setSfPrice('0');
    setSfLocation('online'); setSfMeetingUrl(''); setSfBuffer('0'); setSfMaxDaily('');
    setEditingService(null);
  };

  const openEditService = (s: CoachingService) => {
    setSfName(s.name); setSfDesc(s.description ?? ''); setSfDuration(String(s.duration_minutes));
    setSfPrice(String(s.price)); setSfLocation(s.location_type); setSfMeetingUrl(s.meeting_url ?? '');
    setSfBuffer(String(s.buffer_minutes)); setSfMaxDaily(s.max_daily_bookings ? String(s.max_daily_bookings) : '');
    setEditingService(s);
    setShowServiceForm(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const body = {
      name: sfName,
      description: sfDesc || null,
      duration_minutes: parseInt(sfDuration),
      price: Math.round(parseFloat(sfPrice) * 100),
      location_type: sfLocation,
      meeting_url: sfMeetingUrl || null,
      buffer_minutes: parseInt(sfBuffer) || 0,
      max_daily_bookings: sfMaxDaily ? parseInt(sfMaxDaily) : null,
    };

    try {
      const endpoint = editingService
        ? `${API_BASE}/coaching/services/${editingService.id}`
        : `${API_BASE}/coaching/services`;
      const res = await fetch(endpoint, {
        method: editingService ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save service.');
      setShowServiceForm(false);
      resetServiceForm();
      setMessage({ type: 'success', text: editingService ? 'Service updated!' : 'Service created!' });
      fetchMyServices();
      fetchPublicServices();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred.' });
    }
    setIsSubmitting(false);
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Delete this service? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/coaching/services/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Delete failed.');
      setMyServices((prev) => prev.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: 'Service deleted.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  // ── Slot generation ────────────────────────────────────────────

  const handleGenerateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceForSlots) return;
    setIsSubmitting(true);
    setMessage(null);

    const dates = slotDates.split('\n').map((d) => d.trim()).filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/coaching/services/${selectedServiceForSlots.id}/slots/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dates, start_time: slotStartTime, end_time: slotEndTime }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Slot generation failed.');
      setMessage({ type: 'success', text: json.message });
      setShowSlotForm(false);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to generate slots.' });
    }
    setIsSubmitting(false);
  };

  // ── Booking ────────────────────────────────────────────────────

  const openBooking = async (service: CoachingService) => {
    setSelectedServiceForBooking(service);
    setSelectedSlotId(null);
    setBookingNotes('');
    setShowBookingModal(true);
    try {
      const res = await fetch(`${API_BASE}/coaching/services/${service.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setAvailableSlots(json.available_slots ?? []);
      }
    } catch { setAvailableSlots([]); }
  };

  const handleBook = async () => {
    if (!selectedServiceForBooking || !selectedSlotId) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/coaching/book`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ service_id: selectedServiceForBooking.id, slot_id: selectedSlotId, notes: bookingNotes || null }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setMessage({ type: 'error', text: `${json.message} Required: ${formatPrice(json.required)}, Balance: ${formatPrice(json.balance)}` });
      } else if (!res.ok) {
        throw new Error(json.message ?? 'Booking failed.');
      } else {
        setShowBookingModal(false);
        setMessage({ type: 'success', text: 'Session booked successfully!' });
        fetchMyBookings();
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Booking failed.' });
    }
    setIsSubmitting(false);
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm('Cancel this booking? You will be refunded if paid.')) return;
    try {
      const res = await fetch(`${API_BASE}/coaching/bookings/${id}/cancel`, { method: 'POST', headers: getAuthHeaders() });
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
      const res = await fetch(`${API_BASE}/coaching/bookings/${id}/complete`, { method: 'POST', headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to complete session.');
      setMessage({ type: 'success', text: json.message });
      fetchMySessions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to complete session.' });
    }
  };

  // ── UI ─────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'browse', label: 'Browse Services' },
    { key: 'my-services', label: 'My Services (Creator)' },
    { key: 'my-bookings', label: 'My Bookings' },
    { key: 'my-sessions', label: 'My Sessions (Creator)' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Calendar className="h-6 w-6 text-secondary" />
            1:1 Coaching & Bookings
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Offer paid 1-on-1 coaching, consultations, and advice sessions.
          </p>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
              tab === t.key ? 'border-secondary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Browse Services ────────────────────────────────── */}
      {tab === 'browse' && (
        <div className="space-y-4">
          {isLoadingServices ? (
            <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" /></div>
          ) : services.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No coaching services available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Creators haven't published any coaching services yet. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.filter((s) => s.is_active).map((s) => (
                <ServiceCard key={s.id} service={s} onBook={openBooking} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: My Services (Creator) ──────────────────────────── */}
      {tab === 'my-services' && (
        <div className="space-y-4">
          <button
            onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> New Service
          </button>

          {myServices.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No services yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">Create your first coaching service to start accepting bookings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Service Form Modal */}
          {showServiceForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <div className="border border-border rounded-2xl bg-card p-6 max-w-lg w-full shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-foreground">{editingService ? 'Edit Service' : 'New Coaching Service'}</h3>
                <form onSubmit={handleSaveService} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Service Name</label>
                    <input type="text" value={sfName} onChange={(e) => setSfName(e.target.value)} required placeholder="e.g. 30-min Coaching Call" className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</label>
                    <textarea value={sfDesc} onChange={(e) => setSfDesc(e.target.value)} placeholder="What will this session cover?" rows={3} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Duration (min)</label>
                      <input type="number" value={sfDuration} onChange={(e) => setSfDuration(e.target.value)} min={15} max={480} required className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Price (cents)</label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-2 rounded-l-xl border border-r-0 border-border">$</span>
                        <input type="number" value={sfPrice} onChange={(e) => setSfPrice(e.target.value)} min={0} step={0.01} placeholder="0.00 (free)" className="flex-1 px-3 py-2 text-xs rounded-r-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Location</label>
                      <select value={sfLocation} onChange={(e) => setSfLocation(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary">
                        <option value="online">Online</option>
                        <option value="in_person">In Person</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Buffer (min)</label>
                      <input type="number" value={sfBuffer} onChange={(e) => setSfBuffer(e.target.value)} min={0} max={120} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Meeting URL</label>
                      <input type="url" value={sfMeetingUrl} onChange={(e) => setSfMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Max daily</label>
                      <input type="number" value={sfMaxDaily} onChange={(e) => setSfMaxDaily(e.target.value)} min={1} max={50} placeholder="Unlimited" className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowServiceForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted transition-colors">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                      {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {editingService ? 'Update' : 'Create'} Service
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: My Bookings ─────────────────────────────────────── */}
      {tab === 'my-bookings' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No bookings yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">Browse services and book a session with a creator.</p>
            </div>
          ) : (
            myBookings.map((b) => (
              <BookingRow key={b.id} booking={b} isCreator={false} onCancel={handleCancelBooking} onComplete={() => {}} />
            ))
          )}
        </div>
      )}

      {/* ── Tab: My Sessions (Creator) ───────────────────────────── */}
      {tab === 'my-sessions' && (
        <div className="space-y-3">
          {mySessions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No upcoming sessions</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">Sessions booked by members will appear here.</p>
            </div>
          ) : (
            mySessions.map((b) => (
              <BookingRow key={b.id} booking={b} isCreator={true} onCancel={handleCancelBooking} onComplete={handleCompleteSession} />
            ))
          )}
        </div>
      )}

      {/* ── Slot Generation Modal ────────────────────────────────── */}
      {showSlotForm && selectedServiceForSlots && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Generate Slots for "{selectedServiceForSlots.name}"</h3>
            <form onSubmit={handleGenerateSlots} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Dates (one per line)</label>
                <textarea value={slotDates} onChange={(e) => setSlotDates(e.target.value)} placeholder="2026-07-27&#10;2026-07-28&#10;2026-07-29" rows={4} required className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">Enter one date per line in YYYY-MM-DD format. Max 30 dates.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Start time</label>
                  <input type="time" value={slotStartTime} onChange={(e) => setSlotStartTime(e.target.value)} required className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">End time</label>
                  <input type="time" value={slotEndTime} onChange={(e) => setSlotEndTime(e.target.value)} required className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSlotForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Generate Slots
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Booking Modal ────────────────────────────────────────── */}
      {showBookingModal && selectedServiceForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Book: {selectedServiceForBooking.name}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{selectedServiceForBooking.duration_minutes} min</span>
              <span className="flex items-center gap-1">
                {selectedServiceForBooking.price === 0 ? 'Free' : formatPrice(selectedServiceForBooking.price, selectedServiceForBooking.currency)}
              </span>
            </div>

            {availableSlots.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border rounded-xl bg-muted/20">
                <p className="text-xs text-muted-foreground">No available slots. Please check back later.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Select a time slot</p>
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs border transition-all ${
                      selectedSlotId === slot.id
                        ? 'border-secondary bg-secondary/10'
                        : 'border-border bg-muted/20 hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-secondary" />
                      {formatDateTime(slot.start_time)}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">Notes (optional)</label>
              <textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="What do you want to discuss?" rows={2} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowBookingModal(false)} className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleBook} disabled={!selectedSlotId || isSubmitting} className="px-4 py-2 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                {selectedServiceForBooking.price > 0 ? `Pay ${formatPrice(selectedServiceForBooking.price, selectedServiceForBooking.currency)}` : 'Book Free Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
