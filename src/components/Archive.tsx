import React, { useState, useMemo } from "react";
import { User, Archive, SavedItem, Item } from "../types";
import { printInvoice, printMatrix } from "../utils/print";
import { exportExcel } from "../utils/export";
import { compareDatesDescending, parseArabicOrStandardDate } from "../utils/date";
import PrintMatrixFilterModal from "./PrintMatrixFilterModal";

interface ArchiveProps {
  currentUser: User;
  archives: Archive[];
  savedItems: SavedItem[];
  onDeleteArchive: (id: string) => void;
  onDeleteItemFromArchive: (archiveId: string, itemIndex: number) => void;
  onEditItemInArchive?: (archiveId: string, itemIndex: number, updatedFields: any) => void;
  onAddItemToArchive: (archiveId: string, item: any) => void;
  onViewDetails: (
    title: string,
    items: any[],
    onDeleteItem?: (index: number) => void,
    onEditItem?: (index: number, updatedItem: any) => void
  ) => void;
  onUpdateArchive?: (updatedArchive: Archive) => void;
}

export function getArchiveDeliveryStatus(arch: Archive): {
  status: "completed" | "partial" | "delayed" | "pending";
  label: string;
  badgeClass: string;
  receivedCount: number;
  partialCount: number;
  delayedCount: number;
  pendingCount: number;
  totalCount: number;
} {
  const totalCount = arch.items?.length || 0;
  if (totalCount === 0) {
    return {
      status: "completed",
      label: "فارغة",
      badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
      receivedCount: 0,
      partialCount: 0,
      delayedCount: 0,
      pendingCount: 0,
      totalCount: 0
    };
  }

  let receivedCount = 0;
  let partialCount = 0;
  let delayedCount = 0;
  let pendingCount = 0;

  arch.items.forEach(it => {
    const isPartial = it.hasPartialReceipt || Boolean(it.receivedQty && it.receivedQty !== "0" && it.remainingQty && it.remainingQty !== "0");
    const isDelayed = it.isNotArrived || it.deliveryStatus === "delayed" || (it.note && (it.note.includes("لم يصل") || it.note.includes("لم تصل")));
    const isReceived = it.deliveryStatus === "received" && !isPartial;

    if (isPartial) {
      partialCount++;
    } else if (isDelayed) {
      delayedCount++;
    } else if (isReceived) {
      receivedCount++;
    } else {
      pendingCount++;
    }
  });

  if (receivedCount === totalCount) {
    return {
      status: "completed",
      label: "✅ مكتملة الاستلام بالكامل",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      receivedCount,
      partialCount,
      delayedCount,
      pendingCount,
      totalCount
    };
  }
  if (partialCount > 0) {
    return {
      status: "partial",
      label: `🟡 استلام جزئي (${receivedCount}/${totalCount} مستلم)`,
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      receivedCount,
      partialCount,
      delayedCount,
      pendingCount,
      totalCount
    };
  }
  if (delayedCount > 0) {
    return {
      status: "delayed",
      label: `🚨 بها بنود لم تصل (${delayedCount})`,
      badgeClass: "bg-red-100 text-red-800 border-red-300",
      receivedCount,
      partialCount,
      delayedCount,
      pendingCount,
      totalCount
    };
  }
  if (receivedCount > 0) {
    return {
      status: "partial",
      label: `🟡 استلام جزئي (${receivedCount}/${totalCount})`,
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      receivedCount,
      partialCount,
      delayedCount,
      pendingCount,
      totalCount
    };
  }

  return {
    status: "pending",
    label: "⏳ بانتظار الاستلام",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    receivedCount,
    partialCount,
    delayedCount,
    pendingCount,
    totalCount
  };
}

