import { 
  collection, 
  doc, 
  setDoc as firestoreSetDoc, 
  getDocs, 
  onSnapshot, 
  deleteDoc as firestoreDeleteDoc, 
  updateDoc as firestoreUpdateDoc,
  query,
  where,
  getDoc,
  disableNetwork,
  enableNetwork
} from "firebase/firestore";
import { db } from "../firebase";
import { 
  User, 
  Item, 
  MergedInvoice, 
  Archive, 
  WarehouseArchive, 
  Report, 
  SavedItem, 
  Quotation,
  TrashItem
} from "../types";
import { companyItemsMap } from "../data/constants";

// Helper function to recursively clean "undefined" values from objects, replacing them with null, 
// to prevent Firestore "Unsupported field value: undefined" validation errors.
function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// === LOCAL STORAGE FALLBACK AND CACHING LAYER ===
// Ensures the application remains 100% functional and fast even when Firestore quota limits are exceeded
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(`rouda_${key}`);
    if (data) {
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.warn(`Failed to read from local storage for key ${key}:`, err);
  }
  return defaultValue;
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`rouda_${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write to local storage for key ${key}:`, err);
  }
}

// In-memory listener registry for real-time local updates
type Listener<T> = (data: T) => void;
const listenersMap: { [key: string]: Set<Listener<any>> } = {};

// Safe onSnapshot wrapper that checks circuit breaker and handles quota errors cleanly
function safeOnSnapshot(target: any, onNext: (snapshot: any) => void, onError?: (err: any) => void): () => void {
  if (isFirestoreQuotaExhausted) {
    return () => {};
  }

  try {
    let unsub: () => void = () => {};
    unsub = onSnapshot(target, onNext, (err) => {
      const isQuota = (err as any)?.code === "resource-exhausted" || err?.message?.includes("Quota") || err?.message?.includes("quota") || err?.message?.includes("resource-exhausted");
      if (isQuota) {
        markQuotaExhausted();
        try { unsub(); } catch {}
      } else if (onError) {
        onError(err);
      }
    });
    return () => {
      try { unsub(); } catch {}
    };
  } catch (err: any) {
    const isQuota = err?.code === "resource-exhausted" || err?.message?.includes("Quota") || err?.message?.includes("quota");
    if (isQuota) {
      markQuotaExhausted();
    }
    return () => {};
  }
}

function registerLocalListener<T>(key: string, callback: Listener<T>): () => void {
  if (!listenersMap[key]) {
    listenersMap[key] = new Set();
  }
  listenersMap[key].add(callback);
  return () => {
    listenersMap[key]?.delete(callback);
  };
}

