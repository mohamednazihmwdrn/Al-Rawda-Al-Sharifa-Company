import { 
  collection, 
  doc, 
  setDoc as firestoreSetDoc, 
  getDocs, 
  onSnapshot, 
  deleteDoc, 
  updateDoc as firestoreUpdateDoc,
  query,
  where,
  getDoc,
  getDocFromServer
} from "firebase/firestore";
import { db } from "../firebase";

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

async function setDoc(docRef: any, data: any, options?: any) {
  const cleanedData = cleanUndefined(data);
  return firestoreSetDoc(docRef, cleanedData, options);
}

async function updateDoc(docRef: any, data: any) {
  const cleanedData = cleanUndefined(data);
  return firestoreUpdateDoc(docRef, cleanedData);
}
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Seed default users if users collection is empty
export async function seedUsersIfEmpty() {
  try {
    let querySnapshot;
    try {
      querySnapshot = await getDocs(collection(db, "users"));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "users");
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

    if (querySnapshot.empty) {
      console.log("Seeding default users...");
      for (const [key, user] of Object.entries(defaultUsers)) {
        try {
          await setDoc(doc(db, "users", key), user);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${key}`);
        }
      }
      console.log("Seeding completed!");
    } else {
      console.log("Ensuring correct user display names...");
      for (const [key, user] of Object.entries(defaultUsers)) {
        try {
          await setDoc(doc(db, "users", key), {
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            warehouse: user.warehouse
          }, { merge: true });
        } catch (err) {
          console.error(`Failed to update default user ${key}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Error seeding users:", error);
  }
}

// Test Firebase connection as required by SKILL.md
export async function testConnection() {
  try {
    // Attempt to read test document from server
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}

// === Users ===
export function listenUsers(callback: (users: { [key: string]: User }) => void) {
  return onSnapshot(collection(db, "users"), (snapshot) => {
    const usersMap: { [key: string]: User } = {};
    snapshot.forEach((doc) => {
      usersMap[doc.id] = doc.data() as User;
    });
    callback(usersMap);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "users");
  });
}

export async function saveUser(user: User) {
  try {
    await setDoc(doc(db, "users", user.username), user);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.username}`);
  }
}

export async function removeUser(username: string) {
  try {
    await deleteDoc(doc(db, "users", username));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${username}`);
  }
}

// === Items (Deficit items) ===
export function listenItems(callback: (items: Item[]) => void) {
  return onSnapshot(collection(db, "items"), (snapshot) => {
    const itemsList: Item[] = [];
    snapshot.forEach((doc) => {
      itemsList.push(doc.data() as Item);
    });
    callback(itemsList);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "items");
  });
}

export async function saveItem(item: Item) {
  try {
    await setDoc(doc(db, "items", item.id), item);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
  }
}

export async function saveItems(items: Item[]) {
  for (const item of items) {
    await saveItem(item);
  }
}

export async function deleteItem(id: string) {
  try {
    await deleteDoc(doc(db, "items", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `items/${id}`);
  }
}

export async function updateItemStatus(id: string, status: Item["status"], extraFields: Partial<Item> = {}) {
  try {
    await updateDoc(doc(db, "items", id), {
      status,
      ...extraFields
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `items/${id}`);
  }
}

export async function updateItemFields(id: string, fields: Partial<Item>) {
  try {
    await updateDoc(doc(db, "items", id), fields);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `items/${id}`);
  }
}

// === Merged Invoices ===
export function listenMergedInvoices(callback: (invoices: MergedInvoice[]) => void) {
  return onSnapshot(collection(db, "mergedInvoices"), (snapshot) => {
    const invoices: MergedInvoice[] = [];
    snapshot.forEach((doc) => {
      invoices.push(doc.data() as MergedInvoice);
    });
    callback(invoices);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "mergedInvoices");
  });
}

export async function saveMergedInvoice(invoice: MergedInvoice) {
  try {
    await setDoc(doc(db, "mergedInvoices", invoice.id), invoice);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `mergedInvoices/${invoice.id}`);
  }
}

export async function getPendingItemsFromDb(): Promise<Item[]> {
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
  }
}

export async function getPendingMergedInvoicesFromDb(today: string): Promise<MergedInvoice[]> {
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
  }
}

