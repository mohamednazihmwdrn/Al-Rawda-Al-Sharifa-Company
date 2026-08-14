import React, { useState } from "react";
import { User, Item, MergedInvoice } from "../types";
import { printInvoice } from "../utils/print";
import { compareDatesDescending } from "../utils/date";

interface UnreceivedItemsProps {
  currentUser: User;
  mergedInvoices: MergedInvoice[];
  warehouseFilter: string | null; // Null means manager (all), non-null means a specific warehouse
  onUpdateItemDeliveryStatus?: (invoiceId: string, itemId: string, status: "received" | "delayed") => void;
  onResendUnreceivedItems?: (itemsToResend: Item[], defaultWhName?: string) => void;
}

export default function UnreceivedItems({
  currentUser,
  mergedInvoices,
  warehouseFilter,
  onUpdateItemDeliveryStatus,
  onResendUnreceivedItems
}: UnreceivedItemsProps) {
  // Filter and group unreceived items from approved invoices
  // Approved invoices are those with status "approved" or "auto_approved"
  const approvedInvoices = mergedInvoices.filter(
    (m) => m.status === "approved" || m.status === "auto_approved"
  );

  // Grouping by Date and Invoice
  interface InvoiceGroup {
    id: string;
    invoiceNumber: number;
    date: string;
    time: string;
    items: Item[];
    warehouses: string[];
    recorder: string;
  }

  const groups: InvoiceGroup[] = [];

  approvedInvoices.forEach((inv) => {
    // Filter items in this invoice that are unreceived or have partial remaining quantities
    const unreceivedItems = inv.items.filter((item) => {
      // Hide items that have already been resent to manager to prevent clutter/confusion
      if (item.resent) return false;

      // If there is a warehouse filter, only show items belonging to that warehouse
      if (warehouseFilter && (item.warehouse || "").trim() !== warehouseFilter.trim()) {
        return false;
      }

      const isReceived = item.deliveryStatus === "received";
      const isPartialWithRemaining = item.hasPartialReceipt && item.remainingQty && item.remainingQty !== "0";

      // It is unreceived if:
      // 1. It is not marked as received (pending or delayed)
      // 2. OR it was received partially but still has a remaining quantity
      return !isReceived || isPartialWithRemaining;
    });

    if (unreceivedItems.length > 0) {
      groups.push({
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
  groups.sort((a, b) => {
    const cmp = compareDatesDescending(a, b);
    if (cmp !== 0) return cmp;
    return b.invoiceNumber - a.invoiceNumber;
  });

  // Track expanded groups
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handlePrintGroup = (group: InvoiceGroup) => {
    const title = warehouseFilter 
      ? `النواقص غير المستلمة - ${warehouseFilter} (${group.date})`
      : `النواقص غير المستلمة - جميع المخازن (${group.date})`;
    printInvoice(group.items, title, warehouseFilter, currentUser.displayName || currentUser.username);
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
        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-extrabold text-xs p-2.5 px-4 rounded-xl border border-red-100 dark:border-red-900/30">
          إجمالي الفواتير المعلقة: {groups.length}
        </div>
      </div>

      {/* Main Content List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
            <span className="text-5xl block mb-3">🎉</span>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">ممتاز! لا توجد بنود غير مستلمة</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">تم استلام كافة البضائع والأصناف المعتمدة بنجاح تام.</p>
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
                      <span>المخزن: {warehouseFilter || "جميع المخازن"}</span>
                      <span>المسجل: {group.recorder}</span>
                      <span className="font-bold text-[#8b6b4d]">عدد البنود: {group.items.length} #{group.invoiceNumber}</span>
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
    </div>
  );
}
