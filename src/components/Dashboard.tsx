import React, { useEffect, useState } from "react";
import { User, Item, MergedInvoice } from "../types";
import { AYAT, isItemInTodayWindow, getToday } from "../data/constants";
import { printInvoice } from "../utils/print";
import { compareDatesDescending, parseArabicOrStandardDate, isWarehouseMatch } from "../utils/date";
import PrintMatrixFilterModal from "./PrintMatrixFilterModal";

interface DashboardProps {
  currentUser: User;
  items: Item[];
  mergedInvoices: MergedInvoice[];
  users: { [key: string]: User };
  onApproveMerged: (indexOrId: number | string) => void;
  onRejectMerged: (indexOrId: number | string) => void;
  onDeleteMerged: (indexOrId: number | string) => void;
  onApproveWaiting: (id: string) => void;
  onRejectWaiting: (id: string) => void;
  onRestoreDeleted: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onPrintMergedNormal: (indexOrId: number | string) => void;
  onPrintMergedMatrix: (indexOrId: number | string) => void;
  onDeleteMergedItem?: (invoiceIndexOrId: number | string, itemIndex: number) => void;
  onEditMergedItem?: (invoiceIndexOrId: number | string, itemIndex: number, item: any) => void;
  onDeleteWaitingItem?: (id: string) => void;
  onEditWaitingItem?: (item: any) => void;
  onUpdateItemDeliveryStatus?: (invoiceId: string, itemId: string, status: "received" | "delayed") => void;
  onRolloverUnreceivedItems?: () => void;
  onAddItemToApprovedInvoice?: (invoiceId: string, itemData: any) => void;
  onNavigateSection?: (section: string) => void;
}

