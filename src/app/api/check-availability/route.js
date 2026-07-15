import { supabase } from '@/lib/supabase';
import { isWithinOpeningHours, generateAlternativeSlots, DEFAULT_SERVICES } from '@/lib/booking-utils';

export async function POST(request) {
  try {
    const { serviceId, category, startAt } = await request.json();

    if (!category || !startAt) {
      return Response.json(
        { error: 'Chybí povinné údaje: category a startAt.' },
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = uuidRegex.test(serviceId);

      if (isValidUUID) {
        // Pokud je to platné UUID, dotážeme se databáze
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('duration_minutes')
          .eq('id', serviceId)
          .single();

        if (!serviceError && service) {
          durationMinutes = service.duration_minutes;
        }
      } else {
        // Pokud to není UUID, zkusíme najít službu ve výchozích (fallback) službách
        const defaultService = DEFAULT_SERVICES.find(s => s.id === serviceId);
        if (defaultService) {
          durationMinutes = defaultService.duration_minutes;
        }
      }
    }

    const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60 * 1000);

    // 2. Kontrola otevírací doby
    const withinHours = isWithinOpeningHours(requestedStart, durationMinutes);
    if (!withinHours) {
      // Navrhnout alternativy
      const candidateSlots = generateAlternativeSlots(startAt, durationMinutes);
      const freeAlternatives = await filterFreeSlots(candidateSlots, durationMinutes);

      return Response.json({
        available: false,
        reason: 'outside_hours',
        message: 'Požadovaný čas leží mimo otevírací dobu nebo je v den, kdy máme zavřeno.',
        alternatives: freeAlternatives.slice(0, 3),
      });
    }

    // 3. Kontrola kolizí v databázi
    const hasCollision = await checkOverlap(requestedStart, requestedEnd);

    if (!hasCollision) {
      return Response.json({
        available: true,
        startAt: requestedStart.toISOString(),
        endAt: requestedEnd.toISOString(),
        durationMinutes,
      });
    }

    // 4. Pokud je kolize, najít nejbližší volné alternativy
    const candidateSlots = generateAlternativeSlots(startAt, durationMinutes);
    const freeAlternatives = await filterFreeSlots(candidateSlots, durationMinutes);

    return Response.json({
      available: false,
      reason: 'collision',
      message: 'Tento termín je již obsazený.',
      alternatives: freeAlternatives.slice(0, 3),
    });

  } catch (error) {
    console.error('Chyba při kontrole dostupnosti:', error);
    return Response.json(
      { error: 'Interní chyba serveru při kontrole dostupnosti.' },
      { status: 500 }
    );
  }
}

// Funkce zkontroluje, zda se čas překrývá s nějakou existující rezervací v DB
async function checkOverlap(start, end) {
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'confirmed')
    .lt('start_at', endStr)
    .gt('end_at', startStr);

  if (error) {
    console.error('Chyba při dotazu do DB na překryvy:', error);
    throw error;
  }

  return data && data.length > 0;
}

// Projde kandidátní sloty a vyfiltruje pouze ty, které nemají kolizi v DB
async function filterFreeSlots(slots, durationMinutes) {
  const freeSlots = [];

  for (const slot of slots) {
    const start = slot;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    try {
      const isOverlapping = await checkOverlap(start, end);
      if (!isOverlapping) {
        freeSlots.push(start.toISOString());
      }
    } catch (e) {
      console.error('Chyba při ověřování kandidátního slotu:', e);
    }
  }

  return freeSlots;
}