export async function getMergedInvoicesCountFromDb(): Promise<number> {
  try {
    const snapshot = await getDocs(collection(db, "mergedInvoices"));
    let maxNum = snapshot.size;
    snapshot.forEach((doc) => {
      const data = doc.data() as MergedInvoice;
      if (data.invoiceNumber && typeof data.invoiceNumber === "number" && data.invoiceNumber > maxNum) {
        maxNum = data.invoiceNumber;
      }
    });
    return maxNum;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "mergedInvoices");
    return 0;
  }
}

export async function deleteMergedInvoice(id: string) {
  try {
    await deleteDoc(doc(db, "mergedInvoices", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `mergedInvoices/${id}`);
  }
}

// === Archives ===
export function listenArchives(callback: (archives: Archive[]) => void) {
  return onSnapshot(collection(db, "archives"), (snapshot) => {
    const archives: Archive[] = [];
    snapshot.forEach((doc) => {
      archives.push(doc.data() as Archive);
    });
    callback(archives);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "archives");
  });
}

export async function saveArchive(archive: Archive) {
  try {
    await setDoc(doc(db, "archives", archive.id), archive);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `archives/${archive.id}`);
  }
}

export async function deleteArchive(id: string) {
  try {
    await deleteDoc(doc(db, "archives", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `archives/${id}`);
  }
}

// === Warehouse Archives ===
export function listenWarehouseArchives(callback: (archives: WarehouseArchive[]) => void) {
  return onSnapshot(collection(db, "warehouseArchives"), (snapshot) => {
    const archives: WarehouseArchive[] = [];
    snapshot.forEach((doc) => {
      archives.push(doc.data() as WarehouseArchive);
    });
    callback(archives);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "warehouseArchives");
  });
}

export async function saveWarehouseArchive(archive: WarehouseArchive) {
  try {
    await setDoc(doc(db, "warehouseArchives", archive.id), archive);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `warehouseArchives/${archive.id}`);
  }
}

export async function deleteWarehouseArchive(id: string) {
  try {
    await deleteDoc(doc(db, "warehouseArchives", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `warehouseArchives/${id}`);
  }
}

// === Reports ===
export function listenReports(callback: (reports: Report[]) => void) {
  return onSnapshot(collection(db, "reports"), (snapshot) => {
    const reports: Report[] = [];
    snapshot.forEach((doc) => {
      reports.push(doc.data() as Report);
    });
    callback(reports);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "reports");
  });
}

export async function saveReport(report: Report) {
  try {
    await setDoc(doc(db, "reports", report.id), report);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reports/${report.id}`);
  }
}

export async function deleteReport(id: string) {
  try {
    await deleteDoc(doc(db, "reports", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reports/${id}`);
  }
}

// === Saved Items ===
export function listenSavedItems(callback: (savedItems: SavedItem[]) => void) {
  return onSnapshot(collection(db, "savedItems"), (snapshot) => {
    const savedItems: SavedItem[] = [];
    snapshot.forEach((doc) => {
      savedItems.push(doc.data() as SavedItem);
    });
    callback(savedItems);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "savedItems");
  });
}

export async function saveSavedItem(item: SavedItem) {
  try {
    await setDoc(doc(db, "savedItems", item.id), item);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `savedItems/${item.id}`);
  }
}

export async function deleteSavedItem(itemId: string) {
  try {
    await deleteDoc(doc(db, "savedItems", itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `savedItems/${itemId}`);
  }
}

// === Custom Companies ===
import { companyItemsMap } from "../data/constants";

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
    // Find if there is any custom company doc that overrides this default company (by matching name, id, or originalName)
    const custom = customCompanies.find(
      cc => cc.id === name || cc.name === name || cc.originalName === name
    );

    if (custom) {
      if (custom.isDeleted) {
        // Soft deleted default company, skip it
        return;
      }
      // Use the updated name and fixed names from custom configuration
      merged[custom.name] = custom.fixedNames;
    } else {
      // Use standard default company
      merged[name] = defaultFixedNames;
    }
  });

  // 2. Process custom companies that are brand new (not overriding any default company)
  customCompanies.forEach(cc => {
    if (cc.isDeleted) return;

    // Check if this custom company is already processed as a default company override
    const isOverride = Object.keys(companyItemsMap).some(
      name => cc.id === name || cc.name === name || cc.originalName === name
    );

    if (!isOverride) {
      merged[cc.name] = cc.fixedNames;
    }
  });

  // Filter out any company containing "باكين" or "pakin" (completely deleted by user request)
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
  return onSnapshot(collection(db, "customCompanies"), (snapshot) => {
    const list: CustomCompany[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as CustomCompany);
    });
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "customCompanies");
  });
}

