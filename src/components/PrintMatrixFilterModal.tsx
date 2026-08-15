import React, { useState } from "react";
import { Item } from "../types";
import { printMatrix } from "../utils/print";

interface PrintMatrixFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  title?: string;
  currentUserDisplay?: string;
  defaultWarehouse?: string;
}

export default function PrintMatrixFilterModal({
  isOpen,
  onClose,
  items,
  title = "بيان مصفوفة النواقص",
  currentUserDisplay = "المدير",
  defaultWarehouse = "جميع المخازن"
}: PrintMatrixFilterModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>(defaultWarehouse);

  if (!isOpen) return null;

  // Calculate statistics for warehouses in this dataset
  let nahasCount = 0;
  let nadyCount = 0;
  let managerCount = 0;
  const customCounts: { [key: string]: number } = {};

  items.forEach(it => {
    const wh = (it.warehouse || "").trim();
    if (wh.includes("النحاس") || wh.toLowerCase().includes("nahas") || wh.includes("جمعة")) {
      nahasCount++;
    } else if (wh.includes("النادي") || wh.toLowerCase().includes("nady") || wh.includes("جعفر")) {
      nadyCount++;
    } else if (wh.includes("المدير") || wh.toLowerCase().includes("manager")) {
      managerCount++;
    } else if (wh) {
      customCounts[wh] = (customCounts[wh] || 0) + 1;
    } else {
      nahasCount++;
    }
  });

  const handlePrint = (filterToUse: string) => {
    printMatrix(items, title, filterToUse, undefined, currentUserDisplay);
    onClose();
  };

  return (
    <div
      id="print-matrix-filter-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="print-matrix-filter-modal-content"
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-[#8b6b4d] to-[#6d4f34] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⊞</span>
            <div>
              <h3 className="font-extrabold text-base leading-tight">خيارات طباعة مصفوفة النواقص</h3>
              <p className="text-xs text-amber-100/90 mt-0.5">اختر طباعة كافة المخازن معاً أو فلترة مستودع محدد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 px-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body & Filters */}
        <div className="p-6 space-y-4">
          <div className="text-xs font-bold text-gray-500 mb-1">
            اختر نطاق المستودع لطباعة المصفوفة ({items.length} صنف إجمالي):
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* All Warehouses */}
            <button
              onClick={() => handlePrint("جميع المخازن")}
              className={`p-3.5 rounded-xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer ${
                selectedFilter === "جميع المخازن"
                  ? "border-[#8b6b4d] bg-amber-50/60 shadow-xs"
                  : "border-gray-200 hover:border-amber-300 hover:bg-gray-50/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                  <span>🌐</span> جميع المخازن
                </span>
                <span className="bg-[#8b6b4d] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {items.length} صنف
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                مصفوفة مدمجة تشمل كافة المستودعات في 4 أعمدة متوازنة (A4 بالعرض).
              </p>
            </button>

            {/* Nahas Warehouse */}
            <button
              onClick={() => handlePrint("مخزن النحاس")}
              disabled={nahasCount === 0}
              className={`p-3.5 rounded-xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer ${
                nahasCount === 0
                  ? "opacity-50 border-gray-100 bg-gray-50 cursor-not-allowed"
                  : selectedFilter === "مخزن النحاس"
                  ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                  : "border-gray-200 hover:border-emerald-400 hover:bg-gray-50/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                  <span>🏭</span> مخزن النحاس فقط
                </span>
                <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {nahasCount} صنف
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                مصفوفة مخصصة لنواقص مخزن النحاس فقط موزعة بكفاءة على الصفحة.
              </p>
            </button>

            {/* Nady Warehouse */}
            <button
              onClick={() => handlePrint("مخزن النادي")}
              disabled={nadyCount === 0}
              className={`p-3.5 rounded-xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer ${
                nadyCount === 0
                  ? "opacity-50 border-gray-100 bg-gray-50 cursor-not-allowed"
                  : selectedFilter === "مخزن النادي"
                  ? "border-blue-600 bg-blue-50/60 shadow-xs"
                  : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                  <span>🏟️</span> مخزن النادي فقط
                </span>
                <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {nadyCount} صنف
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                مصفوفة مخصصة لنواقص مخزن النادي فقط موزعة بكفاءة على الصفحة.
              </p>
            </button>

            {/* Manager Warehouse if any */}
            {managerCount > 0 && (
              <button
                onClick={() => handlePrint("مخزن المدير")}
                className="p-3.5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 text-right transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                    <span>👑</span> مخزن المدير
                  </span>
                  <span className="bg-purple-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {managerCount} صنف
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  مصفوفة خاصة بنواقص مخزن الإدارة المركزية.
                </p>
              </button>
            )}

            {/* Custom Warehouses if any */}
            {Object.entries(customCounts).map(([cName, cCount]) => (
              <button
                key={cName}
                onClick={() => handlePrint(cName)}
                className="p-3.5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 text-right transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                    <span>📦</span> {cName}
                  </span>
                  <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {cCount} صنف
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  مصفوفة خاصة بهذا المستودع المحدد.
                </p>
              </button>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-start gap-2 text-xs text-blue-900 leading-relaxed mt-3">
            <span>💡</span>
            <span>
              <strong>ملاحظة:</strong> يمكنك أيضاً التبديل الحي بين المخازن وتغيير اتجاه الورقة (أفقي / رأسي) مباشرة من شريط الأدوات داخل نافذة المعاينة والطباعة!
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 px-6 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <button
            onClick={() => handlePrint(selectedFilter)}
            className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span>
            <span>طباعة المصفوفة المختارة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
