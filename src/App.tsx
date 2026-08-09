import React, { useState, useEffect } from "react";
import { 
  User, 
  Item, 
  MergedInvoice, 
  Archive, 
  WarehouseArchive, 
  Report, 
  SavedItem, 
  Quotation 
} from "./types";
import { 
  seedUsersIfEmpty, 
  testConnection, 
  listenUsers, 
  listenItems, 
  listenMergedInvoices, 
  listenArchives, 
  listenWarehouseArchives, 
  listenReports, 
  listenSavedItems, 
  listenQuotations, 
  saveUser, 
  removeUser, 
  saveItem, 
  saveMergedInvoice, 
  deleteMergedInvoice, 
  saveArchive, 
  deleteArchive, 
  saveWarehouseArchive, 
  deleteWarehouseArchive, 
  saveReport, 
  deleteReport, 
  saveSavedItem, 
  deleteSavedItem,
  saveQuotation, 
  deleteQuotation,
  deleteItem,
  updateItemStatus,
  updateItemFields,
  getPendingItemsFromDb,
  getPendingMergedInvoicesFromDb,
  getMergedInvoicesCountFromDb,
  listenCustomCompanies,
  saveCustomCompany,
  deleteCustomCompany,
  CustomCompany,
  CompanyInfo,
  listenCompanyInfo,
  saveCompanyInfo,
  listenChats
} from "./services/dbService";

// Helper constants & utils
import { getToday, getNow, getFullDate, AYAT, isItemInTodayWindow } from "./data/constants";
import { printInvoice, printMatrix, getPrintUserName } from "./utils/print";