export async function saveCustomCompany(company: CustomCompany) {
  try {
    await setDoc(doc(db, "customCompanies", company.id), company);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `customCompanies/${company.id}`);
  }
}

export async function deleteCustomCompany(companyId: string) {
  try {
    await deleteDoc(doc(db, "customCompanies", companyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `customCompanies/${companyId}`);
  }
}

// === Quotations ===
export function listenQuotations(callback: (quotations: Quotation[]) => void) {
  return onSnapshot(collection(db, "quotations"), (snapshot) => {
    const quotations: Quotation[] = [];
    snapshot.forEach((doc) => {
      quotations.push(doc.data() as Quotation);
    });
    callback(quotations);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "quotations");
  });
}

export async function saveQuotation(quotation: Quotation) {
  try {
    await setDoc(doc(db, "quotations", quotation.id), quotation);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `quotations/${quotation.id}`);
  }
}

export async function deleteQuotation(id: string) {
  try {
    await deleteDoc(doc(db, "quotations", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `quotations/${id}`);
  }
}

// === Trash / Recycle Bin (سلة المحذوفات) ===
export function listenTrash(callback: (trashItems: TrashItem[]) => void) {
  return onSnapshot(collection(db, "trash"), (snapshot) => {
    const trashItems: TrashItem[] = [];
    snapshot.forEach((doc) => {
      trashItems.push(doc.data() as TrashItem);
    });
    callback(trashItems);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "trash");
  });
}

export async function moveToTrash(trashRecord: TrashItem) {
  try {
    await setDoc(doc(db, "trash", trashRecord.id), trashRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `trash/${trashRecord.id}`);
  }
}

