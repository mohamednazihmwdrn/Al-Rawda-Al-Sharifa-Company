export interface User {
  username: string;
  displayName: string;
  password?: string;
  role: "مدير" | "مخزن" | "مستخدم";
  warehouse: string | null;
  permissions?: string[];
}

export interface Item {
  id: string;
  company: string;
  fixedName: string;
  description: string;
  note: string;
  date: string;
  time: string;
  warehouse: string;
  user: string;
  savedAt: string;
  status: "active" | "waiting" | "deleted" | "reported" | "approved" | "rejected";
  duplicateFrom?: string;
  duplicateNote?: boolean;
  deletedAt?: string;
  deletedFrom?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt?: number;
  deliveryStatus?: "received" | "delayed" | "pending";
  deliveredAt?: string;
  isRollover?: boolean;
  originalDate?: string;
  rolledOver?: boolean;
  rolledOverToDate?: string;
  resent?: boolean;
  resentToDate?: string;
  isNotArrived?: boolean;
  originalQty?: string;
  receivedQty?: string;
  remainingQty?: string;
  hasPartialReceipt?: boolean;
}

export interface MergedInvoice {
  id: string;
  invoiceNumber: number;
  date: string;
  time: string;
  items: Item[];
  warehouses: string[];
  total: number;
  status: "pending" | "approved" | "rejected" | "empty" | "auto_approved";
  unread: boolean;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface Archive {
  id: string;
  title: string;
  date: string;
  time: string;
  warehouse: string;
  user: string;
  items: Item[];
  total: number;
  approvedAt?: string;
  merged?: boolean;
  warehouses?: string[];
  invoiceNumber?: number;
  unread: boolean;
  autoArchived?: boolean;
}

export interface WarehouseArchive {
  id: string;
  title: string;
  date: string;
  time: string;
  warehouse: string;
  user: string;
  items: Item[];
  total: number;
  status: string;
  invoiceNumber?: number;
  unread: boolean;
}

export interface Report {
  id: string;
  date: string;
  time: string;
  items: Item[];
  warehouse: string;
  total: number;
  invoiceNumber?: number;
  approvedAt?: string;
  autoArchived?: boolean;
}

export interface SavedItem {
  id: string;
  name: string;
  company: string;
  fixedName: string;
  note?: string;
  price?: number;
  lastPrice?: number;
  lastUsed?: string;
}

export interface QuotationItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  note: string;
  subtotal: number;
  total: number;
  company?: string;
  fixedName?: string;
  warehouse?: string;
}

export interface Quotation {
  id: string;
  quotationNumber?: number;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  items: QuotationItem[];
  total: number;
  user: string;
  status: "pending" | "approved";
  createdAt: string;
  approvedAt?: string;
  updatedAt?: string;
}

export interface TrashItem {
  id: string;
  type: "mergedInvoice" | "item" | "archive" | "report" | "quotation";
  title: string;
  data: any;
  itemCount?: number;
  deletedAt: string;
  deletedTimestamp: number;
  deletedBy: string;
  warehouse?: string;
  originalInvoiceNumber?: number;
}

