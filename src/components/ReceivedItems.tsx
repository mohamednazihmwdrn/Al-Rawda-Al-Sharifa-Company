import React, { useState } from "react";
import { User, Item, MergedInvoice } from "../types";
import { printInvoice } from "../utils/print";
import { compareDatesDescending } from "../utils/date";

interface ReceivedItemsProps {
  currentUser: User;
  mergedInvoices: MergedInvoice[];
  warehouseFilter: string | null; // Null means manager (all)
}

export default function ReceivedItems({
  currentUser,
  mergedInvoices,
  warehouseFilter
}: ReceivedItemsProps) {
  // Filter and group received items from approved invoices
  const approvedInvoices = mergedInvoices.filter(
    (m) => m.status === "approved" || m.status === "auto_approved"
  );

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
    // Filter items in this invoice that are received (fully or partially with some received quantity)
    const receivedItems = inv.items.filter((item) => {
      if (warehouseFilter && (item.warehouse || "").trim() !== warehouseFilter.trim()) {
        return false;
      }

      const isReceived = item.deliveryStatus === "received";
      const isPartialWithReceived = item.hasPartialReceipt && item.receivedQty && item.receivedQty !== "0";

      return isReceived || isPartialWithReceived;
    });

    if (receivedItems.length > 0) {
      groups.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        time: inv.time,
        items: receivedItems,
        warehouses: Array.from(new Set(receivedItems.map((it) => it.warehouse || ""))),
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
      ? `البنود المستلمة - ${warehouseFilter} (${group.date})`
      : `البنود المستلمة - جميع المخازن (${group.date})`;
    printInvoice(group.items, title, warehouseFilter, currentUser.displayName || currentUser.username);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header section */}
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white border-r-4 border-emerald-500 pr-3">
            ✅ {warehouseFilter ? `البنود المستلمة بمستودع (${warehouseFilter})` : "جمع البنود المستلمة من جميع المستودعات"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {warehouseFilter 
              ? "تعرض هنا جميع الأصناف التي تم استلامها بالكامل أو جزئياً في مخزنك، مرتبة بالتواريخ والكميات المستلمة فعلياً."
              : "تجميعة ذكية وحصرية للمدير تعرض كافة الأصناف والكميات التي تم استلامها بالكامل أو جزئياً في جميع المستودعات."
            }
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs p-2.5 px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          إجمالي فواتير الاستلام: {groups.length}
        </div>
      </div>

      {/* Main Content List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
            <span className="text-5xl block mb-3">📦</span>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">لا توجد بنود مستلمة بعد</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">لم يتم تسجيل استلامات معتمدة على الفواتير الحالية حتى الآن.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isExpanded = !!expandedGroups[group.id];
            return (
              <div 
                key={group.id} 
                className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Group Header Info */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-extrabold text-[11px] p-1 px-2.5 rounded-full">
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
                          <th className="p-3 w-28 text-center">مستلم (الكمية المستلمة)</th>
                          <th className="p-3">اسم الصنف والبيان</th>
                          {!warehouseFilter && <th className="p-3 w-40">المستودع المعني</th>}
                          <th className="p-3 w-32 text-center">حالة الاستلام الحالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {group.items.map((item, itemIdx) => {
                          const isPartial = item.hasPartialReceipt;
                          const qtyDisplay = isPartial ? (
                            <div className="text-center font-black text-emerald-600 dark:text-emerald-400">
                              {item.receivedQty} <span className="text-[10px] text-gray-400 font-normal block">(مستلم من مطلوب {item.originalQty || item.company})</span>
                            </div>
                          ) : (
                            <div className="text-center font-black text-emerald-600 dark:text-emerald-400">
                              {item.company}
                            </div>
                          );

                          return (
                            <tr 
                              key={item.id || itemIdx} 
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
                                  {item.note && item.note !== "-" && <span className="mr-2">📝 ملاحظة: {item.note}</span>}
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
                                {isPartial ? (
                                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 dark:border-emerald-900/30">
                                    🟢 مستلم جزئياً (مستلم: {item.receivedQty})
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 dark:border-emerald-900/30">
                                    🟢 تم الاستلام بنجاح
                                  </span>
                                )}
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