export async function permanentlyDeleteFromTrash(id: string) {
  try {
    await deleteDoc(doc(db, "trash", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `trash/${id}`);
  }
}

export async function clearAllTrash() {
  try {
    const snapshot = await getDocs(collection(db, "trash"));
    for (const docSnapshot of snapshot.docs) {
      try {
        await deleteDoc(doc(db, "trash", docSnapshot.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `trash/${docSnapshot.id}`);
      }
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

  try {
    const snapshot = await getDocs(collection(db, "trash"));
    for (const docSnapshot of snapshot.docs) {
      const item = docSnapshot.data() as TrashItem;
      const itemTimestamp = item.deletedTimestamp || 0;
      if (itemTimestamp > 0 && (now - itemTimestamp) > FIFTEEN_DAYS_MS) {
        try {
          await deleteDoc(doc(db, "trash", docSnapshot.id));
          cleanedCount++;
        } catch (e) {
          console.error("Failed to auto-clean trash item:", docSnapshot.id, e);
        }
      }
    }
  } catch (err) {
    console.error("Error in autoCleanOldTrash:", err);
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
    try {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnapshot of snapshot.docs) {
        try {
          await deleteDoc(doc(db, colName, docSnapshot.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `${colName}/${docSnapshot.id}`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, colName);
    }
  }
}

// Clear only manual and experimental operations to start fresh (keeps users, saved items, and custom companies)
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
    try {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnapshot of snapshot.docs) {
        try {
          await deleteDoc(doc(db, colName, docSnapshot.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `${colName}/${docSnapshot.id}`);
        }
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
      for (const [key, user] of Object.entries(backupData.users)) {
        try {
          await setDoc(doc(db, "users", key), user);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${key}`);
        }
      }
    }
    
    // For items
    if (backupData.items && Array.isArray(backupData.items)) {
      for (const item of backupData.items) {
        try {
          await setDoc(doc(db, "items", item.id), item);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
        }
      }
    } else {
      // Compatibility with old backup format
      const activeInvoices = backupData.invoices || {};
      for (const [wh, items] of Object.entries(activeInvoices)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            try {
              await setDoc(doc(db, "items", item.id), {
                ...item,
                warehouse: wh,
                status: item.status || "active"
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
            }
          }
        }
      }

      const waitingItems = backupData.waitingItems || [];
      if (Array.isArray(waitingItems)) {
        for (const item of waitingItems) {
          try {
            await setDoc(doc(db, "items", item.id), {
              ...item,
              status: "waiting"
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
          }
        }
      }

      const deletedItems = backupData.deletedItems || [];
      if (Array.isArray(deletedItems)) {
        for (const item of deletedItems) {
          try {
            await setDoc(doc(db, "items", item.id), {
              ...item,
              status: "deleted"
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
          }
        }
      }
    }

    if (backupData.archives && Array.isArray(backupData.archives)) {
      for (const archive of backupData.archives) {
        try {
          await setDoc(doc(db, "archives", archive.id), archive);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `archives/${archive.id}`);
        }
      }
    }

    if (backupData.mergedInvoices && Array.isArray(backupData.mergedInvoices)) {
      for (const inv of backupData.mergedInvoices) {
        try {
          await setDoc(doc(db, "mergedInvoices", inv.id), inv);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `mergedInvoices/${inv.id}`);
        }
      }
    }

    if (backupData.warehouseArchives) {
      if (Array.isArray(backupData.warehouseArchives)) {
        for (const arch of backupData.warehouseArchives) {
          try {
            await setDoc(doc(db, "warehouseArchives", arch.id), arch);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `warehouseArchives/${arch.id}`);
          }
        }
      } else {
        for (const [wh, archList] of Object.entries(backupData.warehouseArchives)) {
          if (Array.isArray(archList)) {
            for (const arch of archList) {
              try {
                await setDoc(doc(db, "warehouseArchives", arch.id), arch);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `warehouseArchives/${arch.id}`);
              }
            }
          }
        }
      }
    }

    if (backupData.reports && Array.isArray(backupData.reports)) {
      for (const report of backupData.reports) {
        try {
          await setDoc(doc(db, "reports", report.id), report);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `reports/${report.id}`);
        }
      }
    }

    if (backupData.savedItems && Array.isArray(backupData.savedItems)) {
      for (const s of backupData.savedItems) {
        try {
          await setDoc(doc(db, "savedItems", s.id), s);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `savedItems/${s.id}`);
        }
      }
    }

    if (backupData.quotations && Array.isArray(backupData.quotations)) {
      for (const q of backupData.quotations) {
        try {
          await setDoc(doc(db, "quotations", q.id), q);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `quotations/${q.id}`);
        }
      }
    }
  } catch (error) {
    console.error("Bulk restore failed:", error);
    throw error;
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
  return onSnapshot(collection(db, "chats"), (snapshot) => {
    const list: Chat[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Chat;
      if (data.participants && data.participants.includes(username)) {
        list.push(data);
      }
    });
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "chats");
  });
}

export async function createOrGetDirectChat(userA: string, userB: string, userBName: string): Promise<string> {
  const chatId = `direct_${[userA, userB].sort().join("_")}`;
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    const newChat: Chat = {
      id: chatId,
      name: userBName,
      type: "direct",
      participants: [userA, userB],
      lastMessage: "",
      lastMessageTime: "",
      lastMessageSender: ""
    };
    await setDoc(chatRef, newChat);
  }
  return chatId;
}

export async function createGroupChat(name: string, participants: string[]): Promise<string> {
  const chatId = `group_${Date.now()}`;
  const chatRef = doc(db, "chats", chatId);
  const newChat: Chat = {
    id: chatId,
    name: name,
    type: "group",
    participants: participants,
    lastMessage: "تم إنشاء المجموعة",
    lastMessageTime: new Date().toISOString(),
    lastMessageSender: "system"
  };
  await setDoc(chatRef, newChat);
  return chatId;
}

export function listenMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
  return onSnapshot(collection(db, "chats", chatId, "messages"), (snapshot) => {
    const list: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as ChatMessage);
    });
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `chats/${chatId}/messages`);
  });
}

export async function sendMessage(chatId: string, sender: string, senderName: string, text: string) {
  const msgId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
  const msgRef = doc(db, "chats", chatId, "messages", msgId);
  const nowStr = new Date().toISOString();
  
  const msg: ChatMessage = {
    id: msgId,
    sender,
    senderName,
    text,
    timestamp: nowStr
  };

  await setDoc(msgRef, msg);

  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
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

export function listenCompanyInfo(callback: (info: CompanyInfo | null) => void) {
  return onSnapshot(doc(db, "systemSettings", "company_info"), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as CompanyInfo);
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, "systemSettings/company_info");
  });
}

export async function saveCompanyInfo(info: CompanyInfo) {
  const ref = doc(db, "systemSettings", "company_info");
  await setDoc(ref, info);
}

