import React, { useState, useMemo } from "react";
import { User, Item, MergedInvoice } from "../types";
import { printInvoice } from "../utils/print";
import { compareDatesDescending, parseArabicOrStandardDate, isWarehouseMatch } from "../utils/date";

interface UnreceivedItemsProps {
  currentUser: User;
  mergedInvoices: MergedInvoice[];
  warehouseFilter: string | null; // Null means manager (all), non-null means a specific warehouse
  onUpdateItemDeliveryStatus?: (invoiceId: string, itemId: string, status: "received" | "delayed") => void;
  onResendUnreceivedItems?: (itemsToResend: Item[], defaultWhName?: string) => void;
  onDeleteMergedInvoice?: (invoiceId: string) => void;
  onDeleteMergedItem?: (invoiceId: string, itemId: string) => void;
  onEditMergedItem?: (invoiceId: string, item: Item) => void;
  onAddItemToApprovedInvoice?: (invoiceId: string, itemData: any) => void;
}

export default function UnreceivedItems({
  currentUser,
  mergedInvoices,
  warehouseFilter,
  onUpdateItemDeliveryStatus,
  onResendUnreceivedItems,
  onDeleteMergedInvoice,
  onDeleteMergedItem,
  onEditMergedItem,
  onAddItemToApprovedInvoice
}: UnreceivedItemsProps) {
  // Filter state
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouseFilter || "all");
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "today" | "week" | "month" | "specific">("all");
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Add Item Modal state
  const [addItemModalInvoiceId, setAddItemModalInvoiceId] = useState<string | null>(null);
  const [modalWarehouse, setModalWarehouse] = useState("مخزن النحاس");
  const [modalCustomWarehouse, setModalCustomWarehouse] = useState("");
  const [modalQty, setModalQty] = useState("");
  const [modalFixed, setModalFixed] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalNote, setModalNote] = useState("");

  const isManager = currentUser.role === "مدير";

  // Grouping by Date and Invoice interface
  interface InvoiceGroup {
    id: string;
    invoiceNumber: number;
    date: string;
    time: string;
    items: Item[];
    warehouses: string[];
    recorder: string;
  }

  // Extract all approved invoices
  const approvedInvoices = useMemo(() => {
    return mergedInvoices.filter(
      (m) => m.status === "approved" || m.status === "auto_approved"
    );
  }, [mergedInvoices]);

  // Extract list of all unique warehouses and dates for dropdown options
  const { allWarehouses, allDates } = useMemo(() => {
    const whSet = new Set<string>();
    const dateSet = new Set<string>();

    approvedInvoices.forEach((inv) => {
      if (inv.date) dateSet.add(inv.date.trim());
      inv.items.forEach((item) => {
        if (item.warehouse && item.warehouse.trim()) {
          whSet.add(item.warehouse.trim());
        }
      });
    });

    return {
      allWarehouses: Array.from(whSet).sort(),
      allDates: Array.from(dateSet).sort((a, b) => {
        const dA = parseArabicOrStandardDate(a);
        const dB = parseArabicOrStandardDate(b);
        return dB.getTime() - dA.getTime();
      })
    };
  }, [approvedInvoices]);

  // Today reference date for relative filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Process and filter groups
  const groups: InvoiceGroup[] = useMemo(() => {
    const result: InvoiceGroup[] = [];

    approvedInvoices.forEach((inv) => {
      // 1. Date Filtering
      const invDateObj = parseArabicOrStandardDate(inv.date);
      const invTime = invDateObj.getTime();

      if (dateFilterMode === "today") {
        if (invTime < todayStart || invTime >= todayStart + oneDayMs) {
          return;
        }
      } else if (dateFilterMode === "week") {
        if (invTime < todayStart - 7 * oneDayMs) {
          return;
        }
      } else if (dateFilterMode === "month") {
        if (invTime < todayStart - 30 * oneDayMs) {
          return;
        }
      } else if (dateFilterMode === "specific") {
        if (selectedSpecificDate && inv.date.trim() !== selectedSpecificDate.trim()) {
          return;
        }
        if (customStartDate) {
          const startObj = new Date(customStartDate).setHours(0, 0, 0, 0);
          if (invTime < startObj) return;
        }
        if (customEndDate) {
          const endObj = new Date(customEndDate).setHours(23, 59, 59, 999);
          if (invTime > endObj) return;
        }
      }

      // 2. Filter items in this invoice
      const effectiveWh = warehouseFilter || (selectedWarehouse !== "all" ? selectedWarehouse : null);

      const unreceivedItems = inv.items.filter((item) => {
        // Hide items that have already been resent to manager
        if (item.resent) return false;

        // Warehouse filter
        if (effectiveWh && !isWarehouseMatch(effectiveWh, item.warehouse)) {
          return false;
        }

        // Search query filter (item name, description, note, or invoice number)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = (item.fixedName || "").toLowerCase().includes(q);
          const matchesDesc = (item.description || "").toLowerCase().includes(q);
          const matchesNote = (item.note || "").toLowerCase().includes(q);
          const matchesWh = (item.warehouse || "").toLowerCase().includes(q);
          const matchesInv = String(inv.invoiceNumber).includes(q);
          if (!matchesName && !matchesDesc && !matchesNote && !matchesWh && !matchesInv) {
            return false;
          }
        }

        const isReceived = item.deliveryStatus === "received";
        const isPartialWithRemaining = item.hasPartialReceipt && item.remainingQty && item.remainingQty !== "0";

        return !isReceived || isPartialWithRemaining;
      });

      if (unreceivedItems.length > 0) {
        result.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          time: inv.time,
          items: unreceivedItems,
          warehouses: Array.from(new Set(unreceivedItems.map((it) => it.warehouse || ""))),
          recorder: inv.status === "auto_approved" ? "نظام الترحيل التلقائي" : "المدير"
        });
      }
    });

    // Sort groups by date descending, then invoice number descending
    result.sort((a, b) => {
      const cmp = compareDatesDescending(a, b);
      if (cmp !== 0) return cmp;
      return b.invoiceNumber - a.invoiceNumber;
    });

    return result;
  }, [
    approvedInvoices,
    dateFilterMode,
    selectedSpecificDate,
    customStartDate,
    customEndDate,
    warehouseFilter,
    selectedWarehouse,
    searchQuery,
    todayStart
  ]);

  // Overall statistics
  const totalUnreceivedItemsCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.items.length, 0);
  }, [groups]);

  const totalUnreceivedQuantitySum = useMemo(() => {
    return groups.reduce((acc, g) => {
      return acc + g.items.reduce((sum, it) => {
        const q = it.hasPartialReceipt && it.remainingQty ? parseFloat(it.remainingQty) : parseFloat(it.company || "1");
        return sum + (isNaN(q) ? 1 : q);
      }, 0);
    }, 0);
  }, [groups]);

  // Track expanded groups
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    const newExpanded: { [key: string]: boolean } = {};
    groups.forEach((g) => {
      newExpanded[g.id] = true;
    });
    setExpandedGroups(newExpanded);
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  const resetFilters = () => {
    setSelectedWarehouse(warehouseFilter || "all");
    setDateFilterMode("all");
    setSelectedSpecificDate("");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchQuery("");
  };

  const isFilterActive =
    (selectedWarehouse !== "all" && !warehouseFilter) ||
    dateFilterMode !== "all" ||
    selectedSpecificDate !== "" ||
    customStartDate !== "" ||
    customEndDate !== "" ||
    searchQuery.trim() !== "";

  const handlePrintGroup = (group: InvoiceGroup) => {
    const effectiveWh = warehouseFilter || (selectedWarehouse !== "all" ? selectedWarehouse : null);
    const title = effectiveWh 
      ? `النواقص غير المستلمة - ${effectiveWh} (${group.date})`
      : `النواقص غير المستلمة - جميع المخازن (${group.date})`;
    printInvoice(group.items, title, effectiveWh, currentUser.displayName || currentUser.username);
  };

  const handlePrintAllFiltered = () => {
    const allFilteredItems = groups.flatMap((g) => g.items);
    if (allFilteredItems.length === 0) {
      alert("⚠️ لا توجد بنود مطابقة للطباعة");
      return;
    }
    const effectiveWh = warehouseFilter || (selectedWarehouse !== "all" ? selectedWarehouse : null);
    const title = effectiveWh 
      ? `تقرير النواقص غير المستلمة المفلترة - ${effectiveWh}`
      : "تقرير النواقص غير المستلمة المفلترة - جميع المخازن";
    printInvoice(allFilteredItems, title, effectiveWh, currentUser.displayName || currentUser.username);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header section */}
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white border-r-4 border-red-500 pr-3">
            ⚠️ {warehouseFilter ? `البنود غير المستلمة بمستودع (${warehouseFilter})` : "جمع البنود غير المستلمة من جميع المستودعات"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {warehouseFilter 
              ? "تعرض هنا جميع الأصناف التي اعتمدها المدير ولم يتم استلامها في مخزنك بعد، مرتبة بالتواريخ اليومية والكميات المتبقية."
              : "تجميعة ذكية وحصرية للمدير تعرض كافة الأصناف والكميات المعلقة أو المستلمة جزئياً بكل المستودعات لكل يوم على حدة."
            }
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-extrabold text-xs p-2.5 px-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-1.5">
            <span>📋 الفواتير:</span>
            <span className="text-sm font-black">{groups.length}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-extrabold text-xs p-2.5 px-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-1.5">
            <span>📦 البنود المعلقة:</span>
            <span className="text-sm font-black">{totalUnreceivedItemsCount}</span>
          </div>
          <div className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-extrabold text-xs p-2.5 px-4 rounded-xl border border-[#8b6b4d]/20 flex items-center gap-1.5">
            <span>🔢 إجمالي الكميات:</span>
            <span className="text-sm font-black">{totalUnreceivedQuantitySum}</span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
            <span>🔍 أدوات التصفية والفلترة الذكية</span>
            {isFilterActive && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                فلترة نشطة
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 p-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                🔄 إلغاء التصفية
              </button>
            )}
            <button
              onClick={expandAll}
              className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 px-2.5 rounded-lg transition-all cursor-pointer"
            >
              ➕ توسيع الكل
            </button>
            <button
              onClick={collapseAll}
              className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 px-2.5 rounded-lg transition-all cursor-pointer"
            >
              ➖ طي الكل
            </button>
            {groups.length > 0 && (
              <button
                onClick={handlePrintAllFiltered}
                className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                🖨️ طباعة المفلتر
              </button>
            )}
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Filter by Warehouse */}
          {!warehouseFilter ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                🏢 تصفية حسب المخزن:
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d] transition-all"
              >
                <option value="all">📍 جميع المخازن ({allWarehouses.length})</option>
                {allWarehouses.map((wh) => (
                  <option key={wh} value={wh}>
                    {wh}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                🏢 المخزن المعروض:
              </label>
              <div className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-[#8b6b4d]">
                📍 {warehouseFilter} (المخزن الحالي)
              </div>
            </div>
          )}

          {/* 2. Filter by Order Date Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              📅 نطاق تاريخ الطلب:
            </label>
            <select
              value={dateFilterMode}
              onChange={(e) => {
                const mode = e.target.value as any;
                setDateFilterMode(mode);
                if (mode !== "specific") {
                  setSelectedSpecificDate("");
                  setCustomStartDate("");
                  setCustomEndDate("");
                }
              }}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d] transition-all"
            >
              <option value="all">🗓️ جميع التواريخ</option>
              <option value="today">⚡ طلبات اليوم فقط</option>
              <option value="week">⏳ آخر 7 أيام</option>
              <option value="month">📆 آخر 30 يوماً</option>
              <option value="specific">🎯 اختيار تاريخ محدد / مخصص</option>
            </select>
          </div>

          {/* 3. Specific Date Dropdown / Inputs (visible when specific mode is chosen) */}
          {dateFilterMode === "specific" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                🎯 اختر تاريخ الطلب:
              </label>
              {allDates.length > 0 ? (
                <select
                  value={selectedSpecificDate}
                  onChange={(e) => setSelectedSpecificDate(e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d] transition-all"
                >
                  <option value="">-- اختر من تواريخ الفواتير الموجودة --</option>
                  {allDates.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d]"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                🔎 بحث بالاسم أو الملاحظة:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن صنف، مخزن، أو بيان..."
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d]"
              />
            </div>
          )}

          {/* 4. Search input (or custom date range if specific date mode is on) */}
          {dateFilterMode === "specific" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                🔎 بحث بالاسم أو الملاحظة:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن صنف، مخزن، أو بيان..."
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-[#8b6b4d]"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
            <span className="text-5xl block mb-3">
              {isFilterActive ? "🔍" : "🎉"}
            </span>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">
              {isFilterActive ? "لا توجد نتائج مطابقة لخيارات الفلترة الحالية" : "ممتاز! لا توجد بنود غير مستلمة"}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {isFilterActive 
                ? "جرب تغيير تاريخ الطلب، المخزن، أو مسح نص البحث لعرض بيانات أخرى."
                : "تم استلام كافة البضائع والأصناف المعتمدة بنجاح تام."}
            </p>
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="mt-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer"
              >
                🔄 إعادة تعيين جميع الفلاتر
              </button>
            )}
          </div>
        ) : (
          groups.map((group, gIdx) => {
            const isExpanded = !!expandedGroups[group.id];
            return (
              <div 
                key={`${group.id}-${gIdx}`} 
                className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Group Header Info */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-extrabold text-[11px] p-1 px-2.5 rounded-full">
                        📋 فاتورة مدمجة #{group.invoiceNumber}
                      </span>
                      <strong className="text-sm md:text-base text-gray-800 dark:text-white">
                        بيان يوم: {group.date}
                      </strong>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>تاريخ الحفظ: {group.date} {group.time && `| ${group.time}`}</span>
                      <span>المخزن: {warehouseFilter || (selectedWarehouse !== "all" ? selectedWarehouse : "جميع المخازن")}</span>
                      <span>المسجل: {group.recorder}</span>
                      <span className="font-bold text-[#8b6b4d]">عدد البنود المتبقية: {group.items.length}</span>
                    </div>
                    {!warehouseFilter && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {group.warehouses.map((wh, idx) => (
                          <span 
                            key={idx} 
                            className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold text-[10px] p-0.5 px-2 rounded-md"
                          >
                            📍 {wh}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    {isManager && onAddItemToApprovedInvoice && (
                      <button
                        onClick={() => {
                          setAddItemModalInvoiceId(group.id);
                          setModalWarehouse(group.warehouses[0] || "مخزن النحاس");
                          setModalQty("");
                          setModalFixed("");
                          setModalDesc("");
                          setModalNote("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2.5 px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                        title="إضافة بند جديد إلى هذه الفاتورة المدمجة"
                      >
                        ➕ إضافة صنف
                      </button>
                    )}
                    {isManager && onDeleteMergedInvoice && (
                      <button
                        onClick={() => onDeleteMergedInvoice(group.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold p-2.5 px-3 rounded-xl cursor-pointer transition-all flex items-center gap-1 border border-red-200"
                        title="حذف الفاتورة المدمجة بالكامل ونقلها لسلة المحذوفات"
                      >
                        🗑️ حذف الفاتورة
                      </button>
                    )}
                    {onResendUnreceivedItems && (
                      <button
                        onClick={() => onResendUnreceivedItems(group.items, group.warehouses[0])}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                        title="إعادة إرسال كافة الأصناف غير المستلمة في هذا البيان إلى الفاتورة المدمجة للمدير اليوم"
                      >
                        🔄 إعادة إرسال المدمجة للمدير
                      </button>
                    )}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      👁️ {isExpanded ? "إخفاء البنود" : "عرض البنود"}
                    </button>
                    <button
                      onClick={() => handlePrintGroup(group)}
                      className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      🖨️ طباعة
                    </button>
                  </div>
                </div>

                {/* Table of items (visible only when expanded) */}
                {isExpanded && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 overflow-x-auto rounded-xl">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800">
                          <th className="p-3 w-10 text-center">#</th>
                          <th className="p-3 w-28 text-center">متبقي (الكمية غير المستلمة)</th>
                          <th className="p-3">اسم الصنف والبيان</th>
                          {!warehouseFilter && <th className="p-3 w-40">المستودع المعني</th>}
                          <th className="p-3 w-32 text-center">حالة الاستلام الحالية</th>
                          {isManager && <th className="p-3 w-28 text-center">إجراءات المدير</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {group.items.map((item, itemIdx) => {
                          const isPartial = item.hasPartialReceipt;
                          const qtyDisplay = isPartial ? (
                            <div className="text-center font-black text-red-600 dark:text-red-400">
                              {item.remainingQty} <span className="text-[10px] text-gray-400 font-normal block">(متبقي من مطلوب {item.originalQty || item.company})</span>
                            </div>
                          ) : (
                            <div className="text-center font-black text-amber-600 dark:text-amber-500">
                              {item.company}
                            </div>
                          );

                          return (
                            <tr 
                              key={`${group.id}-${item.id || itemIdx}-${itemIdx}`} 
                              className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all"
                            >
                              <td className="p-3 text-center font-bold text-gray-400">{itemIdx + 1}</td>
                              <td className="p-3 font-semibold">{qtyDisplay}</td>
                              <td className="p-3">
                                <div className="font-extrabold text-gray-800 dark:text-gray-200 text-sm">
                                  {item.fixedName}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {item.description && item.description !== "-" && <span>{item.description}</span>}
                                  {(() => {
                                    const cleanNote = (item.note || "")
                                      .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
                                      .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
                                      .replace(/[\(（]?\s*لم تصل[^\)）]*[\)）]?/g, "")
                                      .trim();
                                    return cleanNote && cleanNote !== "-" ? <span className="mr-2">📝 ملاحظة: {cleanNote}</span> : null;
                                  })()}
                                </div>
                              </td>
                              {!warehouseFilter && (
                                <td className="p-3">
                                  <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold p-1 px-2.5 rounded-full text-[10px]">
                                    {item.warehouse}
                                  </span>
                                </td>
                              )}
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  {isPartial ? (
                                    <span className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-red-200 dark:border-red-900/30">
                                      🔴 مستلم جزئياً (مستلم: {item.receivedQty})
                                    </span>
                                  ) : (item.deliveryStatus === "delayed" || item.isNotArrived) ? (
                                    <span className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-red-200 dark:border-red-900/30">
                                      🔴 لم يصل
                                    </span>
                                  ) : (
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                      ⏳ بانتظار الاستلام
                                    </span>
                                  )}

                                  {/* Receipt Controllers */}
                                  <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                                    {onUpdateItemDeliveryStatus && (
                                      <>
                                        <button
                                          onClick={() => onUpdateItemDeliveryStatus(group.id, item.id, "received")}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                          title="تعديل العدد وتأكيد الاستلام"
                                        >
                                          ✓ استلام
                                        </button>
                                        {item.deliveryStatus !== "delayed" && (
                                          <button
                                            onClick={() => onUpdateItemDeliveryStatus(group.id, item.id, "delayed")}
                                            className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                            title="تحديد كـ لم يصل بعد"
                                          >
                                            ✖ لم تصل
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {item.resent ? (
                                      <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-purple-200 dark:border-purple-800">
                                        🔄 تم إعادة الإرسال للمدير {item.resentToDate && `(${item.resentToDate})`}
                                      </span>
                                    ) : onResendUnreceivedItems ? (
                                      <button
                                        onClick={() => onResendUnreceivedItems([item], item.warehouse)}
                                        className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="إعادة إرسال هذا البند فقط إلى الفاتورة المدمجة للمدير لليوم"
                                      >
                                        🔄 إعادة إرسال للمدير
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              {isManager && (
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {onEditMergedItem && (
                                      <button
                                        onClick={() => onEditMergedItem(group.id, item)}
                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-amber-200"
                                        title="تعديل هذا البند"
                                      >
                                        ✏️ تعديل
                                      </button>
                                    )}
                                    {onDeleteMergedItem && (
                                      <button
                                        onClick={() => onDeleteMergedItem(group.id, item.id)}
                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all cursor-pointer border border-red-200"
                                        title="حذف هذا البند"
                                      >
                                        🗑️ حذف
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Item to Merged Invoice Modal */}
      {addItemModalInvoiceId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[11500] p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#d4b48c]/20 text-right animate-fade-in" dir="rtl">
            <h3 className="text-lg font-bold text-[#8b6b4d] border-b pb-3 mb-4 flex items-center gap-2">
              <span>➕ إضافة صنف جديد للفاتورة المدمجة</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🏢 المستودع المعني:</label>
                <select
                  value={modalWarehouse}
                  onChange={(e) => setModalWarehouse(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#8b6b4d]"
                >
                  <option value="مخزن النحاس">مخزن النحاس</option>
                  <option value="مخزن النادي">مخزن النادي</option>
                  <option value="مخزن المدير">مخزن المدير</option>
                  <option value="custom">مخزن آخر (إدخال يدوي)...</option>
                </select>
                {modalWarehouse === "custom" && (
                  <input
                    type="text"
                    placeholder="اكتب اسم المخزن هنا"
                    value={modalCustomWarehouse}
                    onChange={(e) => setModalCustomWarehouse(e.target.value)}
                    className="w-full mt-2 p-2.5 bg-white border border-[#8b6b4d] rounded-xl text-sm font-bold"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🔢 الكمية / العدد: <span className="text-gray-400 font-normal text-[11px]">(اختياري)</span></label>
                <input
                  type="text"
                  placeholder="مثال: 10، 5 كرتونة (أو اتركه فارغاً)"
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#8b6b4d]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">📝 اسم الصنف:</label>
                <input
                  type="text"
                  placeholder="مثال: حبر طابعة، ورق A4"
                  value={modalFixed}
                  onChange={(e) => setModalFixed(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#8b6b4d]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ℹ️ تفاصيل إضافية (اختياري):</label>
                <input
                  type="text"
                  placeholder="التفاصيل والمواصفات"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">💬 ملاحظة خاصة (اختياري):</label>
                <input
                  type="text"
                  placeholder="ملاحظات"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#8b6b4d]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  const finalWh = modalWarehouse === "custom" ? modalCustomWarehouse.trim() : modalWarehouse;
                  if (!finalWh || !modalFixed.trim()) {
                    alert("⚠️ يرجى تحديد المخزن وإدخال اسم الصنف!");
                    return;
                  }
                  if (onAddItemToApprovedInvoice && addItemModalInvoiceId) {
                    await onAddItemToApprovedInvoice(addItemModalInvoiceId, {
                      warehouse: finalWh,
                      company: modalQty.trim() || "-",
                      fixedName: modalFixed.trim(),
                      description: modalDesc.trim() || "-",
                      note: modalNote.trim()
                    });
                  }
                  setAddItemModalInvoiceId(null);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                💾 إضافة الصنف للفاتورة
              </button>
              <button
                onClick={() => setAddItemModalInvoiceId(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