export default function Dashboard({
  currentUser,
  items,
  mergedInvoices,
  users,
  onApproveMerged,
  onRejectMerged,
  onDeleteMerged,
  onApproveWaiting,
  onRejectWaiting,
  onRestoreDeleted,
  onPermanentDelete,
  onPrintMergedNormal,
  onPrintMergedMatrix,
  onDeleteMergedItem,
  onEditMergedItem,
  onDeleteWaitingItem,
  onEditWaitingItem,
  onUpdateItemDeliveryStatus,
  onRolloverUnreceivedItems,
  onAddItemToApprovedInvoice,
  onNavigateSection
}: DashboardProps) {
  const [randomAyat, setRandomAyat] = useState<{ text: string; reference: string }>({ text: "", reference: "" });
  const [addItemModalInvoice, setAddItemModalInvoice] = useState<MergedInvoice | null>(null);
  const [matrixModalData, setMatrixModalData] = useState<{ items: Item[]; title: string; defaultWarehouse?: string } | null>(null);
  const [approvedFilterMode, setApprovedFilterMode] = useState<"all" | "today">("all");
  const [modalWarehouse, setModalWarehouse] = useState("مخزن النحاس");
  const [modalCustomWarehouse, setModalCustomWarehouse] = useState("");
  const [modalQty, setModalQty] = useState("");
  const [modalFixed, setModalFixed] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalNote, setModalNote] = useState("");

  const defaultWarehouses = ["مخزن النحاس", "مخزن النادي", "مخزن المدير"];
  const availableWarehouses = Array.from(new Set([
    ...defaultWarehouses,
    ...mergedInvoices.flatMap(m => m.warehouses || []).filter(Boolean),
    ...mergedInvoices.flatMap(m => m.items.map(i => i.warehouse)).filter(Boolean),
    ...Object.values(users).map(u => u.warehouse).filter(Boolean) as string[]
  ])).filter(w => w !== "جميع المخازن" && w !== "غير محدد");

  const handleModalAddSubmit = () => {
    if (!addItemModalInvoice) return;
    const selectedWh = modalWarehouse === "CUSTOM_WAREHOUSE" ? modalCustomWarehouse.trim() : modalWarehouse.trim();
    if (!selectedWh) {
      alert("⚠️ يرجى اختيار أو إدخال اسم المخزن!");
      return;
    }
    if (!modalQty.trim()) {
      alert("⚠️ يرجى إدخال العدد أو الكمية!");
      return;
    }
    if (!modalFixed.trim()) {
      alert("⚠️ يرجى إدخال اسم الصنف!");
      return;
    }

    onAddItemToApprovedInvoice?.(addItemModalInvoice.id, {
      warehouse: selectedWh,
      company: modalQty.trim(),
      fixedName: modalFixed.trim(),
      description: modalDesc.trim() || "-",
      note: modalNote.trim(),
    });

    setAddItemModalInvoice(null);
    setModalQty("");
    setModalFixed("");
    setModalDesc("");
    setModalNote("");
    setModalCustomWarehouse("");
  };

  const changeVerse = () => {
    // Non-repeating selection logic using localStorage
    const shownRaw = localStorage.getItem("shown_ayat_indexes");
    let shownIndexes: number[] = [];
    try {
      if (shownRaw) shownIndexes = JSON.parse(shownRaw);
    } catch (e) {}

    let availableIndexes = AYAT.map((_, i) => i).filter(i => !shownIndexes.includes(i));
    if (availableIndexes.length === 0) {
      availableIndexes = AYAT.map((_, i) => i);
      shownIndexes = [];
    }

    const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    shownIndexes.push(randomIndex);
    localStorage.setItem("shown_ayat_indexes", JSON.stringify(shownIndexes));

    setRandomAyat(AYAT[randomIndex]);
  };

  useEffect(() => {
    changeVerse();
    const interval = setInterval(changeVerse, 60000); // 1 minute
    return () => {
      clearInterval(interval);
    };
  }, []);

  const isManager = currentUser.role === "مدير";

  // Daily closing after 10:00 PM (22:00)
  const isPost10PM = new Date().getHours() >= 22;

  const isToday = (dateStr: string) => {
    try {
      const parsedDate = parseArabicOrStandardDate(dateStr);
      const todayDate = new Date();
      return (
        parsedDate.getDate() === todayDate.getDate() &&
        parsedDate.getMonth() === todayDate.getMonth() &&
        parsedDate.getFullYear() === todayDate.getFullYear()
      );
    } catch (e) {
      return false;
    }
  };

  const hasQuranVersePermission = 
    currentUser.role === "مدير" || 
    !currentUser.permissions || 
    currentUser.permissions.includes("quran-verse");

  // Calculate statistics
  const activeItems = items.filter(i => i.status === "active");
  const waitingItems = items.filter(i => i.status === "waiting");
  const deletedItems = items.filter(i => i.status === "deleted");

  const todayDeficitsCount = items.filter(isItemInTodayWindow).length;

  // Group active items by warehouse
  const warehouseStats: { [key: string]: number } = {};
  // Initialize default ones
  warehouseStats["مخزن النحاس"] = 0;
  warehouseStats["مخزن النادي"] = 0;
  warehouseStats["مخزن المدير"] = 0;
  
  // Add other active custom warehouses from users
  Object.values(users).forEach(u => {
    if (u.warehouse && u.role === "مخزن") {
      warehouseStats[u.warehouse] = 0;
    }
  });

  activeItems.forEach(item => {
    if (item.warehouse) {
      warehouseStats[item.warehouse] = (warehouseStats[item.warehouse] || 0) + 1;
    }
  });

  // Calculate chart data (Group items by date)
  const dateCounts: { [key: string]: number } = {};
  items.forEach(i => {
    if (i.date) {
      dateCounts[i.date] = (dateCounts[i.date] || 0) + 1;
    }
  });

  const sortedDates = Object.entries(dateCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7); // Last 7 active dates

  const maxCount = Math.max(...sortedDates.map(d => d[1]), 1);

  // Calculate unreceived/pending items in approved invoices that are currently visible
  const approvedInvoices = mergedInvoices.filter(m => m.status === "approved" || m.status === "auto_approved");

  // Pending Merged Invoices Awaiting Approval
  const pendingMergedInvoices = React.useMemo(() => {
    return mergedInvoices.filter(m => m.status === "pending");
  }, [mergedInvoices]);

  const pendingMergedItemsCount = React.useMemo(() => {
    return pendingMergedInvoices.reduce((acc, inv) => acc + (inv.items?.length || inv.total || 0), 0);
  }, [pendingMergedInvoices]);

  // Total Items Received Today
  const receivedTodayStats = React.useMemo(() => {
    let count = 0;
    let totalQty = 0;

    approvedInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (!isManager && currentUser.warehouse && !(it.warehouse || "").trim().includes(currentUser.warehouse.trim())) {
          return;
        }
        const isReceived = it.deliveryStatus === "received";
        const isPartialWithReceived = Boolean(it.hasPartialReceipt && it.receivedQty && it.receivedQty !== "0");

        if (isReceived || isPartialWithReceived) {
          const checkDateStr = it.deliveredAt || it.date || inv.date;
          if (checkDateStr && isToday(checkDateStr)) {
            count++;
            const q = isPartialWithReceived ? parseFloat(it.receivedQty || "0") : parseFloat(it.company || "1");
            totalQty += isNaN(q) ? 1 : q;
          }
        }
      });
    });

    return { count, totalQty };
  }, [approvedInvoices, isManager, currentUser.warehouse]);

  // Comprehensive tracking for unreceived (delayed/not arrived), partial, and fully received items
  const deliveryStats = React.useMemo(() => {
    let delayedNotArrivedCount = 0; // Items marked as delayed, not arrived, or with 'لم يصل'
    let partialReceivedCount = 0; // Items with confirmed partial receipt and remaining quantity > 0
    let totalUnreceivedCount = 0; // All unreceived items (delayed + pending + partial remaining)
    let fullyReceivedCount = 0; // Fully received items
    let totalUnreceivedQty = 0; // Sum of quantities remaining
    let totalPartialRemainingQty = 0; // Sum of partial remaining quantities

    approvedInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (!isManager && currentUser.warehouse && !(it.warehouse || "").trim().includes(currentUser.warehouse.trim())) {
          return;
        }

        // Hide resent items from pending count
        if (it.resent) return;

        const isDelayed = it.deliveryStatus === "delayed" || it.isNotArrived || (it.note && (it.note.includes("لم يصل") || it.note.includes("لم تصل")));
        const isPartialWithRemaining = Boolean(it.hasPartialReceipt && it.remainingQty && it.remainingQty !== "0");
        const isReceived = it.deliveryStatus === "received";

        if (isDelayed) {
          delayedNotArrivedCount++;
        }

        if (isPartialWithRemaining) {
          partialReceivedCount++;
          const rem = parseFloat(it.remainingQty || "0");
          totalPartialRemainingQty += isNaN(rem) ? 0 : rem;
        }

        if (!isReceived || isPartialWithRemaining) {
          totalUnreceivedCount++;
          const q = isPartialWithRemaining ? parseFloat(it.remainingQty || "0") : parseFloat(it.company || "1");
          totalUnreceivedQty += isNaN(q) ? 1 : q;
        } else if (isReceived && !isPartialWithRemaining) {
          fullyReceivedCount++;
        }
      });
    });

    return {
      delayedNotArrivedCount,
      partialReceivedCount,
      totalUnreceivedCount,
      fullyReceivedCount,
      totalUnreceivedQty,
      totalPartialRemainingQty
    };
  }, [approvedInvoices, isManager, currentUser.warehouse]);

  const unreceivedItemsFromApproved = deliveryStats.totalUnreceivedCount;

  return (
    <div className="space-y-6">
      {/* Quranic Verse & Prayer upon the Prophet Custom Block */}
      {hasQuranVersePermission && (
        <div className="bg-gradient-to-r from-emerald-50/70 via-[#fbf9f6] to-amber-50/70 p-6 rounded-2xl shadow-sm border-2 border-[#8b6b4d]/40 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Aesthetic Islamic art background accents */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b6b4d]/5 rounded-full -mr-16 -mt-16 pointer-events-none border border-[#8b6b4d]/10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full -ml-12 -mb-12 pointer-events-none border border-emerald-500/10"></div>
          
          <div className="flex-1 space-y-2.5 relative z-10 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-[#8b6b4d] bg-[#8b6b4d]/10 px-3 py-1 rounded-full border border-[#8b6b4d]/20 flex items-center gap-1.5">
                  <span>📖</span>
                  <span>آية قرآنية متغيرة</span>
                </span>
                <button
                  onClick={changeVerse}
                  className="text-xs font-bold text-[#8b6b4d] hover:text-[#6d4f34] bg-white/90 hover:bg-white px-2.5 py-1 rounded-full border border-[#8b6b4d]/30 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="عرض آية كريمة أخرى من القرآن الكريم"
                >
                  <span>🔄</span>
                  <span>آية أخرى</span>
                </button>
                {(currentUser.warehouse === "مخزن النحاس" || currentUser.warehouse === "مخزن النادي") && (
                  <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-pulse">
                    🕌 ترحيب خاص بـ {currentUser.warehouse}
                  </span>
                )}
              </div>
              {randomAyat.text ? (
                <div className="space-y-1">
                  <p className="text-base md:text-lg font-extrabold text-[#705238] leading-relaxed">
                    "{randomAyat.text}"
                  </p>
                  <span className="text-xs text-gray-500 font-bold block">({randomAyat.reference})</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">جاري تحميل الآية الكريمة...</p>
              )}
            </div>
          </div>

          <div className="shrink-0 text-center bg-white/90 backdrop-blur-xs border-2 border-emerald-300 p-4 rounded-2xl shadow-sm relative z-10 w-full md:w-auto md:min-w-[240px] transition-all hover:scale-[1.02]">
            <span className="text-3xl block mb-1">💚</span>
            <h4 className="text-sm font-black text-emerald-800">هل صليت اليوم على النبي ﷺ؟</h4>
            <p className="text-xs text-emerald-600/95 font-bold mt-1 bg-emerald-50/50 py-1 px-3 rounded-lg border border-emerald-100">
              «اللهم صلِّ وسلم وبارك على نبينا محمد»
            </p>
          </div>
        </div>
      )}

      {/* DEVELOPED TODAY'S SUMMARY (ملخص اليوم المطور) */}
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-[#8b6b4d]/25 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>ملخص اليوم المطور والتشغيلي</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  مباشر ولحظي ⚡
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isManager 
                  ? "لوحة التحكم الرئيسية للمدير: إدارة الفواتير المدمجة، متابعة الاستلام والمؤشرات الميدانية"
                  : `متابعة حركة النواقص والتوريد الخاصة بـ (${currentUser.warehouse || "المستودع"})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#8b6b4d] bg-[#8b6b4d]/10 px-3 py-1 rounded-xl border border-[#8b6b4d]/20">
              📅 {getToday()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#f5f2ed]/60 dark:bg-gray-800/40 p-3 rounded-xl border border-[#8b6b4d]/15 text-center">
            <div className="text-2xl font-black text-[#705238] dark:text-[#c4a482]">{activeItems.length}</div>
            <div className="text-[11px] font-bold text-gray-600 dark:text-gray-400 mt-0.5">النواقص النشطة</div>
          </div>
          <div className="bg-amber-50/70 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30 text-center">
            <div className="text-2xl font-black text-amber-800 dark:text-amber-300">{pendingMergedInvoices.length}</div>
            <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300 mt-0.5">فواتير بانتظار الاعتماد</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/30 text-center">
            <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{approvedInvoices.length}</div>
            <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mt-0.5">فواتير معتمدة ومنجزة</div>
          </div>
          <div className="bg-blue-50/70 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-200 dark:border-blue-900/30 text-center">
            <div className="text-2xl font-black text-blue-800 dark:text-blue-300">{receivedTodayStats.count}</div>
            <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300 mt-0.5">أصناف استلمت اليوم ({receivedTodayStats.totalQty} وحدة)</div>
          </div>
        </div>
      </div>

      {/* MANAGER VIEW: MERGED INVOICES HUB FIRST, INDICATORS UNDERNEATH */}
      {isManager ? (
        <>
          {/* 1. HERO SECTION FOR MANAGER: MERGED INVOICES SENT BY WAREHOUSES */}
          <div className="space-y-6" id="manager-merged-invoices-hub">
            {/* Sub-section A: Pending Merged Invoices */}
            <div id="pending-merged-invoices-section" className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-amber-300/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📨</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-amber-900 dark:text-amber-300">
                        فواتير مدمجة بانتظار الاعتماد والمراجعة
                      </h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                        pendingMergedInvoices.length > 0 ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {pendingMergedInvoices.length} فاتورة معلقة
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      الفواتير التي أرسلتها المستودعات وتنتظر اعتماد الإدارة لاعتماد توزيع البضائع
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-[480px] overflow-y-auto">
                {(() => {
                  const pendingFiltered = mergedInvoices.filter(m => m.status === "pending");
                  if (pendingFiltered.length === 0) {
                    return (
                      <div className="text-center py-10 bg-gray-50/70 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                        <span className="text-3xl block">✨</span>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          لا توجد فواتير مدمجة معلقة بانتظار المراجعة
                        </p>
                        <p className="text-xs text-gray-400">
                          كافة الفواتير المرسلة من المخازن تم اعتمادها وتحديثها فوراً.
                        </p>
                      </div>
                    );
                  }
                  return [...pendingFiltered].sort(compareDatesDescending).map((inv, invIdx) => (
                    <div key={`${inv.id}-${invIdx}`} className="bg-amber-50/30 border-2 border-amber-200/80 p-5 rounded-2xl space-y-3.5 shadow-xs">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="font-black text-[#1e2b3c] dark:text-gray-100 text-base">
                          📋 فاتورة مدمجة #{inv.invoiceNumber} - {inv.date}
                        </span>
                        <span className="bg-amber-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-2xs">
                          {inv.total} بند مسجل
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-bold">🏷️ المستودعات المساهمة: {inv.warehouses.join(" | ")}</p>
                      
                      {/* Nested item list preview */}
                      <div className="space-y-2 max-h-[220px] overflow-y-auto bg-white dark:bg-[#1f1f1f] p-3 rounded-xl border border-amber-100">
                        {inv.items.map((item, iIndex) => (
                          <div key={`${inv.id}-${item.id || iIndex}-${iIndex}`} className="flex flex-col text-xs border-b border-gray-50 dark:border-gray-800 pb-2 pt-1 first:pt-0 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-gray-700 dark:text-gray-200 flex items-center gap-2 font-bold text-sm">
                                <span className="text-gray-400 font-normal">{iIndex+1}.</span>
                                <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2.5 py-0.5 rounded-lg text-xs">
                                  العدد: {item.company}
                                </span>
                                <span className="text-gray-900 dark:text-white font-extrabold">{item.fixedName}</span>
                                {(item.isNotArrived || item.deliveryStatus === "delayed" || (item.note && (item.note.includes("لم يصل") || item.note.includes("لم تصل")))) && (
                                  <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-md">
                                    لم يصل
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{item.warehouse}</span>
                                {onDeleteMergedItem && (
                                  <button
                                    onClick={() => onDeleteMergedItem(inv.id, iIndex)}
                                    className="text-red-500 hover:text-red-700 font-bold p-1.5 hover:bg-red-50 rounded cursor-pointer transition-all"
                                    title="حذف البند"
                                  >
                                    🗑️
                                  </button>
                                )}
                                {onEditMergedItem && (
                                  <button
                                    onClick={() => onEditMergedItem(inv.id, iIndex, item)}
                                    className="text-amber-600 hover:text-amber-800 font-bold p-1.5 hover:bg-amber-50 rounded cursor-pointer transition-all"
                                    title="تعديل البند"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            </div>
                            {(() => {
                              const cleanNote = (item.note || "")
                                .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
                                .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
                                .replace(/[\(（]?\s*لم تصل[^\)）]*[\)）]?/g, "")
                                .trim();
                              return cleanNote && cleanNote !== "-" && cleanNote !== "" ? (
                                <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                  <span>📝 ملاحظة:</span>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{cleanNote}</span>
                                </div>
                              ) : null;
                            })()}
                            {item.duplicateFrom && (
                              <div className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 p-2 rounded-lg mt-1 font-semibold flex flex-col gap-0.5 max-w-full">
                                <span className="flex items-center gap-1 text-amber-800">⚠️ تنبيه تكرار البند:</span>
                                <span className="text-gray-600 font-normal leading-relaxed text-right">
                                  هذا الصنف أرسل مسبقاً من <strong className="text-amber-800 font-bold">({item.duplicateFrom})</strong>.
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => onApproveMerged(inv.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black p-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <span>✓</span>
                          <span>اعتماد الكل</span>
                        </button>
                        <button
                          onClick={() => onPrintMergedNormal(inv.id)}
                          className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>🖨️</span>
                          <span>طباعة</span>
                        </button>
                        <button
                          onClick={() => setMatrixModalData({ items: inv.items, title: `فاتورة مدمجة #${inv.invoiceNumber} (${inv.date})`, defaultWarehouse: "جميع المخازن" })}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold p-2.5 px-3.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                          title="طباعة مصفوفة النواقص مع خيارات الفلترة"
                        >
                          <span>⊞</span>
                          <span>طباعة مصفوفة</span>
                        </button>
                        <button
                          onClick={() => onRejectMerged(inv.id)}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-2.5 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>✕</span>
                          <span>رفض الكل</span>
                        </button>
                        <button
                          onClick={() => onDeleteMerged(inv.id)}
                          className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-bold p-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>🗑️</span>
                          <span>حذف الفاتورة</span>
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Sub-section B: Approved Merged Invoices */}
            {(() => {
              const allApproved = mergedInvoices.filter(m => m.status === "approved" || m.status === "auto_approved");
              const approvedFiltered = allApproved.filter(m => {
                if (approvedFilterMode === "today") {
                  return isToday(m.date);
                }
                return true;
              });

              return (
                <div id="approved-merged-invoices-section" className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-emerald-300/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">✅</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-300">
                            الفواتير المدمجة المعتمدة (المنجزة)
                          </h3>
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-black">
                            {approvedFiltered.length} فاتورة
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          الفواتير التي اعتمدتها الإدارة وتخضع حالياً لتأكيد الاستلام والتوريد في المستودعات
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button
                          onClick={() => setApprovedFilterMode("all")}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            approvedFilterMode === "all"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                          }`}
                        >
                          الكل ({allApproved.length})
                        </button>
                        <button
                          onClick={() => setApprovedFilterMode("today")}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            approvedFilterMode === "today"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                          }`}
                        >
                          اليوم ({allApproved.filter(m => isToday(m.date)).length})
                        </button>
                      </div>

                      {onNavigateSection && (
                        <button
                          onClick={() => onNavigateSection("archive")}
                          className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold p-2 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/40"
                          title="فتح الأرشيف الشامل لكافة الفواتير"
                        >
                          <span>📦 الأرشيف الكامل</span>
                          <span>←</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {approvedFiltered.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                      <span className="text-3xl block">📋</span>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {approvedFilterMode === "today"
                          ? "لا توجد فواتير مدمجة معتمدة بتاريخ اليوم حتى الآن"
                          : "لا توجد فواتير مدمجة معتمدة مسجلة حالياً"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        عند اعتماد أي فاتورة مدمجة من قسم "بانتظار الاعتماد" بالأعلى، ستظهر هنا فوراً لمتابعة تسليم أصنافها، كما تحفظ نسخة دائمة في قسم الأرشيف.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                      {[...approvedFiltered].sort(compareDatesDescending).map((inv, invIdx) => (
                        <div key={`${inv.id}-${invIdx}`} className="bg-emerald-50/20 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl space-y-3 shadow-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#1e2b3c] dark:text-gray-200">
                              📋 فاتورة مدمجة #{inv.invoiceNumber} - {inv.date}
                            </span>
                            <span className="bg-emerald-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                              {inv.total} بند | معتمدة ✅
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">🏷️ المخازن المساهمة: {inv.warehouses.join(" | ")}</p>
                          
                          {/* Nested item list preview */}
                          <div className="space-y-2 max-h-[180px] overflow-y-auto bg-white dark:bg-[#1f1f1f] p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                            {inv.items.map((item, iIndex) => {
                              const canUpdateDelivery = true; // Manager has full permissions
                              const isPartial = item.hasPartialReceipt && item.remainingQty && item.remainingQty !== "0";

                              return (
                                <div key={`${inv.id}-${item.id || iIndex}-${iIndex}`} className="flex flex-col text-xs border-b border-gray-50 dark:border-gray-800 pb-2 pt-1 first:pt-0 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2 font-bold text-sm">
                                      <span className="text-gray-400 font-normal">{iIndex+1}.</span>
                                      {isPartial ? (
                                        <span className="bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-lg text-xs border border-amber-300">
                                          مستلم: {item.receivedQty || "0"} | متبقي: {item.remainingQty}
                                        </span>
                                      ) : (
                                        <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2.5 py-0.5 rounded-lg text-xs">
                                          العدد: {item.company}
                                        </span>
                                      )}
                                      <span className="text-gray-800 dark:text-white font-extrabold">{item.fixedName}</span>
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Delivery Status Controllers */}
                                      <div className="flex items-center gap-1 mr-1">
                                        {item.deliveryStatus === "received" ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-200">
                                              🟢 تم الاستلام
                                            </span>
                                            {canUpdateDelivery && (
                                              <button
                                                onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "delayed")}
                                                className="text-[10px] bg-red-50 hover:bg-red-600 hover:text-white text-red-700 font-bold px-2 py-0.5 rounded-lg border border-red-200 cursor-pointer transition-all flex items-center gap-1"
                                                title="تراجع / تحديد كـ لم يصل"
                                              >
                                                <span>🔄</span>
                                                <span>لم يصل</span>
                                              </button>
                                            )}
                                          </div>
                                        ) : item.deliveryStatus === "delayed" || item.isNotArrived ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-red-100 text-red-800 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-red-200">
                                              🔴 لم يصل بعد
                                            </span>
                                            {canUpdateDelivery && (
                                              <button
                                                onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "received")}
                                                className="text-[10px] bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold px-2 py-0.5 rounded-lg border border-emerald-200 cursor-pointer transition-all flex items-center gap-1"
                                                title="تأكيد الاستلام"
                                              >
                                                <span>✓</span>
                                                <span>استلام</span>
                                              </button>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                              ⏳ بانتظار التأكيد
                                            </span>
                                            {canUpdateDelivery && (
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "received")}
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2.5 py-1 rounded-lg text-[10px] cursor-pointer transition-all shadow-2xs flex items-center gap-1"
                                                  title="تأكيد استلام الصنف"
                                                >
                                                  <span>✓</span>
                                                  <span>استلام</span>
                                                </button>
                                                <button
                                                  onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "delayed")}
                                                  className="bg-amber-500 hover:bg-amber-600 text-white font-black px-2.5 py-1 rounded-lg text-[10px] cursor-pointer transition-all shadow-2xs flex items-center gap-1"
                                                  title="تحديد الصنف كـ لم يصل"
                                                >
                                                  <span>✖</span>
                                                  <span>لم يصل</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{item.warehouse}</span>
                                      {onDeleteMergedItem && (
                                        <button
                                          onClick={() => onDeleteMergedItem(inv.id, iIndex)}
                                          className="text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded cursor-pointer"
                                          title="حذف البند"
                                        >
                                          🗑
                                        </button>
                                      )}
                                      {onEditMergedItem && (
                                        <button
                                          onClick={() => onEditMergedItem(inv.id, iIndex, item)}
                                          className="text-amber-600 hover:text-amber-800 font-bold p-1 hover:bg-amber-50 rounded cursor-pointer"
                                          title="تعديل البند"
                                        >
                                          ✏️
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {item.note && item.note !== "-" && item.note !== "" && (
                                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                      <span>📝 ملاحظة:</span>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{item.note}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => setAddItemModalInvoice(inv)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-3 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              ➕ إضافة صنف
                            </button>
                            <button
                              onClick={() => onPrintMergedNormal(inv.id)}
                              className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                            >
                              🖨️ طباعة
                            </button>
                            <button
                              onClick={() => setMatrixModalData({ items: inv.items, title: `فاتورة مدمجة معتمدة #${inv.invoiceNumber} (${inv.date})`, defaultWarehouse: "جميع المخازن" })}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer shadow-xs"
                              title="طباعة مصفوفة النواقص مع خيارات الفلترة"
                            >
                              ⊞ طباعة مصفوفة
                            </button>
                            <button
                              onClick={() => onDeleteMerged(inv.id)}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold p-2 px-2.5 rounded-xl transition-all cursor-pointer"
                            >
                              🗑️ حذف الفاتورة المعتمدة
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 2. INDICATORS & STATISTICS UNDERNEATH (المؤشرات تحتها فقط) */}
          <div className="space-y-6 pt-4 border-t-2 border-dashed border-[#8b6b4d]/30" id="manager-indicators-hub">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h3 className="text-lg font-black text-gray-800 dark:text-white">
                مؤشرات الأداء والحركة التشغيلية
              </h3>
            </div>

            {/* Key Statistical Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-key-stats-row">
              {/* Card 1: Total Active Shortages */}
              <div
                id="stats-active-deficits-card"
                className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-[#8b6b4d]/30 bg-gradient-to-br from-[#8b6b4d]/5 via-white to-white relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md hover:border-[#8b6b4d]/50"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-[#8b6b4d] uppercase tracking-wide flex items-center gap-1.5">
                        <span className="text-base">📋</span> إجمالي النواقص النشطة
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        كافة بنود النواقص المسجلة والجارية حالياً
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-[#8b6b4d] text-white px-2.5 py-0.5 rounded-full shadow-xs">
                      نشط الآن
                    </span>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-[#705238] dark:text-[#c4a482]">
                        {activeItems.length}
                      </span>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        صنف / بند نشط
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
                      <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2 py-0.5 rounded-md">
                        منها {todayDeficitsCount} بند سُجّل اليوم
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        (النحاس: {warehouseStats["مخزن النحاس"] || 0} • النادي: {warehouseStats["مخزن النادي"] || 0})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  {onNavigateSection && (
                    <button
                      onClick={() => onNavigateSection("warehouse-nahas")}
                      className="text-xs font-extrabold text-[#8b6b4d] hover:text-[#705238] transition-colors cursor-pointer"
                    >
                      <span>الانتقال لنواقص المستودعات ←</span>
                    </button>
                  )}
                  <span className="text-[11px] text-gray-400 font-semibold">مباشر</span>
                </div>
              </div>

              {/* Card 2: Pending Invoices Awaiting Approval */}
              <div
                id="stats-pending-invoices-card"
                className={`bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 ${
                  pendingMergedInvoices.length > 0
                    ? "border-amber-400/80 bg-gradient-to-br from-amber-50/50 via-white to-white"
                    : "border-gray-200 bg-white"
                } relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="text-base">⏳</span> فواتير بانتظار الاعتماد
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        فواتير مدمجة مرسلة تنتظر مراجعة المدير
                      </p>
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs ${
                        pendingMergedInvoices.length > 0
                          ? "bg-amber-500 text-white animate-pulse"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {pendingMergedInvoices.length > 0 ? "معلقة للمراجعة" : "لا توجد معلقات"}
                    </span>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-amber-900 dark:text-amber-300">
                        {pendingMergedInvoices.length}
                      </span>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        فاتورة مدمجة معلقة
                      </span>
                    </div>

                    <div className="mt-2.5 text-xs">
                      {pendingMergedInvoices.length > 0 ? (
                        <span className="bg-amber-100/80 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 font-bold px-2 py-0.5 rounded-md inline-block">
                          تحتوي على {pendingMergedItemsCount} صنف بانتظار الاعتماد
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✅ تم اعتماد وتحديث كافة الفواتير الواردة
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      const el = document.getElementById("pending-merged-invoices-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-xs font-bold text-amber-800 hover:text-amber-950 dark:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>الانتقال للفواتير المعلقة</span>
                    <span>↑</span>
                  </button>
                  <span className="text-[11px] text-gray-400 font-semibold">صلاحية المدير العام</span>
                </div>
              </div>

              {/* Card 3: Total Items Received Today */}
              <div
                id="stats-received-today-card"
                className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-50/40 via-white to-white relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md hover:border-emerald-400"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="text-base">✅</span> الأصناف المستلمة اليوم
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        بنود تم تأكيد توريدها واستلامها بتاريخ اليوم
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                      استلام اليوم
                    </span>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-emerald-800 dark:text-emerald-300">
                        {receivedTodayStats.count}
                      </span>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        صنف مستلم اليوم
                      </span>
                    </div>

                    <div className="mt-2.5 text-xs">
                      {receivedTodayStats.totalQty > 0 ? (
                        <span className="bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 font-bold px-2 py-0.5 rounded-md inline-block">
                          إجمالي الكميات المستلمة اليوم: {receivedTodayStats.totalQty} وحدة
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400 font-medium">
                          {receivedTodayStats.count > 0 ? "تم تأكيد وصول البنود بنجاح" : "لم تسجل مستلمات جديدة اليوم بعد"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  {onNavigateSection && (
                    <button
                      onClick={() => onNavigateSection("manager-received")}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>عرض سجل المستلمات</span>
                      <span>←</span>
                    </button>
                  )}
                  <span className="text-[11px] text-gray-400 font-semibold">تحديث مباشر</span>
                </div>
              </div>
            </div>

            {/* Delivery Movement Tracker */}
            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🚚</span>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                      <span>متابعة حركة استلام وتوريد الأصناف</span>
                      <span className="text-xs bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2.5 py-0.5 rounded-full">
                        تحديث فوري
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      إحصائيات الأصناف التي لم تصل (Delayed)، الأصناف المستلمة جزئياً، وروابط الانتقال السريع
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {onNavigateSection && (
                    <>
                      <button
                        onClick={() => onNavigateSection("manager-unreceived")}
                        className="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs font-bold p-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-red-200 dark:border-red-900/40"
                      >
                        <span>⚠️ عرض النواقص التي لم تصل</span>
                        <span className="text-xs">⬅</span>
                      </button>

                      <button
                        onClick={() => onNavigateSection("manager-received")}
                        className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold p-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-900/40"
                      >
                        <span>✅ عرض البنود المستلمة</span>
                        <span className="text-xs">⬅</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 3 Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Delayed / Not Arrived Items */}
                <div className="bg-gradient-to-br from-red-50/60 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10 p-4 rounded-xl border border-red-200/80 dark:border-red-900/30 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
                        <span>🚨</span> أصناف لم تصل (Delayed)
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        أصناف تم تأكيد تأخيرها أو لم تصل بعد
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-md">
                      معلقة
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <div className="text-3xl font-black text-red-700 dark:text-red-400">
                        {deliveryStats.delayedNotArrivedCount > 0 ? deliveryStats.delayedNotArrivedCount : deliveryStats.totalUnreceivedCount}
                      </div>
                      <div className="text-[11px] text-red-600 dark:text-red-300 font-bold mt-0.5">
                        {deliveryStats.delayedNotArrivedCount > 0 ? `منها ${deliveryStats.totalUnreceivedCount} بند معلق كلياً` : `إجمالي المعلق: ${deliveryStats.totalUnreceivedQty} وحدة`}
                      </div>
                    </div>
                    {onNavigateSection && (
                      <button
                        onClick={() => onNavigateSection("manager-unreceived")}
                        className="text-xs font-bold text-red-700 dark:text-red-300 hover:text-red-800 underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>عرض القائمة</span>
                        <span>←</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card 2: Partially Received Items */}
                <div className="bg-gradient-to-br from-amber-50/60 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/30 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                        <span>📦</span> أصناف مستلمة جزئياً
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        تم توريد جزء منها وتبقى كمية معلقة
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-md">
                      جزئي
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <div className="text-3xl font-black text-amber-800 dark:text-amber-300">
                        {deliveryStats.partialReceivedCount}
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                        {deliveryStats.partialReceivedCount > 0 ? `المتبقي: ${deliveryStats.totalPartialRemainingQty} وحدة` : "لا توجد معلقات جزئية"}
                      </div>
                    </div>
                    {onNavigateSection && (
                      <button
                        onClick={() => onNavigateSection("manager-unreceived")}
                        className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>عرض البنود</span>
                        <span>←</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card 3: Fully Received Items */}
                <div className="bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/30 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                        <span>✅</span> أصناف مستلمة بالكامل
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        تم تأكيد وصولها واستلامها 100%
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                      مكتمل
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <div className="text-3xl font-black text-emerald-800 dark:text-emerald-300">
                        {deliveryStats.fullyReceivedCount}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                        بند معتمد مكتمل الاستلام
                      </div>
                    </div>
                    {onNavigateSection && (
                      <button
                        onClick={() => onNavigateSection("manager-received")}
                        className="text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>عرض السجل</span>
                        <span>←</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Analysis & Flow Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-6">📊 تحليل وتدفق البيانات اليومية (آخر 7 أيام نشطة)</h3>
              {sortedDates.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">لا توجد سجلات كافية لعرض الرسم البياني</p>
              ) : (
                <div className="flex h-56 items-end gap-4 md:gap-8 justify-center bg-[#f5f2ed]/45 p-6 rounded-2xl">
                  {sortedDates.map(([date, count]) => {
                    const heightPercent = (count / maxCount) * 100;
                    return (
                      <div key={date} className="flex flex-col items-center flex-1 max-w-[50px] h-full justify-end">
                        <div className="text-xs font-bold text-[#8b6b4d] mb-1">{count}</div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-[#8b6b4d]/85 rounded-t-lg transition-all duration-500 hover:bg-[#8b6b4d]"
                        ></div>
                        <div className="text-[10px] text-gray-500 mt-2 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full" title={date}>
                          {date.split("/").slice(0, 2).join("/")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* WAREHOUSE USER VIEW */
        <>
          {/* Key Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="warehouse-key-stats-row">
            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-[#8b6b4d]/30 bg-gradient-to-br from-[#8b6b4d]/5 via-white to-white relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-black text-[#8b6b4d] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="text-base">📋</span> نواقص المستودع النشطة
                </span>
                <div className="text-4xl font-black text-[#705238] dark:text-[#c4a482]">
                  {activeItems.filter(i => (i.warehouse || "").trim().includes((currentUser.warehouse || "").trim())).length}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-white relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-black text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="text-base">⏳</span> بضائع بانتظار استلامها
                </span>
                <div className="text-4xl font-black text-amber-900">
                  {deliveryStats.totalUnreceivedCount}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-white relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="text-base">✅</span> مستلم اليوم
                </span>
                <div className="text-4xl font-black text-emerald-800">
                  {receivedTodayStats.count}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Tracker */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <span>🚚 متابعة البضائع والتوريد في مستودعك</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50/60 p-4 rounded-xl border border-red-200 flex flex-col justify-between">
                <span className="text-xs font-black text-red-700">🚨 لم تصل بعد</span>
                <div className="text-3xl font-black text-red-700">{deliveryStats.delayedNotArrivedCount}</div>
              </div>
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 flex flex-col justify-between">
                <span className="text-xs font-black text-amber-800">📦 استلام جزئي</span>
                <div className="text-3xl font-black text-amber-800">{deliveryStats.partialReceivedCount}</div>
              </div>
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 flex flex-col justify-between">
                <span className="text-xs font-black text-emerald-800">✅ مستلم بالكامل</span>
                <div className="text-3xl font-black text-emerald-800">{deliveryStats.fullyReceivedCount}</div>
              </div>
            </div>
          </div>

          {/* Active Shortages List & Pending items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📋 نواقص المستودع النشطة (آخر 5)</h3>
              <div className="space-y-2.5">
                {activeItems
                  .filter(i => (i.warehouse || "").trim().includes((currentUser.warehouse || "").trim()))
                  .slice(-5).map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="bg-gray-50 p-3 rounded-xl border-l-2 border-[#8b6b4d] text-sm">
                      <div className="flex justify-between items-center font-bold text-gray-800">
                        <span className="flex items-center gap-2">
                          <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2 py-0.5 rounded-md text-xs">العدد: {item.company}</span>
                          <span className="font-semibold text-gray-800">{item.fixedName}</span>
                        </span>
                      </div>
                      <div className="text-gray-500 text-xs mt-1 flex justify-between">
                        <span>{item.description !== "-" ? item.description : ""}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📊 تحليل النشاط (آخر 7 أيام)</h3>
              <div className="flex h-44 items-end gap-3 justify-center bg-[#f5f2ed]/45 p-4 rounded-xl">
                {sortedDates.map(([date, count]) => {
                  const heightPercent = (count / maxCount) * 100;
                  return (
                    <div key={date} className="flex flex-col items-center flex-1 max-w-[40px] h-full justify-end">
                      <div className="text-xs font-bold text-[#8b6b4d] mb-1">{count}</div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-[#8b6b4d]/85 rounded-t-md hover:bg-[#8b6b4d]"
                      ></div>
                      <div className="text-[10px] text-gray-500 mt-1">{date.split("/").slice(0, 2).join("/")}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Add Item Modal for Approved/Merged Invoices */}
      {addItemModalInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>➕ إضافة صنف إلى الفاتورة المدمجة #{addItemModalInvoice.invoiceNumber}</span>
            </h3>

            <div className="space-y-3">
              {/* Warehouse selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🏢 اختيار المخزن المعني <span className="text-red-500">*</span></label>
                <select
                  value={modalWarehouse}
                  onChange={(e) => setModalWarehouse(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] bg-white text-sm font-semibold"
                >
                  {availableWarehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                  <option value="CUSTOM_WAREHOUSE">🏢 مخزن آخر (إدخال يدوي...)</option>
                </select>
                {modalWarehouse === "CUSTOM_WAREHOUSE" && (
                  <input
                    type="text"
                    placeholder="اكتب اسم المخزن الجديد..."
                    value={modalCustomWarehouse}
                    onChange={(e) => setModalCustomWarehouse(e.target.value)}
                    className="p-2 border border-amber-300 bg-amber-50/50 rounded-lg text-sm mt-1 focus:outline-[#8b6b4d]"
                  />
                )}
              </div>

              {/* Quantity / العدد */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🔢 العدد (الكمية المطلوب إدراجها) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: 10 أو 5 كرتونة..."
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Item Name / اسم الصنف */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">📦 اسم الصنف <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: معجون دايتون GLC / كابل تايب سي..."
                  value={modalFixed}
                  onChange={(e) => setModalFixed(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Description / الوصف والتفاصيل */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">📝 الوصف / التفاصيل (اختياري)</label>
                <input
                  type="text"
                  placeholder="تفاصيل إضافية..."
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="p-2 border border-gray-200 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              {/* Note / ملاحظة */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">📌 ملاحظات إضافية (اختياري)</label>
                <input
                  type="text"
                  placeholder="ملاحظة للبند..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="p-2 border border-gray-200 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button
                onClick={handleModalAddSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-sm transition-all"
              >
                ➕ إضافة الصنف للفاتورة
              </button>
              <button
                onClick={() => setAddItemModalInvoice(null)}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm cursor-pointer transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Matrix Filter Modal */}
      {matrixModalData && (
        <PrintMatrixFilterModal
          isOpen={Boolean(matrixModalData)}
          onClose={() => setMatrixModalData(null)}
          items={matrixModalData.items}
          title={matrixModalData.title}
          currentUserDisplay={currentUser.displayName || currentUser.username}
          defaultWarehouse={matrixModalData.defaultWarehouse || "جميع المخازن"}
        />
      )}
    </div>
  );
}