export default function ArchiveComponent({
  currentUser,
  archives,
  savedItems,
  onDeleteArchive,
  onDeleteItemFromArchive,
  onEditItemInArchive,
  onAddItemToArchive,
  onViewDetails,
  onUpdateArchive
}: ArchiveProps) {
  // Filter states
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "partial" | "delayed" | "pending">("all");
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "today" | "week" | "month" | "specific" | "range">("all");
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editingArchive, setEditingArchive] = useState<Archive | null>(null);
  const [matrixModalData, setMatrixModalData] = useState<{ items: Item[]; title: string; defaultWarehouse?: string } | null>(null);
  const [addWarehouse, setAddWarehouse] = useState("مخزن النحاس");
  const [customWarehouse, setCustomWarehouse] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addFixed, setAddFixed] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addNote, setAddNote] = useState("");

  const isManager = currentUser.role === "مدير";

  // Available warehouses list for dropdown
  const defaultWarehouses = ["مخزن النحاس", "مخزن النادي", "مخزن المدير"];
  const dynamicWarehouses = Array.from(new Set([
    ...defaultWarehouses,
    ...archives.map(a => a.warehouse).filter(Boolean),
    ...archives.flatMap(a => a.warehouses || []).filter(Boolean),
    ...archives.flatMap(a => a.items.map(i => i.warehouse)).filter(Boolean)
  ])).filter(w => w !== "جميع المخازن" && w !== "غير محدد");

  // Available unique dates in archives
  const uniqueDates = useMemo(() => {
    const dSet = new Set<string>();
    archives.forEach(a => {
      if (a.date) dSet.add(a.date.trim());
    });
    return Array.from(dSet).sort((a, b) => {
      const dA = parseArabicOrStandardDate(a);
      const dB = parseArabicOrStandardDate(b);
      return dB.getTime() - dA.getTime();
    });
  }, [archives]);

  // Today reference date for relative filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Filter logic
  const filteredArchives = useMemo(() => {
    return archives.filter(arch => {
      // 1. Search filter
      const matchesSearch = searchText.trim() === "" || 
        arch.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        arch.warehouse?.toLowerCase().includes(searchText.toLowerCase()) ||
        arch.user?.toLowerCase().includes(searchText.toLowerCase()) ||
        String(arch.invoiceNumber || "").includes(searchText.trim()) ||
        arch.items?.some(item =>
          item.company?.toLowerCase().includes(searchText.toLowerCase()) ||
          item.fixedName?.toLowerCase().includes(searchText.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchText.toLowerCase()) ||
          item.note?.toLowerCase().includes(searchText.toLowerCase())
        );

      if (!matchesSearch) return false;

      // 2. Warehouse filter
      if (warehouseFilter !== "") {
        const matchesWarehouse = 
          arch.warehouse === warehouseFilter ||
          (arch.merged && arch.warehouses?.some(w => w.includes(warehouseFilter))) ||
          arch.items?.some(i => (i.warehouse || "").includes(warehouseFilter));
        if (!matchesWarehouse) return false;
      }

      // 3. Status filter (completed / partial / delayed / pending)
      const deliveryInfo = getArchiveDeliveryStatus(arch);
      if (statusFilter !== "all") {
        if (statusFilter === "completed" && deliveryInfo.status !== "completed") return false;
        if (statusFilter === "partial" && deliveryInfo.status !== "partial") return false;
        if (statusFilter === "delayed" && deliveryInfo.status !== "delayed") return false;
        if (statusFilter === "pending" && deliveryInfo.status !== "pending") return false;
      }

      // 4. Date filtering
      const invDateObj = parseArabicOrStandardDate(arch.date);
      const invTime = invDateObj.getTime();

      if (dateFilterMode === "today") {
        if (invTime < todayStart || invTime >= todayStart + oneDayMs) {
          return false;
        }
      } else if (dateFilterMode === "week") {
        if (invTime < todayStart - 7 * oneDayMs) {
          return false;
        }
      } else if (dateFilterMode === "month") {
        if (invTime < todayStart - 30 * oneDayMs) {
          return false;
        }
      } else if (dateFilterMode === "specific") {
        if (selectedSpecificDate && arch.date?.trim() !== selectedSpecificDate.trim()) {
          return false;
        }
      } else if (dateFilterMode === "range") {
        if (customStartDate) {
          const startObj = new Date(customStartDate).setHours(0, 0, 0, 0);
          if (invTime < startObj) return false;
        }
        if (customEndDate) {
          const endObj = new Date(customEndDate).setHours(23, 59, 59, 999);
          if (invTime > endObj) return false;
        }
      }

      return true;
    }).sort(compareDatesDescending);
  }, [
    archives,
    searchText,
    warehouseFilter,
    statusFilter,
    dateFilterMode,
    selectedSpecificDate,
    customStartDate,
    customEndDate,
    todayStart
  ]);

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchText("");
    setWarehouseFilter("");
    setStatusFilter("all");
    setDateFilterMode("all");
    setSelectedSpecificDate("");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const isFiltered = searchText || warehouseFilter || statusFilter !== "all" || dateFilterMode !== "all" || selectedSpecificDate || customStartDate || customEndDate;

  // Stats summaries
  const statusStats = useMemo(() => {
    let completed = 0;
    let partial = 0;
    let delayed = 0;
    let pending = 0;

    archives.forEach(arch => {
      const st = getArchiveDeliveryStatus(arch).status;
      if (st === "completed") completed++;
      else if (st === "partial") partial++;
      else if (st === "delayed") delayed++;
      else if (st === "pending") pending++;
    });

    return { total: archives.length, completed, partial, delayed, pending };
  }, [archives]);

  const handleExportAll = () => {
    const allItems: any[] = [];
    filteredArchives.forEach(arch => {
      arch.items.forEach(item => {
        allItems.push({
          ...item,
          archiveDate: arch.date,
          archiveTitle: arch.title,
          invoiceNumber: arch.invoiceNumber || "-"
        });
      });
    });

    if (allItems.length === 0) {
      alert("⚠️ لا يوجد أرشيف للتصدير!");
      return;
    }
    exportExcel(allItems, "الأرشيف_المفلتر");
  };

  const handleAddSubmit = (archiveId: string) => {
    const selectedWh = addWarehouse === "CUSTOM_WAREHOUSE" ? customWarehouse.trim() : addWarehouse.trim();
    if (!selectedWh) {
      alert("⚠️ يرجى اختيار أو إدخال اسم المخزن!");
      return;
    }
    if (!addQty.trim()) {
      alert("⚠️ يرجى إدخال العدد أو الكمية!");
      return;
    }
    if (!addFixed.trim()) {
      alert("⚠️ يرجى إدخال اسم الصنف!");
      return;
    }

    onAddItemToArchive(archiveId, {
      warehouse: selectedWh,
      company: addQty.trim(),
      fixedName: addFixed.trim(),
      description: addDesc.trim() || "-",
      note: addNote.trim(),
    });

    setAddQty("");
    setAddFixed("");
    setAddDesc("");
    setAddNote("");
    setCustomWarehouse("");
    setShowEditModal(null);
    alert("✅ تم إضافة الصنف بنجاح إلى الفاتورة المؤرشفة!");
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📦 الأرشيف العام - الفواتير المعتمدة</h2>
          <p className="text-xs text-gray-400 mt-1">تصفح وفلترة فواتير وبيانات النواقص المعتمدة بدقة وسهولة</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {archives.length > 0 && (
            <button
              onClick={handleExportAll}
              className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
            >
              📥 تصدير السجلات المحددة ({filteredArchives.length})
            </button>
          )}
        </div>
      </div>

      {/* Quick Summary Badges / Counter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
            statusFilter === "all" ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
          }`}
        >
          <div className="text-xs font-bold">جميع الفواتير</div>
          <div className="text-lg font-extrabold mt-0.5">{statusStats.total}</div>
        </button>

        <button
          onClick={() => setStatusFilter("completed")}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
            statusFilter === "completed" ? "bg-emerald-700 text-white border-emerald-700 shadow-sm" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
          }`}
        >
          <div className="text-xs font-bold">✅ مكتملة بالكامل</div>
          <div className="text-lg font-extrabold mt-0.5">{statusStats.completed}</div>
        </button>

        <button
          onClick={() => setStatusFilter("partial")}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
            statusFilter === "partial" ? "bg-amber-700 text-white border-amber-700 shadow-sm" : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
          }`}
        >
          <div className="text-xs font-bold">🟡 استلام جزئي</div>
          <div className="text-lg font-extrabold mt-0.5">{statusStats.partial}</div>
        </button>

        <button
          onClick={() => setStatusFilter("delayed")}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
            statusFilter === "delayed" ? "bg-red-700 text-white border-red-700 shadow-sm" : "bg-red-50 hover:bg-red-100 text-red-800 border-red-200"
          }`}
        >
          <div className="text-xs font-bold">🚨 بها لم يصل</div>
          <div className="text-lg font-extrabold mt-0.5">{statusStats.delayed}</div>
        </button>

        <button
          onClick={() => setStatusFilter("pending")}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === "pending" ? "bg-blue-700 text-white border-blue-700 shadow-sm" : "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200"
          }`}
        >
          <div className="text-xs font-bold">⏳ بانتظار الاستلام</div>
          <div className="text-lg font-extrabold mt-0.5">{statusStats.pending}</div>
        </button>
      </div>

      {/* Advanced Filter and Search Bar */}
      <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">⚙️ خيارات التصفية والبحث المتقدم</span>
            {isFiltered && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300">
                مفلتر: {filteredArchives.length} من {archives.length} فاتورة
              </span>
            )}
          </div>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded-lg cursor-pointer transition-all"
            >
              🔄 إلغاء الفلاتر وإعادة الضبط
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Search Box */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">🔍 بحث نصي (رقم الفاتورة، صنف، بيان...)</label>
            <input
              type="text"
              placeholder="ابحث بالاسم، الوصف، الرقم..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-[#8b6b4d]"
            />
          </div>

          {/* 2. Warehouse Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">🏢 المخزن المعني</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-[#8b6b4d]"
            >
              <option value="">جميع المخازن (الكل)</option>
              {dynamicWarehouses.map(wh => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </select>
          </div>

          {/* 3. Invoice Delivery Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">🚦 حالة الفاتورة (الاستلام)</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:outline-[#8b6b4d]"
            >
              <option value="all">جميع الحالات</option>
              <option value="completed">✅ مكتملة الاستلام بالكامل</option>
              <option value="partial">🟡 استلام جزئي (يوجد متبقيات)</option>
              <option value="delayed">🚨 بها بنود مؤشرة لم تصل</option>
              <option value="pending">⏳ بانتظار الاستلام</option>
            </select>
          </div>

          {/* 4. Date Mode Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">📅 نطاق التاريخ</label>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as any)}
              className="p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-[#8b6b4d]"
            >
              <option value="all">كل الفترات (جميع التواريخ)</option>
              <option value="today">فواتير اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">هذا الشهر (آخر 30 يوم)</option>
              <option value="specific">تاريخ محدد من السجل</option>
              <option value="range">نطاق تاريخ مخصص (من - إلى)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Secondary Date Selectors */}
        {dateFilterMode === "specific" && (
          <div className="pt-2 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-xs font-bold text-gray-700 whitespace-nowrap">اختر التاريخ المسجل:</label>
            <select
              value={selectedSpecificDate}
              onChange={(e) => setSelectedSpecificDate(e.target.value)}
              className="p-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold max-w-xs focus:outline-[#8b6b4d]"
            >
              <option value="">-- اختر تاريخاً من السجلات --</option>
              {uniqueDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {dateFilterMode === "range" && (
          <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700">من تاريخ:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-[#8b6b4d]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700">إلى تاريخ:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-[#8b6b4d]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Archives Cards Listing */}
      <div className="space-y-4">
        {filteredArchives.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center space-y-2">
            <p className="text-gray-500 font-bold text-sm">لا توجد فواتير مطابقة لخيارات الفلترة والبحث المحددة.</p>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#8b6b4d] font-bold hover:underline cursor-pointer"
              >
                إلغاء الفلاتر وعرض كافة السجلات 🔄
              </button>
            )}
          </div>
        ) : (
          filteredArchives.map((arch, idx) => {
            const isUnread = arch.unread;
            const mergedTag = arch.merged ? `📋 بيان #${arch.invoiceNumber || ""}` : "";
            const deliveryInfo = getArchiveDeliveryStatus(arch);

            return (
              <div
                key={`${arch.id}-${idx}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-xs ${
                  isUnread
                    ? "bg-amber-50/20 border-amber-300 border-r-4 border-r-amber-500"
                    : "bg-white border-gray-200 border-r-4 border-r-[#8b6b4d] hover:border-gray-300"
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <strong className="text-gray-900 text-sm font-extrabold">📦 {arch.title || "فاتورة معتمدة"}</strong>
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${deliveryInfo.badgeClass}`}>
                      {deliveryInfo.label}
                    </span>
                    {mergedTag && (
                      <span className="text-[10px] font-bold bg-[#8b6b4d]/10 text-[#8b6b4d] px-2 py-0.5 rounded-md border border-[#8b6b4d]/20">
                        {mergedTag}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>📅 التاريخ: <strong className="text-gray-700">{arch.date}</strong> | ⏰ {arch.time || "10:00 مساءً"}</span>
                    <span>🏢 المخزن: <strong className="text-gray-700">{arch.warehouse || "جميع المخازن"}</strong></span>
                    <span>👤 المسجل: <strong className="text-gray-700">{arch.user || "غير معروف"}</strong></span>
                    <span className="font-bold text-[#8b6b4d]">🔢 إجمالي البنود: {arch.items?.length || 0}</span>
                  </div>

                  {/* Delivery summary mini pills */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                      مكتمل: {deliveryInfo.receivedCount}
                    </span>
                    {deliveryInfo.partialCount > 0 && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
                        جزئي: {deliveryInfo.partialCount}
                      </span>
                    )}
                    {deliveryInfo.delayedCount > 0 && (
                      <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-bold">
                        لم يصل: {deliveryInfo.delayedCount}
                      </span>
                    )}
                    {deliveryInfo.pendingCount > 0 && (
                      <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded font-bold">
                        معلق: {deliveryInfo.pendingCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                  <button
                    onClick={() => onViewDetails(
                      arch.title,
                      arch.items,
                      (index) => onDeleteItemFromArchive(arch.id, index),
                      onEditItemInArchive ? (index, fields) => onEditItemInArchive(arch.id, index, fields) : undefined
                    )}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                  >
                    👁️ عرض البنود
                  </button>
                  <button
                    onClick={() => printInvoice(arch.items, `فاتورة - ${arch.date}`, arch.warehouse || "جميع المخازن", arch.user)}
                    className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                  >
                    🖨️ طباعة
                  </button>
                  <button
                    onClick={() => setMatrixModalData({ items: arch.items, title: `أرشيف مصفوفة - ${arch.date}`, defaultWarehouse: arch.warehouse || "جميع المخازن" })}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                    title="طباعة مصفوفة النواقص مع خيارات الفلترة وحالة الاستلام"
                  >
                    ⊞ طباعة مصفوفة
                  </button>
                  <button
                    onClick={() => exportExcel(arch.items, `أرشيف_${arch.date}`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setShowEditModal(arch.id)}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                  >
                    ✏️ إضافة صنف
                  </button>
                  {isManager && (
                    <button
                      onClick={() => setEditingArchive(arch)}
                      className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                    >
                      ✏️ تعديل
                    </button>
                  )}
                  {confirmDeleteId === arch.id ? (
                    <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-xl border border-red-300">
                      <button
                        onClick={() => {
                          onDeleteArchive(arch.id);
                          setConfirmDeleteId(null);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer transition-all animate-pulse"
                      >
                        تأكيد الحذف ⚠️
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="bg-gray-500 hover:bg-gray-600 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer transition-all"
                      >
                        تراجع
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(arch.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-2 px-3 rounded-xl cursor-pointer transition-all"
                    >
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit modal (Add item to confirmed archive) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>📦 إدراج صنف جديد لأرشيف معتمد</span>
            </h3>
            
            <div className="space-y-3">
              {/* Warehouse selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🏢 اختيار المخزن المعني <span className="text-red-500">*</span></label>
                <select
                  value={addWarehouse}
                  onChange={(e) => setAddWarehouse(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] bg-white text-sm font-semibold"
                >
                  {dynamicWarehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                  <option value="CUSTOM_WAREHOUSE">🏢 مخزن آخر (إدخال يدوي...)</option>
                </select>
                {addWarehouse === "CUSTOM_WAREHOUSE" && (
                  <input
                    type="text"
                    placeholder="اكتب اسم المخزن الجديد..."
                    value={customWarehouse}
                    onChange={(e) => setCustomWarehouse(e.target.value)}
                    className="p-2 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm mt-1"
                  />
                )}
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🔢 العدد / الكمية <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: 5"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Fixed Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🏷️ اسم الصنف <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: مفتاح 16 أمبير ساس"
                  value={addFixed}
                  onChange={(e) => setAddFixed(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">📝 البيان / الوصف</label>
                <input
                  type="text"
                  placeholder="مثال: صنف أبيض أصلي (اختياري)"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">📌 ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="ملاحظات..."
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleAddSubmit(showEditModal)}
                className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer transition-all shadow-md"
              >
                حفظ وإدراج للصنف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Full Archive Modal */}
      {editingArchive && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>✏️ تعديل بيانات الأرشيف العام</span>
            </h3>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">عنوان الفاتورة:</label>
                <input
                  type="text"
                  value={editingArchive.title || ""}
                  onChange={(e) => setEditingArchive({ ...editingArchive, title: e.target.value })}
                  className="p-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-[#8b6b4d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">التاريخ:</label>
                  <input
                    type="text"
                    value={editingArchive.date || ""}
                    onChange={(e) => setEditingArchive({ ...editingArchive, date: e.target.value })}
                    className="p-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-[#8b6b4d]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">المخزن:</label>
                  <input
                    type="text"
                    value={editingArchive.warehouse || ""}
                    onChange={(e) => setEditingArchive({ ...editingArchive, warehouse: e.target.value })}
                    className="p-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-[#8b6b4d]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setEditingArchive(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateArchive && editingArchive) {
                    onUpdateArchive(editingArchive);
                    setEditingArchive(null);
                  }
                }}
                className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer transition-all shadow-md"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Matrix Modal */}
      {matrixModalData && (
        <PrintMatrixFilterModal
          isOpen={true}
          onClose={() => setMatrixModalData(null)}
          items={matrixModalData.items}
          title={matrixModalData.title}
          defaultWarehouse={matrixModalData.defaultWarehouse}
          currentUserDisplay={currentUser?.displayName || currentUser?.username || "المدير"}
        />
      )}
    </div>
  );
}
