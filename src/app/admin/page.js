'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { OPENING_HOURS, timeStringToMinutes } from '@/lib/booking-utils';
import { 
  LogOut, 
  Calendar as CalendarIcon, 
  Scissors, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Plus, 
  User, 
  Phone, 
  Clock, 
  MessageSquare, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle 
} from 'lucide-react';

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  // Stav pro dashboard
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Stav pro formuláře (vytvoření / úprava)
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(null); // booking objekt
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Data formuláře
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientNotes: '',
    serviceId: '',
    category: 'barber',
    customRequestText: '',
    dateStr: '',
    timeStr: ''
  });

  // Kontrola přihlášení
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession) {
        router.push('/admin/login');
      } else {
        setSession(activeSession);
      }
      setAuthLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/admin/login');
      } else {
        setSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Načtení dat (služby a rezervace) z DB
  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Načtení služeb
      const { data: dbServices, error: servicesErr } = await supabase
        .from('services')
        .select('*')
        .order('name');
      
      if (!servicesErr) {
        setServices(dbServices || []);
      }

      // Načtení všech aktivních rezervací (seřazených podle času)
      const { data: dbBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select(`
          *,
          services (
            name,
            duration_minutes,
            price
          )
        `)
        .eq('status', 'confirmed')
        .order('start_at', { ascending: true });

      if (!bookingsErr) {
        setBookings(dbBookings || []);
      }
    } catch (err) {
      console.error('Chyba při načítání dat:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Navigace v čase
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Filtrovat rezervace pro vybraný den
  const getBookingsForSelectedDate = () => {
    const dateStr = selectedDate.toDateString();
    return bookings.filter(b => new Date(b.start_at).toDateString() === dateStr);
  };

  // Otevření formuláře pro novou rezervaci
  const openAddModal = () => {
    const localDate = selectedDate.toISOString().split('T')[0];
    setFormData({
      clientName: '',
      clientPhone: '',
      clientNotes: '',
      serviceId: services.length > 0 ? services[0].id : '',
      category: 'barber',
      customRequestText: '',
      dateStr: localDate,
      timeStr: '09:00'
    });
    setFormError(null);
    setIsAdding(true);
  };

  // Otevření formuláře pro úpravu rezervace
  const openEditModal = (booking) => {
    const bookingStart = new Date(booking.start_at);
    const tzOffset = bookingStart.getTimezoneOffset() * 60000;
    const localISOTime = new Date(bookingStart.getTime() - tzOffset).toISOString();
    
    const dateStr = localISOTime.split('T')[0];
    const timeStr = localISOTime.split('T')[1].substring(0, 5);

    setFormData({
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      clientNotes: booking.client_notes || '',
      serviceId: booking.service_id || '',
      category: booking.services?.category || (booking.custom_service_request ? 'tattoo' : 'barber'),
      customRequestText: booking.custom_service_request || '',
      dateStr,
      timeStr
    });
    setFormError(null);
    setIsEditing(booking);
  };

  // Zpracování změny ve formuláři
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Pokud se změní vybraná služba (pokud není custom), nastavíme kategorii podle služby
      if (name === 'serviceId' && value !== '') {
        const svc = services.find(s => s.id === value);
        if (svc) {
          updated.category = svc.category;
        }
      }
      return updated;
    });
  };

  // Validace překryvů a otevírací doby na straně klienta (v rámci aktuálně načtených rezervací)
  const validateBookingTimes = (startAt, endAt, excludeBookingId = null) => {
    const dayOfWeek = startAt.getDay();
    const hours = OPENING_HOURS[dayOfWeek];
    if (!hours) {
      return 'V tento den je zavřeno.';
    }

    const startMin = startAt.getHours() * 60 + startAt.getMinutes();
    const endMin = endAt.getHours() * 60 + endAt.getMinutes();
    const openMin = timeStringToMinutes(hours.open);
    const closeMin = timeStringToMinutes(hours.close);

    if (startMin < openMin || endMin > closeMin) {
      return `Rezervace leží mimo otevírací dobu (${hours.open} - ${hours.close}).`;
    }

    // Kontrola kolizí v lokálním poli bookings
    for (const b of bookings) {
      if (excludeBookingId && b.id === excludeBookingId) continue;
      
      const bStart = new Date(b.start_at);
      const bEnd = new Date(b.end_at);

      if (startAt < bEnd && endAt > bStart) {
        return `Detekována kolize s rezervací klienta ${b.client_name} (${bStart.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute:'2-digit'})} - ${bEnd.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute:'2-digit'})}).`;
      }
    }

    return null;
  };

  // Uložení nové nebo upravené rezervace
  const handleSaveBooking = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const { clientName, clientPhone, clientNotes, serviceId, category, customRequestText, dateStr, timeStr } = formData;

    if (!clientName || !clientPhone || !dateStr || !timeStr) {
      setFormError('Vyplňte prosím všechna povinná pole.');
      setFormLoading(false);
      return;
    }

    // Sestavení datumů start_at a end_at
    const startAt = new Date(`${dateStr}T${timeStr}:00`);
    let duration = category === 'tattoo' ? 120 : 45; // výchozí

    if (serviceId) {
      const svc = services.find(s => s.id === serviceId);
      if (svc) duration = svc.duration_minutes;
    }

    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    // Validace časů
    const collisionError = validateBookingTimes(startAt, endAt, isEditing?.id);
    if (collisionError) {
      setFormError(collisionError);
      setFormLoading(false);
      return;
    }

    try {
      if (isAdding) {
        // Vložení nové
        const { error } = await supabase
          .from('bookings')
          .insert([{
            client_name: clientName,
            client_phone: clientPhone,
            client_notes: clientNotes || null,
            service_id: serviceId || null,
            custom_service_request: serviceId ? null : customRequestText || null,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: 'confirmed'
          }]);

        if (error) throw error;
      } else if (isEditing) {
        // Update existující
        const { error } = await supabase
          .from('bookings')
          .update({
            client_name: clientName,
            client_phone: clientPhone,
            client_notes: clientNotes || null,
            service_id: serviceId || null,
            custom_service_request: serviceId ? null : customRequestText || null,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString()
          })
          .eq('id', isEditing.id);

        if (error) throw error;
      }

      // Zavření modálu a obnova dat
      setIsAdding(false);
      setIsEditing(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      setFormError('Chyba při zápisu do databáze. Zkontrolujte připojení.');
    } finally {
      setFormLoading(false);
    }
  };

  // Smazání rezervace
  const handleDeleteBooking = async (id) => {
    if (!confirm('Opravdu chcete tuto rezervaci smazat?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Chyba při mazání rezervace:', err);
      alert('Chyba při mazání rezervace ze Supabase.');
    }
  };

  // Pomocná metoda pro rychlé založení výchozích služeb v DB
  const handleSeedServices = async () => {
    if (!confirm('Tato akce vloží výchozí služby do databáze. Chcete pokračovat?')) return;
    
    const seedData = [
      { name: 'Klasický střih & styling', category: 'barber', duration_minutes: 45, price: 550, description: 'Mytí, střih, foukaná, kolínská a styling.' },
      { name: 'Úprava vousů & hot towel', category: 'barber', duration_minutes: 30, price: 350, description: 'Napaření, holení břitvou, úprava vousů a balzám.' },
      { name: 'Kompletní servis (Střih + Vousy)', category: 'barber', duration_minutes: 75, price: 800, description: 'Klasický střih s kompletní úpravou vousů.' },
      { name: 'Malé tetování (do 5cm)', category: 'tattoo', duration_minutes: 60, price: 1200, description: 'Jednoduché motivy, nápisy, geometrie.' },
      { name: 'Střední tetování (do 15cm)', category: 'tattoo', duration_minutes: 150, price: 3000, description: 'Detailnější práce, blackwork nebo lineart.' },
      { name: 'Konzultace motivu', category: 'tattoo', duration_minutes: 30, price: 0, description: 'Osobní konzultace a návrh vašeho budoucího tetování.' }
    ];

    try {
      const { error } = await supabase.from('services').insert(seedData);
      if (error) throw error;
      alert('Služby byly úspěšně vloženy!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Nepodařilo se vložit služby. Pravděpodobně již existují nebo nemáte práva.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Ověřuji oprávnění...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const filteredBookings = getBookingsForSelectedDate();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <Scissors className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-wider bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                FREE STUDIO
              </span>
              <span className="text-[10px] block text-neutral-500 font-semibold tracking-wider -mt-1 uppercase">Administrace</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden md:inline-block text-xs text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800">
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Odhlásit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Date Selector Header & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900/30 border border-neutral-900 p-4 rounded-2xl">
          <div className="flex items-center space-x-2">
            <button 
              onClick={handlePrevDay}
              className="p-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-left px-2">
              <h2 className="font-bold text-base sm:text-lg text-white">
                {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <span className="text-xs text-neutral-500">
                Aktivní rezervace na tento den
              </span>
            </div>
            <button 
              onClick={handleNextDay}
              className="p-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={handleToday}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Dnes
            </button>
            <button 
              onClick={openAddModal}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nová rezervace</span>
            </button>
          </div>
        </div>

        {/* Database setup notice if no services exist */}
        {services.length === 0 && !loadingData && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
            <div className="flex items-center space-x-2 text-amber-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>V databázi nemáte žádné definované služby. Můžete vložit výchozí set pro rychlý start.</span>
            </div>
            <button
              onClick={handleSeedServices}
              className="px-3.5 py-1.5 bg-amber-500 text-neutral-950 font-bold rounded-lg hover:bg-amber-400 transition-all cursor-pointer"
            >
              Nahrát výchozí služby
            </button>
          </div>
        )}

        {/* Bookings Timeline / List */}
        <div className="bg-neutral-900/20 border border-neutral-900 rounded-3xl p-4 sm:p-6 min-h-[300px]">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-7 w-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-500">Načítám rozvrh...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-500 border border-dashed border-neutral-900 rounded-2xl">
              <CalendarIcon className="h-8 w-8 text-neutral-700 mb-2.5" />
              <p className="text-sm font-semibold text-neutral-400">Žádné rezervace na tento den</p>
              <p className="text-xs text-neutral-600 mt-1">Klienti ani vy jste na dnes neuložili žádný termín.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const start = new Date(booking.start_at);
                const end = new Date(booking.end_at);
                const timeLabel = `${start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`;
                
                const isTattoo = booking.services?.category === 'tattoo' || booking.custom_service_request;

                return (
                  <div 
                    key={booking.id}
                    className="p-4 sm:p-5 bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-800 rounded-2xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="space-y-2 flex-1 w-full">
                      {/* Top Badges & Time */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          {timeLabel}
                        </span>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isTattoo 
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                          {isTattoo ? 'Tattoo' : 'Barber'}
                        </span>

                        {booking.services && (
                          <span className="text-[11px] font-medium text-neutral-400">
                            {booking.services.name}
                          </span>
                        )}
                        
                        {booking.custom_service_request && (
                          <span className="text-[11px] font-medium text-purple-300 italic bg-purple-500/5 px-2 py-0.5 rounded border border-purple-950">
                            Vlastní: {booking.custom_service_request}
                          </span>
                        )}
                      </div>

                      {/* Client Info Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs pt-1.5 text-neutral-400">
                        <div className="flex items-center space-x-2">
                          <User className="h-3.5 w-3.5 text-neutral-500" />
                          <span className="font-semibold text-white">{booking.client_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-3.5 w-3.5 text-neutral-500" />
                          <a href={`tel:${booking.client_phone}`} className="hover:text-amber-400 transition-all font-semibold">
                            {booking.client_phone}
                          </a>
                        </div>
                      </div>

                      {/* Notes */}
                      {booking.client_notes && (
                        <div className="mt-2 text-xs text-neutral-400 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-900/60 italic flex items-start space-x-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-neutral-600 shrink-0 mt-0.5" />
                          <span>{booking.client_notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end border-t border-neutral-900 md:border-t-0 pt-3 md:pt-0">
                      <button
                        onClick={() => openEditModal(booking)}
                        className="flex-1 md:flex-initial p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 border border-neutral-800 rounded-xl transition-all flex items-center justify-center space-x-1 text-xs font-semibold cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="md:hidden">Upravit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="flex-1 md:flex-initial p-2 bg-red-500/5 hover:bg-red-500/10 text-red-500 hover:text-red-400 border border-red-500/25 hover:border-red-500/40 rounded-xl transition-all flex items-center justify-center space-x-1 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="md:hidden">Smazat</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: Add / Edit Reservation */}
      {(isAdding || isEditing) && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Modal Title */}
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-amber-400" />
                <span>{isAdding ? 'Nová rezervace' : 'Upravit rezervaci'}</span>
              </h3>
              <button 
                onClick={() => { setIsAdding(false); setIsEditing(null); }}
                className="p-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center space-x-2 text-xs">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client Name */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Jméno a Příjmení *
                  </label>
                  <input
                    type="text"
                    required
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleFormChange}
                    placeholder="Např. Jan Novák"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm placeholder-neutral-600 focus:outline-none transition-all"
                  />
                </div>

                {/* Client Phone */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Telefonní číslo *
                  </label>
                  <input
                    type="tel"
                    required
                    name="clientPhone"
                    value={formData.clientPhone}
                    onChange={handleFormChange}
                    placeholder="Např. +420 777 123 456"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm placeholder-neutral-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Vybraná Služba
                </label>
                <select
                  name="serviceId"
                  value={formData.serviceId}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm text-neutral-200 focus:outline-none transition-all"
                >
                  <option value="">-- Vlastní požadavek (vyplňte níže) --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.category.toUpperCase()}] {s.name} ({s.duration_minutes} min, {s.price} Kč)
                    </option>
                  ))}
                </select>
              </div>

              {/* Category and Custom request fields if serviceId is empty */}
              {formData.serviceId === '' && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Kategorie vlastního požadavku
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, category: 'barber' }))}
                        className={`flex-1 py-2 text-xs border rounded-lg transition-all ${
                          formData.category === 'barber'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-400'
                        }`}
                      >
                        Barber (45 min)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, category: 'tattoo' }))}
                        className={`flex-1 py-2 text-xs border rounded-lg transition-all ${
                          formData.category === 'tattoo'
                            ? 'bg-purple-500/10 border-purple-500 text-purple-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-400'
                        }`}
                      >
                        Tattoo (120 min)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Popis vlastního požadavku *
                    </label>
                    <input
                      type="text"
                      name="customRequestText"
                      value={formData.customRequestText}
                      onChange={handleFormChange}
                      required={formData.serviceId === ''}
                      placeholder="Např. Specifické tetování draka, apod."
                      className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm placeholder-neutral-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Date & Time selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Datum *
                  </label>
                  <input
                    type="date"
                    required
                    name="dateStr"
                    value={formData.dateStr}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm text-neutral-200 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Čas zahájení *
                  </label>
                  <input
                    type="time"
                    required
                    name="timeStr"
                    value={formData.timeStr}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm text-neutral-200 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Client Notes */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Poznámka (Nepovinné)
                </label>
                <textarea
                  name="clientNotes"
                  value={formData.clientNotes}
                  onChange={handleFormChange}
                  placeholder="Speciální požadavky klienta..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-xl text-sm placeholder-neutral-600 focus:outline-none transition-all h-20 resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex space-x-2 pt-2 border-t border-neutral-800">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-50"
                >
                  {formLoading ? (
                    <div className="h-5 w-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Uložit rezervaci'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setIsEditing(null); }}
                  className="px-5 py-3 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
