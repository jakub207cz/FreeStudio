'use strict';
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { OPENING_HOURS, getLocalISODateString } from '@/lib/booking-utils';
import { 
  Scissors, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  MessageSquare, 
  Check, 
  AlertTriangle, 
  Info,
  CalendarCheck2
} from 'lucide-react';

// Výchozí služby pokud by databáze byla prázdná
const DEFAULT_SERVICES = [
  { id: 'b1', name: 'Klasický střih & styling', category: 'barber', duration_minutes: 45, price: 550, description: 'Mytí, střih, foukaná, kolínská a styling.' },
  { id: 'b2', name: 'Úprava vousů & hot towel', category: 'barber', duration_minutes: 30, price: 350, description: 'Napaření, holení břitvou, úprava vousů a balzám.' },
  { id: 'b3', name: 'Kompletní servis (Střih + Vousy)', category: 'barber', duration_minutes: 75, price: 800, description: 'Klasický střih s kompletní úpravou vousů.' },
  { id: 't1', name: 'Malé tetování (do 5cm)', category: 'tattoo', duration_minutes: 60, price: 1200, description: 'Jednoduché motivy, nápisy, geometrie.' },
  { id: 't2', name: 'Střední tetování (do 15cm)', category: 'tattoo', duration_minutes: 150, price: 3000, description: 'Detailnější práce, blackwork nebo lineart.' },
  { id: 't3', name: 'Konzultace motivu', category: 'tattoo', duration_minutes: 30, price: 0, description: 'Osobní konzultace a návrh vašeho budoucího tetování.' }
];

