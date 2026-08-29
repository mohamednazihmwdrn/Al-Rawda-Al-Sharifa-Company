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
 * Checks if two date strings represent the same calendar day,
 * taking into account Arabic numerals, standard numerals, and different formatting.
 */
export function isSameDay(date1?: string, date2?: string): boolean {
  if (!date1 || !date2) return false;
  if (date1.trim() === date2.trim()) return true;
  const d1 = parseArabicOrStandardDate(date1);
  const d2 = parseArabicOrStandardDate(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Checks if a record (invoice, item, archive, report) was created or belongs to TODAY.
 */
export function isTodayRecord(record: { date?: string; time?: string; createdAt?: number | string; approvedAt?: string; savedAt?: string }): boolean {
  if (!record) return false;
  const now = new Date();
  
  // 1. Check direct date string
  if (record.date) {
    const todayAr = now.toLocaleDateString("ar-EG");
    const todayEn = now.toLocaleDateString("en-US");
    const todayIso = now.toISOString().split("T")[0];
    
    if (
      isSameDay(record.date, todayAr) || 
      isSameDay(record.date, todayEn) || 
      isSameDay(record.date, todayIso)
    ) {
      return true;
    }
    
    const parsedDate = parseArabicOrStandardDate(record.date, record.time);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > 0) {
      if (
        parsedDate.getFullYear() === now.getFullYear() &&
        parsedDate.getMonth() === now.getMonth() &&
        parsedDate.getDate() === now.getDate()
      ) {
        return true;
      }
    }
  }

  // 2. Check createdAt timestamp
  if (record.createdAt) {
    const ts = typeof record.createdAt === "number" ? record.createdAt : new Date(record.createdAt).getTime();
    if (!isNaN(ts) && ts > 0) {
      const d = new Date(ts);
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        return true;
      }
    }
  }

  // 3. Check approvedAt or savedAt
  if (record.approvedAt) {
    const d = parseArabicOrStandardDate(record.approvedAt);
    if (!isNaN(d.getTime()) && d.getTime() > 0) {
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        return true;
      }
    }
  }

  if (record.savedAt) {
    const d = parseArabicOrStandardDate(record.savedAt);
    if (!isNaN(d.getTime()) && d.getTime() > 0) {
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Comparator to sort dates/times descending (newest on top, oldest at bottom)
 */
export function compareDatesDescending<T extends { date?: string; time?: string; invoiceNumber?: number; createdAt?: number | string }>(a: T, b: T): number {
  const dateA = parseArabicOrStandardDate(a.date || "", a.time);
  const dateB = parseArabicOrStandardDate(b.date || "", b.time);
  const diff = dateB.getTime() - dateA.getTime();
  if (diff !== 0) return diff;
  if (b.invoiceNumber && a.invoiceNumber && b.invoiceNumber !== a.invoiceNumber) {
    return b.invoiceNumber - a.invoiceNumber;
  }
  if (b.createdAt && a.createdAt && b.createdAt !== a.createdAt) {
    const numA = typeof a.createdAt === "number" ? a.createdAt : new Date(a.createdAt).getTime() || 0;
    const numB = typeof b.createdAt === "number" ? b.createdAt : new Date(b.createdAt).getTime() || 0;
    return numB - numA;
  }
  return 0;
}

/**
 * Comparator to sort dates/times ascending (oldest on top, newest at bottom)
 */
export function compareDatesAscending<T extends { date?: string; time?: string; invoiceNumber?: number; createdAt?: number | string }>(a: T, b: T): number {
  return -compareDatesDescending(a, b);
}

/**
 * Format timestamp or date string to readable Arabic format
 */
export function formatDateArabic(val: number | string | Date): string {
  if (!val) return "";
  const d = typeof val === "object" ? val : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/**
 * Flexible warehouse comparison helper to prevent mismatches
 * between "مخزن النحاس" and "النحاس" or different whitespace variations.
 */
export function isWarehouseMatch(userWh?: string, itemWh?: string): boolean {
  if (!userWh || !itemWh) return true;
  const clean1 = userWh.replace(/مخزن\s*/g, "").trim().toLowerCase();
  const clean2 = itemWh.replace(/مخزن\s*/g, "").trim().toLowerCase();
  if (!clean1 || !clean2) return true;
  return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
}