// Sub-components
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Cart, { LocalCartItem } from "./components/Cart";
import Quotations from "./components/Quotations";
import Reports from "./components/Reports";
import ArchiveComponent from "./components/Archive";
import Settings from "./components/Settings";
import ChatComponent from "./components/ChatComponent";
import PrivacyPolicy from "./components/PrivacyPolicy";
import SmartPrint from "./components/SmartPrint";
import UnreceivedItems from "./components/UnreceivedItems";
import ReceivedItems from "./components/ReceivedItems";

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (permission === "privacy-policy") return true;
  if (user.role === "مدير") {
    return true; // Managers have all permissions
  }

  // A warehouse user ALWAYS has access to their own warehouse section
  if (permission === "warehouse-unreceived" && (user.warehouse || user.role === "مخزن")) {
    return true;
  }
  if (permission === "warehouse-custom" && user.warehouse) {
    return true;
  }
  if (permission === "warehouse-nahas" && (user.warehouse === "مخزن النحاس" || user.username === "مخزن النحاس" || user.username === "Nahas")) {
    return true;
  }
  if (permission === "warehouse-nady" && (user.warehouse === "مخزن النادي" || user.username === "مخزن النادي" || user.username === "Nady")) {
    return true;
  }

  if (user.permissions) {
    return user.permissions.includes(permission);
  }
  
  if (permission === "cart" || permission === "chat" || permission === "quran-verse") {
    return true;
  }
  if (permission === "warehouse-custom") {
    return !!user.warehouse;
  }
  return false;
}

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<{ [key: string]: User }>({});

  // DB models states (Real-time synchronized)
  const [items, setItems] = useState<Item[]>([]);
  const [mergedInvoices, setMergedInvoices] = useState<MergedInvoice[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [warehouseArchives, setWarehouseArchives] = useState<WarehouseArchive[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customCompanies, setCustomCompanies] = useState<CustomCompany[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [randomAyat, setRandomAyat] = useState({ text: "", reference: "" });

  // Rotate verse every 1 minute
  useEffect(() => {
    const changeVerse = () => {
      const randomIndex = Math.floor(Math.random() * AYAT.length);
      setRandomAyat(AYAT[randomIndex]);
    };
    changeVerse();
    const interval = setInterval(changeVerse, 60000);
    return () => clearInterval(interval);
  }, []);

  // Navigation & Sidebars
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCustomWarehouse, setSelectedCustomWarehouse] = useState<string | null>(null);

  // Audible voice alert states & refs
  const lastChatsRef = React.useRef<{ [chatId: string]: string }>({});
  const lastPendingInvoicesCountRef = React.useRef<number>(-1);
  const lastMergedInvoicesRef = React.useRef<MergedInvoice[]>([]);
  const isFirstMergedInvoicesRef = React.useRef(true);
  const isArchivingRef = React.useRef(false);
  const processedInvoiceIdsRef = React.useRef<Set<string>>(new Set());
  const [chatAlert, setChatAlert] = useState<{ senderName: string; chatId: string } | null>(null);

  // Global Dialog Modal (Viewing details of report/archive)
  const [detailsModal, setDetailsModal] = useState<{
    title: string;
    items: any[];
    onDeleteItem?: (index: number) => void;
    onEditItem?: (index: number, updatedItem: any) => void;
  } | null>(null);

  // State for editing any item across the system
  const [editingItem, setEditingItem] = useState<{
    id: string;
    index?: number;
    parentId?: string;
    parentType: "items" | "reports" | "archives" | "warehouseArchives" | "mergedInvoices";
    company: string;
    fixedName: string;
    description: string;
    note: string;
    warehouse?: string;
  } | null>(null);

  const [editingWarehouseArchive, setEditingWarehouseArchive] = useState<WarehouseArchive | null>(null);

  // Partial receipt confirmation modal state
  const [receiptConfirmModal, setReceiptConfirmModal] = useState<{
    invoiceId: string;
    itemId: string;
    itemName: string;
    requiredQty: string;
    originalQty?: string;
    receivedQty?: string;
  } | null>(null);

  const [receiptReceivedQty, setReceiptReceivedQty] = useState("");
  const [receiptRemainingQty, setReceiptRemainingQty] = useState("");
  const [whActiveTab, setWhActiveTab] = useState<"sent" | "received" | "not-arrived">("sent");
  const [whExpandedInvs, setWhExpandedInvs] = useState<{ [key: string]: boolean }>({});

  React.useEffect(() => {
    if (receiptConfirmModal) {
      setReceiptReceivedQty(receiptConfirmModal.requiredQty);
      setReceiptRemainingQty("0");
    } else {
      setReceiptReceivedQty("");
      setReceiptRemainingQty("");
    }
  }, [receiptConfirmModal]);

  // Keyboard shortcut Ctrl+R / Refresh trigger
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Dark Mode state & synchronization
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("darkMode") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("darkMode", String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (err) {
      console.error("Failed to sync dark mode state:", err);
    }
  }, [darkMode]);

  // On mount, run connection tests and seed baseline accounts
  useEffect(() => {
    testConnection();
    seedUsersIfEmpty();

    // Check if user has active session saved in local storage
    try {
      const savedSession = localStorage.getItem("current_user_session");
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as User;
        setCurrentUser(parsed);
        // Find first permitted section
        if (hasPermission(parsed, "dashboard")) {
          setActiveSection("dashboard");
        } else if (hasPermission(parsed, "cart")) {
          setActiveSection("cart");
        } else if (hasPermission(parsed, "chat")) {
          setActiveSection("chat");
        } else {
          setActiveSection("cart");
        }
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
    }
  }, []);

  // Synchronize Firestore collections in real-time
  useEffect(() => {
    const unsubUsers = listenUsers(setUsers);
    const unsubItems = listenItems(setItems);
    const unsubMerged = listenMergedInvoices(setMergedInvoices);
    const unsubArchives = listenArchives(setArchives);
    const unsubWarehouseArchives = listenWarehouseArchives(setWarehouseArchives);
    const unsubReports = listenReports(setReports);
    const unsubSaved = listenSavedItems(setSavedItems);
    const unsubQuotations = listenQuotations(setQuotations);
    const unsubCustomCompanies = listenCustomCompanies(setCustomCompanies);
    const unsubCompanyInfo = listenCompanyInfo(setCompanyInfo);

    return () => {
      unsubUsers();
      unsubItems();
      unsubMerged();
      unsubArchives();
      unsubWarehouseArchives();
      unsubReports();
      unsubSaved();
      unsubQuotations();
      unsubCustomCompanies();
      unsubCompanyInfo();
    };
  }, []);

  // Audio helper functions
  const playNotificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.3);
      playTone(659.25, now + 0.1, 0.3);
      playTone(783.99, now + 0.2, 0.4);
    } catch (e) {
      console.error("Web Audio chime failed:", e);
    }
  };

  const speakArabic = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }
    window.speechSynthesis.speak(utterance);
  };



  const getSpeechSenderName = (username: string) => {
    const low = username.toLowerCase();
    if (low.includes("nahas") || low.includes("جمعة") || low.includes("السي")) {
      return "مخزن النحاس جمعة السيد";
    }
    if (low.includes("nady") || low.includes("جعفر") || low.includes("ضياء")) {
      return "مخزن النادي جعفر ضياء";
    }
    if (low.includes("admin") || low.includes("احمد") || low.includes("أحمد") || low.includes("حمدي")) {
      return "المدير أحمد حمدي";
    }
    return username;
  };

  // Real-time Chat message notifications
  useEffect(() => {
    if (!currentUser) return;

    const unsubChats = listenChats(currentUser.username, (newChats) => {
      newChats.forEach(chat => {
        const lastMsgTime = chat.lastMessageTime || "";
        const lastMsgSender = chat.lastMessageSender || "";
        const chatId = chat.id;

        if (lastMsgTime && lastMsgSender !== currentUser.username) {
          const previousTime = lastChatsRef.current[chatId];
          if (previousTime !== undefined && previousTime !== lastMsgTime) {
            playNotificationChime();
            const senderName = chat.name || lastMsgSender;
            const spokenName = getSpeechSenderName(senderName);
            setTimeout(() => {
              speakArabic(`وصلت رسالة جديدة من ${spokenName}`);
            }, 600);

            setChatAlert({ senderName: getPrintUserName(senderName), chatId });
          }
          lastChatsRef.current[chatId] = lastMsgTime;
        } else if (lastMsgTime && lastChatsRef.current[chatId] === undefined) {
          lastChatsRef.current[chatId] = lastMsgTime;
        }
      });
    });

    return () => {
      unsubChats();
    };
  }, [currentUser]);

  // Comprehensive Real-time Voice Notifications for shortages status and delivery updates
  useEffect(() => {
    if (!currentUser) return;

    // Check if we need to initialize lastMergedInvoicesRef
    if (isFirstMergedInvoicesRef.current) {
      if (mergedInvoices.length > 0) {
        lastMergedInvoicesRef.current = mergedInvoices;
        isFirstMergedInvoicesRef.current = false;
      }
      return;
    }

    // 1. Check for newly added invoices or status changes
    mergedInvoices.forEach(newInv => {
      const oldInv = lastMergedInvoicesRef.current.find(o => o.id === newInv.id);
      if (!oldInv) {
        // Brand new merged invoice added
        const whs = newInv.warehouses?.map(w => {
          if (w.includes("النحاس") || w.toLowerCase().includes("nahas")) return "مخزن النحاس";
          if (w.includes("النادي") || w.toLowerCase().includes("nady")) return "مخزن النادي";
          return w;
        }).join(" و ") || "مخزن فرعي";
        
        playNotificationChime();
        setTimeout(() => {
          speakArabic(`تم تسجيل بيان نواقص جديد من ${whs}`);
        }, 600);
      } else {
        // Existed, let's check for status change
        if (newInv.status !== oldInv.status) {
          playNotificationChime();
          setTimeout(() => {
            if (newInv.status === "approved" || newInv.status === "auto_approved") {
              speakArabic(`تم اعتماد بيان النواقص رقم ${newInv.invoiceNumber} من قبل المدير`);
            } else if (newInv.status === "rejected") {
              speakArabic(`تم رفض بيان النواقص رقم ${newInv.invoiceNumber}`);
            } else if (newInv.status === "archived") {
              speakArabic(`تم ترحيل وأرشفة بيان النواقص رقم ${newInv.invoiceNumber}`);
            }
          }, 600);
        }

        // Check for item delivery status changes (استلامات أو لم يسلم)
        newInv.items.forEach(newItem => {
          const oldItem = oldInv.items.find(it => it.id === newItem.id);
          if (oldItem && newItem.deliveryStatus !== oldItem.deliveryStatus) {
            playNotificationChime();
            setTimeout(() => {
              const itemName = newItem.fixedName;
              const whName = newItem.warehouse || "المخزن";
              const spokenWh = whName.includes("النحاس") || whName.toLowerCase().includes("nahas") ? "مخزن النحاس" : 
                               whName.includes("النادي") || whName.toLowerCase().includes("nady") ? "مخزن النادي" : whName;
              
              if (newItem.deliveryStatus === "received") {
                speakArabic(`تم استلام صنف ${itemName} في ${spokenWh}`);
              } else if (newItem.deliveryStatus === "delayed") {
                speakArabic(`تم الإبلاغ أن صنف ${itemName} في ${spokenWh} لم يصل بعد`);
              }
            }, 600);
          }
        });
      }
    });

    // 2. Check for deleted invoices
    lastMergedInvoicesRef.current.forEach(oldInv => {
      const stillExists = mergedInvoices.some(n => n.id === oldInv.id);
      if (!stillExists) {
        playNotificationChime();
        setTimeout(() => {
          speakArabic(`تم حذف بيان النواقص رقم ${oldInv.invoiceNumber}`);
        }, 600);
      }
    });

    lastMergedInvoicesRef.current = mergedInvoices;
  }, [mergedInvoices, currentUser]);

  // Reset print counter when DB is empty to restart serials from 1 automatically
  useEffect(() => {
    try {
      if (companyInfo) {
        localStorage.setItem("system_company_info", JSON.stringify(companyInfo));
      } else {
        localStorage.removeItem("system_company_info");
      }
    } catch (e) {
      console.error("Failed to sync system_company_info to localStorage:", e);
    }
  }, [companyInfo]);

  useEffect(() => {
    if (archives.length === 0 && mergedInvoices.length === 0 && quotations.length === 0) {
      try {
        localStorage.setItem("print_counter", "0");
      } catch (e) {}
    }
  }, [archives, mergedInvoices, quotations]);

  // Synchronize currentUser with real-time users list
  useEffect(() => {
    if (currentUser && users[currentUser.username]) {
      const updatedUser = users[currentUser.username];
      const curStr = JSON.stringify({
        role: currentUser.role,
        displayName: currentUser.displayName,
        permissions: currentUser.permissions || [],
        warehouse: currentUser.warehouse,
        password: currentUser.password
      });
      const updStr = JSON.stringify({
        role: updatedUser.role,
        displayName: updatedUser.displayName,
        permissions: updatedUser.permissions || [],
        warehouse: updatedUser.warehouse,
        password: updatedUser.password
      });
      if (curStr !== updStr) {
        setCurrentUser(updatedUser);
        localStorage.setItem("current_user_session", JSON.stringify(updatedUser));
      }
    }
  }, [users, currentUser]);

  // 10 PM automatic archiving check & pending invoice auto-consolidation
  useEffect(() => {
    // Run the automatic check once on mount / update
    handleAutoArchiveDeficits();

    // Automatically consolidate pending invoices and items for today
    autoMergePendingInvoices();

    // Check periodically (every 30 seconds)
    const checkInterval = setInterval(() => {
      handleAutoArchiveDeficits();
      autoMergePendingInvoices();
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [mergedInvoices, items]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("current_user_session", JSON.stringify(user));
    
    if (hasPermission(user, "dashboard")) {
      setActiveSection("dashboard");
    } else if (hasPermission(user, "cart")) {
      setActiveSection("cart");
    } else if (hasPermission(user, "chat")) {
      setActiveSection("chat");
    } else {
      setActiveSection("cart");
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("current_user_session");
    setShowLogoutConfirm(false);
  };

  const refreshDatabase = async () => {
    setIsRefreshing(true);
    try {
      await testConnection();
      // Firestore listeners are real-time, but forcing a minor state trigger
      setItems(prev => [...prev]);
      alert("✅ تم مزامنة وتحديث قاعدة البيانات بنجاح!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Keyboard Ctrl+R for database sync
  useEffect(() => {
    const handleKeyRefresh = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        refreshDatabase();
      }
    };
    window.addEventListener("keydown", handleKeyRefresh);
    return () => window.removeEventListener("keydown", handleKeyRefresh);
  }, []);

  // === Deficits and Cart saving logic ===
  const handleSaveCart = async (cartItems: LocalCartItem[]) => {
    if (!currentUser) return;
    const warehouse = currentUser.role === "مدير" ? "مخزن المدير" : (currentUser.warehouse || "المدير");
    const today = getToday();

    const savedItemsList: Item[] = [];

    for (const cartItem of cartItems) {
      const newItem: Item = {
        id: cartItem.id,
        company: cartItem.company,
        fixedName: cartItem.fixedName,
        description: cartItem.description,
        note: cartItem.note,
        date: today,
        time: cartItem.time,
        warehouse,
        user: currentUser.displayName || currentUser.username,
        savedAt: getFullDate(),
        status: "waiting", // All warehouse deficits (including general merchandise & copper) go to waiting
        duplicateFrom: cartItem.duplicateFrom,
        duplicateNote: cartItem.duplicateNote,
        createdAt: Date.now()
      };

      await saveItem(newItem);
      savedItemsList.push(newItem);
    }

    // Always trigger auto-merge so items from all warehouses (general merchandise, copper, etc.) are combined into a single invoice
    await autoMergePendingInvoices();
  };

  // Automatic deficit merging for manager (real-time from Firestore)
  const autoMergePendingInvoices = async () => {
    const today = getToday();

    // Query active items that are pending 'waiting' directly from DB
    const pendingItems = (await getPendingItemsFromDb()) || [];
    // Check existing pending merged invoices for today
    const existingInvoices = (await getPendingMergedInvoicesFromDb(today)) || [];

    // Collect all item IDs that belong to approved / auto_approved invoices for today
    const approvedTodayInvoices = mergedInvoices.filter(
      m => m.date === today && (m.status === "approved" || m.status === "auto_approved")
    );
    const approvedItemIds = new Set<string>();
    approvedTodayInvoices.forEach(inv => {
      inv.items?.forEach(it => {
        if (it.id) approvedItemIds.add(it.id);
      });
    });

    // Filter items to ensure no items from approved invoices are treated as pending
    const trulyPendingItems = pendingItems.filter(
      it => it.status === "waiting" && (!it.id || !approvedItemIds.has(it.id))
    );

    if (existingInvoices.length > 0) {
      // Consolidate into the primary pending invoice
      const primary = { ...existingInvoices[0] };
      const itemsMap = new Map<string, Item>();

      // Collect items from all existing pending invoices (excluding already approved items)
      existingInvoices.forEach(inv => {
        inv.items?.forEach(it => {
          if (it.id && !approvedItemIds.has(it.id)) {
            itemsMap.set(it.id, it);
          }
        });
      });

      // Collect standalone truly pending items
      trulyPendingItems.forEach(it => {
        if (it.id) itemsMap.set(it.id, it);
      });

      const combinedItems = Array.from(itemsMap.values());
      const combinedWarehouses = Array.from(new Set(combinedItems.map(i => i.warehouse || "").filter(Boolean)));

      // If all items in the pending invoice(s) have been approved, delete the pending invoice(s)
      if (combinedItems.length === 0) {
        for (const inv of existingInvoices) {
          await deleteMergedInvoice(inv.id);
        }
        return;
      }

      // Avoid redundant write if already consolidated and item counts match
      if (
        existingInvoices.length === 1 &&
        combinedItems.length === (primary.items?.length || 0) &&
        combinedWarehouses.length === (primary.warehouses?.length || 0)
      ) {
        return;
      }

      await saveMergedInvoice({
        ...primary,
        items: combinedItems,
        total: combinedItems.length,
        warehouses: combinedWarehouses,
        time: primary.time || getNow()
      });

      // If multiple pending invoices existed for today, delete the extra ones to keep everything in ONE invoice
      for (let i = 1; i < existingInvoices.length; i++) {
        await deleteMergedInvoice(existingInvoices[i].id);
      }
    } else if (trulyPendingItems.length > 0) {
      const invoicesCount = await getMergedInvoicesCountFromDb();
      const invoiceNum = (invoicesCount || 0) + 1;
      const uniqueWarehouses = Array.from(new Set(trulyPendingItems.map(i => i.warehouse || "").filter(Boolean)));
      const newInvoice: MergedInvoice = {
        id: Date.now().toString(),
        invoiceNumber: invoiceNum,
        date: today,
        time: getNow(),
        items: trulyPendingItems,
        warehouses: uniqueWarehouses,
        total: trulyPendingItems.length,
        status: "pending",
        unread: true
      };
      await saveMergedInvoice(newInvoice);
    }
  };

  // 10 PM daily automatic archiver function
  const handleAutoArchiveDeficits = async () => {
    if (isArchivingRef.current) return;

    const today = getToday();
    const currentHour = new Date().getHours();
    
    // Find pending invoices that should be archived:
    // Either they belong to a past day, or they belong to today and the current hour is 22 (10 PM) or later.
    const pendingMerged = mergedInvoices.filter(m => {
      if (m.status !== "pending") return false;
      if (processedInvoiceIdsRef.current.has(m.id)) return false;
      const isPastDay = m.date !== today;
      const isTodayAfter10PM = m.date === today && currentHour >= 22;
      return isPastDay || isTodayAfter10PM;
    });

    if (pendingMerged.length === 0) return;

    isArchivingRef.current = true;
    try {
      for (const inv of pendingMerged) {
        if (processedInvoiceIdsRef.current.has(inv.id)) continue;
        processedInvoiceIdsRef.current.add(inv.id);

        // 1. Approve Merged Invoice
        await saveMergedInvoice({
          ...inv,
          status: "auto_approved",
          approvedAt: getFullDate()
        });

        // 2. Put into report
        const reportId = Date.now().toString() + Math.random().toString(36).slice(2, 5);
        await saveReport({
          id: reportId,
          date: today,
          time: getNow(),
          items: inv.items,
          warehouse: "جميع المخازن (ترحيل تلقائي)",
          total: inv.items.length,
          invoiceNumber: inv.invoiceNumber,
          approvedAt: getFullDate(),
          autoArchived: true
        });

        // 3. Put into general archive
        const archiveId = Date.now().toString() + Math.random().toString(36).slice(2, 5);
        await saveArchive({
          id: archiveId,
          title: `فاتورة ترحيل تلقائي #${inv.invoiceNumber} - ${inv.date}`,
          date: inv.date,
          time: getNow(),
          warehouse: "جميع المخازن",
          user: "نظام الترحيل التلقائي",
          items: inv.items,
          total: inv.total,
          approvedAt: getFullDate(),
          merged: true,
          warehouses: inv.warehouses,
          invoiceNumber: inv.invoiceNumber,
          unread: true,
          autoArchived: true
        });

        // 4. Update the item's status in the database to active approved
        for (const item of inv.items) {
          await saveItem({
            ...item,
            status: "approved",
            approvedAt: getFullDate()
          });
        }
      }
    } catch (error) {
      console.error("Error in automatic archiving task:", error);
    } finally {
      isArchivingRef.current = false;
    }
  };

  // === Manager's Merged Invoices approvals/rejections ===
  const handleApproveMerged = async (index: number) => {
    const invoice = mergedInvoices[index];
    if (!invoice) return;

    const approvedAtTime = getFullDate();

    // 1. Prepare items with approved status
    const updatedItems = invoice.items.map(item => ({
      ...item,
      status: "approved" as const,
      approvedAt: approvedAtTime
    }));

    // 2. Update item statuses in database in parallel
    await Promise.all(updatedItems.map(item => saveItem(item)));

    // 3. Set status approved on merged invoice with updated items
    await saveMergedInvoice({
      ...invoice,
      items: updatedItems,
      status: "approved",
      approvedAt: approvedAtTime
    });

    // 4. Add archive
    const archiveId = Date.now().toString();
    await saveArchive({
      id: archiveId,
      title: `فاتورة مدمجة #${invoice.invoiceNumber} - ${invoice.date}`,
      date: invoice.date,
      time: getNow(),
      warehouse: "جميع المخازن",
      user: currentUser?.displayName || currentUser?.username || "غير معروف",
      items: updatedItems,
      total: updatedItems.length,
      approvedAt: approvedAtTime,
      merged: true,
      warehouses: invoice.warehouses,
      invoiceNumber: invoice.invoiceNumber,
      unread: true
    });

    // 5. Group by warehouse and add to warehouse specific archives
    const grouped: { [key: string]: Item[] } = {};
    updatedItems.forEach(item => {
      const source = item.warehouse || "غير معروف";
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(item);
    });

    for (const [wh, list] of Object.entries(grouped)) {
      const whArchiveId = Date.now().toString() + Math.random().toString(36).slice(2, 5);
      await saveWarehouseArchive({
        id: whArchiveId,
        title: `فاتورة ${wh} - ${invoice.date} (معتمدة)`,
        date: invoice.date,
        time: getNow(),
        warehouse: wh,
        user: currentUser?.displayName || currentUser?.username || "غير معروف",
        items: list,
        total: list.length,
        status: "✅ معتمدة من المدير",
        invoiceNumber: invoice.invoiceNumber,
        unread: true
      });
    }

    // 6. Group into reports
    const reportId = Date.now().toString() + Math.random().toString(36).slice(2, 5);
    await saveReport({
      id: reportId,
      date: invoice.date,
      time: getNow(),
      items: updatedItems,
      warehouse: "جميع المخازن (معتمد)",
      total: updatedItems.length,
      invoiceNumber: invoice.invoiceNumber,
      approvedAt: approvedAtTime
    });

    alert(`✅ تم اعتماد الفاتورة المدمجة #${invoice.invoiceNumber} بنجاح!`);
  };

  const handleRejectMerged = async (index: number) => {
    const invoice = mergedInvoices[index];
    if (!invoice) return;

    if (!confirm("تأكيد رفض الفاتورة المدمجة بالكامل وإعادتها لمستودعات الفروع؟")) return;

    await saveMergedInvoice({
      ...invoice,
      status: "rejected",
      rejectedAt: getFullDate()
    });

    for (const item of invoice.items) {
      await saveItem({
        ...item,
        status: "rejected",
        rejectedAt: getFullDate()
      });
    }

    alert(`❌ تم رفض وإعادة الفاتورة #${invoice.invoiceNumber}`);
  };

  const handleDeleteMerged = async (index: number) => {
    const invoice = mergedInvoices[index];
    if (!invoice) return;

    if (confirm(`تأكيد حذف الفاتورة المدمجة #${invoice.invoiceNumber} نهائياً من قاعدة البيانات؟`)) {
      await deleteMergedInvoice(invoice.id);
      alert("🗑️ تم الحذف الكلي بنجاح!");
    }
  };

  const handleDeleteMergedItem = async (invoiceIndex: number, itemIndex: number) => {
    const inv = mergedInvoices[invoiceIndex];
    if (!inv) return;
    const item = inv.items[itemIndex];
    if (!item) return;

    if (!confirm(`هل تريد حذف البند "${item.description}" من هذه الفاتورة المدمجة؟`)) return;

    const updatedItems = [...inv.items];
    updatedItems.splice(itemIndex, 1);

    if (updatedItems.length === 0) {
      await deleteMergedInvoice(inv.id);
      alert("🗑️ تم تفريغ وحذف الفاتورة المدمجة بالكامل!");
    } else {
      await saveMergedInvoice({
        ...inv,
        items: updatedItems,
        total: updatedItems.length
      });
      alert("🗑️ تم حذف البند من الفاتورة المدمجة!");
    }
  };

  const handleEditMergedItem = (invoiceIndex: number, itemIndex: number, item: any) => {
    setEditingItem({
      id: item.id || "",
      index: itemIndex,
      parentId: mergedInvoices[invoiceIndex].id,
      parentType: "mergedInvoices",
      company: item.company,
      fixedName: item.fixedName || "",
      description: item.description,
      note: item.note || ""
    });
  };

  const handleUpdateItemDeliveryStatus = async (invoiceId: string, itemId: string, status: "received" | "delayed") => {
    const itemToUpdate = items.find(i => i.id === itemId);
    if (itemToUpdate) {
      const updatedItem = {
        ...itemToUpdate,
        deliveryStatus: status,
        deliveredAt: status === "received" ? getFullDate() : undefined
      };
      await saveItem(updatedItem);
    }

    const invoiceToUpdate = mergedInvoices.find(m => m.id === invoiceId);
    if (invoiceToUpdate) {
      const updatedItems = invoiceToUpdate.items.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            deliveryStatus: status,
            deliveredAt: status === "received" ? getFullDate() : undefined
          };
        }
        return it;
      });

      await saveMergedInvoice({
        ...invoiceToUpdate,
        items: updatedItems,
        total: updatedItems.length
      });
    }
  };

  const handleReceivedQtyChange = (val: string) => {
    setReceiptReceivedQty(val);
    if (!receiptConfirmModal) return;

    // Try to parse values as floats/integers
    const reqNum = parseFloat(receiptConfirmModal.requiredQty);
    const recNum = parseFloat(val);

    if (!isNaN(reqNum) && !isNaN(recNum)) {
      const rem = Math.max(0, reqNum - recNum);
      setReceiptRemainingQty(rem.toString());
    } else {
      // If we can't parse them, don't auto-compute but let user write
      setReceiptRemainingQty("");
    }
  };

  const handleConfirmPartialReceipt = async (
    invoiceId: string,
    itemId: string,
    receivedNowStr: string,
    remainingNowStr: string
  ) => {
    const itemToUpdate = items.find(i => i.id === itemId);
    if (!itemToUpdate) return;

    // Determine original quantity
    const originalQty = itemToUpdate.originalQty || itemToUpdate.company;
    const requiredQty = itemToUpdate.remainingQty || itemToUpdate.company;
    
    // Check if remaining quantity is 0
    let remainingVal = parseFloat(remainingNowStr);
    if (isNaN(remainingVal)) {
      // If remainingNowStr is not a number, we check if it is "0"
      remainingVal = remainingNowStr === "0" ? 0 : 1;
    }

    const isFullyReceived = remainingVal <= 0;

    // Cumulative receivedQty
    let pastReceived = parseFloat(itemToUpdate.receivedQty || "0");
    if (isNaN(pastReceived)) pastReceived = 0;

    let receivedNowNum = parseFloat(receivedNowStr);
    if (isNaN(receivedNowNum)) receivedNowNum = 0;

    const cumulativeReceived = (pastReceived + receivedNowNum).toString();

    const updatedItem: Item = {
      ...itemToUpdate,
      originalQty,
      receivedQty: isFullyReceived ? originalQty : cumulativeReceived,
      remainingQty: remainingNowStr,
      hasPartialReceipt: true,
      deliveryStatus: isFullyReceived ? "received" : "delayed",
      deliveredAt: isFullyReceived ? getFullDate() : undefined
    };

    await saveItem(updatedItem);

    // Also update in mergedInvoices
    const invoiceToUpdate = mergedInvoices.find(m => m.id === invoiceId);
    if (invoiceToUpdate) {
      const updatedItems = invoiceToUpdate.items.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            originalQty,
            receivedQty: isFullyReceived ? originalQty : cumulativeReceived,
            remainingQty: remainingNowStr,
            hasPartialReceipt: true,
            deliveryStatus: isFullyReceived ? "received" : "delayed",
            deliveredAt: isFullyReceived ? getFullDate() : undefined
          };
        }
        return it;
      });

      await saveMergedInvoice({
        ...invoiceToUpdate,
        items: updatedItems,
        total: updatedItems.length
      });
    }

    setReceiptConfirmModal(null);
  };

  const handleRolloverUnreceivedItems = async () => {
    const today = getToday();
    const previousUnreceivedItems: Item[] = [];
    
    // Find all approved / auto-approved invoices from previous days (date !== today)
    const approvedInvoices = mergedInvoices.filter(m => 
      (m.status === "approved" || m.status === "auto_approved") && 
      m.date !== today
    );

    const itemsToUpdateInInvoices: { invoiceId: string; itemId: string }[] = [];

    approvedInvoices.forEach(inv => {
      inv.items.forEach(it => {
        // Items where deliveryStatus is not received and not already rolled over
        if (it.deliveryStatus !== "received" && !it.rolledOver) {
          previousUnreceivedItems.push(it);
          itemsToUpdateInInvoices.push({ invoiceId: inv.id, itemId: it.id });
        }
      });
    });

    if (previousUnreceivedItems.length === 0) {
      alert("ℹ️ لا توجد بنود معلقة أو متأخرة من الأيام السابقة لترحيلها!");
      return;
    }

    if (!confirm(`هل تريد ترحيل عدد (${previousUnreceivedItems.length}) بند غير مستلم من الأيام السابقة إلى قائمة نواقص اليوم المدمجة؟`)) {
      return;
    }

    // Process each item
    for (const item of previousUnreceivedItems) {
      // 1. Mark original item as rolled over in the general items collection
      const originalItem = items.find(i => i.id === item.id);
      if (originalItem) {
        await saveItem({
          ...originalItem,
          rolledOver: true,
          rolledOverToDate: today
        });
      }

      // 2. Create a new item for today with "waiting" status
      const newId = item.id + "_rollover_" + Date.now() + Math.random().toString(36).slice(2, 5);
      const originalNoteStr = item.note && item.note !== "-" ? item.note : "";
      const rolledNote = originalNoteStr ? `${originalNoteStr} (طلب سابق بتاريخ ${item.date})` : `(طلب سابق بتاريخ ${item.date})`;
      
      const newItem: Item = {
        ...item,
        id: newId,
        date: today,
        time: getNow(),
        savedAt: getFullDate(),
        status: "waiting", // Reset status to waiting so it will be auto-merged
        deliveryStatus: "pending", // Reset delivery status for the new day
        deliveredAt: undefined,
        note: rolledNote,
        isRollover: true, // Mark it as rolled over item
        originalDate: item.date,
        createdAt: Date.now()
      };
      await saveItem(newItem);
    }

    // 3. Mark rolledOver inside the original MergedInvoices
    for (const ref of itemsToUpdateInInvoices) {
      const inv = mergedInvoices.find(m => m.id === ref.invoiceId);
      if (inv) {
        const updatedItems = inv.items.map(it => {
          if (it.id === ref.itemId) {
            return {
              ...it,
              rolledOver: true,
              rolledOverToDate: today
            };
          }
          return it;
        });
        await saveMergedInvoice({
          ...inv,
          items: updatedItems,
          total: updatedItems.length
        });
      }
    }

    // 4. Trigger autoMerge to put these "waiting" items into today's pending merged invoice!
    await autoMergePendingInvoices();

    alert(`✅ تم ترحيل عدد (${previousUnreceivedItems.length}) بند بنجاح إلى الفاتورة المدمجة لليوم!`);
  };

  // === Delete and Edit Waiting Items ===
  const handleDeleteWaitingItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    if (!confirm(`هل تريد حذف البند "${item.description}"؟`)) return;

    await updateItemStatus(itemId, "deleted", {
      deletedAt: getFullDate(),
      deletedFrom: item.warehouse || "غير محدد"
    });

    // Remove from today's pending merged invoice if exists
    const today = getToday();
    const existingIndex = mergedInvoices.findIndex(m => m.date === today && m.status === "pending");
    if (existingIndex >= 0) {
      const inv = mergedInvoices[existingIndex];
      const updatedList = inv.items.filter(i => i.id !== itemId);
      if (updatedList.length === 0) {
        await deleteMergedInvoice(inv.id);
      } else {
        await saveMergedInvoice({
          ...inv,
          items: updatedList,
          total: updatedList.length
        });
      }
    }

    alert("🗑️ تم نقل البند إلى سلة المحذوفات!");
  };

  const handleEditWaitingItem = (item: any) => {
    setEditingItem({
      id: item.id || "",
      parentType: "items",
      company: item.company,
      fixedName: item.fixedName || "",
      description: item.description,
      note: item.note || "",
      warehouse: item.warehouse
    });
  };

  // === Waiting Items ===
  const handleApproveWaitingItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    await saveItem({
      ...item,
      status: "approved",
      approvedAt: getFullDate()
    });

    // Check if part of any merged invoice and clear it
    const today = getToday();
    const existingIndex = mergedInvoices.findIndex(m => m.date === today && m.status === "pending");
    if (existingIndex >= 0) {
      const inv = mergedInvoices[existingIndex];
      const updatedList = inv.items.filter(i => i.id !== id);
      if (updatedList.length === 0) {
        await deleteMergedInvoice(inv.id);
      } else {
        await saveMergedInvoice({
          ...inv,
          items: updatedList,
          total: updatedList.length
        });
      }
    }

    alert("✅ تم اعتماد الصنف بنجاح!");
  };

  const handleRejectWaitingItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    await saveItem({
      ...item,
      status: "rejected",
      rejectedAt: getFullDate()
    });

    alert("❌ تم رفض الصنف وإرجاعه!");
  };

  // === Deleted Items ===
  const handleRestoreDeletedItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    await saveItem({
      ...item,
      status: "active",
      deletedAt: undefined,
      deletedFrom: undefined
    });

    alert("✅ تم استعادة البند بنجاح للفاتورة النشطة!");
  };

  const handlePermanentDeleteItem = async (id: string) => {
    if (confirm("⚠️ هل أنت متأكد من الحذف النهائي لهذا الصنف من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.")) {
      await deleteItem(id);
      alert("🗑️ تم الحذف النهائي!");
    }
  };

  // === Report item edit & delete ===
  const handleDeleteItemFromReport = async (reportId: string, itemIndex: number) => {
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;
    const item = rep.items[itemIndex];
    if (!item) return;
    if (!confirm(`هل تريد حذف البند "${item.description}" من هذا التقرير اليومي؟`)) return;

    const updatedItems = [...rep.items];
    updatedItems.splice(itemIndex, 1);

    if (updatedItems.length === 0) {
      await deleteReport(rep.id);
    } else {
      await saveReport({
        ...rep,
        items: updatedItems,
        total: updatedItems.length
      });
    }

    await saveItem({
      ...item,
      id: item.id || (Date.now().toString() + Math.random().toString(36).slice(2, 6)),
      status: "deleted",
      deletedAt: getFullDate(),
      deletedFrom: `تقرير ${rep.date}`
    });

    alert("🗑️ تم حذف البند ونقله للمحذوفات!");
    setDetailsModal(null);
  };

  const handleEditItemInReport = async (reportId: string, itemIndex: number, updatedFields: any) => {
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;
    const updatedItems = [...rep.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updatedFields };

    await saveReport({
      ...rep,
      items: updatedItems
    });
    alert("✅ تم تعديل البند في التقرير بنجاح!");
    setDetailsModal(null);
  };

  // === Warehouse Archive item edit & delete ===
  const handleDeleteItemFromWarehouseArchive = async (waId: string, itemIndex: number) => {
    const wa = warehouseArchives.find(w => w.id === waId);
    if (!wa) return;
    const item = wa.items[itemIndex];
    if (!item) return;
    if (!confirm(`هل تريد حذف البند "${item.description}" من هذا الأرشيف؟`)) return;

    const updatedItems = [...wa.items];
    updatedItems.splice(itemIndex, 1);

    if (updatedItems.length === 0) {
      await deleteWarehouseArchive(wa.id);
    } else {
      await saveWarehouseArchive({
        ...wa,
        items: updatedItems
      });
    }

    await saveItem({
      ...item,
      id: item.id || (Date.now().toString() + Math.random().toString(36).slice(2, 6)),
      status: "deleted",
      deletedAt: getFullDate(),
      deletedFrom: wa.title || `أرشيف مخزن ${wa.warehouse}`
    });

    alert("🗑️ تم حذف البند ونقله للمحذوفات!");
    setDetailsModal(null);
  };

  const handleEditItemInWarehouseArchive = async (waId: string, itemIndex: number, updatedFields: any) => {
    const wa = warehouseArchives.find(w => w.id === waId);
    if (!wa) return;
    const updatedItems = [...wa.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updatedFields };

    await saveWarehouseArchive({
      ...wa,
      items: updatedItems
    });
    alert("✅ تم تعديل البند في الأرشيف بنجاح!");
    setDetailsModal(null);
  };

  // === Archive item edit ===
  const handleEditItemInArchive = async (archiveId: string, itemIndex: number, updatedFields: any) => {
    const arch = archives.find(a => a.id === archiveId);
    if (!arch) return;
    const updatedItems = [...arch.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updatedFields };

    await saveArchive({
      ...arch,
      items: updatedItems
    });
    alert("✅ تم تعديل البند في الأرشيف بنجاح!");
    setDetailsModal(null);
  };

  // === Active items edit & delete ===
  const handleDeleteActiveItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    if (!confirm(`هل تريد حذف البند "${item.description}"؟`)) return;

    await updateItemStatus(itemId, "deleted", {
      deletedAt: getFullDate(),
      deletedFrom: item.warehouse || "غير محدد"
    });
    alert("🗑️ تم نقل البند إلى سلة المحذوفات!");
  };

  const handleEditActiveItem = async (itemId: string, updatedFields: any) => {
    await updateItemFields(itemId, updatedFields);
    
    // Propagate updates to pending merged invoice if this is a waiting item
    const item = items.find(i => i.id === itemId);
    if (item && item.status === "waiting") {
      const today = getToday();
      const existingIndex = mergedInvoices.findIndex(m => m.date === today && m.status === "pending");
      if (existingIndex >= 0) {
        const inv = mergedInvoices[existingIndex];
        const updatedList = inv.items.map(it => {
          if (it.id === itemId) {
            return { ...it, ...updatedFields };
          }
          return it;
        });
        await saveMergedInvoice({
          ...inv,
          items: updatedList
        });
      }
    }

    alert("✅ تم تعديل البند بنجاح!");
    setEditingItem(null);
  };

  const handleSaveEditingItem = async () => {
    if (!editingItem) return;

    const { parentType, id, index, company, fixedName, description, note } = editingItem;

    if (!company.trim() || !description.trim()) {
      alert("⚠️ اسم الشركة والبيان لا يمكن تركهما فارغين!");
      return;
    }

    try {
      if (parentType === "items") {
        await handleEditActiveItem(id, { company, fixedName, description, note });
      } else if (parentType === "reports") {
        const rep = reports.find(r => r.items.some(it => it.id === id || (index !== undefined && r.items[index]?.id === id)));
        if (rep && index !== undefined) {
          await handleEditItemInReport(rep.id, index, { company, fixedName, description, note });
        } else {
          // Fallback search by index/matching if IDs aren't fully set
          const fallbackRep = reports.find(r => index !== undefined && r.items[index] !== undefined);
          if (fallbackRep && index !== undefined) {
            await handleEditItemInReport(fallbackRep.id, index, { company, fixedName, description, note });
          }
        }
      } else if (parentType === "archives") {
        const arch = archives.find(a => a.items.some(it => it.id === id || (index !== undefined && a.items[index]?.id === id)));
        if (arch && index !== undefined) {
          await handleEditItemInArchive(arch.id, index, { company, fixedName, description, note });
        } else {
          const fallbackArch = archives.find(a => index !== undefined && a.items[index] !== undefined);
          if (fallbackArch && index !== undefined) {
            await handleEditItemInArchive(fallbackArch.id, index, { company, fixedName, description, note });
          }
        }
      } else if (parentType === "warehouseArchives") {
        const wa = warehouseArchives.find(w => w.items.some(it => it.id === id || (index !== undefined && w.items[index]?.id === id)));
        if (wa && index !== undefined) {
          await handleEditItemInWarehouseArchive(wa.id, index, { company, fixedName, description, note });
        } else {
          const fallbackWa = warehouseArchives.find(w => index !== undefined && w.items[index] !== undefined);
          if (fallbackWa && index !== undefined) {
            await handleEditItemInWarehouseArchive(fallbackWa.id, index, { company, fixedName, description, note });
          }
        }
      } else if (parentType === "mergedInvoices") {
        const inv = mergedInvoices.find(m => m.id === editingItem.parentId);
        if (inv && index !== undefined) {
          const updatedItems = [...inv.items];
          updatedItems[index] = {
            ...updatedItems[index],
            company,
            fixedName,
            description,
            note
          };
          await saveMergedInvoice({
            ...inv,
            items: updatedItems
          });
          alert("✅ تم تعديل البند في الفاتورة المدمجة بنجاح!");
        }
        setEditingItem(null);
      }
    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء الحفظ.");
    }
  };

  // === Archive management ===
  const handleDeleteItemFromArchive = async (archiveId: string, itemIndex: number) => {
    const arch = archives.find(a => a.id === archiveId);
    if (!arch) return;

    const item = arch.items[itemIndex];
    if (!item) return;

    if (!confirm(`هل تريد حذف البند "${item.description}" من هذا الأرشيف المعتمد؟`)) return;

    const updatedItems = [...arch.items];
    updatedItems.splice(itemIndex, 1);

    if (updatedItems.length === 0) {
      await deleteArchive(arch.id);
    } else {
      await saveArchive({
        ...arch,
        items: updatedItems,
        total: updatedItems.length
      });
    }

    // Put item inside deleted collection
    await saveItem({
      ...item,
      status: "deleted",
      deletedAt: getFullDate(),
      deletedFrom: arch.title || `أرشيف ${arch.date}`
    });

    alert("🗑️ تم حذف البند ونقله للمحذوفات!");
    // Close modal to refresh list
    setDetailsModal(null);
  };

  const handleAddItemToArchive = async (archiveId: string, itemData: any) => {
    const arch = archives.find(a => a.id === archiveId);
    if (!arch) return;

    const newItem: Item = {
      id: Date.now().toString(),
      company: itemData.company,
      fixedName: itemData.fixedName,
      description: itemData.description,
      note: itemData.note,
      date: arch.date,
      time: getNow(),
      warehouse: arch.warehouse || "جميع المخازن",
      user: currentUser?.displayName || currentUser?.username || "غير معروف",
      savedAt: getFullDate(),
      status: "approved"
    };

    const updatedItems = [...arch.items, newItem];
    await saveArchive({
      ...arch,
      items: updatedItems,
      total: updatedItems.length
    });
  };

  const handleUpdateArchive = async (updatedArchive: Archive) => {
    try {
      await saveArchive(updatedArchive);
    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء تعديل الأرشيف.");
    }
  };

  const handleUpdateReport = async (updatedReport: Report) => {
    try {
      await saveReport(updatedReport);
    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء تعديل التقرير.");
    }
  };

  const handleUpdateWarehouseArchiveMetadata = async (updatedWa: WarehouseArchive) => {
    try {
      await saveWarehouseArchive(updatedWa);
      alert("✅ تم تعديل بيانات أرشيف المستودع بنجاح!");
      setEditingWarehouseArchive(null);
    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء الحفظ.");
    }
  };

  const handleDeleteWarehouseArchive = async (id: string) => {
    try {
      if (!confirm("⚠️ هل أنت متأكد من رغبتك في حذف هذا الأرشيف للمستودع نهائياً بالكامل؟")) return;
      await deleteWarehouseArchive(id);
      alert("✅ تم حذف الأرشيف للمستودع بنجاح!");
    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء الحذف.");
    }
  };

  // === Admin Profile Settings changes ===
  const handleUpdateAdminProfile = async (displayName: string, currentPass: string, newPass: string) => {
    const admin = users["مدير"];
    if (admin.password !== currentPass) {
      alert("⚠️ كلمة السر الحالية خاطئة!");
      return;
    }

    const updates: Partial<User> = { displayName };
    if (newPass.trim()) {
      updates.password = newPass;
    }

    await saveUser({
      ...admin,
      ...updates
    });
    alert("✅ تم تعديل وحفظ بيانات حساب المدير بنجاح!");
  };

  const handleAddUser = async (user: User) => {
    if (users[user.username]) {
      alert("⚠️ اسم هذا الحساب موجود بالفعل!");
      return;
    }

    await saveUser(user);
    alert(`✅ تم إدراج حساب "${user.displayName || user.username}" وتسجيله بنجاح!`);
  };

  const handleUpdateUser = async (key: string, user: User) => {
    await saveUser(user);
    alert("✅ تم تحديث بيانات الحساب بنجاح!");
  };

  const handleRemoveUser = async (key: string) => {
    if (confirm(`هل تريد إزالة وحذف حساب "${key}" نهائياً من قاعدة البيانات؟`)) {
      await removeUser(key);
      alert("🗑️ تم حذف حساب المستخدم.");
    }
  };

  const handleSaveQuotationToDB = async (q: Quotation) => {
    await saveQuotation(q);
  };

  const handleApproveQuotation = async (id: string) => {
    const q = quotations.find(item => item.id === id);
    if (!q) return;

    await saveQuotation({
      ...q,
      status: "approved",
      approvedAt: getFullDate()
    });

    await saveArchive({
      id: "archive-" + q.id,
      title: `عرض سعر معتمد - ${q.clientName}`,
      date: q.date,
      time: q.time,
      warehouse: "جميع المخازن",
      user: currentUser?.displayName || currentUser?.username || "المدير",
      items: q.items.map(it => {
        const matched = savedItems.find(s => s.name.trim().toLowerCase() === it.name.trim().toLowerCase());
        return {
          id: Date.now().toString() + Math.random().toString(),
          company: it.company || matched?.company || "عروض أسعار",
          fixedName: it.fixedName || matched?.fixedName || "عرض سعر",
          description: it.name,
          note: it.note || "",
          date: q.date,
          time: q.time,
          warehouse: it.warehouse || "جميع المخازن",
          user: "المدير",
          status: "approved"
        };
      }),
      total: q.total,
      approvedAt: getFullDate(),
      unread: true
    });

    alert("✅ تم اعتماد فاتورة عرض السعر بنجاح!");
  };

  // Render correct route section
  const renderActiveSection = () => {
    if (!currentUser) return null;
    const isManager = currentUser.role === "مدير";

    switch (activeSection) {
      case "dashboard":
        return hasPermission(currentUser, "dashboard") ? (
          <Dashboard
            currentUser={currentUser}
            items={items}
            mergedInvoices={mergedInvoices}
            users={users}
            onApproveMerged={handleApproveMerged}
            onRejectMerged={handleRejectMerged}
            onDeleteMerged={handleDeleteMerged}
            onApproveWaiting={handleApproveWaitingItem}
            onRejectWaiting={handleRejectWaitingItem}
            onRestoreDeleted={handleRestoreDeletedItem}
            onPermanentDelete={handlePermanentDeleteItem}
            onPrintMergedNormal={(idx) => {
              const inv = mergedInvoices[idx];
              printInvoice(inv.items, `فاتورة مدمجة #${inv.invoiceNumber} - ${inv.date}`, "جميع المخازن", currentUser.displayName || currentUser.username);
            }}
            onPrintMergedMatrix={(idx) => {
              const inv = mergedInvoices[idx];
              printMatrix(inv.items, `بيان النواقص #${inv.invoiceNumber}`, "جميع المخازن", undefined, currentUser.displayName || currentUser.username);
            }}
            onDeleteMergedItem={handleDeleteMergedItem}
            onEditMergedItem={handleEditMergedItem}
            onDeleteWaitingItem={handleDeleteWaitingItem}
            onEditWaitingItem={handleEditWaitingItem}
            onUpdateItemDeliveryStatus={handleUpdateItemDeliveryStatus}
            onRolloverUnreceivedItems={handleRolloverUnreceivedItems}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            لوحة القيادة والمؤشرات متاحة فقط للمدير العام.
          </div>
        );
      case "smart-print":
        return hasPermission(currentUser, "smart-print") ? (
          <SmartPrint currentUser={currentUser} />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            هذا القسم غير مصرح لك بدخوله.
          </div>
        );
      case "cart":
        return (
          <Cart
            currentUser={currentUser}
            savedItems={savedItems}
            items={items}
            customCompanies={customCompanies}
            onSaveCart={handleSaveCart}
            onSaveItemToDatabase={(item) => {
              if (!item.name?.trim()) return;

              // Prevent duplicate templates in savedItems
              const isAlreadySaved = savedItems.some(
                s => s.name.trim().toLowerCase() === item.name!.trim().toLowerCase() &&
                     s.company === (item.company || "") &&
                     s.fixedName === (item.fixedName || "")
              );

              if (isAlreadySaved) {
                return; // Already exists, skip creating duplicate template
              }

              // Create template in background
              const newS: SavedItem = {
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                name: item.name.trim(),
                company: item.company || "",
                fixedName: item.fixedName || "",
                note: item.note || "",
                lastUsed: item.lastUsed || new Date().toISOString()
              };
              saveSavedItem(newS);
            }}
          />
        );
      case "warehouse-manager":
      case "warehouse-nahas":
      case "warehouse-nady":
      case "warehouse-custom": {
        if (!hasPermission(currentUser, activeSection)) {
          return (
            <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
              هذا القسم غير مصرح لك بدخوله.
            </div>
          );
        }
        const whName = activeSection === "warehouse-manager" ? "مخزن المدير" :
                       activeSection === "warehouse-nahas" ? "مخزن النحاس" :
                       activeSection === "warehouse-nady" ? "مخزن النادي" :
                       selectedCustomWarehouse || currentUser.warehouse || "غير محدد";
        
        const whItems = items.filter(i => i.warehouse === whName && i.status === "active");
        const whArchiveList = warehouseArchives.filter(a => a.warehouse === whName);

        // Filter approved merged invoices containing items for this warehouse
        const approvedInvs = mergedInvoices.filter(m => {
          if (m.status !== "approved" && m.status !== "auto_approved") return false;
          return m.items.some(it => (it.warehouse || "").trim().includes(whName.trim()));
        });

        // Handler to re-send non-arrived items
        const handleResendNotArrivedItems = async (itemsToResend: Item[]) => {
          if (!currentUser || itemsToResend.length === 0) return;
          const wh = currentUser.warehouse || whName;
          const today = getToday();
          
          if (!confirm(`هل أنت متأكد من إعادة إرسال عدد (${itemsToResend.length}) صنف لم يصل إلى المدير العام اليوم كنواقص جديدة؟`)) {
            return;
          }

          try {
            for (const itemToResend of itemsToResend) {
              const qtyToResend = itemToResend.hasPartialReceipt && itemToResend.remainingQty && itemToResend.remainingQty !== "0"
                ? itemToResend.remainingQty
                : itemToResend.company;

              const newId = itemToResend.id + "_resend_" + Date.now() + Math.random().toString(36).slice(2, 5);
              const originalNoteStr = itemToResend.note && itemToResend.note !== "-" ? itemToResend.note : "";
              const resendNote = originalNoteStr 
                ? `${originalNoteStr} (إعادة إرسال لبند لم يصل من طلب بتاريخ ${itemToResend.date})`
                : `(إعادة إرسال لبند لم يصل من طلب بتاريخ ${itemToResend.date})`;

              const newItem: Item = {
                id: newId,
                company: qtyToResend,
                fixedName: itemToResend.fixedName,
                description: itemToResend.description || "",
                note: resendNote,
                date: today,
                time: getNow(),
                warehouse: itemToResend.warehouse || wh,
                user: currentUser.displayName || currentUser.username,
                savedAt: getFullDate(),
                status: "waiting", // back to waiting for manager approval
                deliveryStatus: "pending",
                createdAt: Date.now()
              };

              await saveItem(newItem);
            }

            await autoMergePendingInvoices();
            alert("✅ تم إعادة إرسال الأصناف المحددة بنجاح إلى المدير العام وتحديث قائمتك اليوم!");
          } catch (err) {
            console.error("Failed to re-send items:", err);
            alert("حدث خطأ أثناء محاولة إعادة إرسال الأصناف.");
          }
        };

        const handleFullReceiptDirect = async (invoiceId: string, item: Item) => {
          const qty = item.remainingQty || item.company;
          await handleConfirmPartialReceipt(invoiceId, item.id, qty, "0");
        };

        return (
          <div className="space-y-6">
            {/* Header with Warehouse Title */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800 border-r-4 border-[#8b6b4d] pr-3 flex items-center gap-2">
                  <span>📦 {whName}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">إدارة الطلبات، استلام البضائع، ومعالجة النواقص التي لم تصل.</p>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => printInvoice(whItems, `نواقص ${whName}`, whName, currentUser.displayName || currentUser.username)}
                  className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white p-2.5 px-4 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  🖨️ طباعة النواقص النشطة
                </button>
                <button
                  onClick={() => printMatrix(whItems, `مصفوفة ${whName}`, whName, undefined, currentUser.displayName || currentUser.username)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 px-4 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  ⊞ طباعة المصفوفة
                </button>
              </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setWhActiveTab("sent")}
                className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  whActiveTab === "sent"
                    ? "border-[#8b6b4d] text-[#8b6b4d]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                📋 1. قسم الفواتير المرسلة للمدير
              </button>
              <button
                onClick={() => setWhActiveTab("received")}
                className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  whActiveTab === "received"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                🚚 2. قسم المستلمات وتأكيد وصول البضاعة
              </button>
              <button
                onClick={() => setWhActiveTab("not-arrived")}
                className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  whActiveTab === "not-arrived"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                ⚠️ 3. قسم النواقص التي لم تصل (إعادة إرسال)
              </button>
            </div>

            {/* TAB CONTENT RENDERING */}
            
            {/* TAB 1: SENT INVOICES */}
            {whActiveTab === "sent" && (() => {
              const whSentInvs = mergedInvoices.filter(m => 
                m.items.some(it => (it.warehouse || "").trim().includes(whName.trim()))
              );

              return (
                <div className="space-y-6">
                  {/* Active Shortages (Quick View) */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">📦 الأصناف النشطة المسجلة حالياً</h3>
                    <div className="space-y-3">
                      {whItems.length === 0 ? (
                        <p className="text-gray-400 text-center py-4 text-xs">لا توجد نواقص نشطة للمستودع حالياً.</p>
                      ) : (
                        whItems.map((item, index) => (
                          <div key={item.id} className="p-3 bg-gray-50 border rounded-xl flex justify-between items-center gap-4">
                            <div>
                              <strong className="text-sm font-bold text-[#8b6b4d]">{index+1}. {item.company}</strong>
                              <span className="text-xs text-gray-700 font-semibold mr-2">{item.fixedName} - {item.description}</span>
                              {item.note && <p className="text-xs text-gray-500 mt-1">📝 ملاحظة: {item.note}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{item.date}</span>
                              {isManager && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setEditingItem({
                                      id: item.id,
                                      parentType: "items",
                                      company: item.company,
                                      fixedName: item.fixedName || "",
                                      description: item.description,
                                      note: item.note || ""
                                    })}
                                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    ✏️ تعديل
                                  </button>
                                  <button
                                    onClick={() => handleDeleteActiveItem(item.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    🗑️ حذف
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sent Daily Invoices List */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-r-4 border-[#8b6b4d] pr-3">📋 قائمة الفواتير المرسلة للمدير</h3>
                    <div className="space-y-4">
                      {whSentInvs.length === 0 ? (
                        <p className="text-gray-400 text-center py-8 text-sm">لا توجد فواتير مرسلة مسبقاً.</p>
                      ) : (
                        whSentInvs.map((inv) => {
                          const whInvoiceItems = inv.items.filter(it => (it.warehouse || "").trim().includes(whName.trim()));
                          const isExpanded = !!whExpandedInvs[inv.id];

                          return (
                            <div key={inv.id} className="border rounded-xl overflow-hidden shadow-sm bg-gray-50/30">
                              <div 
                                onClick={() => setWhExpandedInvs(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                                className="p-4 bg-white hover:bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none transition-all"
                              >
                                <div>
                                  <strong className="text-sm font-bold text-[#1e2b3c] block sm:inline">📄 بيان النواقص اليومي رقم #{inv.invoiceNumber}</strong>
                                  <span className="text-xs text-gray-400 sm:mr-3">التاريخ: {inv.date} | عدد بنود المخزن: {whInvoiceItems.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {inv.status === "pending" ? (
                                    <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">⏳ بانتظار مراجعة المدير</span>
                                  ) : inv.status === "approved" || inv.status === "auto_approved" ? (
                                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">🟢 معتمدة وجاري استلامها</span>
                                  ) : (
                                    <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-bold">❌ تم رفضها</span>
                                  )}
                                  <span className="text-gray-400 text-xs">{isExpanded ? "▲ إخفاء" : "▼ عرض التفاصيل"}</span>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-4 border-t bg-white space-y-3">
                                  <div className="flex justify-between items-center pb-2 border-b">
                                    <span className="text-xs font-bold text-gray-500">تفاصيل أصناف الفاتورة:</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        printInvoice(whInvoiceItems, `فاتورة رقم ${inv.invoiceNumber} - ${inv.date}`, whName, currentUser.displayName || currentUser.username);
                                      }}
                                      className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-[11px] font-bold p-1.5 px-3 rounded-lg cursor-pointer"
                                    >
                                      🖨️ طباعة هذه الفاتورة
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {whInvoiceItems.map((item, idx) => (
                                      <div key={item.id || idx} className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center text-xs">
                                        <div>
                                          <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2 py-0.5 rounded text-[10px] ml-2">مطلوب: {item.company}</span>
                                          <strong className="text-gray-800">{item.fixedName}</strong>
                                          <span className="text-gray-500 mr-2">{item.description && item.description !== "-" && `(${item.description})`}</span>
                                          {item.note && <p className="text-[10px] text-gray-400 mt-1">📝 ملاحظة: {item.note}</p>}
                                        </div>
                                        <div>
                                          {item.deliveryStatus === "received" ? (
                                            <span className="text-emerald-600 font-extrabold text-[10px]">✓ تم الاستلام بالكامل</span>
                                          ) : item.deliveryStatus === "delayed" ? (
                                            <span className="text-red-500 font-extrabold text-[10px]">✖ لم يصل بعد</span>
                                          ) : item.hasPartialReceipt ? (
                                            <span className="text-amber-600 font-extrabold text-[10px]">🟡 تم الاستلام جزئياً (المتبقي: {item.remainingQty})</span>
                                          ) : (
                                            <span className="text-gray-400 font-bold text-[10px]">⏳ بانتظار الشحن والاستلام</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: RECEIVED INVOICES & GOODS RECEIPT */}
            {whActiveTab === "received" && (() => {
              if (approvedInvs.length === 0) {
                return (
                  <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium border shadow-sm">
                    لا توجد فواتير معتمدة من المدير العام بانتظار الاستلام حالياً.
                  </div>
                );
              }

              return (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100" id="approved-warehouse-items-receipt">
                  <div className="flex justify-between items-center mb-6 border-b pb-3 border-emerald-50">
                    <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                      <span>🚚 استلام البضائع والفواتير المعتمدة</span>
                    </h2>
                    <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-full font-bold">
                      عدد الفواتير: {approvedInvs.length}
                    </span>
                  </div>

                  <div className="space-y-6 max-h-[700px] overflow-y-auto pr-1">
                    {approvedInvs.map((inv) => {
                      const whInvoiceItems = inv.items.filter(it => (it.warehouse || "").trim().includes(whName.trim()));
                      const pendingCount = whInvoiceItems.filter(it => it.deliveryStatus !== "received" && it.deliveryStatus !== "delayed").length;

                      return (
                        <div key={inv.id} className={`p-4 rounded-xl border transition-all ${pendingCount > 0 ? "bg-amber-50/15 border-amber-200" : "bg-emerald-50/15 border-emerald-100"}`}>
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <strong className="text-sm font-bold text-[#1e2b3c]">📄 بيان النواقص المعتمد رقم #{inv.invoiceNumber}</strong>
                              <span className="text-xs text-gray-400 mr-2">التاريخ: {inv.date}</span>
                            </div>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${pendingCount > 0 ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-emerald-100 text-emerald-800"}`}>
                              {pendingCount > 0 ? `⏳ بانتظار استلام (${pendingCount}) صنف` : "✅ تم استلام جميع الأصناف"}
                            </span>
                          </div>

                          <div className="space-y-2 bg-white p-2 rounded-lg border border-gray-100">
                            {whInvoiceItems.map((item, itemIdx) => {
                              const isReceived = item.deliveryStatus === "received";
                              const isDelayed = item.deliveryStatus === "delayed";

                              return (
                                <div key={item.id || itemIdx} className="p-3 bg-gray-50/50 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs hover:bg-gray-50 transition-all">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {item.hasPartialReceipt ? (
                                        <span className="bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded text-[10px] border border-red-100 animate-pulse">
                                          متبقي: {item.remainingQty} (مطلوب: {item.originalQty || item.company})
                                        </span>
                                      ) : (
                                        <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2 py-0.5 rounded text-[10px]">مطلوب: {item.company}</span>
                                      )}
                                      <span className="font-extrabold text-gray-800 text-sm">{item.fixedName}</span>
                                      {item.isRollover && (
                                        <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold">طلب مسبق بتاريخ {item.originalDate}</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                      <span>{item.description && item.description !== "-" && item.description}</span>
                                      {item.note && item.note !== "-" && <span className="mr-2">📝 ملاحظة: {item.note}</span>}
                                      {item.hasPartialReceipt && (
                                        <span className="mr-2 text-emerald-600 font-bold">✓ مستلم سابقاً: {item.receivedQty}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                    {isReceived ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold text-[10px]">🟢 تم الاستلام في {item.deliveredAt || inv.date}</span>
                                        <button
                                          onClick={() => handleUpdateItemDeliveryStatus(inv.id, item.id, "delayed")}
                                          className="text-[10px] text-gray-400 hover:text-red-500 cursor-pointer p-1 rounded"
                                          title="تراجع / تحديد كـ لم يصل"
                                        >
                                          🔄 تراجع
                                        </button>
                                      </div>
                                    ) : isDelayed ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-bold text-[10px]">🔴 لم يصل بعد</span>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => handleFullReceiptDirect(inv.id, item)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1 px-2.5 rounded-lg cursor-pointer text-[10px]"
                                          >
                                            ✓ استلام
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => handleFullReceiptDirect(inv.id, item)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1 px-2.5 rounded-lg shadow-sm cursor-pointer text-[10px]"
                                          title="استلام كامل الكمية"
                                        >
                                          ✓ استلام
                                        </button>
                                        <button
                                          onClick={() => handleUpdateItemDeliveryStatus(inv.id, item.id, "delayed")}
                                          className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-1 px-2.5 rounded-lg shadow-sm cursor-pointer text-[10px]"
                                          title="لم يصل بعد"
                                        >
                                          ✖ لم يصل
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TAB 3: UNRECEIVED ITEMS & RESEND */}
            {whActiveTab === "not-arrived" && (() => {
              // Group unreceived/delayed items
              const notArrivedGroups = approvedInvs.map(inv => {
                const unarrived = inv.items.filter(item => {
                  if (!(item.warehouse || "").trim().includes(whName.trim())) return false;
                  const isDelayed = item.deliveryStatus === "delayed";
                  const isPartialWithRemaining = item.hasPartialReceipt && item.remainingQty && item.remainingQty !== "0";
                  return isDelayed || isPartialWithRemaining;
                });
                return { inv, items: unarrived };
              }).filter(g => g.items.length > 0);

              if (notArrivedGroups.length === 0) {
                return (
                  <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium border shadow-sm">
                    لا توجد بنود مصنفة "لم تصل" أو متبقيات بانتظار الاستلام حالياً.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl text-xs text-red-900 font-semibold leading-relaxed">
                    💡 هنا تظهر الأصناف التي قمت بوضع علامة (لم يصل) عليها أثناء استلام البضائع، أو التي تم استلامها جزئياً ولا يزال هناك متبقي منها. يمكنك إعادة إرسال الأصناف غير الواصلة بضغطة واحدة إلى المدير العام ليقوم باعتمادها مرة أخرى في اليوم التالي كنواقص نشطة بانتظار الترحيل.
                  </div>

                  <div className="space-y-4">
                    {notArrivedGroups.map(({ inv, items: groupItems }) => (
                      <div key={inv.id} className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3 mb-4">
                          <div>
                            <strong className="text-sm font-bold text-red-900">📄 فواتير نواقص معلقة من الفاتورة رقم #{inv.invoiceNumber}</strong>
                            <p className="text-xs text-gray-400 mt-0.5">تاريخ الفاتورة الأساسية: {inv.date} | عدد البنود المتبقية: {groupItems.length}</p>
                          </div>
                          <button
                            onClick={() => handleResendNotArrivedItems(groupItems)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            🔄 إعادة إرسال كافة البنود غير الواصلة للمدير
                          </button>
                        </div>

                        <div className="space-y-2">
                          {groupItems.map((item, itemIdx) => {
                            const qtyToResend = item.hasPartialReceipt && item.remainingQty && item.remainingQty !== "0"
                              ? item.remainingQty
                              : item.company;

                            return (
                              <div key={item.id || itemIdx} className="p-3 bg-red-50/15 border border-red-100 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                      غير واصل: {qtyToResend}
                                    </span>
                                    <span className="font-extrabold text-gray-800 text-sm">{item.fixedName}</span>
                                    {item.description && item.description !== "-" && (
                                      <span className="text-gray-500">({item.description})</span>
                                    )}
                                  </div>
                                  {item.note && <p className="text-[10px] text-gray-400 mt-1">📝 ملاحظة: {item.note}</p>}
                                </div>

                                <button
                                  onClick={() => handleResendNotArrivedItems([item])}
                                  className="bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-700 font-bold py-1 px-3 rounded-md text-[10px] cursor-pointer transition-all"
                                >
                                  إعادة إرسال هذا البند فقط 🔄
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Waiting items (pending review by manager) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-amber-700 border-r-4 border-amber-500 pr-3 mb-4">⏳ بنود بانتظار المراجعة والاعتماد من المدير</h2>
              <div className="space-y-3">
                {items.filter(i => i.warehouse === whName && i.status === "waiting").length === 0 ? (
                  <p className="text-gray-400 text-center py-6 text-xs">لا توجد بنود بانتظار المراجعة حالياً.</p>
                ) : (
                  items.filter(i => i.warehouse === whName && i.status === "waiting").map((item, index) => (
                    <div key={item.id} className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl flex justify-between items-center gap-4 flex-wrap sm:flex-nowrap">
                      <div>
                        <strong className="text-sm font-bold text-amber-900">{index+1}. {item.company}</strong>
                        <span className="text-xs text-gray-700 font-semibold mr-2">{item.fixedName} - {item.description}</span>
                        {item.note && <p className="text-xs text-gray-500 mt-1">📝 ملاحظة: {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-bold">بانتظار الاعتماد</span>
                        {(isManager || currentUser.warehouse === whName) && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditWaitingItem(item)}
                              className="bg-amber-500 hover:bg-amber-600 text-amber-950 p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="تعديل البند"
                            >
                              ✏️ تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteWaitingItem(item.id)}
                              className="bg-red-600 hover:bg-red-700 text-white p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="حذف البند"
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Historical Archive */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📦 أرشيف تاريخ الفواتير</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {whArchiveList.length === 0 ? (
                  <p className="text-gray-400 text-center py-6">الأرشيف فارغ للمستودع حالياً.</p>
                ) : (
                  whArchiveList.map((arch) => (
                    <div key={arch.id} className="p-3 bg-[#f5f2ed]/45 border rounded-xl flex justify-between items-center">
                      <div>
                        <strong className="text-sm text-gray-800">📄 {arch.title}</strong>
                        <p className="text-xs text-gray-400 mt-1">التاريخ: {arch.date} | عدد البنود: {arch.items.length}</p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => onViewDetails(
                            arch.title,
                            arch.items,
                            (index) => handleDeleteItemFromWarehouseArchive(arch.id, index),
                            (index, fields) => handleEditItemInWarehouseArchive(arch.id, index, fields)
                          )}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold p-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          👁️ عرض
                        </button>
                        <button
                          onClick={() => printInvoice(arch.items, arch.title, whName, currentUser.displayName || currentUser.username)}
                          className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          🖨️ طباعة
                        </button>
                        <button
                          onClick={() => setEditingWarehouseArchive(arch)}
                          className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteWarehouseArchive(arch.id)}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      }
      case "quotations":
        return (
          <Quotations
            currentUser={currentUser}
            quotations={quotations}
            savedItems={savedItems}
            onSaveQuotation={handleSaveQuotationToDB}
            onDeleteQuotation={deleteQuotation}
            onApproveQuotation={handleApproveQuotation}
          />
        );
      case "reports":
        return hasPermission(currentUser, "reports") ? (
          <Reports
            currentUser={currentUser}
            reports={reports}
            onDeleteReport={deleteReport}
            onViewDetails={onViewDetails}
            onDeleteItemFromReport={handleDeleteItemFromReport}
            onEditItemInReport={handleEditItemInReport}
            onUpdateReport={handleUpdateReport}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            التقارير وسجلات الترحيل مخصصة للمدير العام فقط.
          </div>
        );
      case "archive":
        return hasPermission(currentUser, "archive") ? (
          <ArchiveComponent
            currentUser={currentUser}
            archives={archives}
            savedItems={savedItems}
            onDeleteArchive={deleteArchive}
            onDeleteItemFromArchive={handleDeleteItemFromArchive}
            onEditItemInArchive={handleEditItemInArchive}
            onAddItemToArchive={handleAddItemToArchive}
            onViewDetails={onViewDetails}
            onUpdateArchive={handleUpdateArchive}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            الأرشيف العام وسجلات المستندات مخصصة للمدير العام فقط.
          </div>
        );
      case "chat":
        return hasPermission(currentUser, "chat") ? (
          <ChatComponent currentUser={currentUser} users={users} />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            قسم الدردشة والتواصل غير متاح لك.
          </div>
        );
      case "settings":
        return hasPermission(currentUser, "settings") ? (
          <Settings
            currentUser={currentUser}
            users={users}
            items={items}
            mergedInvoices={mergedInvoices}
            archives={archives}
            warehouseArchives={warehouseArchives}
            reports={reports}
            savedItems={savedItems}
            quotations={quotations}
            customCompanies={customCompanies}
            onSaveCustomCompany={saveCustomCompany}
            onDeleteCustomCompany={deleteCustomCompany}
            onSaveSavedItem={saveSavedItem}
            onDeleteSavedItem={deleteSavedItem}
            onUpdateAdminProfile={handleUpdateAdminProfile}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onRemoveUser={handleRemoveUser}
            onDatabaseRefreshed={refreshDatabase}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(prev => !prev)}
            companyInfo={companyInfo}
            onSaveCompanyInfo={saveCompanyInfo}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            الإعدادات المتقدمة وإدارة الحسابات مخصصة للمدير العام فقط.
          </div>
        );
      case "privacy-policy":
        return <PrivacyPolicy currentUser={currentUser} />;
      case "manager-unreceived":
        return hasPermission(currentUser, "manager-unreceived") ? (
          <UnreceivedItems
            currentUser={currentUser}
            mergedInvoices={mergedInvoices}
            warehouseFilter={null}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            هذا القسم غير مصرح لك بدخوله.
          </div>
        );
      case "manager-received":
        return hasPermission(currentUser, "manager-received") ? (
          <ReceivedItems
            currentUser={currentUser}
            mergedInvoices={mergedInvoices}
            warehouseFilter={null}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            هذا القسم غير مصرح لك بدخوله.
          </div>
        );
      case "warehouse-unreceived":
        return hasPermission(currentUser, "warehouse-unreceived") ? (
          <UnreceivedItems
            currentUser={currentUser}
            mergedInvoices={mergedInvoices}
            warehouseFilter={currentUser.warehouse || ""}
          />
        ) : (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-500 font-medium shadow-sm">
            هذا القسم غير مصرح لك بدخوله.
          </div>
        );
      default:
        return null;
    }
  };

  const onViewDetails = (
    title: string,
    detailItems: any[],
    onDeleteItem?: (index: number) => void,
    onEditItem?: (index: number, updatedItem: any) => void
  ) => {
    setDetailsModal({ title, items: detailItems, onDeleteItem, onEditItem });
  };

  const renderWarehouseNav = (sectionId: string, label: string, isCustom = false, customName?: string) => {
    const isActive = activeSection === sectionId && (!isCustom || selectedCustomWarehouse === customName);
    
    return (
      <div className="space-y-1">
        <button
          onClick={() => {
            if (isCustom && customName) {
              setSelectedCustomWarehouse(customName);
            }
            setActiveSection(sectionId as any);
            setWhActiveTab("sent");
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
            isActive ? "bg-[#8b6b4d]/30 text-white font-bold" : "text-gray-300 hover:bg-white/5"
          }`}
        >
          <span>📦 {label}</span>
          <span className="text-[10px] text-gray-400">{isActive ? "▲" : "▼"}</span>
        </button>

        {isActive && (
          <div className="mr-4 pr-2 border-r border-white/10 space-y-1.5 mt-1">
            <button
              onClick={() => {
                if (isCustom && customName) {
                  setSelectedCustomWarehouse(customName);
                }
                setActiveSection(sectionId as any);
                setWhActiveTab("sent");
                setSidebarOpen(false);
              }}
              className={`w-full text-right py-2 px-3 rounded-lg text-xs font-semibold block transition-all cursor-pointer ${
                whActiveTab === "sent"
                  ? "bg-[#8b6b4d]/40 text-white font-bold"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              📋 قسم الفواتير المرسلة للمدير
            </button>
            <button
              onClick={() => {
                if (isCustom && customName) {
                  setSelectedCustomWarehouse(customName);
                }
                setActiveSection(sectionId as any);
                setWhActiveTab("received");
                setSidebarOpen(false);
              }}
              className={`w-full text-right py-2 px-3 rounded-lg text-xs font-semibold block transition-all cursor-pointer ${
                whActiveTab === "received"
                  ? "bg-emerald-600/30 text-emerald-200 font-bold"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              🚚 قسم المستلمات وتأكيد البضاعة
            </button>
            <button
              onClick={() => {
                if (isCustom && customName) {
                  setSelectedCustomWarehouse(customName);
                }
                setActiveSection(sectionId as any);
                setWhActiveTab("not-arrived");
                setSidebarOpen(false);
              }}
              className={`w-full text-right py-2 px-3 rounded-lg text-xs font-semibold block transition-all cursor-pointer ${
                whActiveTab === "not-arrived"
                  ? "bg-red-600/30 text-red-200 font-bold"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              ⚠️ قسم النواقص التي لم تصل
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!currentUser) {
    return <Login users={users} onLoginSuccess={handleLoginSuccess} />;
  }

  const isManager = currentUser.role === "مدير";

  return (
    <div className="min-h-screen bg-[#f5f2ed] flex flex-col lg:flex-row font-sans text-[#1e2b3c]">
      
      {/* Global Progress spinner during database refreshes */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-[#8b6b4d] animate-pulse z-[99999]" />
      )}

      {/* Side overlay for mobile */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar navigation drawer */}
      <aside className={`fixed lg:sticky top-0 bottom-0 lg:h-screen right-0 w-72 bg-gradient-to-b from-[#1e2b3c] to-[#2c3e50] text-white z-50 flex flex-col justify-between transform transition-transform duration-300 overflow-y-auto ${
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      }`}>
        <div className="flex flex-col">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-[#d4b48c] text-xl font-bold">🌹 الروضة الشريفة</h2>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white hover:text-red-400 text-lg cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* User badge */}
          <div className="m-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="font-semibold text-sm">{currentUser.displayName || currentUser.username}</div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{currentUser.role}</div>
          </div>

          {/* Nav links */}
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
            {hasPermission(currentUser, "dashboard") && (
              <button
                onClick={() => { setActiveSection("dashboard"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "dashboard" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                🏠 لوحة القيادة والمؤشرات
              </button>
            )}

            {hasPermission(currentUser, "manager-unreceived") && currentUser.role === "مدير" && (
              <button
                onClick={() => { setActiveSection("manager-unreceived"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "manager-unreceived" ? "bg-red-600/30 text-red-200 border border-red-500/20" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                ⚠️ البنود غير المستلمة (الكل)
              </button>
            )}

            {hasPermission(currentUser, "manager-received") && currentUser.role === "مدير" && (
              <button
                onClick={() => { setActiveSection("manager-received"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "manager-received" ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/20" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                ✅ البنود المستلمة (الكل)
              </button>
            )}

            {hasPermission(currentUser, "warehouse-unreceived") && currentUser.role !== "مدير" && (
              <button
                onClick={() => { setActiveSection("warehouse-unreceived"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "warehouse-unreceived" ? "bg-red-600/30 text-red-200 border border-red-500/20" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                ⚠️ البنود غير المستلمة (المخزن)
              </button>
            )}

            {hasPermission(currentUser, "cart") && (
              <button
                onClick={() => { setActiveSection("cart"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "cart" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                🛒 سلة النواقص وإرسالها
              </button>
            )}

            {hasPermission(currentUser, "chat") && (
              <button
                onClick={() => { setActiveSection("chat"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "chat" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                💬 قسم الدردشة والتواصل
              </button>
            )}

            {/* Warehouse routes */}
            {hasPermission(currentUser, "warehouse-manager") && (
              renderWarehouseNav("warehouse-manager", "مخزن المدير")
            )}

            {hasPermission(currentUser, "warehouse-nahas") && (
              renderWarehouseNav("warehouse-nahas", "مخزن النحاس")
            )}

            {hasPermission(currentUser, "warehouse-nady") && (
              renderWarehouseNav("warehouse-nady", "مخزن النادي")
            )}

            {hasPermission(currentUser, "smart-print") && (
              <button
                onClick={() => { setActiveSection("smart-print"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "smart-print" ? "bg-purple-600/30 text-purple-200 border border-purple-500/20" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                📝 طباعة النصوص والبرومبت
              </button>
            )}

            {hasPermission(currentUser, "warehouse-custom") && (
              currentUser.role === "مدير" ? (
                <>
                  {/* Custom Warehouses list for managers */}
                  {(() => {
                    const seenWarehouses = new Set<string>();
                    return (Object.values(users) as User[]).map(user => {
                      if (user.username === "مدير") return null;
                      const wh = user.warehouse || "";
                      if (!wh || wh === "مخزن النحاس" || wh === "مخزن النادي") return null;
                      if (seenWarehouses.has(wh)) return null;
                      seenWarehouses.add(wh);
                      return (
                        <div key={user.username}>
                          {renderWarehouseNav("warehouse-custom", user.warehouse, true, user.warehouse)}
                        </div>
                      );
                    });
                  })()}
                </>
              ) : (
                currentUser.warehouse && currentUser.warehouse !== "مخزن النحاس" && currentUser.warehouse !== "مخزن النادي" && (
                  renderWarehouseNav("warehouse-custom", currentUser.warehouse, true, currentUser.warehouse)
                )
              )
            )}

            {hasPermission(currentUser, "quotations") && (
              <button
                onClick={() => { setActiveSection("quotations"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "quotations" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                📋 فواتير عروض الأسعار
              </button>
            )}

            {hasPermission(currentUser, "reports") && (
              <button
                onClick={() => { setActiveSection("reports"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "reports" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                📄 التقارير اليومية
              </button>
            )}

            {hasPermission(currentUser, "archive") && (
              <button
                onClick={() => { setActiveSection("archive"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "archive" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                📦 الأرشيف العام للفواتير
              </button>
            )}

            {hasPermission(currentUser, "settings") && (
              <button
                onClick={() => { setActiveSection("settings"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "settings" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                ⚙️ الإعدادات المتقدمة
              </button>
            )}

            {hasPermission(currentUser, "privacy-policy") && (
              <button
                onClick={() => { setActiveSection("privacy-policy"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-right text-sm font-semibold transition-all cursor-pointer ${
                  activeSection === "privacy-policy" ? "bg-[#8b6b4d]/30 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                🛡️ سياسة الخصوصية والأمان
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Controls (Theme Switcher and Logout) for all users */}
        <div className="p-4 border-t border-white/10 space-y-2.5">
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="w-full flex items-center justify-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-white/5"
          >
            {darkMode ? "☀️ تفعيل الوضع الفاتح" : "🌙 تفعيل الوضع المظلم"}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 p-2.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 text-red-200 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-red-500/10"
          >
            🚪 تسجيل الخروج
          </button>
        </div>

        <div className="p-4 border-t border-white/10 text-xs text-center text-gray-400">
          © 2026 الروضة الشريفة
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 min-h-screen p-4 md:p-8 flex flex-col justify-between overflow-x-hidden">
        
        {/* Header toolbar */}
        <header className="bg-white p-4 rounded-2xl shadow-xs flex justify-between items-center gap-4 mb-6 border border-gray-100 flex-wrap">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#1e2b3c] p-1.5 hover:bg-gray-100 rounded-xl cursor-pointer"
            >
              ☰
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-[#1e2b3c]">الروضة الشريفة</h1>
            </div>
          </div>

          {/* Rotating Ayat & Dhikr Center block */}
          {randomAyat.text && hasPermission(currentUser, "quran-verse") && activeSection !== "dashboard" && (
            <div className="hidden md:flex flex-col items-center justify-center max-w-[50%] text-center px-4 py-1.5 bg-[#f5f2ed]/70 rounded-2xl border-r-3 border-[#8b6b4d]">
              <p className="text-xs font-extrabold text-[#8b6b4d] leading-relaxed italic">
                "{randomAyat.text}" <span className="text-[10px] text-gray-500 font-medium font-sans">({randomAyat.reference})</span>
              </p>
              <p className="text-[10px] text-[#8b6b4d]/90 font-bold mt-1 animate-pulse">
                💚 هل صليت اليوم على النبي ﷺ؟
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={refreshDatabase}
              className="bg-[#8b6b4d]/10 hover:bg-[#8b6b4d]/25 text-[#8b6b4d] text-xs font-bold p-2 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
            >
              🔄 تحديث المزامنة
            </button>
            
            {/* Header User details */}
            <div className="bg-[#f5f2ed] p-1.5 px-4 rounded-full flex items-center gap-2 text-xs font-semibold">
              <span className="w-6 h-6 rounded-full bg-[#8b6b4d] text-white flex items-center justify-center font-bold text-[11px]">
                {(currentUser.displayName || currentUser.username).charAt(0)}
              </span>
              <span>{currentUser.displayName || currentUser.username}</span>
            </div>

            <button
              onClick={() => setDarkMode(prev => !prev)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm cursor-pointer transition-all border border-gray-100"
              title={darkMode ? "التحويل للوضع الفاتح" : "التحويل للوضع المظلم"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
            >
              🚪 خروج
            </button>
          </div>
        </header>

        {/* Content routing rendering */}
        <main className="flex-1">
          {currentUser && (() => {
            const defaultSec = hasPermission(currentUser, "dashboard") ? "dashboard" : 
                               hasPermission(currentUser, "cart") ? "cart" : 
                               hasPermission(currentUser, "chat") ? "chat" : "cart";
            if (activeSection !== defaultSec) {
              return (
                <div className="mb-4">
                  <button
                    onClick={() => setActiveSection(defaultSec)}
                    className="flex items-center gap-2 bg-[#8b6b4d]/10 hover:bg-[#8b6b4d]/20 text-[#8b6b4d] font-bold p-2 px-4 rounded-xl cursor-pointer transition-all text-sm border border-[#8b6b4d]/20"
                  >
                    ↩ رجوع للخلف
                  </button>
                </div>
              );
            }
            return null;
          })()}
          {renderActiveSection()}
        </main>

        {/* Shared visual Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>تم تحرير هذا البيان من شركة الروضة الشريفة © 2026</p>
          <p className="mt-1">
            <strong>حقوق الملكية: Mohamed Nazih</strong> | 📱 01029190615
          </p>
        </footer>
      </div>

      {/* Global details list popup dialog modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[11000] p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#d4b48c]/20 max-h-[85vh] overflow-y-auto flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#8b6b4d] border-b pb-3 mb-4">{detailsModal.title}</h3>
              <div className="space-y-2.5">
                {detailsModal.items.map((item, index) => (
                  <div key={item.id || index} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-bold">{index + 1}.</span>
                        <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2 py-0.5 rounded-lg text-xs">العدد: {item.company}</span>
                        <span className="font-extrabold text-gray-800 text-sm">{item.fixedName}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.description && item.description !== "-" && item.description}
                        {item.note && item.note !== "-" && ` | الملاحظة: ${item.note}`}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold p-1 px-2.5 rounded-full">
                        {item.warehouse || "جميع المخازن"}
                      </span>
                      {detailsModal.onEditItem && (
                        <button
                          onClick={() => {
                            setEditingItem({
                              id: item.id || "",
                              index: index,
                              parentType: detailsModal.title.startsWith("تقرير") ? "reports" : 
                                          detailsModal.title.startsWith("عرض سعر") ? "archives" : "warehouseArchives",
                              company: item.company,
                              fixedName: item.fixedName || "",
                              description: item.description,
                              note: item.note || ""
                            });
                          }}
                          className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="تعديل البند"
                        >
                          ✏️ تعديل
                        </button>
                      )}
                      {detailsModal.onDeleteItem && (
                        <button
                          onClick={() => {
                            if (confirm("تأكيد حذف هذا البند المنفصل؟")) {
                              detailsModal.onDeleteItem!(index);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="حذف البند مفرداً"
                        >
                          ✕ حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => setDetailsModal(null)}
              className="mt-6 w-full py-2.5 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl font-bold text-sm cursor-pointer transition-all"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* Global item editing popup modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[11500] p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#d4b48c]/20 animate-fade-in text-right" dir="rtl">
            <h3 className="text-lg font-bold text-[#8b6b4d] border-b pb-3 mb-4 flex items-center gap-2">
              <span>✏️ تعديل تفاصيل البند</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">🔢 خانة أعداد للأصناف (الكمية):</label>
                <input
                  type="text"
                  value={editingItem.company}
                  onChange={(e) => setEditingItem({ ...editingItem, company: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] font-bold"
                  placeholder="مثال: 5، 10 علب، الخ"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">📝 اسم الصنف والبيان:</label>
                <input
                  type="text"
                  value={editingItem.fixedName}
                  onChange={(e) => setEditingItem({ ...editingItem, fixedName: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] font-bold"
                  placeholder="اكتب اسم الصنف هنا"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">ℹ️ تفاصيل إضافية (اختياري):</label>
                <textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] h-16 resize-none"
                  placeholder="التفاصيل والنواقص المطلوبة"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">💬 ملاحظة للتمييز في التكرار:</label>
                <input
                  type="text"
                  value={editingItem.note}
                  onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d]"
                  placeholder="أية ملاحظات اختيارية للتمييز"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEditingItem}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                💾 حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Archive Edit Modal */}
      {editingWarehouseArchive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[11500] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#d4b48c]/20 text-right" dir="rtl">
            <h3 className="text-lg font-bold text-[#8b6b4d] border-b pb-3 mb-4 flex items-center gap-2">
              <span>✏️ تعديل بيانات أرشيف المستودع</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان:</label>
                <input
                  type="text"
                  value={editingWarehouseArchive.title}
                  onChange={(e) => setEditingWarehouseArchive({ ...editingWarehouseArchive, title: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">التاريخ:</label>
                <input
                  type="text"
                  value={editingWarehouseArchive.date}
                  onChange={(e) => setEditingWarehouseArchive({ ...editingWarehouseArchive, date: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الوقت:</label>
                <input
                  type="text"
                  value={editingWarehouseArchive.time}
                  onChange={(e) => setEditingWarehouseArchive({ ...editingWarehouseArchive, time: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d] font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleUpdateWarehouseArchiveMetadata(editingWarehouseArchive)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                💾 حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingWarehouseArchive(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Receipt Confirmation Modal */}
      {receiptConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[11600] p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-emerald-500/20 text-right" dir="rtl">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 border-b pb-3 mb-4 flex items-center gap-2">
              <span>🚚 تعديل الكمية وتأكيد الاستلام</span>
            </h3>

            <div className="mb-4 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-2xl border border-emerald-100/30 text-xs">
              <div className="text-gray-400 mb-1">اسم الصنف المعني بالاستلام:</div>
              <strong className="text-sm font-black text-gray-800 dark:text-white">{receiptConfirmModal.itemName}</strong>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">مطلوب (الكمية المطلوبة):</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={receiptConfirmModal.requiredQty}
                  className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5">مستلم (الكمية المستلمة حالياً):</label>
                <input
                  type="text"
                  value={receiptReceivedQty}
                  onChange={(e) => handleReceivedQtyChange(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-900 border border-emerald-600 dark:border-emerald-500 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                  placeholder="مثال: 5، 10 علب، الخ"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5">متبقي (الكمية المتبقية):</label>
                <input
                  type="text"
                  value={receiptRemainingQty}
                  onChange={(e) => setReceiptRemainingQty(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-900 border border-red-400 dark:border-red-500 rounded-xl text-sm font-black text-red-600 dark:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 text-center"
                  placeholder="0 في حال الاستلام الكامل"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleConfirmPartialReceipt(
                  receiptConfirmModal.invoiceId,
                  receiptConfirmModal.itemId,
                  receiptReceivedQty,
                  receiptRemainingQty
                )}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                ✓ تأكيد الاستلام
              </button>
              <button
                onClick={() => setReceiptConfirmModal(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[12000] p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-red-500/10 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-3xl">
              🚪
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">تأكيد تسجيل الخروج</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              هل أنت متأكد من رغبتك في تسجيل الخروج من منظومة الروضة الشريفة؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                نعم، خروج
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Alert Banner */}
      {chatAlert && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-[#1e2b3c] to-[#2c3e50] border-2 border-[#8b6b4d] text-white p-4 rounded-2xl shadow-2xl z-[99999] flex items-center justify-between gap-4 max-w-sm animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div className="text-right">
              <h4 className="text-xs font-bold text-[#d4b48c]">رسالة جديدة واردة!</h4>
              <p className="text-xs font-semibold mt-0.5 text-white">من: {chatAlert.senderName}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveSection("chat");
                setChatAlert(null);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded-lg text-[10px] transition-all cursor-pointer"
            >
              فتح المحادثة
            </button>
            <button
              onClick={() => setChatAlert(null)}
              className="bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white font-bold py-1 px-2 rounded-lg text-[10px] transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