export default function Home() {
  // Stav průchodu (1: Hlavní kategorie, 2: Výběr služby, 3: Osobní údaje, 4: Datum a Čas, 5: Hotovo)
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null); // 'barber' nebo 'tattoo'
  
  // Databázové služby
  const [dbServices, setDbServices] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  
  // Vlastní požadavek
  const [isCustomRequest, setIsCustomRequest] = useState(false);
  const [customRequestText, setCustomRequestText] = useState('');

  // Osobní údaje
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Výběr času
  const [selectedDate, setSelectedDate] = useState(null); // Date objekt
  const [selectedTimeStr, setSelectedTimeStr] = useState(''); // "HH:MM"
  const [availableSlots, setAvailableSlots] = useState([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null); // { available: bool, alternatives: [] }
  const [availabilityError, setAvailabilityError] = useState(null);

  // Rezervace dokončena
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [completedBooking, setCompletedBooking] = useState(null);

  // Načtení služeb ze Supabase při startu
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('name');
        
        if (!error && data && data.length > 0) {
          setDbServices(data);
        } else {
          setDbServices(DEFAULT_SERVICES);
        }
      } catch (err) {
        console.error('Nepodařilo se načíst služby ze Supabase, používám výchozí:', err);
        setDbServices(DEFAULT_SERVICES);
      }
    };
    fetchServices();
  }, []);

  // Filtrovat služby podle zvolené kategorie
  useEffect(() => {
    if (category) {
      setServices(dbServices.filter(s => s.category === category));
      setSelectedService(null);
      setIsCustomRequest(false);
      setCustomRequestText('');
    }
  }, [category, dbServices]);

  // Vygenerovat seznam 14 dní dopředu pro výběr datumu
  const getNext14Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Vygenerovat seznam časových slotů pro vybraný den na základě otevírací doby
  const getTimeSlotsForDate = (date) => {
    if (!date) return [];
    const dayOfWeek = date.getDay();
    const hours = OPENING_HOURS[dayOfWeek];
    if (!hours) return []; // Zavřeno

    const slots = [];
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    
    let currentMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    
    // Zjistíme délku vybrané služby
    let duration = 45;
    if (selectedService) duration = selectedService.duration_minutes;
    else if (category === 'tattoo') duration = 120;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    while (currentMinutes + duration <= closeMinutes) {
      // Pro dnešek nenabízet časy v minulosti
      if (!isToday || currentMinutes > nowMinutes + 30) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
      currentMinutes += 30; // Nabízet po 30 minutách
    }

    return slots;
  };

  // Kontrola dostupnosti konkrétního slotu
  const checkAvailability = async (timeStr, overrideDate = null) => {
    const dateToUse = overrideDate || selectedDate;
    if (!dateToUse || !timeStr) return;

    setSelectedTimeStr(timeStr);
    setCheckLoading(true);
    setAvailabilityResult(null);
    setAvailabilityError(null);

    const [hours, minutes] = timeStr.split(':').map(Number);
    const startAt = new Date(dateToUse);
    startAt.setHours(hours, minutes, 0, 0);

    try {
      const response = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: isCustomRequest ? null : selectedService?.id,
          category,
          startAt: startAt.toISOString(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAvailabilityResult(data);
      } else {
        setAvailabilityError(data.error || 'Chyba při zjišťování dostupnosti.');
        console.error('Error checking availability:', data.error);
      }
    } catch (err) {
      setAvailabilityError('Chyba sítě nebo spojení se serverem.');
      console.error('Chyba při dotazu na dostupnost:', err);
    } finally {
      setCheckLoading(false);
    }
  };

  // Odeslání závazné rezervace
  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTimeStr || !availabilityResult?.available) return;

    setBookingLoading(true);
    setBookingError(null);

    const [hours, minutes] = selectedTimeStr.split(':').map(Number);
    const startAt = new Date(selectedDate);
    startAt.setHours(hours, minutes, 0, 0);

    try {
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: isCustomRequest ? null : selectedService?.id,
          category,
          customRequestText: isCustomRequest ? customRequestText : null,
          clientName,
          clientPhone,
          clientNotes,
          startAt: startAt.toISOString(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCompletedBooking(data.booking);
        setStep(5); // Hotovo
      } else {
        const errorMsg = data.details 
          ? `${data.error || 'Chyba databáze'}: ${data.details}` 
          : (data.error || data.message || 'Nepodařilo se uložit rezervaci. Zkuste to prosím znovu.');
        setBookingError(errorMsg);
        // Znovu zkontrolujeme stav
        checkAvailability(selectedTimeStr);
      }
    } catch (err) {
      console.error('Chyba při odesílání rezervace:', err);
      setBookingError('Chyba sítě. Zkontrolujte připojení a zkuste to znovu.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Obsluha kliknutí na alternativní čas
  const handleSelectAlternative = (isoString) => {
    const alternativeDate = new Date(isoString);
    setSelectedDate(alternativeDate);
    
    const h = alternativeDate.getHours().toString().padStart(2, '0');
    const m = alternativeDate.getMinutes().toString().padStart(2, '0');
    const timeStr = `${h}:${m}`;
    
    checkAvailability(timeStr, alternativeDate);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-between pb-8">
      {/* Header */}
      <header className="w-full max-w-md px-6 py-6 flex items-center justify-between border-b border-neutral-900/60 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
            <Scissors className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wider uppercase bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
              Free Studio
            </h1>
            <p className="text-[10px] text-neutral-500 font-medium tracking-widest uppercase">Barber & Tattoo</p>
          </div>
        </div>

        {step > 1 && step < 5 && (
          <button 
            onClick={() => {
              setStep(step - 1);
              if (step === 4) {
                setAvailabilityResult(null);
                setSelectedTimeStr('');
              }
            }} 
            className="text-xs font-semibold px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-lg flex items-center space-x-1 transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Zpět</span>
          </button>
        )}
      </header>

      {/* Main Flow Card */}
      <main className="w-full max-w-md px-4 flex-1 flex flex-col justify-center py-6">
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
          {/* Progress bar */}
          {step < 5 && (
            <div className="absolute top-0 left-0 w-full h-1 bg-neutral-800">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          )}

          {/* STEP 1: Main Category Selection */}
          {step === 1 && (
            <div className="space-y-6 my-auto">
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Rezervace termínu</span>
                <h2 className="text-2xl font-bold tracking-tight text-white">Co dnes budeme tvořit?</h2>
                <p className="text-xs text-neutral-400">Vyberte si zaměření našich služeb</p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2">
                <button
                  onClick={() => { setCategory('barber'); setStep(2); }}
                  className="group relative flex items-center justify-between p-6 bg-gradient-to-br from-neutral-900 to-neutral-950 hover:from-neutral-800/80 hover:to-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-2xl transition-all duration-300 text-left shadow-lg overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                      <Scissors className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">Ostříhání</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">Klasické střihy, úprava vousů, hot towel</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  onClick={() => { setCategory('tattoo'); setStep(2); }}
                  className="group relative flex items-center justify-between p-6 bg-gradient-to-br from-neutral-900 to-neutral-950 hover:from-neutral-800/80 hover:to-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-2xl transition-all duration-300 text-left shadow-lg overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">Tetování</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">Vlastní motivy, lineart, konzultace</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Service Selection */}
          {step === 2 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center space-x-2">
                  <span>{category === 'barber' ? 'Nabídka střihů' : 'Styly tetování'}</span>
                </h3>
                <p className="text-xs text-neutral-400 mb-4">Vyberte si konkrétní službu nebo zadejte vlastní představu</p>

                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service);
                        setIsCustomRequest(false);
                      }}
                      className={`w-full p-4 rounded-xl text-left border transition-all flex justify-between items-center ${
                        selectedService?.id === service.id && !isCustomRequest
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-md'
                          : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="space-y-1 pr-4">
                        <h4 className="font-semibold text-sm text-white">{service.name}</h4>
                        {service.description && (
                          <p className="text-[11px] text-neutral-400 line-clamp-2">{service.description}</p>
                        )}
                        <div className="flex items-center space-x-2 text-[10px] text-neutral-500 font-semibold pt-1">
                          <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {service.duration_minutes} min</span>
                          {service.price > 0 && <span>• {service.price} Kč</span>}
                        </div>
                      </div>
                      <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedService?.id === service.id && !isCustomRequest
                          ? 'border-amber-500 bg-amber-500 text-neutral-950'
                          : 'border-neutral-700'
                      }`}>
                        {selectedService?.id === service.id && !isCustomRequest && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </button>
                  ))}

                  {/* Option: Custom request */}
                  <button
                    onClick={() => {
                      setIsCustomRequest(true);
                      setSelectedService(null);
                    }}
                    className={`w-full p-4 rounded-xl text-left border transition-all flex justify-between items-center ${
                      isCustomRequest
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-md'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="space-y-1 flex-1 pr-4">
                      <h4 className="font-semibold text-sm text-white">Vlastní požadavek</h4>
                      <p className="text-[11px] text-neutral-400">Popište nám vlastními slovy, co byste si přáli vytvořit.</p>
                    </div>
                    <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                      isCustomRequest
                        ? 'border-amber-500 bg-amber-500 text-neutral-950'
                        : 'border-neutral-700'
                    }`}>
                      {isCustomRequest && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </button>
                </div>

                {isCustomRequest && (
                  <div className="mt-3 animate-fadeIn">
                    <textarea
                      value={customRequestText}
                      onChange={(e) => setCustomRequestText(e.target.value)}
                      placeholder="Sem napište své přání (např. chci tetování draka na předloktí cca 10cm, nebo chci specifický mullet)..."
                      className="w-full p-3 bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-xs placeholder-neutral-500 focus:outline-none transition-all resize-none h-20"
                      required
                    />
                  </div>
                )}
              </div>

              <button
                disabled={!selectedService && (!isCustomRequest || !customRequestText.trim())}
                onClick={() => setStep(3)}
                className="w-full mt-4 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10"
              >
                <span>Pokračovat</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 3: Personal Details Form */}
          {step === 3 && (
            <form 
              onSubmit={(e) => { e.preventDefault(); setStep(4); }}
              className="space-y-4 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Osobní údaje</h3>
                  <p className="text-xs text-neutral-400">Kam vám můžeme poslat potvrzení a případně zavolat?</p>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Jméno a příjmení
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Jan Novák"
                        className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-sm placeholder-neutral-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Telefonní číslo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+420 777 888 999"
                        className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-sm placeholder-neutral-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Poznámka (volitelné)
                    </label>
                    <div className="relative">
                      <div className="absolute top-3 left-3.5 text-neutral-500">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <textarea
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        placeholder="Máte nějaké speciální přání, alergie, nebo doplňující informace?"
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-sm placeholder-neutral-500 focus:outline-none transition-all h-20 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <span>Vybrat čas</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* STEP 4: Date & Time Picker */}
          {step === 4 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Výběr termínu</h3>
                  <p className="text-xs text-neutral-400">Vyberte preferovaný den a hodinu</p>
                </div>

                {/* Date Slider/Picker */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Den</span>
                  <div className="flex space-x-2 overflow-x-auto pb-2 pr-1 scrollbar-none">
                    {getNext14Days().map((date, idx) => {
                      const isSelected = selectedDate?.toDateString() === date.toDateString();
                      const isClosed = OPENING_HOURS[date.getDay()] === null;
                      const dayName = date.toLocaleDateString('cs-CZ', { weekday: 'short' });
                      const dayNum = date.getDate();
                      const monthName = date.toLocaleDateString('cs-CZ', { month: 'short' });

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTimeStr('');
                            setAvailabilityResult(null);
                          }}
                          className={`flex flex-col items-center justify-center p-3.5 min-w-[62px] rounded-xl border shrink-0 transition-all ${
                            isSelected
                              ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold'
                              : isClosed
                              ? 'bg-neutral-950 border-neutral-900 opacity-30 cursor-not-allowed'
                              : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                          }`}
                          disabled={isClosed}
                        >
                          <span className={`text-[10px] uppercase ${isSelected ? 'text-neutral-900' : 'text-neutral-500'}`}>{dayName}</span>
                          <span className="text-base my-0.5">{dayNum}</span>
                          <span className={`text-[9px] uppercase ${isSelected ? 'text-neutral-900/80' : 'text-neutral-500'}`}>{monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Selection */}
                {selectedDate && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Časové sloty</span>
                      <span className="text-[9px] text-amber-500 lowercase font-medium">
                        Otevřeno: {OPENING_HOURS[selectedDate.getDay()]?.open} - {OPENING_HOURS[selectedDate.getDay()]?.close}
                      </span>
                    </span>
                    
                    <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {getTimeSlotsForDate(selectedDate).length === 0 ? (
                        <div className="col-span-4 text-center py-4 text-xs text-neutral-500">
                          Pro tento den nejsou k dispozici žádné časy.
                        </div>
                      ) : (
                        getTimeSlotsForDate(selectedDate).map((timeStr) => {
                          const isSelected = selectedTimeStr === timeStr;
                          return (
                            <button
                              key={timeStr}
                              type="button"
                              onClick={() => checkAvailability(timeStr)}
                              className={`py-2 text-xs rounded-lg border text-center transition-all ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 font-bold'
                                  : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                              }`}
                            >
                              {timeStr}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Availability Checker Output */}
                <div className="min-h-[110px] pt-1">
                  {checkLoading && (
                    <div className="flex items-center justify-center py-6 space-x-2 text-neutral-400">
                      <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Ověřuji termín v databázi...</span>
                    </div>
                  )}

                  {!checkLoading && availabilityResult && (
                    <div className="animate-fadeIn">
                      {/* Scenario A: AVAILABLE */}
                      {availabilityResult.available && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                          <div className="flex items-start space-x-2.5 text-xs text-emerald-400 font-medium">
                            <Check className="h-4.5 w-4.5 shrink-0 bg-emerald-500/10 rounded-full p-0.5 border border-emerald-500/20" />
                            <div>
                              <p className="font-semibold text-white">Tento termín je volný!</p>
                              <p className="text-[11px] text-neutral-400 mt-0.5">
                                Chcete jej závazně rezervovat na{' '}
                                <strong className="text-neutral-200">
                                  {selectedDate.toLocaleDateString('cs-CZ')} v {selectedTimeStr}
                                </strong>
                                ?
                              </p>
                            </div>
                          </div>

                          {bookingError && (
                            <p className="text-[11px] text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                              {bookingError}
                            </p>
                          )}

                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={handleConfirmBooking}
                              disabled={bookingLoading}
                              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-bold rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-emerald-500/10"
                            >
                              {bookingLoading ? (
                                <div className="h-4.5 w-4.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                'Ano, rezervovat'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAvailabilityResult(null);
                                setSelectedTimeStr('');
                              }}
                              className="px-4 py-2.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 font-semibold rounded-lg text-xs transition-all cursor-pointer"
                            >
                              Ne
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Scenario B: OCCUPIED */}
                      {!availabilityResult.available && (
                        <div className="bg-red-500/5 border border-red-500/25 p-4 rounded-xl space-y-3">
                          <div className="flex items-start space-x-2.5 text-xs text-red-400 font-medium">
                            <AlertTriangle className="h-4.5 w-4.5 shrink-0 bg-red-500/10 rounded-full p-0.5 border border-red-500/20" />
                            <div>
                              <p className="font-semibold text-white">Termín je již obsazený</p>
                              <p className="text-[11px] text-neutral-400 mt-0.5">
                                Vyberte si prosím jiný čas, nebo klikněte na některou z nejbližších volných alternativ:
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1.5">
                            {availabilityResult.alternatives && availabilityResult.alternatives.length > 0 ? (
                              availabilityResult.alternatives.map((altIso) => {
                                const altDate = new Date(altIso);
                                const formatOpt = { weekday: 'short', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                                const label = altDate.toLocaleString('cs-CZ', formatOpt);

                                return (
                                  <button
                                    key={altIso}
                                    type="button"
                                    onClick={() => handleSelectAlternative(altIso)}
                                    className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 font-medium text-[11px] border border-amber-500/25 hover:border-amber-500/50 rounded-lg transition-all cursor-pointer"
                                  >
                                    {label}
                                  </button>
                                );
                              })
                            ) : (
                              <p className="text-[10px] text-neutral-500 italic">Žádné další volné alternativy pro tento den.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!checkLoading && !availabilityResult && !availabilityError && (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                      <Info className="h-5 w-5 mb-1.5 text-neutral-600" />
                      <p className="text-xs">Klikněte na libovolný časový slot výše pro zjištění dostupnosti</p>
                    </div>
                  )}

                  {!checkLoading && availabilityError && (
                    <div className="bg-red-500/5 border border-red-500/25 p-4 rounded-xl space-y-2 text-xs text-red-400">
                      <div className="flex items-center space-x-2 font-semibold">
                        <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-400" />
                        <span>Chyba při kontrole termínu</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {availabilityError}
                      </p>
                      <p className="text-[10px] text-neutral-500 italic mt-1 leading-relaxed">
                        Ujistěte se, že jste v Supabase spustili SQL skript z návodu DEPLOYMENT.md a správně nastavili proměnné na Vercelu.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Booking Completed Screen */}
          {step === 5 && completedBooking && (
            <div className="space-y-6 text-center my-auto py-4 animate-fadeIn">
              <div className="mx-auto h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <CalendarCheck2 className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Rezervace potvrzena!</h3>
                <p className="text-xs text-neutral-400 max-w-[280px] mx-auto">
                  Děkujeme, termín je zapsán. Budeme se na vás těšit ve Free Studiu.
                </p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-2xl max-w-sm mx-auto space-y-2.5 text-left text-xs text-neutral-400">
                <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                  <span>Klient:</span>
                  <span className="font-semibold text-white">{completedBooking.client_name}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                  <span>Služba:</span>
                  <span className="font-semibold text-white">
                    {isCustomRequest ? 'Vlastní požadavek' : selectedService?.name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                  <span>Čas:</span>
                  <span className="font-semibold text-amber-400">
                    {new Date(completedBooking.start_at).toLocaleDateString('cs-CZ')} v{' '}
                    {new Date(completedBooking.start_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {completedBooking.client_notes && (
                  <div className="pt-1">
                    <span className="block text-[10px] text-neutral-500 font-semibold mb-0.5">Poznámka:</span>
                    <p className="text-[11px] text-neutral-300 italic bg-neutral-900/30 p-2 rounded-lg border border-neutral-900">
                      {completedBooking.client_notes}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCategory(null);
                  setSelectedService(null);
                  setIsCustomRequest(false);
                  setCustomRequestText('');
                  setClientName('');
                  setClientPhone('');
                  setClientNotes('');
                  setSelectedDate(null);
                  setSelectedTimeStr('');
                  setAvailabilityResult(null);
                  setCompletedBooking(null);
                }}
                className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Nová rezervace
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md px-6 text-center text-[10px] text-neutral-600 font-medium tracking-wide">
        <p>© 2026 Free Studio. Všechna práva vyhrazena.</p>
        <p className="mt-1">Ostříháme a potetujeme vás na adrese Free Studio.</p>
      </footer>
    </div>
  );
}
