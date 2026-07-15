// Otevírací doba a rezervační utility pro Free Studio (Časově bezpečné pro libovolné servery)

export const OPENING_HOURS = {
  // 1 = Pondělí, 2 = Úterý, ..., 6 = Sobota, 0 = Neděle
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
 * Získá rozložené datum v časové zóně Europe/Prague
 */
export function getPragueDateParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = {};
  formatter.formatToParts(date).forEach(p => parts[p.type] = p.value);
  
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const minute = Number(parts.minute);
  
  // Vytvoříme lokální Date objekt odpovídající času v Praze
  const pragueDate = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    minute
  );
  
  return {
    dayOfWeek: pragueDate.getDay(),
    hours: pragueDate.getHours(),
    minutes: pragueDate.getMinutes(),
    dateObject: pragueDate
  };
}

/**
 * Vytvoří Date objekt v UTC, který odpovídá zadanému času v časové zóně Europe/Prague
 */
export function createDateInTimezone(baseDate, hours, minutes, timeZone = 'Europe/Prague') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(baseDate);
  const partVal = {};
  parts.forEach(p => partVal[p.type] = p.value);
  
  const localISO = `${partVal.year}-${partVal.month}-${partVal.day}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  const utcDate = new Date(`${localISO}Z`);
  const pragueString = utcDate.toLocaleString('en-US', { timeZone });
  const diff = utcDate.getTime() - new Date(pragueString).getTime();
  
  return new Date(utcDate.getTime() + diff);
}

/**
 * Zkontroluje, zda daný termín (od-do) leží kompletně v otevírací době v pražském čase
 */
export function isWithinOpeningHours(dateTime, durationMinutes) {
  const date = new Date(dateTime);
  const prague = getPragueDateParts(date);
  
  const dayHours = OPENING_HOURS[prague.dayOfWeek];
  if (!dayHours) return false; // Zavřeno
  
  const startMinutes = prague.hours * 60 + prague.minutes;
  const endMinutes = startMinutes + durationMinutes;
  
  const openMinutes = timeStringToMinutes(dayHours.open);
  const closeMinutes = timeStringToMinutes(dayHours.close);
  
  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

/**
 * Vygeneruje možné alternativní časy v pražském čase pro stejný den
 */
export function generateAlternativeSlots(requestedDateTimeStr, durationMinutes) {
  const requestedDate = new Date(requestedDateTimeStr);
  const prague = getPragueDateParts(requestedDate);
  const dayHours = OPENING_HOURS[prague.dayOfWeek];
  
  if (!dayHours) {
    // Pokud je zavřeno, navrhneme další otevřený den na ráno
    const nextDate = new Date(requestedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    let nextPrague = getPragueDateParts(nextDate);
    while (OPENING_HOURS[nextPrague.dayOfWeek] === null) {
      nextDate.setDate(nextDate.getDate() + 1);
      nextPrague = getPragueDateParts(nextDate);
    }
    const nextDayHours = OPENING_HOURS[nextPrague.dayOfWeek];
    const [openH, openM] = nextDayHours.open.split(':').map(Number);
    return [createDateInTimezone(nextDate, openH, openM, 'Europe/Prague')];
  }

  const alternatives = [];
  const openMin = timeStringToMinutes(dayHours.open);
  const closeMin = timeStringToMinutes(dayHours.close);

  // Procházíme 30minutové sloty celého dne
  let currentMinutes = openMin;
  while (currentMinutes + durationMinutes <= closeMin) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    
    const slotDate = createDateInTimezone(requestedDate, h, m, 'Europe/Prague');
    
    if (slotDate.getTime() > Date.now()) {
      alternatives.push(slotDate);
    }
    
    currentMinutes += 30;
  }

  // Seřadíme podle vzdálenosti k původně požadovanému času
  const targetTime = requestedDate.getTime();
  alternatives.sort((a, b) => Math.abs(a.getTime() - targetTime) - Math.abs(b.getTime() - targetTime));

  return alternatives.slice(0, 8);
}
