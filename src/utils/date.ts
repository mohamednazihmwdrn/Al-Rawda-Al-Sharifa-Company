/**
 * Safely parses any Arabic (Eastern Arabic numerals) or standard Gregorian date
 * and optional time string into a valid JavaScript Date object for correct chronological sorting.
 */
export function parseArabicOrStandardDate(dateStr: string, timeStr?: string): Date {
  if (!dateStr) return new Date(0);

  // Helper to replace Arabic Eastern digits with Western digits
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let cleanedDate = dateStr;
  for (let i = 0; i < 10; i++) {
    cleanedDate = cleanedDate.replace(new RegExp(arabicDigits[i], "g"), String(i));
  }

  let cleanedTime = timeStr || "";
  for (let i = 0; i < 10; i++) {
    cleanedTime = cleanedTime.replace(new RegExp(arabicDigits[i], "g"), String(i));
  }

  // If date string contains a time component (e.g. separated by " - " or "," or space), split it
  if (cleanedDate.includes(" - ")) {
    const parts = cleanedDate.split(" - ");
    cleanedDate = parts[0];
    if (!cleanedTime) cleanedTime = parts[1];
  } else if (cleanedDate.includes(",")) {
    const parts = cleanedDate.split(",");
    cleanedDate = parts[0];
    if (!cleanedTime) cleanedTime = parts[1];
  } else if (cleanedDate.includes(" ")) {
    const parts = cleanedDate.trim().split(/\s+/);
    if (parts.length > 1) {
      cleanedDate = parts[0];
      if (!cleanedTime) cleanedTime = parts.slice(1).join(" ");
    }
  }

  // Parse date parts
  const dateParts = cleanedDate.split(/[\/\-\s]+/);
  let year = 0;
  let month = 0;
  let day = 0;

  if (dateParts.length >= 3) {
    const p0 = parseInt(dateParts[0], 10);
    const p1 = parseInt(dateParts[1], 10);
    const p2 = parseInt(dateParts[2], 10);

    if (p0 > 1000) {
      year = p0;
      month = p1;
      day = p2;
    } else if (p2 > 1000) {
      year = p2;
      month = p1;
      day = p0;
    } else {
      year = p2 || 0;
      month = p1 || 0;
      day = p0 || 0;
    }
  }

  // Parse time parts
  let hour = 0;
  let minute = 0;
  let second = 0;
  let pm = false;
  let am = false;

  if (cleanedTime) {
    if (cleanedTime.includes("م") || cleanedTime.toLowerCase().includes("pm")) {
      pm = true;
    } else if (cleanedTime.includes("ص") || cleanedTime.toLowerCase().includes("am")) {
      am = true;
    }

    // Strip non-numeric characters for simple hh:mm:ss splitting, except colons
    const timeCleaned = cleanedTime.replace(/[^\d:]/g, "");
    const timeParts = timeCleaned.split(":");
    if (timeParts.length >= 2) {
      hour = parseInt(timeParts[0], 10) || 0;
      minute = parseInt(timeParts[1], 10) || 0;
      second = parseInt(timeParts[2], 10) || 0;

      if (pm && hour < 12) {
        hour += 12;
      } else if (am && hour === 12) {
        hour = 0;
      }
    }
  }

  const dateObj = new Date(year, month - 1, day, hour, minute, second);
  if (!isNaN(dateObj.getTime())) {
    return dateObj;
  }

  const fallback = new Date(cleanedDate);
  return isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

/**
 * Comparator to sort dates/times descending (newest on top, oldest at bottom)
 */
export function compareDatesDescending<T extends { date: string; time?: string }>(a: T, b: T): number {
  const dateA = parseArabicOrStandardDate(a.date, a.time);
  const dateB = parseArabicOrStandardDate(b.date, b.time);
  return dateB.getTime() - dateA.getTime();
}
