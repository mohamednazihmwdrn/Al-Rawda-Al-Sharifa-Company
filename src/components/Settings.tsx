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
} from "../types";
import { bulkRestoreDatabase, clearAllDatabaseTables, clearExperimentalOperationsOnly, CustomCompany, CompanyInfo, getMergedCompanyMap } from "../services/dbService";
import { companyItemsMap } from "../data/constants";

// Safe Base64 encode supporting UTF-8 / Arabic characters
function encodeBackupData(data: any): string {
  const jsonStr = JSON.stringify(data);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return "ROUDA_SECURE_BACKUP_V4_" + btoa(binary);
}

// Safe Base64 decode supporting UTF-8 / Arabic characters
function decodeBackupData(code: string): any {
  const trimmed = code.trim();
  if (!trimmed.startsWith("ROUDA_SECURE_BACKUP_V4_")) {
    throw new Error("الكود المدخل ليس كود نسخ احتياطي صالح لمستودع الروضة.");
  }
  const base64Str = trimmed.replace("ROUDA_SECURE_BACKUP_V4_", "").trim();
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const jsonStr = new TextDecoder().decode(bytes);
  return JSON.parse(jsonStr);
}

export const ALL_SYSTEM_PERMISSIONS = [
  { id: "dashboard", name: "🏠 لوحة القيادة والمؤشرات" },
  { id: "cart", name: "🛒 سلة النواقص وإرسالها" },
  { id: "chat", name: "💬 قسم الدردشة والتواصل" },
  { id: "warehouse-manager", name: "📦 مخزن المدير" },
  { id: "warehouse-nahas", name: "📦 مخزن النحاس" },
  { id: "warehouse-nady", name: "📦 مخزن النادي" },
  { id: "warehouse-custom", name: "🏢 مستودعات أخرى" },
  { id: "smart-print", name: "📝 طباعة النصوص والبرومبت" },
  { id: "quran-verse", name: "📖 الآية القرآنية المتغيرة والذكر" },
  { id: "quotations", name: "📋 فواتير عروض الأسعار" },
  { id: "reports", name: "📄 التقارير اليومية" },
  { id: "archive", name: "📦 الأرشيف العام للفواتير" },
  { id: "trash", name: "🗑️ سلة المحذوفات" },
  { id: "settings", name: "⚙️ الإعدادات المتقدمة" },
  { id: "privacy-policy", name: "📄 سياسة الخصوصية" }
];

interface SettingsProps {
  currentUser: User;
  users: { [key: string]: User };
  items: Item[];
  mergedInvoices: MergedInvoice[];
  archives: Archive[];
  warehouseArchives: WarehouseArchive[];
  reports: Report[];
  savedItems: SavedItem[];
  quotations: Quotation[];
  customCompanies?: CustomCompany[];
  onSaveCustomCompany?: (company: CustomCompany) => void;
  onDeleteCustomCompany?: (companyId: string) => Promise<void>;
  onSaveSavedItem?: (item: SavedItem) => Promise<void>;
  onDeleteSavedItem?: (itemId: string) => Promise<void>;
  onUpdateAdminProfile: (displayName: string, currentPass: string, newPass: string) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (key: string, user: User) => void;
  onRemoveUser: (key: string) => void;
  onDatabaseRefreshed: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  companyInfo: CompanyInfo | null;
  onSaveCompanyInfo: (info: CompanyInfo) => void;
}

