import { supabase } from '@/lib/supabase';
import { isWithinOpeningHours, DEFAULT_SERVICES } from '@/lib/booking-utils';

export async function POST(request) {
  try {
    const {
      serviceId,
      category,
      customRequestText,
      clientName,
      clientPhone,
      clientNotes,
      startAt,
    } = await request.json();

    // Validace povinných polí
    if (!category || !clientName || !clientPhone || !startAt) {
      return Response.json(
        { error: 'Chybí povinné rezervační údaje: category, clientName, clientPhone, startAt.' },
        { status: 400 }
      );
    }

    const requestedStart = new Date(startAt);
    if (isNaN(requestedStart.getTime())) {
      return Response.json(
        { error: 'Neplatný formát data a času startAt.' },
        { status: 400 }
      );
    }

    // 1. Zjistit délku a název služby
    let durationMinutes = category === 'tattoo' ? 120 : 45; // Výchozí hodnoty
    let resolvedServiceId = null;
    let resolvedCustomRequest = customRequestText || null;

    if (serviceId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = uuidRegex.test(serviceId);

      if (isValidUUID) {
        // Pokud je to platné UUID z databáze
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('duration_minutes')
          .eq('id', serviceId)
          .single();

        if (!serviceError && service) {
          durationMinutes = service.duration_minutes;
          resolvedServiceId = serviceId;
        }
      } else {
        // Pokud to není UUID, zkusíme najít službu ve výchozích (fallback) službách
        const defaultService = DEFAULT_SERVICES.find(s => s.id === serviceId);
        if (defaultService) {
          durationMinutes = defaultService.duration_minutes;
          resolvedCustomRequest = customRequestText 
            ? `${defaultService.name} - ${customRequestText}` 
            : defaultService.name;
        }
      }
    }

    const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60 * 1000);

    // 2. Re-validace otevírací doby (bezpečnostní kontrola)
    const withinHours = isWithinOpeningHours(requestedStart, durationMinutes);
    if (!withinHours) {
      return Response.json(
        { error: 'Požadovaný čas leží mimo otevírací dobu.' },
        { status: 400 }
      );
    }

    // 3. Re-validace kolizí v databázi (bezpečnostní kontrola proti race conditions)
    const startStr = requestedStart.toISOString();
    const endStr = requestedEnd.toISOString();

    const { data: overlappingBookings, error: overlapError } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'confirmed')
      .lt('start_at', endStr)
      .gt('end_at', startStr);

    if (overlapError) {
      console.error('Chyba při kontrole překryvů před zápisem:', overlapError);
      return Response.json(
        { 
          error: 'Chyba databáze při validaci termínu.',
          details: overlapError.message || JSON.stringify(overlapError)
        },
        { status: 500 }
      );
    }

    if (overlappingBookings && overlappingBookings.length > 0) {
      return Response.json(
        {
          success: false,
          error: 'slot_taken',
          message: 'Tento termín byl právě obsazen. Zvolte prosím jiný čas.',
        },
        { status: 409 }
      );
    }

    // 4. Zápis rezervace
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert([
        {
          service_id: resolvedServiceId,
          custom_service_request: resolvedCustomRequest,
          client_name: clientName,
          client_phone: clientPhone,
          client_notes: clientNotes || null,
          start_at: startStr,
          end_at: endStr,
          status: 'confirmed',
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Chyba při zápisu rezervace do DB:', insertError);
      return Response.json(
        { 
          error: 'Nepodařilo se uložit rezervaci do databáze.',
          details: insertError.message || JSON.stringify(insertError)
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      booking: newBooking,
    });

  } catch (error) {
    console.error('Chyba v rezervačním API:', error);
    return Response.json(
      { 
        error: 'Interní chyba serveru při vytváření rezervace.',
        details: error.message || JSON.stringify(error)
      },
      { status: 500 }
    );
  }
}
