// Otevírací doba a rezervační utility pro Free Studio

export const OPENING_HOURS = {
  // 1 = Pondělí, 2 = Úterý, ..., 5 = Pátek, 6 = Sobota, 0 = Neděle
  1: { open: '09:00', close: '18:00' },
  2: { open: '09:00', close: '18:00' },
  3: { open: '09:00', close: '18:00' },
  4: { open: '09:00', close: '18:00' },
  5: { open: '09:00', close: '18:00' },
  6: { open: '10:00', close: '15:00' },
  0: null, // Zavřeno
};

/**
 * Převede časový řetězec "HH:MM" na minuty od začátku dne
 */
export function timeStringToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Zkontroluje, zda daný termín (od-do) leží kompletně v otevírací době
 */
export function isWithinOpeningHours(dateTime, durationMinutes) {
  const date = new Date(dateTime);
  const dayOfWeek = date.getDay(); // 0 = Neděle, 1 = Pondělí, ...
  
  const dayHours = OPENING_HOURS[dayOfWeek];
  if (!dayHours) return false; // V neděli (nebo pokud není definováno) je zavřeno
  
  const startMinutes = date.getHours() * 60 + date.getMinutes();
  const endMinutes = startMinutes + durationMinutes;
  
  const openMinutes = timeStringToMinutes(dayHours.open);
  const closeMinutes = timeStringToMinutes(dayHours.close);
  
  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

/**
 * Pomocná funkce pro formátování datumu do ISO v lokálním čase bez časové zóny pro jednodušší porovnávání
 */
export function getLocalISODateString(date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
}

/**
 * Vygeneruje možné alternativní časy pro stejný den
 * Zkusí posuny o délku trvání služby dopředu a dozadu, a také na začátek/konec otevírací doby.
 */
export function generateAlternativeSlots(requestedDateTimeStr, durationMinutes) {
  const requestedDate = new Date(requestedDateTimeStr);
  const dayOfWeek = requestedDate.getDay();
  const dayHours = OPENING_HOURS[dayOfWeek];
  
  if (!dayHours) {
    // Pokud je zavřeno, navrhneme další pracovní den na ráno
    const nextDate = new Date(requestedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    while (OPENING_HOURS[nextDate.getDay()] === null) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    const nextDayHours = OPENING_HOURS[nextDate.getDay()];
    const [openH, openM] = nextDayHours.open.split(':').map(Number);
    nextDate.setHours(openH, openM, 0, 0);
    return [nextDate];
  }

  const alternatives = [];
  const openMin = timeStringToMinutes(dayHours.open);
  const closeMin = timeStringToMinutes(dayHours.close);

  // Zkusíme časy v krocích (např. každých 30 minut) po celý den
  const checkDate = new Date(requestedDate);
  
  // Začneme od otevírací doby dne
  const [openH, openM] = dayHours.open.split(':').map(Number);
  checkDate.setHours(openH, openM, 0, 0);

  // Vygenerujeme všechny možné 30minutové sloty v daném dni, které se vejdou do otevírací doby
  let currentMinutes = openMin;
  while (currentMinutes + durationMinutes <= closeMin) {
    const slotDate = new Date(checkDate);
    slotDate.setMinutes(slotDate.getMinutes() + (currentMinutes - openMin));
    
    // Nepřidávat časy v minulosti (pokud je rezervace na dnešek)
    if (slotDate.getTime() > Date.now()) {
      alternatives.push(slotDate);
    }
    
    currentMinutes += 30; // Krok 30 minut
  }

  // Seřadíme alternativy podle toho, jak blízko jsou k původně požadovanému času
  const targetTime = requestedDate.getTime();
  alternatives.sort((a, b) => Math.abs(a.getTime() - targetTime) - Math.abs(b.getTime() - targetTime));

  // Vrátíme prvních 8 kandidátů k otestování vůči databázi
  return alternatives.slice(0, 8);
}