export default function Settings({
  currentUser,
  users,
  items,
  mergedInvoices,
  archives,
  warehouseArchives,
  reports,
  savedItems,
  quotations,
  customCompanies = [],
  onSaveCustomCompany,
  onDeleteCustomCompany,
  onSaveSavedItem,
  onDeleteSavedItem,
  onUpdateAdminProfile,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onDatabaseRefreshed,
  darkMode,
  onToggleDarkMode,
  companyInfo,
  onSaveCompanyInfo
}: SettingsProps) {
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [adminCurrentPass, setAdminCurrentPass] = useState("");
  const [adminNewPass, setAdminNewPass] = useState("");

  // Company info state
  const [compName, setCompName] = useState("");
  const [compAddress, setCompAddress] = useState("");
  const [compPhones, setCompPhones] = useState("");

  useEffect(() => {
    if (companyInfo) {
      setCompName(companyInfo.name || "");
      setCompAddress(companyInfo.address || "");
      setCompPhones(companyInfo.phones || "");
    }
  }, [companyInfo]);

  // Add User State variables
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"مدير" | "مخزن" | "مستخدم">("مستخدم");
  const [newWarehouse, setNewWarehouse] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>(["cart", "chat"]);

  // Inline Editing State variables
  const [editingUserKey, setEditingUserKey] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"مدير" | "مخزن" | "مستخدم">("مستخدم");
  const [editWarehouse, setEditWarehouse] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // Printing configurations
  const [companiesPerRow, setCompaniesPerRow] = useState(4);
  const [fontSize, setFontSize] = useState(10);

  // Custom Encrypted Code Backup
  const [generatedBackupCode, setGeneratedBackupCode] = useState("");
  const [pasteBackupCode, setPasteBackupCode] = useState("");

  // Saved Items management states
  const [savedItemsSearch, setSavedItemsSearch] = useState("");
  const [editingSavedItemId, setEditingSavedItemId] = useState<string | null>(null);
  const [editingSavedItemName, setEditingSavedItemName] = useState("");
  const [editingSavedItemCompany, setEditingSavedItemCompany] = useState("");
  const [editingSavedItemFixedName, setEditingSavedItemFixedName] = useState("");

  const handleEditSavedItem = (item: SavedItem) => {
    setEditingSavedItemId(item.id);
    setEditingSavedItemName(item.name);
    setEditingSavedItemCompany(item.company || "");
    setEditingSavedItemFixedName(item.fixedName || "");
  };

  const handleSaveSavedItemEdit = async (itemId: string) => {
    if (!editingSavedItemName.trim()) {
      alert("الرجاء إدخال اسم الصنف!");
      return;
    }
    if (onSaveSavedItem) {
      await onSaveSavedItem({
        id: itemId,
        name: editingSavedItemName.trim(),
        company: editingSavedItemCompany.trim(),
        fixedName: editingSavedItemFixedName.trim(),
        note: "-"
      });
      setEditingSavedItemId(null);
      alert("✓ تم تحديث الصنف بنجاح!");
    }
  };

  const handleDeleteSavedItemClick = async (itemId: string) => {
    if (!confirm("⚠️ هل أنت متأكد من رغبتك في حذف هذا الصنف نهائياً من قائمة الأسماء المسجلة؟")) return;
    if (onDeleteSavedItem) {
      await onDeleteSavedItem(itemId);
      alert("🗑️ تم حذف الصنف بنجاح!");
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("matrixSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCompaniesPerRow(parsed.companiesPerRow || 4);
        setFontSize(parsed.fontSize || 10);
      }
    } catch (e) {}
  }, []);

  const handleSavePrintSettings = () => {
    localStorage.setItem("matrixSettings", JSON.stringify({ companiesPerRow, fontSize }));
    alert("✅ تم حفظ إعدادات الطباعة بنجاح!");
  };

  const handleUpdateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminDisplayName.trim() || !adminCurrentPass) {
      alert("⚠️ الرجاء كتابة اسم العميل وكلمة السر الحالية!");
      return;
    }
    onUpdateAdminProfile(adminDisplayName.trim(), adminCurrentPass, adminNewPass);
    setAdminCurrentPass("");
    setAdminNewPass("");
  };

  const handleSaveCompanyInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSaveCompanyInfo({
        name: compName.trim(),
        address: compAddress.trim(),
        phones: compPhones.trim()
      });
      alert("✅ تم حفظ بيانات ترويسة الفاتورة بنجاح ومزامنتها تلقائياً مع جميع الفروع والمخازن!");
    } catch (err: any) {
      alert("❌ حدث خطأ أثناء حفظ الترويسة: " + err.message);
    }
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      alert("⚠️ الرجاء ملء اسم المستخدم وكلمة السر!");
      return;
    }

    const formattedUsername = newUsername.trim();
    const newUserObj: User = {
      username: formattedUsername,
      displayName: newDisplayName.trim() || formattedUsername,
      password: newPassword,
      role: newRole,
      warehouse: newRole === "مخزن" ? (newWarehouse.trim() || formattedUsername) : (newWarehouse.trim() || undefined),
      permissions: newPermissions
    };

    onAddUser(newUserObj);

    // reset form
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewRole("مستخدم");
    setNewWarehouse("");
    setNewPermissions(["cart", "chat"]);
  };

  const toggleNewPermission = (permId: string) => {
    setNewPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  // Backups
  const handleBackup = () => {
    try {
      const data = {
        version: "4.3",
        timestamp: new Date().toISOString(),
        users,
        items,
        mergedInvoices,
        archives,
        warehouseArchives,
        reports,
        savedItems,
        quotations,
        backup_from: "الروضة الشريفة"
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_roudav4_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("💾 تم تصدير النسخة الاحتياطية بنجاح!");
    } catch (err: any) {
      alert("❌ فشل تصدير البيانات: " + err.message);
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);
        if (!backup.version || !backup.users) {
          alert("❌ ملف استعادة غير صالح!");
          return;
        }

        if (confirm("⚠️ هل تريد استعادة وتجاوز البيانات الحالية بقاعدة البيانات؟")) {
          await bulkRestoreDatabase(backup);
          alert("✅ تم استعادة المنظومة وتحديث قاعدة البيانات بنجاح!");
          onDatabaseRefreshed();
        }
      } catch (err: any) {
        alert("❌ خطأ في استعادة النسخة الاحتياطية: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleGenerateCodeBackup = () => {
    try {
      const data = {
        version: "4.3",
        timestamp: new Date().toISOString(),
        users,
        items,
        mergedInvoices,
        archives,
        warehouseArchives,
        reports,
        savedItems,
        quotations,
        backup_from: "الروضة الشريفة"
      };
      const code = encodeBackupData(data);
      setGeneratedBackupCode(code);
      alert("✅ تم توليد كود النسخ الاحتياطي المشفر بنجاح!");
    } catch (err: any) {
      alert("❌ فشل توليد كود النسخ الاحتياطي: " + err.message);
    }
  };

  const handleRestoreFromCode = async () => {
    if (!pasteBackupCode.trim()) {
      alert("⚠️ الرجاء لصق كود النسخ الاحتياطي أولاً في الحقل المخصص!");
      return;
    }
    try {
      const backup = decodeBackupData(pasteBackupCode);
      if (!backup.version || !backup.users) {
        alert("❌ كود استعادة غير صالح أو تالف!");
        return;
      }
      if (confirm("⚠️ تحذير: هل أنت متأكد من رغبتك في استعادة وتجاوز البيانات الحالية في قاعدة البيانات باستخدام الكود المنسوخ؟ لا يمكن التراجع عن هذا الإجراء.")) {
        await bulkRestoreDatabase(backup);
        alert("✅ تم استعادة جميع بيانات المنظومة وتحديث قاعدة البيانات بنجاح من الكود المشفر!");
        setPasteBackupCode("");
        onDatabaseRefreshed();
      }
    } catch (err: any) {
      alert("❌ خطأ في فك تشفير واستعادة البيانات: " + err.message);
    }
  };

  const handleClearAll = async () => {
    if (confirm("⚠️ تحذير: هل أنت متأكد من رغبتك في حذف وتصفير قاعدة البيانات بالكامل؟ لا يمكن استعادة البيانات بعد التصفير.")) {
      const code = prompt("لتأكيد الحذف، اكتب كلمة (نعم) في الحقل أدناه:");
      if (code === "نعم") {
        await clearAllDatabaseTables();
        alert("🗑️ تم تصفير قاعدة البيانات بنجاح!");
        onDatabaseRefreshed();
      } else {
        alert("❌ تم إلغاء عملية التصفير.");
      }
    }
  };

  const handleClearExperimental = async () => {
    if (confirm("🧹 هل أنت متأكد من رغبتك في تنظيف النظام من جميع العمليات والفواتير والتقارير التجريبية المدخلة يدوياً؟\n\nهذا الإجراء سيقوم بحذف كافة الفواتير، التقارير، النواقص، والأرشيف، ولكنه سيحتفظ بحسابات المستخدمين والشركات وقائمة مسميات المنتجات المسجلة لتبدأ عملك الفعلي على نظيف.")) {
      const code = prompt("لتأكيد عملية تنظيف البيانات والبدء على نظيف، اكتب كلمة (نعم) في الحقل أدناه:");
      if (code === "نعم") {
        await clearExperimentalOperationsOnly();
        alert("🧹 تم تنظيف كافة العمليات والفواتير التجريبية بنجاح! المنظومة الآن جاهزة للعمل الفعلي على نظيف.");
        onDatabaseRefreshed();
      } else {
        alert("❌ تم إلغاء عملية التنظيف.");
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-8">
      <div className="card-title text-xl font-bold border-r-4 border-[#8b6b4d] pr-3 mb-6">
        ⚙️ الإعدادات المتقدمة وإدارة النظام
      </div>

      {/* ☀️ / 🌙 Dark Mode / Light Mode Toggle Section */}
      <div className="p-4 bg-[#f5f2ed]/50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-right">
          <h4 className="font-bold text-[#8b6b4d] text-sm flex items-center gap-1.5">
            {darkMode ? "🌙 مظهر النظام: الوضع المظلم (Dark Mode)" : "☀️ مظهر النظام: الوضع الفاتح (Light Mode)"}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">تصفح مريح للعين في ظروف الإضاءة الخافتة أو القوية.</p>
        </div>
        <button
          onClick={onToggleDarkMode}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
            darkMode 
              ? "bg-[#8b6b4d] hover:bg-[#6d4f34] text-white" 
              : "bg-[#1e2b3c] hover:bg-[#2c3e50] text-white"
          }`}
        >
          {darkMode ? "☀️ التبديل إلى الوضع الفاتح" : "🌙 التبديل إلى الوضع المظلم"}
        </button>
      </div>

      {/* Row 1: Profile & Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8">
        {/* Profile Change */}
        <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 text-right">
          <h4 className="font-bold text-[#8b6b4d] text-base border-r-2 border-[#8b6b4d] pr-2">👤 تعديل حساب المدير العام</h4>
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">الاسم المعروض الجديد</label>
            <input
              type="text"
              placeholder="مثال: أ/ أحمد حمدي..."
              value={adminDisplayName}
              onChange={(e) => setAdminDisplayName(e.target.value)}
              className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">كلمة السر الحالية</label>
            <input
              type="password"
              placeholder="••••••••"
              value={adminCurrentPass}
              onChange={(e) => setAdminCurrentPass(e.target.value)}
              className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm text-left"
              dir="ltr"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">كلمة السر الجديدة (اختياري)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={adminNewPass}
              onChange={(e) => setAdminNewPass(e.target.value)}
              className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm text-left"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ✓ تحديث بيانات المدير
          </button>
        </form>

        {/* Database & Backup Actions */}
        <div className="space-y-4">
          <h4 className="font-bold text-[#8b6b4d] text-base border-r-2 border-[#8b6b4d] pr-2">💾 النسخ الاحتياطي والاسترداد</h4>
          <p className="text-xs text-gray-400 font-semibold">تصدير كامل بيانات المستخدمين، والمخازن، والتقارير، والفواتير، والأرشيف واستعادتها لاحقاً بكل سهولة ودقة.</p>
          
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleBackup}
              className="py-2.5 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              📥 تحميل نسخة احتياطية من المنظومة (.json)
            </button>
            <label className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1.5 text-center">
              📤 استعادة نسخة احتياطية سابقة
              <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            </label>
            <button
              onClick={handleClearExperimental}
              className="py-2.5 bg-[#4b5563] hover:bg-[#374151] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
            >
              🧹 تنظيف وتصفير العمليات التجريبية (للبدء على نظيف)
            </button>
            <button
              onClick={handleClearAll}
              className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              ⚠️ تصفير وحذف جميع البيانات نهائياً (ضبط المصنع)
            </button>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h5 className="font-bold text-gray-700 text-sm">🔐 النسخ الاحتياطي اليدوي (بواسطة كود مشفر)</h5>
            <p className="text-xs text-gray-400">يمكنك توليد كود مشفر يحتوي على كافة البيانات وحفظه في ملف نصي أو إرساله، واستعادة المنظومة بلصق نفس الكود.</p>
            
            <div className="space-y-2">
              <button
                onClick={handleGenerateCodeBackup}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔑 توليد كود نسخ احتياطي مشفر جديد
              </button>
              
              {generatedBackupCode && (
                <div className="space-y-1">
                  <textarea
                    readOnly
                    value={generatedBackupCode}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full p-2 h-20 bg-gray-50 border rounded-xl text-[10px] font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedBackupCode);
                      alert("📋 تم نسخ كود النسخ الاحتياطي المشفر إلى الحافظة!");
                    }}
                    className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    📋 نسخ الكود المولد
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed">
              <label className="text-xs font-bold text-gray-600 block">📥 استعادة البيانات عبر الكود المشفر</label>
              <textarea
                placeholder="قم بلصق كود النسخ الاحتياطي المشفر هنا..."
                value={pasteBackupCode}
                onChange={(e) => setPasteBackupCode(e.target.value)}
                className="w-full p-2 h-20 bg-white border rounded-xl text-[10px] font-mono focus:outline-[#8b6b4d]"
              />
              <button
                onClick={handleRestoreFromCode}
                className="w-full py-2 bg-[#1e2b3c] hover:bg-[#2c3e50] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                🔄 استعادة المنظومة من الكود الملتصق
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Company Details for Printing */}
      <div className="p-6 bg-[#f5f2ed]/20 rounded-2xl border border-gray-100 shadow-2xs space-y-4 text-right">
        <h4 className="font-bold text-[#8b6b4d] text-base border-r-4 border-[#8b6b4d] pr-3">🏢 إعدادات ترويسة الفواتير المطبوعة (الإدارة والفروع)</h4>
        <p className="text-xs text-gray-400">تعديل بيانات ترويسة الفواتير التي تظهر في الأعلى لجميع الطباعات. في حالة عدم ملء الحقول، سيتم ترك أماكنها فارغة في الفواتير المطبوعة تلقائياً.</p>
        
        <form onSubmit={handleSaveCompanyInfoSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">اسم الشركة / المؤسسة</label>
            <input
              type="text"
              placeholder="مثال: شركة الروضة الشريفة"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              className="p-2.5 border rounded-xl focus:outline-[#8b6b4d] text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">العنوان بالتفصيل</label>
            <input
              type="text"
              placeholder="مثال: 19 مكرم عبيد - أمام راديو طلعت"
              value={compAddress}
              onChange={(e) => setCompAddress(e.target.value)}
              className="p-2.5 border rounded-xl focus:outline-[#8b6b4d] text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">أرقام الهواتف (كل رقم في سطر أو تفصلهم علامة)</label>
            <textarea
              placeholder="مثال:&#10;01110055809&#10;01100953332"
              rows={2}
              value={compPhones}
              onChange={(e) => setCompPhones(e.target.value)}
              className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm bg-white font-mono text-right"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              💾 حفظ ومزامنة بيانات الترويسة
            </button>
          </div>
        </form>
      </div>

      {/* Row 2: Add Warehouse & Printing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8">
        {/* Add new User and select Role & Permissions */}
        <form onSubmit={handleAddUserSubmit} className="space-y-4 bg-[#f5f2ed]/30 p-5 rounded-2xl border border-dashed border-[#8b6b4d]/30">
          <h4 className="font-bold text-[#8b6b4d] text-base border-r-2 border-[#8b6b4d] pr-2">👤 إضافة مستخدم جديد وتحديد الصلاحيات</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">اسم المستخدم (للتسجيل - فريد بالإنجليزية)</label>
              <input
                type="text"
                placeholder="مثال: ahmad_roudha"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm text-left font-mono"
                dir="ltr"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">الاسم المعروض (بالعربية)</label>
              <input
                type="text"
                placeholder="مثال: أ/ أحمد الشريف"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">كلمة سر الدخول</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm text-left"
                dir="ltr"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">نوع الحساب / الدور الوظيفي</label>
              <select
                value={newRole}
                onChange={(e) => {
                  const role = e.target.value as "مدير" | "مخزن" | "مستخدم";
                  setNewRole(role);
                  // Auto-select baseline permissions depending on role
                  if (role === "مدير") {
                    setNewPermissions(ALL_SYSTEM_PERMISSIONS.map(p => p.id));
                  } else {
                    setNewPermissions(["cart", "chat", "quran-verse"]);
                  }
                }}
                className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm bg-white"
              >
                <option value="مستخدم">مستخدم عادي (مندوب أو عامل)</option>
                <option value="مخزن">مخزن فرعي (مستودع)</option>
                <option value="مدير">مدير عام للنظام (كامل الصلاحيات)</option>
              </select>
            </div>
          </div>

          {(newRole === "مخزن" || newRole === "مستخدم") && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">اسم المستودع المرتبط (اختياري، يطابق اسم المستودع بالفواتير)</label>
              <input
                type="text"
                placeholder="مثال: مخزن النحاس، مخزن النادي، إلخ..."
                value={newWarehouse}
                onChange={(e) => setNewWarehouse(e.target.value)}
                className="p-2 border rounded-xl focus:outline-[#8b6b4d] text-sm"
              />
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-[#8b6b4d] block">🛡️ حدد الصلاحيات الممنوحة لهذا الحساب داخل النظام:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto bg-white p-3 rounded-xl border">
              {ALL_SYSTEM_PERMISSIONS.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-gray-700 font-semibold cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={newPermissions.includes(p.id)}
                    onChange={() => toggleNewPermission(p.id)}
                    className="accent-[#8b6b4d] w-4 h-4 cursor-pointer"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex justify-center items-center gap-2"
          >
            ➕ إنشاء حساب مستخدم جديد بالتراخيص
          </button>
        </form>

        {/* Print configure */}
        <div className="space-y-4">
          <h4 className="font-bold text-[#8b6b4d] text-base border-r-2 border-[#8b6b4d] pr-2">🖨️ إعدادات وتنسيقات الطباعة (المصفوفة)</h4>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">عدد الشركات في الصف الواحد</label>
            <select
              value={companiesPerRow}
              onChange={(e) => setCompaniesPerRow(parseInt(e.target.value))}
              className="p-2.5 border rounded-xl text-sm focus:outline-[#8b6b4d] bg-white"
            >
              <option value={2}>شركتان (2)</option>
              <option value={3}>ثلاث شركات (3)</option>
              <option value={4}>أربع شركات (4)</option>
              <option value={5}>خمس شركات (5)</option>
              <option value={6}>ست شركات (6)</option>
              <option value={8}>ثمان شركات (8)</option>
              <option value={10}>عشر شركات (10)</option>
              <option value={12}>اثنتا عشرة شركة (12)</option>
              <option value={100}>عرض كل الشركات في جدول واحد ممتد (بدون تقسيم)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">حجم الخط الرئيسي للطباعة: {fontSize}px (صغّره للمزيد من الكثافة والمساحة)</label>
            <input
              type="range"
              min={6}
              max={16}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full accent-[#8b6b4d]"
            />
          </div>

          <button
            onClick={handleSavePrintSettings}
            className="w-full py-2 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ✓ حفظ إعدادات الطباعة
          </button>
        </div>
      </div>

      {/* Row 3: Edit existing system users and their permissions */}
      <div className="space-y-4">
        <h4 className="font-bold text-[#8b6b4d] text-base border-r-2 border-[#8b6b4d] pr-2">🛡️ إدارة مستخدمي النظام وتعديل الصلاحيات</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
          {Object.entries(users).map(([key, user]) => {
            if (key === "مدير") return null; // keep general admin safe from deletion
            
            const isEditing = editingUserKey === key;
            const userPermissions = user.permissions || ["cart", "chat"];

            return (
              <div key={key} className={`border p-4 rounded-2xl flex flex-col gap-3 justify-between transition-all ${
                isEditing ? "bg-amber-50/50 border-amber-300 shadow-md" : "bg-gray-50 border-gray-100"
              }`}>
                {isEditing ? (
                  // EDIT MODE
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <strong className="text-sm text-gray-800">تعديل بيانات الحساب: <span className="font-mono text-[#8b6b4d]">{key}</span></strong>
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">وضع التعديل</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-600">الاسم المعروض</label>
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="p-1.5 border rounded-lg bg-white text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-600">كلمة السر</label>
                      <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="p-1.5 border rounded-lg bg-white text-xs text-left font-mono"
                        dir="ltr"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-600">نوع الحساب / الدور الوظيفي</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "مدير" | "مخزن" | "مستخدم")}
                        className="p-1.5 border rounded-lg bg-white text-xs"
                      >
                        <option value="مستخدم">مستخدم عادي (مندوب أو عامل)</option>
                        <option value="مخزن">مخزن فرعي (مستودع)</option>
                        <option value="مدير">مدير عام للنظام</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-600">اسم المستودع المرتبط (اختياري)</label>
                      <input
                        type="text"
                        value={editWarehouse}
                        onChange={(e) => setEditWarehouse(e.target.value)}
                        className="p-1.5 border rounded-lg bg-white text-xs"
                        placeholder="مثال: مخزن النحاس..."
                      />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                      <label className="text-[11px] font-bold text-[#8b6b4d] block">الصلاحيات الممنوحة:</label>
                      <div className="grid grid-cols-2 gap-1.5 bg-white p-2 rounded-xl border max-h-[120px] overflow-y-auto">
                        {ALL_SYSTEM_PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-center gap-1.5 text-[10px] text-gray-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPermissions.includes(p.id)}
                              onChange={() => toggleEditPermission(p.id)}
                              className="accent-[#8b6b4d] w-3.5 h-3.5"
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          onUpdateUser(key, {
                            username: key,
                            displayName: editDisplayName.trim() || key,
                            password: editPassword,
                            role: editRole,
                            warehouse: editWarehouse.trim() || undefined,
                            permissions: editPermissions
                          });
                          setEditingUserKey(null);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        💾 حفظ التعديلات
                      </button>
                      <button
                        onClick={() => setEditingUserKey(null)}
                        className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE
                  <>
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-sm text-gray-800">👤 {user.displayName || user.username}</strong>
                          <span className="text-[10px] mr-2 px-2 py-0.5 rounded-full bg-[#8b6b4d]/10 text-[#8b6b4d] font-bold">
                            {user.role}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">@{user.username}</span>
                      </div>
                      
                      {user.warehouse && (
                        <div className="text-xs text-gray-500 font-semibold mt-1">🏠 المستودع المرتبط: <span className="text-gray-800">{user.warehouse}</span></div>
                      )}
                      
                      <div className="text-xs text-gray-500 font-semibold mt-1">🔑 كلمة السر الحالية: <span className="bg-white border px-1.5 py-0.5 rounded font-mono text-[#8b6b4d] text-xs">{user.password}</span></div>

                      <div className="mt-2.5 pt-2 border-t border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 block mb-1">صلاحيات هذا الحساب:</span>
                        <div className="flex flex-wrap gap-1">
                          {userPermissions.map((pId, idx) => {
                            const found = ALL_SYSTEM_PERMISSIONS.find(sysP => sysP.id === pId);
                            return (
                              <span key={`${pId}-${idx}`} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                {found ? found.name.split(" ")[1] || found.name : pId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setEditingUserKey(key);
                          setEditDisplayName(user.displayName || user.username);
                          setEditPassword(user.password);
                          setEditRole(user.role);
                          setEditWarehouse(user.warehouse || "");
                          setEditPermissions(userPermissions);
                        }}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-1 rounded-lg text-xs cursor-pointer transition-all"
                      >
                        ✏️ تعديل التراخيص والبيانات
                      </button>
                      <button
                        onClick={() => onRemoveUser(key)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1 rounded-lg text-xs cursor-pointer transition-all"
                      >
                        🗑️ حذف كلي
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Registered Products Catalog Management Block */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg border-r-4 border-[#8b6b4d] pr-3 mb-2">📦 مستودع الأصناف المسجلة (كتالوج المنتجات)</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          إدارة الأصناف المسجلة تلقائياً في الكتالوج والتي يتم استخدامها للإكمال التلقائي في السلة وعروض الأسعار والتقارير. يمكنك مراجعة الأسماء، تعديلها لتوحيدها، أو حذف الأصناف المكررة وغير المرغوب فيها نهائياً لتنظيف الكتالوج.
        </p>

        {/* Search Catalog */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 ابحث عن صنف بالاسم أو الشركة أو الاسم الثابت..."
            value={savedItemsSearch}
            onChange={(e) => setSavedItemsSearch(e.target.value)}
            className="flex-1 p-2.5 border rounded-xl text-sm focus:outline-[#8b6b4d]"
          />
          {savedItemsSearch && (
            <button
              onClick={() => setSavedItemsSearch("")}
              className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all"
            >
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Table/List of Saved Items */}
        <div className="border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-3 font-bold text-gray-700 w-1/12 text-center">#</th>
                <th className="p-3 font-bold text-gray-700 w-3/12">اسم الشركة</th>
                <th className="p-3 font-bold text-gray-700 w-4/12">الاسم الثابت الموحد</th>
                <th className="p-3 font-bold text-gray-700 w-4/12">الاسم الكامل في الكتالوج</th>
                <th className="p-3 font-bold text-gray-700 w-2/12 text-center">العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {savedItems
                .filter(item => {
                  if (!savedItemsSearch.trim()) return true;
                  const query = savedItemsSearch.toLowerCase();
                  return (
                    (item.name || "").toLowerCase().includes(query) ||
                    (item.company || "").toLowerCase().includes(query) ||
                    (item.fixedName || "").toLowerCase().includes(query)
                  );
                })
                .map((item, index) => {
                  const isEditing = editingSavedItemId === item.id;
                  return (
                    <tr key={`${item.id || index}-${index}`} className="hover:bg-gray-50/50">
                      <td className="p-3 text-center text-gray-400">{index + 1}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingSavedItemCompany}
                            onChange={(e) => setEditingSavedItemCompany(e.target.value)}
                            className="w-full p-1 border rounded text-xs focus:outline-[#8b6b4d]"
                          />
                        ) : (
                          <span className="font-bold text-[#8b6b4d]">{item.company || "-"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingSavedItemFixedName}
                            onChange={(e) => setEditingSavedItemFixedName(e.target.value)}
                            className="w-full p-1 border rounded text-xs focus:outline-[#8b6b4d]"
                          />
                        ) : (
                          <span className="font-semibold text-gray-800">{item.fixedName || "-"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingSavedItemName}
                            onChange={(e) => setEditingSavedItemName(e.target.value)}
                            className="w-full p-1 border rounded text-xs focus:outline-[#8b6b4d]"
                          />
                        ) : (
                          <span className="text-gray-500">{item.name}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => handleSaveSavedItemEdit(item.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] transition-all"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => setEditingSavedItemId(null)}
                              className="px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded font-bold text-[10px] transition-all"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => handleEditSavedItem(item)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded font-bold text-[10px] transition-all"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteSavedItemClick(item.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] transition-all"
                            >
                              حذف
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {savedItems.filter(item => {
                if (!savedItemsSearch.trim()) return true;
                const query = savedItemsSearch.toLowerCase();
                return (
                  (item.name || "").toLowerCase().includes(query) ||
                  (item.company || "").toLowerCase().includes(query) ||
                  (item.fixedName || "").toLowerCase().includes(query)
                );
              }).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                    لا توجد أصناف تطابق معايير البحث في الكتالوج.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
