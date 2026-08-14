import React, { useState } from "react";
import { TrashItem, User } from "../types";
import { formatDateArabic } from "../utils/date";

interface TrashProps {
  currentUser: User;
  trashItems: TrashItem[];
  onRestore: (item: TrashItem) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

export default function Trash({
  currentUser,
  trashItems,
  onRestore,
  onPermanentDelete,
  onClearAll
}: TrashProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredItems = trashItems
    .filter(item => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchUser = item.deletedBy?.toLowerCase().includes(q);
        const matchWh = item.warehouse?.toLowerCase().includes(q);
        return matchTitle || matchUser || matchWh;
      }
      return true;
    })
    .sort((a, b) => (b.deletedTimestamp || 0) - (a.deletedTimestamp || 0));

  const handleClearAll = async () => {
    if (trashItems.length === 0) return;
    if (!confirm("⚠️ هل أنت متأكد تماماً من إفراغ سلة المحذوفات بالكامل نهائياً؟\nلن تتمكن من استرجاع أي من هذه العناصر بعد الآن!")) {
      return;
    }
    setIsClearing(true);
    try {
      await onClearAll();
    } finally {
      setIsClearing(false);
    }
  };

  const handleRestoreItem = async (item: TrashItem) => {
    if (!confirm(`هل تريد استعادة "${item.title}" إلى النظام مرة أخرى؟`)) return;
    setProcessingId(item.id);
    try {
      await onRestore(item);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteItem = async (item: TrashItem) => {
    if (!confirm(`⚠️ هل أنت متأكد من حذف "${item.title}" نهائياً من سلة المحذوفات؟`)) return;
    setProcessingId(item.id);
    try {
      await onPermanentDelete(item.id);
    } finally {
      setProcessingId(null);
    }
  };

  const getDaysRemaining = (timestamp: number) => {
    const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - timestamp;
    const remainingMs = FIFTEEN_DAYS_MS - elapsed;
    if (remainingMs <= 0) return "يحذف قريباً";
    const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    return `متبقي ${days} يوم على الحذف التلقائي`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "mergedInvoice":
        return { label: "فاتورة مدمجة", color: "bg-blue-100 text-blue-800 border-blue-200" };
      case "item":
        return { label: "بند ناقص", color: "bg-amber-100 text-amber-800 border-amber-200" };
      case "archive":
        return { label: "أرشيف", color: "bg-purple-100 text-purple-800 border-purple-200" };
      case "report":
        return { label: "تقرير", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "quotation":
        return { label: "عرض أسعار", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
      default:
        return { label: "عنصر", color: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  return (
    <div className="space-y-6" dir="rtl" id="trash-container">
      {/* Header card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800 border-r-4 border-red-500 pr-3">
              🗑️ سلة المحذوفات (المدير العام)
            </h2>
            <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold border border-red-200">
              {trashItems.length} عنصر محذوف
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            يتم نقل أي فواتير أو بنود محذوفة إلى هذه السلة تلقائياً. يمكنك استعادتها بأي وقت أو حذفها نهائياً. يتم تنظيف السلة تلقائياً بعد مرور 15 يوماً.
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            id="clear-all-trash-btn"
          >
            🧹 {isClearing ? "جاري الإفراغ..." : "إفراغ سلة المحذوفات نهائياً"}
          </button>
        )}
      </div>

      {/* Auto-cleaning info banner */}
      <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-xl flex items-center justify-between text-xs text-amber-900 font-semibold gap-2">
        <div className="flex items-center gap-2">
          <span>⏳</span>
          <span>نظام التنظيف الذكي يعمل تلقائياً: العناصر التي تتجاوز مدة حذفها 15 يوماً يتم مسحها نهائياً لتوفير المساحة وتنظيم البيانات.</span>
        </div>
      </div>

      {/* Controls: Search & Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { id: "all", label: "الكل" },
            { id: "mergedInvoice", label: "الفواتير المدمجة" },
            { id: "item", label: "البنود" },
            { id: "archive", label: "الأرشيف" },
            { id: "quotation", label: "عروض الأسعار" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === tab.id
                  ? "bg-[#8b6b4d] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 بحث في المحذوفات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-right focus:outline-none focus:border-[#8b6b4d]"
        />
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center shadow-sm border border-gray-100">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-base font-bold text-gray-700 mb-1">سلة المحذوفات فارغة</h3>
          <p className="text-xs text-gray-400">لا توجد عناصر محذوفة حالياً مطابقة للبحث.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const typeInfo = getTypeLabel(item.type);
            const isExpanded = expandedId === item.id;
            const isProcessing = processingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white p-4.5 rounded-2xl shadow-sm border border-gray-100 hover:border-gray-200 transition-all"
                id={`trash-item-${item.id}`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-800">
                        {item.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>📅 حُذف في: <strong className="text-gray-600">{item.deletedAt}</strong></span>
                        <span>👤 بواسطة: <strong className="text-gray-600">{item.deletedBy}</strong></span>
                        {item.warehouse && (
                          <span>🏢 المستودع: <strong className="text-gray-600">{item.warehouse}</strong></span>
                        )}
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-100">
                          ⏱️ {getDaysRemaining(item.deletedTimestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {item.data?.items && Array.isArray(item.data.items) && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                      >
                        {isExpanded ? "إخفاء التفاصيل ▲" : `عرض الأصناف (${item.data.items.length}) ▼`}
                      </button>
                    )}

                    <button
                      onClick={() => handleRestoreItem(item)}
                      disabled={isProcessing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      🔄 استعادة
                    </button>

                    <button
                      onClick={() => handleDeleteItem(item)}
                      disabled={isProcessing}
                      className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 text-xs font-bold py-1.5 px-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      title="حذف نهائي"
                    >
                      ❌ حذف نهائي
                    </button>
                  </div>
                </div>

                {/* Expanded items preview */}
                {isExpanded && item.data?.items && Array.isArray(item.data.items) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50/50 p-3 rounded-xl">
                    <h5 className="text-xs font-bold text-gray-600 mb-2">الأصناف المشمولة في هذه الفاتورة:</h5>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {item.data.items.map((subItem: any, sIdx: number) => (
                        <div key={sIdx} className="bg-white p-2 rounded-lg text-xs flex justify-between items-center border border-gray-100">
                          <span className="font-bold text-gray-800">
                            {sIdx + 1}. {subItem.fixedName || subItem.description}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="bg-[#8b6b4d]/10 text-[#8b6b4d] font-black px-2 py-0.5 rounded text-[11px]">
                              العدد: {subItem.company}
                            </span>
                            {subItem.warehouse && (
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                                {subItem.warehouse}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
