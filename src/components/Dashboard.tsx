import React, { useEffect, useState } from "react";
import { User, Item, MergedInvoice } from "../types";
import { AYAT, isItemInTodayWindow, getToday } from "../data/constants";
import { printInvoice } from "../utils/print";
import { compareDatesDescending, parseArabicOrStandardDate } from "../utils/date";

interface DashboardProps {
  currentUser: User;
  items: Item[];
  mergedInvoices: MergedInvoice[];
  users: { [key: string]: User };
  onApproveMerged: (index: number) => void;
  onRejectMerged: (index: number) => void;
  onDeleteMerged: (index: number) => void;
  onApproveWaiting: (id: string) => void;
  onRejectWaiting: (id: string) => void;
  onRestoreDeleted: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onPrintMergedNormal: (index: number) => void;
  onPrintMergedMatrix: (index: number) => void;
  onDeleteMergedItem?: (invoiceIndex: number, itemIndex: number) => void;
  onEditMergedItem?: (invoiceIndex: number, itemIndex: number, item: any) => void;
  onDeleteWaitingItem?: (id: string) => void;
  onEditWaitingItem?: (item: any) => void;
  onUpdateItemDeliveryStatus?: (invoiceId: string, itemId: string, status: "received" | "delayed") => void;
  onRolloverUnreceivedItems?: () => void;
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
  onRolloverUnreceivedItems
}: DashboardProps) {
  const [randomAyat, setRandomAyat] = useState<{ text: string; reference: string }>({ text: "", reference: "" });

  useEffect(() => {
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
  const unreceivedItemsFromApproved = approvedInvoices.reduce((acc, inv) => {
    const unreceivedInInv = inv.items.filter(it => {
      if (it.deliveryStatus === "received") return false;
      const isManager = currentUser.role === "مدير";
      if (!isManager) {
        if (currentUser.warehouse && !(it.warehouse || "").trim().includes(currentUser.warehouse.trim())) return false;
        if (!isToday(inv.date)) return false;
        if (isPost10PM) return false;
      }
      return true;
    });
    return acc + unreceivedInInv.length;
  }, 0);

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
                <span className="text-xs font-black text-[#8b6b4d] bg-[#8b6b4d]/10 px-3 py-1 rounded-full border border-[#8b6b4d]/20">
                  📖 آية قرآنية متغيرة
                </span>
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

      {/* Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Day Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📊 ملخص اليوم</h3>
            <div className="space-y-3">
              <p className="text-[#1e2b3c] font-black text-sm">
                مرحباً بك يا {currentUser.displayName || currentUser.username}!
              </p>
              <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                نتمنى لك يوماً سعيداً ومليئاً بالإنجاز والخير والبركة في الروضة الشريفة. إن متابعة وتسجيل النواقص أولاً بأول يضمن سير العمل بكل كفاءة وسلاسة.
              </p>
              <div className="bg-[#f5f2ed] p-3 rounded-xl border-r-3 border-emerald-500 text-[11px] text-gray-700 font-bold space-y-1">
                <p className="text-emerald-800 font-extrabold">📌 إرشادات سريعة للعمل اليومي:</p>
                <p>• تأكد من صحة كميات النواقص والشركات المحددة.</p>
                <p>• استخدم تحديث المزامنة للتأكد من مواءمة البيانات الجديدة.</p>
                <p>• راجع قائمة فواتير النواقص لمتابعة البنود المستلمة والمرفوضة.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold">صلّ على النبي اليوم ﷺ</p>
            <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
              اللهم صلِّ على محمد 💚
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📈 إحصائيات سريعة</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-[#f5f2ed] p-4 rounded-xl text-center">
              <div className="text-3xl font-extrabold text-[#8b6b4d]">{activeItems.length}</div>
              <div className="text-xs text-gray-500 mt-1">إجمالي النواقص</div>
            </div>
            <div className="bg-[#f5f2ed] p-4 rounded-xl text-center">
              <div className="text-3xl font-extrabold text-[#8b6b4d]">{todayDeficitsCount}</div>
              <div className="text-xs text-gray-500 mt-1">نواقص اليوم</div>
            </div>
          </div>
        </div>

        {/* Awaiting Warehouse Receipt */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#8b6b4d] border-r-4 border-[#8b6b4d] pr-3 mb-3">🚚 بضائع معلقة بالمستودعات</h3>
            <div className="bg-amber-50/55 p-4 rounded-xl text-center border border-amber-200">
              <div className="text-3xl font-black text-amber-800">{unreceivedItemsFromApproved}</div>
              <div className="text-xs text-amber-700 font-bold mt-1">بند بانتظار الاستلام</div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 text-center font-bold">
              البنود المعتمدة من المدير التي لم يتم تأكيد استلامها صنف صنف في المستودعات بعد.
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Invoices and Pending Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time active deficits */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📋 النواقص النشطة (آخر 5 بنود)</h3>
            <div className="space-y-2.5">
              {activeItems.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">لا توجد نواقص نشطة حالياً</p>
              ) : (
                activeItems.slice(-5).map((item) => (
                  <div key={item.id} className="bg-gray-50 p-3 rounded-xl border-l-2 border-[#8b6b4d] text-sm">
                    <div className="flex justify-between items-center font-bold text-gray-800">
                      <span className="flex items-center gap-2">
                        <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold px-2 py-0.5 rounded-md text-xs">العدد: {item.company}</span>
                        <span className="font-semibold text-gray-800">{item.fixedName}</span>
                      </span>
                      <span className="text-[#8b6b4d] text-xs">📦 {item.warehouse}</span>
                    </div>
                    <div className="text-gray-500 text-xs mt-1 flex justify-between">
                      <span>
                        {item.description && item.description !== "-" && item.description}
                        {item.note && item.note !== "-" && ` | ${item.note}`}
                      </span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Merged Invoices for Manager */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">📨 الفواتير المدمجة بانتظار الاعتماد</h3>
          <div className="space-y-4 max-h-[350px] overflow-y-auto">
            {!isManager ? (
              <p className="text-gray-400 text-sm text-center py-6">خصائص دمج وإدارة الفواتير متاحة فقط للمدير</p>
            ) : (() => {
              const pendingFiltered = mergedInvoices.filter(m => {
                if (m.status !== "pending") return false;
                return true;
              });
              if (pendingFiltered.length === 0) {
                return (
                  <p className="text-gray-400 text-sm text-center py-6">
                    لا توجد فواتير مدمجة بانتظار المراجعة
                  </p>
                );
              }
              return [...pendingFiltered].sort(compareDatesDescending).map((inv) => (
                <div key={inv.id} className="bg-emerald-50/50 border-2 border-emerald-100 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1e2b3c]">📋 فاتورة مدمجة #{inv.invoiceNumber} - {inv.date}</span>
                    <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{inv.total} بند</span>
                  </div>
                  <p className="text-xs text-gray-500">🏷️ المخازن المساهمة: {inv.warehouses.join(" | ")}</p>
                  
                  {/* Nested item list preview */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto bg-white p-2.5 rounded-xl border border-gray-100">
                    {inv.items.map((item, iIndex) => (
                      <div key={item.id || iIndex} className="flex flex-col text-xs border-b border-gray-50 pb-2 pt-1 first:pt-0 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-700 flex items-center gap-2 font-bold text-sm">
                            <span className="text-gray-400 font-normal">{iIndex+1}.</span>
                            <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2.5 py-0.5 rounded-lg text-xs">العدد: {item.company}</span>
                            <span className="text-gray-800 font-extrabold">{item.fixedName}</span>
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{item.warehouse}</span>
                            {onDeleteMergedItem && (
                              <button
                                onClick={() => onDeleteMergedItem(mergedInvoices.indexOf(inv), iIndex)}
                                className="text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded cursor-pointer"
                                title="حذف البند"
                              >
                                🗑️
                              </button>
                            )}
                            {onEditMergedItem && (
                              <button
                                onClick={() => onEditMergedItem(mergedInvoices.indexOf(inv), iIndex, item)}
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
                            <span className="font-medium text-gray-700">{item.note}</span>
                          </div>
                        )}
                        {item.duplicateFrom && (
                          <div className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 p-2.5 rounded-lg mt-1.5 font-semibold flex flex-col gap-0.5 max-w-full">
                            <span className="flex items-center gap-1 text-amber-800">⚠️ تنبيه تكرار البند:</span>
                            <span className="text-gray-600 font-normal leading-relaxed text-right">
                              هذا الصنف أرسل مسبقاً من <strong className="text-amber-800 font-bold">({item.duplicateFrom})</strong>، وقام المستودع الحالي بإعادة إرساله مسبقاً مما تسبب في تكراره. يمكنك حذف أو تعديل أي منهما لتجنب التكرار.
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => onApproveMerged(mergedInvoices.indexOf(inv))}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      ✓ اعتماد الكل
                    </button>
                    <button
                      onClick={() => onPrintMergedNormal(mergedInvoices.indexOf(inv))}
                      className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      🖨️ طباعة
                    </button>
                    <button
                      onClick={() => onPrintMergedMatrix(mergedInvoices.indexOf(inv))}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      ⊞ طباعة مصفوفة
                    </button>
                    <button
                      onClick={() => onRejectMerged(mergedInvoices.indexOf(inv))}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      ✕ رفض الكل
                    </button>
                    <button
                      onClick={() => onDeleteMerged(mergedInvoices.indexOf(inv))}
                      className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold p-2 px-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      🗑️ حذف الفاتورة
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Approved Merged Invoices */}
      {(() => {
        const approvedFiltered = mergedInvoices.filter(m => {
          if (m.status !== "approved" && m.status !== "auto_approved") return false;
          if (!isToday(m.date)) return false;
          return true;
        });
        if (approvedFiltered.length === 0) return null;
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-emerald-800 border-r-4 border-emerald-600 pr-3 mb-4">✅ الفواتير المدمجة المعتمدة (المنجزة)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
              {[...approvedFiltered].sort(compareDatesDescending).map((inv) => (
                <div key={inv.id} className="bg-emerald-50/10 border border-emerald-100 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1e2b3c]">📋 فاتورة مدمجة #{inv.invoiceNumber} - {inv.date}</span>
                    <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{inv.total} بند | معتمدة</span>
                  </div>
                  <p className="text-xs text-gray-500">🏷️ المخازن المساهمة: {inv.warehouses.join(" | ")}</p>
                  
                  {/* Nested item list preview */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto bg-white p-2.5 rounded-xl border border-gray-100">
                    {inv.items.map((item, iIndex) => {
                      const isManager = currentUser.role === "مدير";
                      const canUpdateDelivery = !isManager && (currentUser.warehouse && (item.warehouse || "").trim().includes(currentUser.warehouse.trim()));
                      return (
                        <div key={item.id || iIndex} className="flex flex-col text-xs border-b border-gray-50 pb-2 pt-1 first:pt-0 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-gray-700 flex items-center gap-2 font-bold text-sm">
                              <span className="text-gray-400 font-normal">{iIndex+1}.</span>
                              <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2.5 py-0.5 rounded-lg text-xs">العدد: {item.company}</span>
                              <span className="text-gray-800 font-extrabold">{item.fixedName}</span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Delivery Status Controllers (The two requested squares) */}
                              <div className="flex items-center gap-1 mr-1">
                                {item.deliveryStatus === "received" ? (
                                  <div className="flex items-center gap-1">
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">🟢 تم الاستلام</span>
                                    {canUpdateDelivery && (
                                      <button
                                        onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "delayed")}
                                        className="text-xs text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                                        title="تراجع / تحديد كـ لم يصل"
                                      >
                                        🔄
                                      </button>
                                    )}
                                  </div>
                                ) : item.deliveryStatus === "delayed" ? (
                                  <div className="flex items-center gap-1">
                                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">🔴 لم يصل بعد</span>
                                    {canUpdateDelivery && (
                                      <button
                                        onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "received")}
                                        className="text-xs text-gray-400 hover:text-emerald-600 cursor-pointer p-0.5"
                                        title="تغيير إلى تم الاستلام"
                                      >
                                        🔄
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">⏳ بانتظار التأكيد</span>
                                    {canUpdateDelivery && (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "received")}
                                          className="w-5 h-5 flex items-center justify-center bg-emerald-100 hover:bg-emerald-600 hover:text-white text-emerald-800 rounded font-black cursor-pointer transition-all border border-emerald-300 text-[10px]"
                                          title="تم الاستلام ✅"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => onUpdateItemDeliveryStatus?.(inv.id, item.id, "delayed")}
                                          className="w-5 h-5 flex items-center justify-center bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-200 rounded font-black cursor-pointer transition-all text-[10px]"
                                          title="لم يصل بعد ❌"
                                        >
                                          ✖
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">{item.warehouse}</span>
                              {onDeleteMergedItem && (
                                <button
                                  onClick={() => onDeleteMergedItem(mergedInvoices.indexOf(inv), iIndex)}
                                  className="text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded cursor-pointer"
                                  title="حذف البند"
                                >
                                  🗑
                                </button>
                              )}
                              {onEditMergedItem && (
                                <button
                                  onClick={() => onEditMergedItem(mergedInvoices.indexOf(inv), iIndex, item)}
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
                              <span className="font-medium text-gray-700">{item.note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => onPrintMergedNormal(mergedInvoices.indexOf(inv))}
                      className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      🖨️ طباعة
                    </button>
                    <button
                      onClick={() => onPrintMergedMatrix(mergedInvoices.indexOf(inv))}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold p-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      ⊞ طباعة مصفوفة
                    </button>
                    <button
                      onClick={() => onDeleteMerged(mergedInvoices.indexOf(inv))}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold p-2 px-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      🗑️ حذف الفاتورة المعتمدة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Received and Delayed items sections */}
      {(() => {
        const approvedInvoices = mergedInvoices.filter(m => m.status === "approved" || m.status === "auto_approved");
        const allApprovedEntries: { item: Item; invoiceId: string; invoiceNumber: number; date: string }[] = [];
        
        approvedInvoices.forEach(inv => {
          inv.items.forEach(it => {
            allApprovedEntries.push({
              item: it,
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber,
              date: inv.date
            });
          });
        });

        const isManager = currentUser.role === "مدير";
        const filteredEntries = allApprovedEntries.filter(entry => 
          isManager || (currentUser.warehouse && (entry.item.warehouse || "").trim().includes(currentUser.warehouse.trim()))
        );

        const receivedEntries = filteredEntries.filter(entry => {
          if (entry.item.deliveryStatus !== "received") return false;
          if (!isToday(entry.date)) return false;
          if (isPost10PM) return false;
          return true;
        });

        const pendingEntries = filteredEntries.filter(entry => {
          if (entry.item.deliveryStatus === "received") return false;
          if (isManager) return true;
          if (!isToday(entry.date)) return false;
          if (isPost10PM) return false;
          return true;
        });

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6" dir="rtl">
            {/* Column 1: Received Items Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col">
              <h3 className="text-lg font-bold text-emerald-800 border-r-4 border-emerald-600 pr-3 mb-4 flex justify-between items-center">
                <span>📦 البنود المستلمة بنجاح ({receivedEntries.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const itemsToPrint = receivedEntries.map(entry => entry.item);
                      printInvoice(itemsToPrint, "بيان الأصناف المستلمة بنجاح", currentUser.warehouse || null, currentUser.displayName || currentUser.username);
                    }}
                    disabled={receivedEntries.length === 0}
                    className={`flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg font-extrabold transition-all border cursor-pointer ${
                      receivedEntries.length === 0
                        ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white"
                    }`}
                    title="طباعة بيان البنود المستلمة"
                  >
                    🖨️ طباعة البنود المستلمة
                  </button>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">المستلمة</span>
                </div>
              </h3>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {receivedEntries.length === 0 ? (
                  <p className="text-gray-400 text-center py-10 text-sm font-medium">لا توجد بنود مستلمة حالياً.</p>
                ) : (
                  receivedEntries.map((entry, index) => (
                    <div key={entry.item.id || index} className="p-3 bg-emerald-50/20 border border-emerald-100 rounded-xl flex justify-between items-center gap-4 hover:bg-emerald-50/40 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded-lg text-xs">العدد: {entry.item.company}</span>
                          <strong className="text-sm font-bold text-gray-800">{entry.item.fixedName}</strong>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span>📍 {entry.item.warehouse}</span>
                          <span>📋 فاتورة مدمجة #{entry.invoiceNumber}</span>
                          {entry.item.deliveredAt && <span>🕒 استلمت: {entry.item.deliveredAt}</span>}
                        </div>
                      </div>
                      
                      {/* Undo action button */}
                      {!isManager && (currentUser.warehouse && (entry.item.warehouse || "").trim().includes(currentUser.warehouse.trim())) && (
                        <button
                          onClick={() => onUpdateItemDeliveryStatus?.(entry.invoiceId, entry.item.id, "delayed")}
                          className="bg-gray-100 hover:bg-amber-100 text-gray-500 hover:text-amber-800 p-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="تراجع عن الاستلام"
                        >
                          🔄 تراجع
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Pending/Delayed Items Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col">
              <h3 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-3 mb-4 flex justify-between items-center">
                <span>⏳ البنود المعلقة والمتأخرة ({pendingEntries.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const itemsToPrint = pendingEntries.map(entry => entry.item);
                      printInvoice(itemsToPrint, "بيان الأصناف المعلقة والمتأخرة", currentUser.warehouse || null, currentUser.displayName || currentUser.username);
                    }}
                    disabled={pendingEntries.length === 0}
                    className={`flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg font-extrabold transition-all border cursor-pointer ${
                      pendingEntries.length === 0
                        ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed"
                        : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white"
                    }`}
                    title="طباعة بيان البنود المعلقة"
                  >
                    🖨️ طباعة البنود المعلقة
                  </button>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-bold">معلقة / لم تصل</span>
                </div>
              </h3>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {(() => {
                  const todayDate = getToday();
                  const rolloverableCount = pendingEntries.filter(entry => entry.date !== todayDate && !entry.item.rolledOver).length;
                  if (rolloverableCount > 0 && onRolloverUnreceivedItems) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 animate-pulse">
                        <div className="text-xs text-amber-900 font-bold">
                          ⚠️ يوجد عدد ({rolloverableCount}) من البنود لم تصل من أيام سابقة. هل ترغب في ترحيلها إلى الفاتورة المدمجة لليوم؟
                        </div>
                        <button
                          onClick={onRolloverUnreceivedItems}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
                        >
                          🔄 ترحيل النواقص لليوم
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {pendingEntries.length === 0 ? (
                  <p className="text-emerald-600 text-center py-10 text-sm font-bold bg-emerald-50/30 rounded-xl">🎉 جميع البنود تم استلامها بنجاح!</p>
                ) : (
                  pendingEntries.map((entry, index) => {
                    const isDelayed = entry.item.deliveryStatus === "delayed";
                    const isRolledOverItem = entry.item.isRollover;
                    const canUpdate = !isManager && (currentUser.warehouse && (entry.item.warehouse || "").trim().includes(currentUser.warehouse.trim()));
                    return (
                      <div key={entry.item.id || index} className={`p-3 border rounded-xl flex justify-between items-center gap-4 transition-all ${isDelayed ? "bg-red-50/10 border-red-200" : "bg-gray-50/30 border-gray-100 hover:bg-gray-50/60"}`}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-black px-2 py-0.5 rounded-lg text-xs ${isDelayed ? "bg-red-100 text-red-900" : "bg-gray-200 text-gray-800"}`}>العدد: {entry.item.company}</span>
                            <strong className="text-sm font-bold text-gray-800">{entry.item.fixedName}</strong>
                            {isDelayed && <span className="bg-red-100 text-red-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">لم تصل بعد ⚠️</span>}
                            {isRolledOverItem && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-black">
                                ⏳ طلب مسبق بتاريخ {entry.item.originalDate}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            <span>📍 {entry.item.warehouse}</span>
                            <span>📋 فاتورة مدمجة #{entry.invoiceNumber}</span>
                            <span>📅 تاريخ الطلب الحالي: {entry.date}</span>
                          </div>
                        </div>

                        {/* Interactive Controls (squares) */}
                        {canUpdate && (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => onUpdateItemDeliveryStatus?.(entry.invoiceId, entry.item.id, "received")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="تحديد كـ تم الاستلام"
                            >
                              ✓ استلام
                            </button>
                            {!isDelayed && (
                              <button
                                onClick={() => onUpdateItemDeliveryStatus?.(entry.invoiceId, entry.item.id, "delayed")}
                                className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
                                title="تحديد كـ لم يصل بعد"
                              >
                                ✖ لم تصل
                              </button>
                            )}
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

      {/* Row 3: Deleted Items */}
      <div className="grid grid-cols-1 gap-6">
        {/* Deleted Items (سلة المحذوفات) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3 mb-4">🗑️ المحذوفات مؤخراً</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {!isManager ? (
              <p className="text-gray-400 text-sm text-center py-6">سلة المحذوفات متاحة فقط للمدير لاستعادة أو حذف السجلات</p>
            ) : deletedItems.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">سلة المحذوفات فارغة</p>
            ) : (
              deletedItems.map((item) => (
                <div key={item.id} className="bg-red-50/40 border border-red-100 p-3 rounded-2xl flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">محذوف من: {item.deletedFrom || item.warehouse}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-red-100 text-red-700 font-black px-2.5 py-0.5 rounded-lg text-xs">العدد: {item.company}</span>
                      <span className="font-extrabold text-gray-800 text-sm">{item.fixedName}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">محذوف في: {item.deletedAt || item.date}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRestoreDeleted(item.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-2.5 rounded-xl transition-all cursor-pointer"
                      title="استعادة للفاتورة"
                    >
                      إرجاع
                    </button>
                    <button
                      onClick={() => onPermanentDelete(item.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-2 px-2.5 rounded-xl transition-all cursor-pointer"
                      title="حذف نهائي دون رجعة"
                    >
                      حذف نهائي
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chart container */}
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
  );
}
