import { supabase } from '@/lib/supabase';
import { isWithinOpeningHours } from '@/lib/booking-utils';

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

    // 1. Zjistit délku služby
    let durationMinutes = category === 'tattoo' ? 120 : 45; // Výchozí hodnoty

    if (serviceId) {
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .single();

      if (!serviceError && service) {
        durationMinutes = service.duration_minutes;
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
        { error: 'Chyba databáze při validaci termínu.' },
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
          service_id: serviceId || null,
          custom_service_request: customRequestText || null,
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
        { error: 'Nepodařilo se uložit rezervaci do databáze.' },
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
      { error: 'Interní chyba serveru při vytváření rezervace.' },
      { status: 500 }
    );
  }
}