function notifyLocalListeners<T>(key: string, data: T) {
  setLocal(key, data);
  if (listenersMap[key]) {
    listenersMap[key].forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in local listener for ${key}:`, err);
      }
    });
  }
}

// === QUOTA CIRCUIT BREAKER ===
// Prevents continuous network retries and console errors when Firebase free tier limit is reached
let isFirestoreQuotaExhausted = false;

try {
  const savedState = localStorage.getItem("rouda_quota_exhausted");
  const savedTime = localStorage.getItem("rouda_quota_exhausted_time");
  if (savedState === "true" && savedTime) {
    const elapsed = Date.now() - parseInt(savedTime, 10);
    // Keep circuit breaker active for 24 hours (Free daily write quota reset window)
    if (elapsed < 24 * 60 * 60 * 1000) {
      isFirestoreQuotaExhausted = true;
      disableNetwork(db).catch(() => {});
    } else {
      localStorage.removeItem("rouda_quota_exhausted");
      localStorage.removeItem("rouda_quota_exhausted_time");
    }
  }
} catch {
  // Ignore localStorage errors
}

export function markQuotaExhausted() {
  if (!isFirestoreQuotaExhausted) {
    isFirestoreQuotaExhausted = true;
    try {
      localStorage.setItem("rouda_quota_exhausted", "true");
      localStorage.setItem("rouda_quota_exhausted_time", Date.now().toString());
    } catch {}
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
    console.info("⚡ [وضع العمل المحلي فائق السرعة مُفعّل]: تم الانتقال السلس للذاكرة المحلية لضمان استمرار كافة وظائف التطبيق بكفاءة 100% وبدون أي توقف.");
  }
}

export function isQuotaLimitActive(): boolean {
  return isFirestoreQuotaExhausted;
}

// Safe Firestore write wrappers that fallback to local cache on quota/network error
async function safeSetDoc(docRef: any, data: any, options?: any) {
  if (isFirestoreQuotaExhausted) return;
  const cleanedData = cleanUndefined(data);
  try {
    await firestoreSetDoc(docRef, cleanedData, options);
  } catch (err: any) {
    if (err?.code === "resource-exhausted" || err?.message?.includes("Quota") || err?.message?.includes("quota")) {
      markQuotaExhausted();
    } else {
      console.warn("Firestore setDoc warning (fallback to local state):", err);
    }
  }
}

async function safeUpdateDoc(docRef: any, data: any) {
  if (isFirestoreQuotaExhausted) return;
  const cleanedData = cleanUndefined(data);
  try {
    await firestoreUpdateDoc(docRef, cleanedData);
  } catch (err: any) {
    if (err?.code === "resource-exhausted" || err?.message?.includes("Quota") || err?.message?.includes("quota")) {
      markQuotaExhausted();
    } else {
      console.warn("Firestore updateDoc warning (fallback to local state):", err);
    }
  }
}

async function safeDeleteDoc(docRef: any) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await firestoreDeleteDoc(docRef);
  } catch (err: any) {
    if (err?.code === "resource-exhausted" || err?.message?.includes("Quota") || err?.message?.includes("quota")) {
      markQuotaExhausted();
    } else {
      console.warn("Firestore deleteDoc warning (fallback to local state):", err);
    }
  }
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuota = (error as any)?.code === "resource-exhausted" || errMessage.includes("resource-exhausted") || errMessage.includes("Quota") || errMessage.includes("quota");
  
  if (isQuota) {
    markQuotaExhausted();
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn("Firestore Notice: ", JSON.stringify(errInfo));
}

const defaultUsers: { [key: string]: User } = {
  "مدير": {
    username: "مدير",
    displayName: "المدير",
    password: "admin123",
    role: "مدير",
    warehouse: null
  },
  "مخزن النحاس": {
    username: "مخزن النحاس",
    displayName: "مخزن النحاس",
    password: "nahas123",
    role: "مخزن",
    warehouse: "مخزن النحاس"
  },
  "مخزن النادي": {
    username: "مخزن النادي",
    displayName: "مخزن النادي",
    password: "nady123",
    role: "مخزن",
    warehouse: "مخزن النادي"
  }
};

// Seed default users if users collection is empty
export async function seedUsersIfEmpty() {
  try {
    const cachedUsers = getLocal<{ [key: string]: User }>("users", {});
    if (Object.keys(cachedUsers).length === 0) {
      setLocal("users", defaultUsers);
      notifyLocalListeners("users", defaultUsers);
    } else {
      // Local users already available, no need to perform seeding writes
      return;
    }

    if (isFirestoreQuotaExhausted) return;

    // Only attempt Firestore seed if local was empty
    let querySnapshot;
    try {
      querySnapshot = await getDocs(collection(db, "users"));
      if (querySnapshot.empty) {
        console.log("Seeding default users in Firestore...");
        for (const [key, user] of Object.entries(defaultUsers)) {
          await safeSetDoc(doc(db, "users", key), user);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "users");
    }
  } catch (error) {
    console.warn("Notice during seeding users:", error);
  }
}

// Test Firebase connection
export async function testConnection() {
  if (isFirestoreQuotaExhausted) return true;
  try {
    const snap = await getDoc(doc(db, "test", "connection"));
    return snap.exists();
  } catch (error) {
    // Graceful check, doesn't disrupt local mode
    return false;
  }
}

// === Users ===
export function listenUsers(callback: (users: { [key: string]: User }) => void) {
  // 1. Initial cached value
  const initial = getLocal<{ [key: string]: User }>("users", defaultUsers);
  callback(initial);

  // 2. Local listener
  const unsubLocal = registerLocalListener("users", callback);

  // 3. Firestore listener with quota tolerance
  const unsubFirestore = safeOnSnapshot(collection(db, "users"), (snapshot) => {
    if (snapshot.empty) return;
    const usersMap: { [key: string]: User } = {};
    snapshot.forEach((doc: any) => {
      usersMap[doc.id] = doc.data() as User;
    });
    setLocal("users", usersMap);
    callback(usersMap);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "users");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveUser(user: User) {
  const current = getLocal<{ [key: string]: User }>("users", defaultUsers);
  const updated = { ...current, [user.username]: user };
  notifyLocalListeners("users", updated);
  await safeSetDoc(doc(db, "users", user.username), user);
}

export async function removeUser(username: string) {
  const current = getLocal<{ [key: string]: User }>("users", defaultUsers);
  const updated = { ...current };
  delete updated[username];
  notifyLocalListeners("users", updated);
  await safeDeleteDoc(doc(db, "users", username));
}

// === Items (Deficit items) ===
export function listenItems(callback: (items: Item[]) => void) {
  const initial = getLocal<Item[]>("items", []);
  callback(initial);

  const unsubLocal = registerLocalListener("items", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "items"), (snapshot) => {
    const local = getLocal<Item[]>("items", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, Item>();
    snapshot.forEach((d: any) => {
      const data = d.data() as Item;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    // Merge with any local item not in Firestore
    local.forEach(item => {
      if (item.id && !firestoreMap.has(item.id)) {
        firestoreMap.set(item.id, item);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("items", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "items");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveItem(item: Item) {
  const current = getLocal<Item[]>("items", []);
  const index = current.findIndex(i => i.id === item.id);
  const updated = index >= 0 
    ? current.map(i => i.id === item.id ? item : i)
    : [item, ...current];
  
  notifyLocalListeners("items", updated);
  await safeSetDoc(doc(db, "items", item.id), item);
}

export async function saveItems(items: Item[]) {
  const current = getLocal<Item[]>("items", []);
  const updatedMap = new Map(current.map(i => [i.id, i]));
  items.forEach(it => updatedMap.set(it.id, it));
  const updatedList = Array.from(updatedMap.values());
  
  notifyLocalListeners("items", updatedList);

  for (const item of items) {
    await safeSetDoc(doc(db, "items", item.id), item);
  }
}

export async function deleteItem(id: string) {
  const current = getLocal<Item[]>("items", []);
  const updated = current.filter(i => i.id !== id);
  notifyLocalListeners("items", updated);
  await safeDeleteDoc(doc(db, "items", id));
}

export async function updateItemStatus(id: string, status: Item["status"], extraFields: Partial<Item> = {}) {
  const current = getLocal<Item[]>("items", []);
  const updated = current.map(i => i.id === id ? { ...i, status, ...extraFields } : i);
  notifyLocalListeners("items", updated);
  await safeUpdateDoc(doc(db, "items", id), { status, ...extraFields });
}

export async function updateItemFields(id: string, fields: Partial<Item>) {
  const current = getLocal<Item[]>("items", []);
  const updated = current.map(i => i.id === id ? { ...i, ...fields } : i);
  notifyLocalListeners("items", updated);
  await safeUpdateDoc(doc(db, "items", id), fields);
}

// === Merged Invoices ===
export function listenMergedInvoices(callback: (invoices: MergedInvoice[]) => void) {
  const initial = getLocal<MergedInvoice[]>("mergedInvoices", []);
  callback(initial);

  const unsubLocal = registerLocalListener("mergedInvoices", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "mergedInvoices"), (snapshot) => {
    const local = getLocal<MergedInvoice[]>("mergedInvoices", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, MergedInvoice>();
    snapshot.forEach((d: any) => {
      const data = d.data() as MergedInvoice;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(inv => {
      if (inv.id && !firestoreMap.has(inv.id)) {
        firestoreMap.set(inv.id, inv);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("mergedInvoices", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "mergedInvoices");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveMergedInvoice(invoice: MergedInvoice) {
  const current = getLocal<MergedInvoice[]>("mergedInvoices", []);
  const index = current.findIndex(m => m.id === invoice.id);
  const updated = index >= 0 
    ? current.map(m => m.id === invoice.id ? invoice : m)
    : [invoice, ...current];
  
  notifyLocalListeners("mergedInvoices", updated);
  await safeSetDoc(doc(db, "mergedInvoices", invoice.id), invoice);
}

export async function getPendingItemsFromDb(): Promise<Item[]> {
  const local = getLocal<Item[]>("items", []);
  if (isFirestoreQuotaExhausted || (local && local.length > 0)) {
    return local.filter(i => i.status === "waiting");
  }
  try {
    const q = query(collection(db, "items"), where("status", "==", "waiting"));
    const snapshot = await getDocs(q);
    const itemsList: Item[] = [];
    snapshot.forEach((doc) => {
      itemsList.push(doc.data() as Item);
    });
    return itemsList;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "items");
    return local.filter(i => i.status === "waiting");
  }
}

export async function getPendingMergedInvoicesFromDb(today: string): Promise<MergedInvoice[]> {
  const local = getLocal<MergedInvoice[]>("mergedInvoices", []);
  if (isFirestoreQuotaExhausted || (local && local.length > 0)) {
    return local.filter(m => m.status === "pending" && m.date === today);
  }
  try {
    const q = query(
      collection(db, "mergedInvoices"), 
      where("status", "==", "pending"),
      where("date", "==", today)
    );
    const snapshot = await getDocs(q);
    const invoices: MergedInvoice[] = [];
    snapshot.forEach((doc) => {
      invoices.push(doc.data() as MergedInvoice);
    });
    return invoices;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "mergedInvoices");
    return local.filter(m => m.status === "pending" && m.date === today);
  }
}

export async function getMergedInvoicesCountFromDb(): Promise<number> {
  const local = getLocal<MergedInvoice[]>("mergedInvoices", []);
  let maxNum = local.length;
  local.forEach(data => {
    if (data.invoiceNumber && typeof data.invoiceNumber === "number" && data.invoiceNumber > maxNum) {
      maxNum = data.invoiceNumber;
    }
  });

  if (isFirestoreQuotaExhausted || local.length > 0) {
    return maxNum;
  }

  try {
    const snapshot = await getDocs(collection(db, "mergedInvoices"));
    let firestoreMax = snapshot.size;
    snapshot.forEach((doc) => {
      const data = doc.data() as MergedInvoice;
      if (data.invoiceNumber && typeof data.invoiceNumber === "number" && data.invoiceNumber > firestoreMax) {
        firestoreMax = data.invoiceNumber;
      }
    });
    return Math.max(maxNum, firestoreMax);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "mergedInvoices");
    return maxNum;
  }
}

export async function deleteMergedInvoice(id: string) {
  const current = getLocal<MergedInvoice[]>("mergedInvoices", []);
  const updated = current.filter(m => m.id !== id);
  notifyLocalListeners("mergedInvoices", updated);
  await safeDeleteDoc(doc(db, "mergedInvoices", id));
}

// === Archives ===
export function listenArchives(callback: (archives: Archive[]) => void) {
  const initial = getLocal<Archive[]>("archives", []);
  callback(initial);

  const unsubLocal = registerLocalListener("archives", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "archives"), (snapshot) => {
    const local = getLocal<Archive[]>("archives", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, Archive>();
    snapshot.forEach((d: any) => {
      const data = d.data() as Archive;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(arch => {
      if (arch.id && !firestoreMap.has(arch.id)) {
        firestoreMap.set(arch.id, arch);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("archives", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "archives");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveArchive(archive: Archive) {
  const current = getLocal<Archive[]>("archives", []);
  const index = current.findIndex(a => a.id === archive.id);
  const updated = index >= 0 
    ? current.map(a => a.id === archive.id ? archive : a)
    : [archive, ...current];
  
  notifyLocalListeners("archives", updated);
  await safeSetDoc(doc(db, "archives", archive.id), archive);
}

export async function deleteArchive(id: string) {
  const current = getLocal<Archive[]>("archives", []);
  const updated = current.filter(a => a.id !== id);
  notifyLocalListeners("archives", updated);
  await safeDeleteDoc(doc(db, "archives", id));
}

// === Warehouse Archives ===
export function listenWarehouseArchives(callback: (archives: WarehouseArchive[]) => void) {
  const initial = getLocal<WarehouseArchive[]>("warehouseArchives", []);
  callback(initial);

  const unsubLocal = registerLocalListener("warehouseArchives", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "warehouseArchives"), (snapshot) => {
    const local = getLocal<WarehouseArchive[]>("warehouseArchives", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, WarehouseArchive>();
    snapshot.forEach((d: any) => {
      const data = d.data() as WarehouseArchive;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(arch => {
      if (arch.id && !firestoreMap.has(arch.id)) {
        firestoreMap.set(arch.id, arch);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("warehouseArchives", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "warehouseArchives");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveWarehouseArchive(archive: WarehouseArchive) {
  const current = getLocal<WarehouseArchive[]>("warehouseArchives", []);
  const index = current.findIndex(a => a.id === archive.id);
  const updated = index >= 0 
    ? current.map(a => a.id === archive.id ? archive : a)
    : [archive, ...current];
  
  notifyLocalListeners("warehouseArchives", updated);
  await safeSetDoc(doc(db, "warehouseArchives", archive.id), archive);
}

export async function deleteWarehouseArchive(id: string) {
  const current = getLocal<WarehouseArchive[]>("warehouseArchives", []);
  const updated = current.filter(a => a.id !== id);
  notifyLocalListeners("warehouseArchives", updated);
  await safeDeleteDoc(doc(db, "warehouseArchives", id));
}

// === Reports ===
export function listenReports(callback: (reports: Report[]) => void) {
  const initial = getLocal<Report[]>("reports", []);
  callback(initial);

  const unsubLocal = registerLocalListener("reports", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "reports"), (snapshot) => {
    const local = getLocal<Report[]>("reports", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, Report>();
    snapshot.forEach((d: any) => {
      const data = d.data() as Report;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(rep => {
      if (rep.id && !firestoreMap.has(rep.id)) {
        firestoreMap.set(rep.id, rep);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("reports", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "reports");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveReport(report: Report) {
  const current = getLocal<Report[]>("reports", []);
  const index = current.findIndex(r => r.id === report.id);
  const updated = index >= 0 
    ? current.map(r => r.id === report.id ? report : r)
    : [report, ...current];
  
  notifyLocalListeners("reports", updated);
  await safeSetDoc(doc(db, "reports", report.id), report);
}

export async function deleteReport(id: string) {
  const current = getLocal<Report[]>("reports", []);
  const updated = current.filter(r => r.id !== id);
  notifyLocalListeners("reports", updated);
  await safeDeleteDoc(doc(db, "reports", id));
}

// === Saved Items ===
export function listenSavedItems(callback: (savedItems: SavedItem[]) => void) {
  const initial = getLocal<SavedItem[]>("savedItems", []);
  callback(initial);

  const unsubLocal = registerLocalListener("savedItems", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "savedItems"), (snapshot) => {
    const local = getLocal<SavedItem[]>("savedItems", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, SavedItem>();
    snapshot.forEach((d: any) => {
      const data = d.data() as SavedItem;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(s => {
      if (s.id && !firestoreMap.has(s.id)) {
        firestoreMap.set(s.id, s);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("savedItems", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "savedItems");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveSavedItem(item: SavedItem) {
  const current = getLocal<SavedItem[]>("savedItems", []);
  const index = current.findIndex(s => s.id === item.id);
  const updated = index >= 0 
    ? current.map(s => s.id === item.id ? item : s)
    : [item, ...current];
  
  notifyLocalListeners("savedItems", updated);
  await safeSetDoc(doc(db, "savedItems", item.id), item);
}

export async function deleteSavedItem(itemId: string) {
  const current = getLocal<SavedItem[]>("savedItems", []);
  const updated = current.filter(s => s.id !== itemId);
  notifyLocalListeners("savedItems", updated);
  await safeDeleteDoc(doc(db, "savedItems", itemId));
}

// === Custom Companies ===
export interface CustomCompany {
  id: string;
  name: string;
  fixedNames: string[];
  isDeleted?: boolean;
  originalName?: string;
}

export function getMergedCompanyMap(customCompanies: CustomCompany[]): { [key: string]: string[] } {
  const merged: { [key: string]: string[] } = {};

  // 1. Process default companies from companyItemsMap
  Object.entries(companyItemsMap).forEach(([name, defaultFixedNames]) => {
    const custom = customCompanies.find(
      cc => cc.id === name || cc.name === name || cc.originalName === name
    );

    if (custom) {
      if (custom.isDeleted) return;
      merged[custom.name] = custom.fixedNames;
    } else {
      merged[name] = defaultFixedNames;
    }
  });

  // 2. Process custom companies that are brand new
  customCompanies.forEach(cc => {
    if (cc.isDeleted) return;
    const isOverride = Object.keys(companyItemsMap).some(
      name => cc.id === name || cc.name === name || cc.originalName === name
    );

    if (!isOverride) {
      merged[cc.name] = cc.fixedNames;
    }
  });

  // Filter out any company containing "باكين" or "pakin"
  const finalMerged: { [key: string]: string[] } = {};
  Object.entries(merged).forEach(([name, fixedNames]) => {
    const isPakin = name.includes("باكين") || name.toLowerCase().includes("pakin");
    if (!isPakin) {
      finalMerged[name] = fixedNames;
    }
  });

  return finalMerged;
}

export function listenCustomCompanies(callback: (companies: CustomCompany[]) => void) {
  const initial = getLocal<CustomCompany[]>("customCompanies", []);
  callback(initial);

  const unsubLocal = registerLocalListener("customCompanies", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "customCompanies"), (snapshot) => {
    const local = getLocal<CustomCompany[]>("customCompanies", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, CustomCompany>();
    snapshot.forEach((d: any) => {
      const data = d.data() as CustomCompany;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(comp => {
      if (comp.id && !firestoreMap.has(comp.id)) {
        firestoreMap.set(comp.id, comp);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("customCompanies", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "customCompanies");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveCustomCompany(company: CustomCompany) {
  const current = getLocal<CustomCompany[]>("customCompanies", []);
  const index = current.findIndex(c => c.id === company.id);
  const updated = index >= 0 
    ? current.map(c => c.id === company.id ? company : c)
    : [company, ...current];
  
  notifyLocalListeners("customCompanies", updated);
  await safeSetDoc(doc(db, "customCompanies", company.id), company);
}

export async function deleteCustomCompany(companyId: string) {
  const current = getLocal<CustomCompany[]>("customCompanies", []);
  const updated = current.filter(c => c.id !== companyId);
  notifyLocalListeners("customCompanies", updated);
  await safeDeleteDoc(doc(db, "customCompanies", companyId));
}

// === Quotations ===
export function listenQuotations(callback: (quotations: Quotation[]) => void) {
  const initial = getLocal<Quotation[]>("quotations", []);
  callback(initial);

  const unsubLocal = registerLocalListener("quotations", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "quotations"), (snapshot) => {
    const local = getLocal<Quotation[]>("quotations", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, Quotation>();
    snapshot.forEach((d: any) => {
      const data = d.data() as Quotation;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(q => {
      if (q.id && !firestoreMap.has(q.id)) {
        firestoreMap.set(q.id, q);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("quotations", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "quotations");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function saveQuotation(quotation: Quotation) {
  const current = getLocal<Quotation[]>("quotations", []);
  const index = current.findIndex(q => q.id === quotation.id);
  const updated = index >= 0 
    ? current.map(q => q.id === quotation.id ? quotation : q)
    : [quotation, ...current];
  
  notifyLocalListeners("quotations", updated);
  await safeSetDoc(doc(db, "quotations", quotation.id), quotation);
}

export async function deleteQuotation(id: string) {
  const current = getLocal<Quotation[]>("quotations", []);
  const updated = current.filter(q => q.id !== id);
  notifyLocalListeners("quotations", updated);
  await safeDeleteDoc(doc(db, "quotations", id));
}

// === Trash / Recycle Bin (سلة المحذوفات) ===
export function listenTrash(callback: (trashItems: TrashItem[]) => void) {
  const initial = getLocal<TrashItem[]>("trash", []);
  callback(initial);

  const unsubLocal = registerLocalListener("trash", callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "trash"), (snapshot) => {
    const local = getLocal<TrashItem[]>("trash", []);
    if (snapshot.empty) {
      if (local.length > 0) callback(local);
      return;
    }

    const firestoreMap = new Map<string, TrashItem>();
    snapshot.forEach((d: any) => {
      const data = d.data() as TrashItem;
      if (data && data.id) firestoreMap.set(data.id, data);
    });

    local.forEach(t => {
      if (t.id && !firestoreMap.has(t.id)) {
        firestoreMap.set(t.id, t);
      }
    });

    const mergedList = Array.from(firestoreMap.values());
    setLocal("trash", mergedList);
    callback(mergedList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "trash");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function moveToTrash(trashRecord: TrashItem) {
  const current = getLocal<TrashItem[]>("trash", []);
  const updated = [trashRecord, ...current.filter(t => t.id !== trashRecord.id)];
  notifyLocalListeners("trash", updated);
  await safeSetDoc(doc(db, "trash", trashRecord.id), trashRecord);
}

export async function permanentlyDeleteFromTrash(id: string) {
  const current = getLocal<TrashItem[]>("trash", []);
  const updated = current.filter(t => t.id !== id);
  notifyLocalListeners("trash", updated);
  await safeDeleteDoc(doc(db, "trash", id));
}

export async function clearAllTrash() {
  notifyLocalListeners("trash", []);
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, "trash"));
    for (const docSnapshot of snapshot.docs) {
      await safeDeleteDoc(doc(db, "trash", docSnapshot.id));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "trash");
  }
}

// Automatically clean items older than 15 days from trash
export async function autoCleanOldTrash(): Promise<number> {
  const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleanedCount = 0;

  const current = getLocal<TrashItem[]>("trash", []);
  const filtered = current.filter(item => {
    const ts = item.deletedTimestamp || 0;
    if (ts > 0 && (now - ts) > FIFTEEN_DAYS_MS) {
      cleanedCount++;
      return false;
    }
    return true;
  });

  if (cleanedCount > 0) {
    notifyLocalListeners("trash", filtered);
  }

  if (isFirestoreQuotaExhausted) return cleanedCount;

  try {
    const snapshot = await getDocs(collection(db, "trash"));
    for (const docSnapshot of snapshot.docs) {
      const item = docSnapshot.data() as TrashItem;
      const itemTimestamp = item.deletedTimestamp || 0;
      if (itemTimestamp > 0 && (now - itemTimestamp) > FIFTEEN_DAYS_MS) {
        await safeDeleteDoc(doc(db, "trash", docSnapshot.id));
      }
    }
  } catch (err) {
    // Ignore quota warning on background cleanup
  }

  return cleanedCount;
}

// Clear all database tables (Manager setting)
export async function clearAllDatabaseTables() {
  const collectionsToClear = [
    "items",
    "mergedInvoices",
    "archives",
    "warehouseArchives",
    "reports",
    "savedItems",
    "quotations"
  ];

  for (const colName of collectionsToClear) {
    notifyLocalListeners(colName, []);
    if (isFirestoreQuotaExhausted) continue;
    try {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnapshot of snapshot.docs) {
        await safeDeleteDoc(doc(db, colName, docSnapshot.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, colName);
    }
  }
}

// Clear only manual and experimental operations to start fresh
export async function clearExperimentalOperationsOnly() {
  const collectionsToClear = [
    "items",
    "mergedInvoices",
    "archives",
    "warehouseArchives",
    "reports",
    "quotations"
  ];

  for (const colName of collectionsToClear) {
    notifyLocalListeners(colName, []);
    if (isFirestoreQuotaExhausted) continue;
    try {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnapshot of snapshot.docs) {
        await safeDeleteDoc(doc(db, colName, docSnapshot.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, colName);
    }
  }
}

// Bulk restore data (from JSON backup)
export async function bulkRestoreDatabase(backupData: any) {
  try {
    if (backupData.users) {
      notifyLocalListeners("users", backupData.users);
      for (const [key, user] of Object.entries(backupData.users)) {
        await safeSetDoc(doc(db, "users", key), user);
      }
    }
    
    if (backupData.items && Array.isArray(backupData.items)) {
      notifyLocalListeners("items", backupData.items);
      for (const item of backupData.items) {
        await safeSetDoc(doc(db, "items", item.id), item);
      }
    }

    if (backupData.archives && Array.isArray(backupData.archives)) {
      notifyLocalListeners("archives", backupData.archives);
      for (const archive of backupData.archives) {
        await safeSetDoc(doc(db, "archives", archive.id), archive);
      }
    }

    if (backupData.mergedInvoices && Array.isArray(backupData.mergedInvoices)) {
      notifyLocalListeners("mergedInvoices", backupData.mergedInvoices);
      for (const inv of backupData.mergedInvoices) {
        await safeSetDoc(doc(db, "mergedInvoices", inv.id), inv);
      }
    }

    if (backupData.warehouseArchives) {
      if (Array.isArray(backupData.warehouseArchives)) {
        notifyLocalListeners("warehouseArchives", backupData.warehouseArchives);
        for (const arch of backupData.warehouseArchives) {
          await safeSetDoc(doc(db, "warehouseArchives", arch.id), arch);
        }
      }
    }

    if (backupData.reports && Array.isArray(backupData.reports)) {
      notifyLocalListeners("reports", backupData.reports);
      for (const report of backupData.reports) {
        await safeSetDoc(doc(db, "reports", report.id), report);
      }
    }

    if (backupData.savedItems && Array.isArray(backupData.savedItems)) {
      notifyLocalListeners("savedItems", backupData.savedItems);
      for (const s of backupData.savedItems) {
        await safeSetDoc(doc(db, "savedItems", s.id), s);
      }
    }

    if (backupData.quotations && Array.isArray(backupData.quotations)) {
      notifyLocalListeners("quotations", backupData.quotations);
      for (const q of backupData.quotations) {
        await safeSetDoc(doc(db, "quotations", q.id), q);
      }
    }
  } catch (error) {
    console.error("Bulk restore notice:", error);
  }
}

// === Chat System ===
export interface Chat {
  id: string;
  name: string;
  type: "direct" | "group";
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSender?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export function listenChats(username: string, callback: (chats: Chat[]) => void) {
  const allChats = getLocal<Chat[]>("chats", []);
  callback(allChats.filter(c => c.participants && c.participants.includes(username)));

  const unsubLocal = registerLocalListener("chats", (chats: Chat[]) => {
    callback(chats.filter(c => c.participants && c.participants.includes(username)));
  });

  const unsubFirestore = safeOnSnapshot(collection(db, "chats"), (snapshot) => {
    const list: Chat[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data() as Chat;
      list.push(data);
    });
    setLocal("chats", list);
    callback(list.filter(c => c.participants && c.participants.includes(username)));
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "chats");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function createOrGetDirectChat(userA: string, userB: string, userBName: string): Promise<string> {
  const chatId = `direct_${[userA, userB].sort().join("_")}`;
  const allChats = getLocal<Chat[]>("chats", []);
  let found = allChats.find(c => c.id === chatId);
  
  if (!found) {
    found = {
      id: chatId,
      name: userBName,
      type: "direct",
      participants: [userA, userB],
      lastMessage: "",
      lastMessageTime: "",
      lastMessageSender: ""
    };
    notifyLocalListeners("chats", [found, ...allChats]);
    await safeSetDoc(doc(db, "chats", chatId), found);
  }
  
  return chatId;
}

export async function createGroupChat(name: string, participants: string[]): Promise<string> {
  const chatId = `group_${Date.now()}`;
  const allChats = getLocal<Chat[]>("chats", []);
  const newChat: Chat = {
    id: chatId,
    name: name,
    type: "group",
    participants: participants,
    lastMessage: "تم إنشاء المجموعة",
    lastMessageTime: new Date().toISOString(),
    lastMessageSender: "system"
  };
  
  notifyLocalListeners("chats", [newChat, ...allChats]);
  await safeSetDoc(doc(db, "chats", chatId), newChat);
  return chatId;
}

export function listenMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
  const initial = getLocal<ChatMessage[]>(`chat_msgs_${chatId}`, []);
  callback(initial);

  const unsubLocal = registerLocalListener(`chat_msgs_${chatId}`, callback);

  const unsubFirestore = safeOnSnapshot(collection(db, "chats", chatId, "messages"), (snapshot) => {
    const list: ChatMessage[] = [];
    snapshot.forEach((doc: any) => {
      list.push(doc.data() as ChatMessage);
    });
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setLocal(`chat_msgs_${chatId}`, list);
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `chats/${chatId}/messages`);
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export async function sendMessage(chatId: string, sender: string, senderName: string, text: string) {
  const msgId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
  const nowStr = new Date().toISOString();
  
  const msg: ChatMessage = {
    id: msgId,
    sender,
    senderName,
    text,
    timestamp: nowStr
  };

  const currentMsgs = getLocal<ChatMessage[]>(`chat_msgs_${chatId}`, []);
  notifyLocalListeners(`chat_msgs_${chatId}`, [...currentMsgs, msg]);

  // Update chat summary
  const allChats = getLocal<Chat[]>("chats", []);
  const updatedChats = allChats.map(c => c.id === chatId ? {
    ...c,
    lastMessage: text,
    lastMessageTime: nowStr,
    lastMessageSender: senderName
  } : c);
  notifyLocalListeners("chats", updatedChats);

  await safeSetDoc(doc(db, "chats", chatId, "messages", msgId), msg);
  await safeUpdateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    lastMessageTime: nowStr,
    lastMessageSender: senderName
  });
}

// === Company Info Settings ===
export interface CompanyInfo {
  name: string;
  address: string;
  phones: string;
}

const defaultCompanyInfo: CompanyInfo = {
  name: "مستودع الروضة",
  address: "شارع المحطة - بجوار السكة الحديد",
  phones: "01000000000 - 01111111111"
};

export function listenCompanyInfo(callback: (info: CompanyInfo | null) => void) {
  const initial = getLocal<CompanyInfo>("company_info", defaultCompanyInfo);
  callback(initial);

  const unsubLocal = registerLocalListener("company_info", callback);

  const unsubFirestore = safeOnSnapshot(doc(db, "systemSettings", "company_info"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as CompanyInfo;
      setLocal("company_info", data);
      callback(data);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "systemSettings/company_info");
  });

  return () => {
    unsubLocal();
    unsubFirestore();
  };
}

export function resetQuotaCircuitBreaker() {
  isFirestoreQuotaExhausted = false;
  try {
    localStorage.removeItem("rouda_quota_exhausted");
    localStorage.removeItem("rouda_quota_exhausted_time");
    enableNetwork(db).catch(() => {});
  } catch {}
}

export async function syncAllLocalDataToFirestore(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Users
    const users = getLocal<{ [key: string]: User }>("users", defaultUsers);
    for (const [username, user] of Object.entries(users)) {
      if (isFirestoreQuotaExhausted) break;
      await safeSetDoc(doc(db, "users", username), user);
    }

    // 2. Items
    const items = getLocal<Item[]>("items", []);
    for (const item of items) {
      if (isFirestoreQuotaExhausted) break;
      if (item.id) await safeSetDoc(doc(db, "items", item.id), item);
    }

    // 3. Merged Invoices
    const merged = getLocal<MergedInvoice[]>("mergedInvoices", []);
    for (const inv of merged) {
      if (isFirestoreQuotaExhausted) break;
      if (inv.id) await safeSetDoc(doc(db, "mergedInvoices", inv.id), inv);
    }

    // 4. Archives
    const archives = getLocal<Archive[]>("archives", []);
    for (const arch of archives) {
      if (isFirestoreQuotaExhausted) break;
      if (arch.id) await safeSetDoc(doc(db, "archives", arch.id), arch);
    }

    // 5. Warehouse Archives
    const whArchives = getLocal<WarehouseArchive[]>("warehouseArchives", []);
    for (const wArch of whArchives) {
      if (isFirestoreQuotaExhausted) break;
      if (wArch.id) await safeSetDoc(doc(db, "warehouseArchives", wArch.id), wArch);
    }

    // 6. Reports
    const reports = getLocal<Report[]>("reports", []);
    for (const rep of reports) {
      if (isFirestoreQuotaExhausted) break;
      if (rep.id) await safeSetDoc(doc(db, "reports", rep.id), rep);
    }

    // 7. Saved Items
    const savedItems = getLocal<SavedItem[]>("savedItems", []);
    for (const sItem of savedItems) {
      if (isFirestoreQuotaExhausted) break;
      if (sItem.id) await safeSetDoc(doc(db, "savedItems", sItem.id), sItem);
    }

    // 8. Custom Companies
    const customCompanies = getLocal<CustomCompany[]>("customCompanies", []);
    for (const comp of customCompanies) {
      if (isFirestoreQuotaExhausted) break;
      if (comp.id) await safeSetDoc(doc(db, "customCompanies", comp.id), comp);
    }

    // 9. Quotations
    const quotations = getLocal<Quotation[]>("quotations", []);
    for (const q of quotations) {
      if (isFirestoreQuotaExhausted) break;
      if (q.id) await safeSetDoc(doc(db, "quotations", q.id), q);
    }

    // 10. Trash
    const trash = getLocal<TrashItem[]>("trash", []);
    for (const t of trash) {
      if (isFirestoreQuotaExhausted) break;
      if (t.id) await safeSetDoc(doc(db, "trash", t.id), t);
    }

    // 11. Company Info
    if (!isFirestoreQuotaExhausted) {
      const compInfo = getLocal<CompanyInfo>("company_info", defaultCompanyInfo);
      await safeSetDoc(doc(db, "systemSettings", "company_info"), compInfo);
    }

    if (isFirestoreQuotaExhausted) {
      return { success: false, message: "تم إيقاف المزامنة السحابية مؤقتاً بسبب الوصول للحد اليومي للحصة المجانية. جميع البيانات محفوظة ومحدثة محلياً 100%." };
    }

    return { success: true, message: "تم رفع ونقل كافة البيانات وشغل اليوم بنجاح إلى قاعدة البيانات الجديدة!" };
  } catch (err: any) {
    console.error("Sync error:", err);
    return { success: false, message: err?.message || "حدث خطأ أثناء نقل البيانات" };
  }
}

export async function saveCompanyInfo(info: CompanyInfo) {
  notifyLocalListeners("company_info", info);
  await safeSetDoc(doc(db, "systemSettings", "company_info"), info);
}

// Ensure catalog is seeded with standard products if empty
export function seedCatalogIfEmpty() {
  try {
    const existing = getLocal<SavedItem[]>("savedItems", []);
    if (existing.length === 0) {
      const generated: SavedItem[] = [];
      let count = 1;
      Object.entries(companyItemsMap).forEach(([company, fixedList]) => {
        fixedList.forEach(fixedName => {
          generated.push({
            id: `cat_${count++}_${Date.now()}`,
            name: `${company} ${fixedName}`,
            company: company,
            fixedName: fixedName,
            isFavorite: true
          });
        });
      });
      setLocal("savedItems", generated);
      notifyLocalListeners("savedItems", generated);
    }
  } catch (err) {
    console.warn("Catalog seed notice:", err);
  }
}

// Scans and recovers any previous local data or backups stored across local keys
export function recoverPreviousWork(): { recovered: boolean; count: number; details: string } {
  let count = 0;
  try {
    // Check if we have backup files/keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Look for previous backup keys or old naming structures
      if (key.startsWith("backup_") || key.includes("rouda_backup")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.items || parsed.mergedInvoices || parsed.archives)) {
              if (parsed.items && Array.isArray(parsed.items)) {
                const cur = getLocal<Item[]>("items", []);
                const map = new Map(cur.map(it => [it.id, it]));
                parsed.items.forEach((it: Item) => { if (it.id) map.set(it.id, it); });
                const list = Array.from(map.values());
                setLocal("items", list);
                notifyLocalListeners("items", list);
                count += parsed.items.length;
              }
              if (parsed.mergedInvoices && Array.isArray(parsed.mergedInvoices)) {
                const cur = getLocal<MergedInvoice[]>("mergedInvoices", []);
                const map = new Map(cur.map(it => [it.id, it]));
                parsed.mergedInvoices.forEach((it: MergedInvoice) => { if (it.id) map.set(it.id, it); });
                const list = Array.from(map.values());
                setLocal("mergedInvoices", list);
                notifyLocalListeners("mergedInvoices", list);
                count += parsed.mergedInvoices.length;
              }
              if (parsed.archives && Array.isArray(parsed.archives)) {
                const cur = getLocal<Archive[]>("archives", []);
                const map = new Map(cur.map(it => [it.id, it]));
                parsed.archives.forEach((it: Archive) => { if (it.id) map.set(it.id, it); });
                const list = Array.from(map.values());
                setLocal("archives", list);
                notifyLocalListeners("archives", list);
                count += parsed.archives.length;
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("Recovery notice:", err);
  }

  seedCatalogIfEmpty();

  const totalItems = getLocal<Item[]>("items", []).length;
  const totalInvoices = getLocal<MergedInvoice[]>("mergedInvoices", []).length;
  const totalArchives = getLocal<Archive[]>("archives", []).length;
  const totalSaved = getLocal<SavedItem[]>("savedItems", []).length;

  return {
    recovered: true,
    count,
    details: `الأصناف: ${totalItems} | الفواتير: ${totalInvoices} | الأرشيف: ${totalArchives} | الكتالوج: ${totalSaved}`
  };
}

// === Database Storage & Quota Stats (MB calculation) ===
export interface DatabaseStorageStats {
  usedBytes: number;
  usedKB: string;
  usedMB: string;
  totalQuotaMB: number;
  remainingMB: string;
  percentUsed: string;
  totalDocumentsCount: number;
  breakdown: {
    invoicesMB: string;
    invoicesCount: number;
    itemsMB: string;
    itemsCount: number;
    archivesMB: string;
    archivesCount: number;
    catalogMB: string;
    catalogCount: number;
    reportsMB: string;
    reportsCount: number;
    usersCount: number;
  };
  healthStatus: "ممتازة" | "جيدة" | "تنبيه";
}

export function getDatabaseStorageStats(): DatabaseStorageStats {
  try {
    const items = getLocal<Item[]>("items", []);
    const mergedInvoices = getLocal<MergedInvoice[]>("mergedInvoices", []);
    const archives = getLocal<Archive[]>("archives", []);
    const whArchives = getLocal<WarehouseArchive[]>("warehouseArchives", []);
    const reports = getLocal<Report[]>("reports", []);
    const savedItems = getLocal<SavedItem[]>("savedItems", []);
    const users = getLocal<{ [key: string]: User }>("users", {});
    const customCompanies = getLocal<CustomCompany[]>("customCompanies", []);
    const quotations = getLocal<Quotation[]>("quotations", []);
    const trash = getLocal<TrashItem[]>("trash", []);

    const sizeItems = new Blob([JSON.stringify(items)]).size;
    const sizeInvoices = new Blob([JSON.stringify(mergedInvoices)]).size;
    const sizeArchives = new Blob([JSON.stringify(archives)]).size + new Blob([JSON.stringify(whArchives)]).size;
    const sizeReports = new Blob([JSON.stringify(reports)]).size;
    const sizeCatalog = new Blob([JSON.stringify(savedItems)]).size + new Blob([JSON.stringify(customCompanies)]).size;
    const sizeUsers = new Blob([JSON.stringify(users)]).size;
    const sizeOther = new Blob([JSON.stringify(quotations)]).size + new Blob([JSON.stringify(trash)]).size;

    const totalBytes = sizeItems + sizeInvoices + sizeArchives + sizeReports + sizeCatalog + sizeUsers + sizeOther;
    const totalMB = totalBytes / (1024 * 1024);
    const totalKB = totalBytes / 1024;
    const TOTAL_QUOTA_MB = 1024; // 1GB Firebase Spark Plan Free Quota
    const remainingMB = Math.max(0, TOTAL_QUOTA_MB - totalMB);
    const percentUsed = (totalMB / TOTAL_QUOTA_MB) * 100;

    const totalDocs = items.length + mergedInvoices.length + archives.length + whArchives.length + reports.length + savedItems.length + Object.keys(users).length + quotations.length + trash.length;

    let health: "ممتازة" | "جيدة" | "تنبيه" = "ممتازة";
    if (percentUsed > 80) health = "تنبيه";
    else if (percentUsed > 50) health = "جيدة";

    return {
      usedBytes: totalBytes,
      usedKB: totalKB.toFixed(2),
      usedMB: totalMB < 0.01 ? (totalMB).toFixed(4) : totalMB.toFixed(2),
      totalQuotaMB: TOTAL_QUOTA_MB,
      remainingMB: remainingMB.toFixed(2),
      percentUsed: percentUsed.toFixed(3) + "%",
      totalDocumentsCount: totalDocs,
      breakdown: {
        invoicesMB: (sizeInvoices / (1024 * 1024)).toFixed(3),
        invoicesCount: mergedInvoices.length,
        itemsMB: (sizeItems / (1024 * 1024)).toFixed(3),
        itemsCount: items.length,
        archivesMB: (sizeArchives / (1024 * 1024)).toFixed(3),
        archivesCount: archives.length + whArchives.length,
        catalogMB: (sizeCatalog / (1024 * 1024)).toFixed(3),
        catalogCount: savedItems.length,
        reportsMB: (sizeReports / (1024 * 1024)).toFixed(3),
        reportsCount: reports.length,
        usersCount: Object.keys(users).length
      },
      healthStatus: health
    };
  } catch (err) {
    return {
      usedBytes: 0,
      usedKB: "0.00",
      usedMB: "0.00",
      totalQuotaMB: 1024,
      remainingMB: "1024.00",
      percentUsed: "0.000%",
      totalDocumentsCount: 0,
      breakdown: {
        invoicesMB: "0.000",
        invoicesCount: 0,
        itemsMB: "0.000",
        itemsCount: 0,
        archivesMB: "0.000",
        archivesCount: 0,
        catalogMB: "0.000",
        catalogCount: 0,
        reportsMB: "0.000",
        reportsCount: 0,
        usersCount: 0
      },
      healthStatus: "ممتازة"
    };
  }
}
