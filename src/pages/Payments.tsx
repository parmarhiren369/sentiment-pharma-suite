import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  HandCoins,
  Plus,
  Printer,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

type InvoiceTxStatus = "Paid" | "Partially Paid" | "Unpaid";

type PaymentDirection = "In" | "Out";
type PaymentMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque";
type PaymentStatus = "Completed" | "Pending" | "Failed";

interface PaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  direction: PaymentDirection;
  partyType: "customer" | "supplier" | "other";
  partyId?: string;
  partyName?: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes?: string;
  status: PaymentStatus;
  createdAt?: Date;
}

interface PartyOption {
  id: string;
  name: string;
}

type PartyType = "customer" | "supplier";

type InvoiceStatus = string;

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  partyType: PartyType;
  partyId: string;
  partyName: string;
  issueDate: string;
  dueDate?: string;
  total: number;
  status?: InvoiceStatus;
}

type NoteType = "Debit" | "Credit";

interface NoteRecord {
  id: string;
  noteType: NoteType;
  noteNo: string;
  date: string;
  partyType: PartyType;
  partyId: string;
  partyName: string;
  amount: number;
  relatedInvoiceNo?: string;
  reason?: string;
}

const defaultFormState = {
  date: new Date().toISOString().slice(0, 10),
  direction: "In" as PaymentDirection,
  partyType: "customer" as PaymentRecord["partyType"],
  partyId: "",
  partyName: "",
  amount: "",
  method: "Cash" as PaymentMethod,
  reference: "",
  notes: "",
  status: "Completed" as PaymentStatus,
};

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function partyShortCode(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";

  const lettersOnly = first.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (lettersOnly.startsWith("AL")) return "AL";
  return lettersOnly.slice(0, 3);
}

export default function Payments() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);

  const [activePartyType, setActivePartyType] = useState<PartyType>("customer");
  const [partySearch, setPartySearch] = useState("");
  const [openPartyId, setOpenPartyId] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterOutstandingOnly, setFilterOutstandingOnly] = useState(false);
  const [filterAdvanceOnly, setFilterAdvanceOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRecord | null>(null);
  const [formData, setFormData] = useState(defaultFormState);

  const { toast } = useToast();

  const partyOptions = useMemo(() => {
    if (formData.partyType === "supplier") return suppliers;
    if (formData.partyType === "customer") return customers;
    return [];
  }, [customers, suppliers, formData.partyType]);

  const selectedParty = useMemo(() => {
    if (formData.partyType === "other") return { id: "", name: formData.partyName.trim() };
    return partyOptions.find((p) => p.id === formData.partyId);
  }, [formData.partyId, formData.partyName, formData.partyType, partyOptions]);

  const CURRENCY = "₹";

  const amountText = (n: number): string => {
    const value = Number.isFinite(n) ? n : 0;
    return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rupees = (n: number): string => `${CURRENCY}${amountText(n)}`;
  const money = (n: number): string => rupees(n);

  const isOverdueInvoice = (inv: InvoiceRecord): boolean => {
    if ((inv.status || "").toLowerCase() === "paid") return false;
    if ((inv.status || "").toLowerCase() === "overdue") return true;
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const activeParties = useMemo(() => (activePartyType === "customer" ? customers : suppliers), [activePartyType, customers, suppliers]);

  const partySummaries = useMemo(() => {
    const completedPayments = payments.filter((p) => p.status === "Completed");
    return activeParties
      .map((p) => {
        const partyInvoices = invoices.filter((x) => x.partyType === activePartyType && x.partyId === p.id);
        const partyNotes = notes.filter((x) => x.partyType === activePartyType && x.partyId === p.id);
        const partyPayments = completedPayments.filter((x) => x.partyType === activePartyType && x.partyId === p.id);

        const totalInvoiced = partyInvoices.reduce((sum, x) => sum + (x.total || 0), 0);

        const creditAdjustments = partyNotes.filter((n) => n.noteType === "Credit").reduce((sum, n) => sum + (n.amount || 0), 0);
        const debitAdjustments = partyNotes.filter((n) => n.noteType === "Debit").reduce((sum, n) => sum + (n.amount || 0), 0);

        const settledDirection: PaymentDirection = activePartyType === "customer" ? "In" : "Out";
        const settled = partyPayments
          .filter((x) => x.direction === settledDirection)
          .reduce((sum, x) => sum + (x.amount || 0), 0);

        const balance = totalInvoiced + debitAdjustments - creditAdjustments - settled;
        const outstanding = Math.max(0, balance);
        const advance = Math.max(0, -balance);

        const overdueInvoicesTotal = partyInvoices.filter(isOverdueInvoice).reduce((sum, x) => sum + (x.total || 0), 0);
        const overdueOutstanding = Math.min(outstanding, overdueInvoicesTotal);

        return {
          id: p.id,
          name: p.name,
          totalInvoiced,
          settled,
          creditAdjustments,
          debitAdjustments,
          balance,
          outstanding,
          advance,
          overdueOutstanding,
          invoices: partyInvoices,
          notes: partyNotes,
          payments: partyPayments,
        };
      })
      .filter((x) => x.name);
  }, [activeParties, activePartyType, invoices, notes, payments]);

  const topStats = useMemo(() => {
    const totalOutstanding = partySummaries.reduce((sum, x) => sum + x.outstanding, 0);
    const overdueAmount = partySummaries.reduce((sum, x) => sum + x.overdueOutstanding, 0);
    const advancePayments = partySummaries.reduce((sum, x) => sum + x.advance, 0);
    const activeCount = partySummaries.filter((x) => x.totalInvoiced > 0 || x.settled > 0 || x.creditAdjustments > 0 || x.debitAdjustments > 0).length;
    return { totalOutstanding, overdueAmount, advancePayments, activeCount };
  }, [partySummaries]);

  const visiblePartySummaries = useMemo(() => {
    let list = partySummaries;

    if (filterOverdueOnly) list = list.filter((p) => p.overdueOutstanding > 0);
    if (filterOutstandingOnly) list = list.filter((p) => p.outstanding > 0);
    if (filterAdvanceOnly) list = list.filter((p) => p.advance > 0);

    if (!partySearch.trim()) return list;
    const q = partySearch.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [filterAdvanceOnly, filterOutstandingOnly, filterOverdueOnly, partySearch, partySummaries]);

  const fetchParties = async () => {
    const [customersSnap, suppliersSnap] = await Promise.all([
      getDocs(collection(db, "customers")),
      getDocs(collection(db, "suppliers")),
    ]);

    const customersList = customersSnap.docs
      .map((d) => ({ id: d.id, name: (d.data().name || "").toString() }))
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    const suppliersList = suppliersSnap.docs
      .map((d) => ({ id: d.id, name: (d.data().name || "").toString() }))
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    setCustomers(customersList);
    setSuppliers(suppliersList);
  };

  const fetchPayments = async () => {
    const qy = query(collection(db, "payments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: (data.date || "").toString(),
        direction: (data.direction || "In") as PaymentDirection,
        partyType: (data.partyType || "customer") as PaymentRecord["partyType"],
        partyId: (data.partyId || "").toString() || undefined,
        partyName: (data.partyName || "").toString() || undefined,
        amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
        method: (data.method || "Cash") as PaymentMethod,
        reference: (data.reference || "").toString(),
        notes: (data.notes || "").toString() || undefined,
        status: (data.status || "Completed") as PaymentStatus,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as PaymentRecord;
    });
    setPayments(list);
  };

  const fetchInvoices = async () => {
    const qy = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          invoiceNo: (data.invoiceNo || "").toString(),
          manualInvoiceNo: (data.manualInvoiceNo || "").toString() || undefined,
          partyType: ((data.partyType || "customer") as PartyType) || "customer",
          partyId: (data.partyId || "").toString(),
          partyName: (data.partyName || "").toString(),
          issueDate: (data.issueDate || "").toString(),
          dueDate: (data.dueDate || "").toString() || undefined,
          total: typeof data.total === "number" ? data.total : parseFloat(data.total) || 0,
          status: (data.status || "").toString() || undefined,
        } as InvoiceRecord;
      })
      .filter((x) => x.invoiceNo && x.partyId);
    setInvoices(list);
  };

  const fetchNotes = async () => {
    const qy = query(collection(db, "debitCreditNotes"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          noteType: (data.noteType || "Debit") as NoteType,
          noteNo: (data.noteNo || "").toString(),
          date: (data.date || "").toString(),
          partyType: (data.partyType || "customer") as PartyType,
          partyId: (data.partyId || "").toString(),
          partyName: (data.partyName || "").toString(),
          amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
          relatedInvoiceNo: (data.relatedInvoiceNo || "").toString() || undefined,
          reason: (data.reason || "").toString() || undefined,
        } as NoteRecord;
      })
      .filter((x) => x.noteNo && x.partyId);
    setNotes(list);
  };

  const fetchAll = async () => {
    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await Promise.all([fetchParties(), fetchPayments(), fetchInvoices(), fetchNotes()]);
    } catch (error) {
      console.error("Error fetching payments", error);
      toast({
        title: "Load failed",
        description: "Could not load payments/invoices/notes from Firestore.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setFormData({
      ...defaultFormState,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const openAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openAddForParty = (partyType: PartyType, partyId: string, partyName: string) => {
    resetForm();
    setFormData((s) => ({
      ...s,
      partyType,
      partyId,
      partyName,
      direction: partyType === "customer" ? "In" : "Out",
    }));
    setIsDialogOpen(true);
  };

  const toggleParty = (partyId: string) => {
    setOpenPartyId((cur) => (cur === partyId ? null : partyId));
  };

  const buildPartyInvoiceHistoryRows = (summary: (typeof partySummaries)[number]) => {
    type InvoiceHistoryRow = {
      invoiceId: string;
      date: string;
      type: string;
      invoiceNo: string;
      amountPaid: number;
      amountRemaining: number;
      totalAmount: number;
      status: InvoiceTxStatus;
    };

    const norm = (v: unknown) => (v ?? "").toString().trim().toLowerCase();

    const byDateAsc = [...summary.invoices].sort((a, b) => (a.issueDate || "").localeCompare(b.issueDate || ""));

    const notesByInvoiceNo = new Map<string, { debit: number; credit: number }>();
    for (const n of summary.notes) {
      const invNo = norm(n.relatedInvoiceNo);
      if (!invNo) continue;
      const cur = notesByInvoiceNo.get(invNo) || { debit: 0, credit: 0 };
      if (n.noteType === "Debit") cur.debit += Number(n.amount) || 0;
      else cur.credit += Number(n.amount) || 0;
      notesByInvoiceNo.set(invNo, cur);
    }

    const settledDirection: PaymentDirection = activePartyType === "customer" ? "In" : "Out";
    const relevantPayments = summary.payments.filter((p) => p.direction === settledDirection);

    const paymentMatchesInvoice = (payment: PaymentRecord, systemInvoiceNo: string, manualInvoiceNo?: string) => {
      const ref = norm(payment.reference);
      if (!ref) return false;
      const sys = norm(systemInvoiceNo);
      const man = norm(manualInvoiceNo);
      return (sys && ref.includes(sys)) || (man && ref.includes(man));
    };

    const noteAdjustForInvoice = (systemInvoiceNo: string, manualInvoiceNo?: string) => {
      const sysKey = norm(systemInvoiceNo);
      const manKey = norm(manualInvoiceNo);
      const a = sysKey ? notesByInvoiceNo.get(sysKey) : undefined;
      const b = manKey ? notesByInvoiceNo.get(manKey) : undefined;
      return {
        debit: (a?.debit || 0) + (b?.debit || 0),
        credit: (a?.credit || 0) + (b?.credit || 0),
      };
    };

    return byDateAsc.map((inv) => {
      const systemInvoiceNo = (inv.invoiceNo || "").toString();
      const manualInvoiceNo = inv.manualInvoiceNo;
      const displayInvoiceNo = manualInvoiceNo || systemInvoiceNo;

      const noteAdjust = noteAdjustForInvoice(systemInvoiceNo, manualInvoiceNo);
      const baseTotal = Number(inv.total) || 0;
      const adjustedTotal = Math.max(0, baseTotal + noteAdjust.debit - noteAdjust.credit);

      const paidRaw = relevantPayments
        .filter((p) => paymentMatchesInvoice(p, systemInvoiceNo, manualInvoiceNo))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const paid = Math.min(adjustedTotal, Math.max(0, paidRaw));

      const amountRemaining = Math.max(0, adjustedTotal - paid);
      const status: InvoiceTxStatus = amountRemaining <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";

      const typeLabel = activePartyType === "customer" ? "Invoice (Sale)" : "Invoice (Purchase)";

      return {
        invoiceId: inv.id,
        date: inv.issueDate || inv.dueDate || "",
        type: typeLabel,
        invoiceNo: displayInvoiceNo,
        amountPaid: paid,
        amountRemaining,
        totalAmount: adjustedTotal,
        status,
      } as InvoiceHistoryRow;
    });
  };

  const buildPartyTransactions = (summary: (typeof partySummaries)[number]) => {
    type TxRow = { date: string; kind: string; ref: string; amount: number };
    const rows: TxRow[] = [];

    for (const inv of summary.invoices) {
      rows.push({
        date: inv.issueDate || inv.dueDate || "",
        kind: "Invoice",
        ref: inv.invoiceNo,
        amount: Number(inv.total) || 0,
      });
    }

    for (const n of summary.notes) {
      const sign = n.noteType === "Debit" ? 1 : -1;
      rows.push({
        date: n.date || "",
        kind: n.noteType === "Debit" ? "Debit Note" : "Credit Note",
        ref: n.noteNo || n.relatedInvoiceNo || "",
        amount: (Number(n.amount) || 0) * sign,
      });
    }

    for (const p of summary.payments) {
      const sign =
        activePartyType === "customer"
          ? p.direction === "In"
            ? -1
            : 1
          : p.direction === "Out"
            ? -1
            : 1;
      rows.push({
        date: p.date || "",
        kind: p.direction === "In" ? "Payment In" : "Payment Out",
        ref: p.reference || p.method,
        amount: (Number(p.amount) || 0) * sign,
      });
    }

    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return rows;
  };

  const printPartyStatement = (summary: (typeof partySummaries)[number]) => {
    const rows = buildPartyTransactions(summary);

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Statement - ${summary.name}</title>
          <style>
            body{font-family:Arial, Helvetica, sans-serif; padding:24px;}
            h1{font-size:18px; margin:0 0 8px;}
            .muted{color:#555; font-size:12px; margin-bottom:16px;}
            .kpi{display:flex; gap:16px; font-size:12px; margin:12px 0 18px;}
            .kpi div{border:1px solid #ddd; padding:8px 10px; border-radius:8px;}
            table{width:100%; border-collapse:collapse;}
            th,td{border:1px solid #ddd; padding:8px; font-size:12px;}
            th{text-align:left; background:#f6f6f6;}
            td.num{text-align:right;}
          </style>
        </head>
        <body>
          <h1>${summary.name} — Statement</h1>
          <div class="muted">Generated on ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div><b>Total invoiced</b><br/>${rupees(summary.totalInvoiced)}</div>
            <div><b>Settled</b><br/>${rupees(summary.settled)}</div>
            <div><b>Adjustments (Credit)</b><br/>${rupees(summary.creditAdjustments)}</div>
            <div><b>Balance</b><br/>${rupees(summary.balance)}</div>
          </div>
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Reference</th><th class="num">Amount</th></tr>
            </thead>
            <tbody>
              ${rows
                .map((r) => `<tr><td>${r.date || "—"}</td><td>${r.kind}</td><td>${r.ref || "—"}</td><td class="num">${rupees(r.amount)}</td></tr>`)
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      toast({ title: "Popup blocked", description: "Please allow popups to print the statement." });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const openEdit = (row: PaymentRecord) => {
    setEditing(row);
    setFormData({
      date: row.date,
      direction: row.direction,
      partyType: row.partyType,
      partyId: row.partyId || "",
      partyName: row.partyName || "",
      amount: (row.amount ?? 0).toString(),
      method: row.method,
      reference: row.reference,
      notes: row.notes || "",
      status: row.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("Delete this payment?")) return;

    try {
      await deleteDoc(doc(db, "payments", id));
      toast({ title: "Deleted", description: "Payment removed." });
      fetchPayments();
    } catch (error) {
      console.error("Error deleting payment", error);
      toast({
        title: "Delete failed",
        description: "Could not delete payment.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    const amount = safeNumber(formData.amount);
    if (amount <= 0) {
      toast({ title: "Validation error", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }

    if (formData.partyType !== "other" && !formData.partyId) {
      toast({ title: "Validation error", description: "Select a party.", variant: "destructive" });
      return;
    }

    if (formData.partyType === "other" && !formData.partyName.trim()) {
      toast({ title: "Validation error", description: "Party name is required.", variant: "destructive" });
      return;
    }

    const payload = {
      date: formData.date,
      direction: formData.direction,
      partyType: formData.partyType,
      partyId: formData.partyType === "other" ? "" : formData.partyId,
      partyName: selectedParty?.name || "",
      amount,
      method: formData.method,
      reference: formData.reference.trim(),
      notes: formData.notes.trim(),
      status: formData.status,
      updatedAt: Timestamp.now(),
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "payments", editing.id), payload);
        toast({ title: "Updated", description: "Payment updated." });
      } else {
        await addDoc(collection(db, "payments"), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        toast({ title: "Saved", description: "Payment saved to Firestore." });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error) {
      console.error("Error saving payment", error);
      toast({
        title: "Save failed",
        description: "Could not save payment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">Payment Tracking</div>
              <div className="text-sm text-muted-foreground">
                Track payments and outstanding balances for customers and suppliers
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="outline" className="gap-2 h-10" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" className="gap-2 h-10" onClick={fetchAll} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={filterOverdueOnly ? "default" : "outline"}
                className={filterOverdueOnly ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={() => setFilterOverdueOnly((v) => !v)}
              >
                Overdue only
              </Button>
              <Button
                type="button"
                variant={filterOutstandingOnly ? "default" : "outline"}
                className={filterOutstandingOnly ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={() => setFilterOutstandingOnly((v) => !v)}
              >
                Outstanding only
              </Button>
              <Button
                type="button"
                variant={filterAdvanceOnly ? "default" : "outline"}
                className={filterAdvanceOnly ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={() => setFilterAdvanceOnly((v) => !v)}
              >
                Advance only
              </Button>
              {(filterOverdueOnly || filterOutstandingOnly || filterAdvanceOnly) ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setFilterOverdueOnly(false);
                    setFilterOutstandingOnly(false);
                    setFilterAdvanceOnly(false);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Outstanding</div>
                <div className="mt-2 leading-tight">
                  <div className="text-base font-bold text-foreground">₹</div>
                  <div className="text-3xl font-extrabold tabular-nums">{amountText(topStats.totalOutstanding)}</div>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Overdue Amount</div>
                <div className="mt-2 text-2xl font-extrabold tabular-nums text-destructive">{money(topStats.overdueAmount)}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Advance Payments</div>
                <div className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700">{money(topStats.advancePayments)}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <HandCoins className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Active Parties</div>
                <div className="mt-2 text-3xl font-extrabold tabular-nums text-purple-700">{topStats.activeCount}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 rounded-2xl shadow-sm">
          <div className="rounded-xl border bg-muted/10 p-1 grid grid-cols-2 gap-1">
            <Button
              type="button"
              className={activePartyType === "customer" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-transparent hover:bg-background"}
              variant={activePartyType === "customer" ? "default" : "ghost"}
              onClick={() => {
                setActivePartyType("customer");
                setOpenPartyId(null);
              }}
            >
              Customers
            </Button>
            <Button
              type="button"
              className={activePartyType === "supplier" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-transparent hover:bg-background"}
              variant={activePartyType === "supplier" ? "default" : "ghost"}
              onClick={() => {
                setActivePartyType("supplier");
                setOpenPartyId(null);
              }}
            >
              Suppliers
            </Button>
          </div>

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
              placeholder={activePartyType === "customer" ? "Search customers..." : "Search suppliers..."}
              className="pl-10"
            />
          </div>
        </Card>

        <Card className="p-0 overflow-hidden rounded-2xl shadow-sm">
          <div className="divide-y">
            {visiblePartySummaries.map((p) => {
            const isOpen = openPartyId === p.id;
            const settledLabel = activePartyType === "customer" ? "Received" : "Paid";
            const dueLabel = activePartyType === "customer" ? "To Receive" : "To Pay";
            const invoiceRows = isOpen ? buildPartyInvoiceHistoryRows(p) : [];

            const accentClass =
              p.overdueOutstanding > 0
                ? "border-l-red-500"
                : p.outstanding > 0
                  ? "border-l-amber-500"
                  : p.advance > 0
                    ? "border-l-green-500"
                    : "border-l-transparent";

            const isActive =
              p.totalInvoiced > 0 || p.settled > 0 || p.creditAdjustments > 0 || p.debitAdjustments > 0;

            const shortCode = partyShortCode(p.name);

            return (
              <div key={p.id} className={`px-4 py-4 border-l-4 ${accentClass}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleParty(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleParty(p.id);
                    }
                  }}
                  className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between cursor-pointer select-none rounded-lg -mx-2 px-2 py-1 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1 h-8 w-8 rounded-lg border bg-background flex items-center justify-center shrink-0">
                      <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold tracking-wide uppercase truncate">{p.name}</div>
                        {shortCode ? (
                          <span className="text-xs font-semibold text-muted-foreground">{shortCode}</span>
                        ) : null}
                        {isActive ? (
                          <span className="rounded-full bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 font-semibold">
                            ACTIVE
                          </span>
                        ) : null}
                        {p.overdueOutstanding > 0 ? (
                          <span className="rounded-full bg-destructive/10 text-destructive text-[11px] px-2 py-0.5 font-semibold">
                            OVERDUE
                          </span>
                        ) : p.advance > 0 ? (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-semibold">
                            ADVANCE
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div className="text-muted-foreground">
                          Total Invoiced: <span className="text-foreground font-medium">{money(p.totalInvoiced)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {settledLabel}: <span className="font-medium text-emerald-700">{money(p.settled)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Returns/Adjustments: <span className="font-medium text-purple-700">{money(p.creditAdjustments)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {dueLabel}: <span className="font-semibold text-orange-600">{money(p.outstanding)}</span>
                        </div>
                        {p.advance > 0 ? (
                          <div className="text-muted-foreground">
                            Advance Balance: <span className="font-medium text-blue-700">{money(p.advance)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          className="gap-2 bg-slate-700 text-white hover:bg-slate-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Printer className="h-4 w-4" />
                          Print
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            printPartyStatement(p);
                          }}
                        >
                          Print statement
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      type="button"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddForParty(activePartyType, p.id, p.name);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Payment
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 rounded-md border overflow-x-auto bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-muted/20">
                      <div className="text-sm font-medium">Transaction History</div>
                      <div className="text-xs text-muted-foreground">Balance: {money(p.balance)}</div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Date</TableHead>
                          <TableHead className="w-[160px]">Type</TableHead>
                          <TableHead className="w-[180px]">Invoice Number</TableHead>
                          <TableHead className="w-[170px] text-right">Amount Paid Till Now</TableHead>
                          <TableHead className="w-[170px] text-right">Amount Remaining</TableHead>
                          <TableHead className="w-[140px] text-right">Total Amount</TableHead>
                          <TableHead className="w-[140px]">Status</TableHead>
                          <TableHead className="w-[160px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-muted-foreground">
                              No transactions found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invoiceRows.map((r) => (
                            <TableRow key={r.invoiceId}>
                              <TableCell>{r.date || "—"}</TableCell>
                              <TableCell>{r.type}</TableCell>
                              <TableCell className="font-medium">{r.invoiceNo || "—"}</TableCell>
                              <TableCell className="text-right font-medium text-emerald-700">{money(r.amountPaid)}</TableCell>
                              <TableCell className="text-right font-medium text-orange-600">{money(r.amountRemaining)}</TableCell>
                              <TableCell className="text-right font-medium">{money(r.totalAmount)}</TableCell>
                              <TableCell>
                                <span
                                  className={
                                    r.status === "Paid"
                                      ? "rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-semibold"
                                      : r.status === "Partially Paid"
                                        ? "rounded-full bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 font-semibold"
                                        : "rounded-full bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 font-semibold"
                                  }
                                >
                                  {r.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAddForParty(activePartyType, p.id, p.name);
                                      // Prefill reference with invoice number for traceability.
                                      setFormData((s) => ({ ...s, reference: r.invoiceNo }));
                                    }}
                                  >
                                    Add Payment
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = new URL(`/invoices/${r.invoiceId}/print`, window.location.origin).toString();
                                      const w = window.open(url, "_blank", "noopener,noreferrer");
                                      if (!w) {
                                        toast({
                                          title: "Popup blocked",
                                          description: "Please allow popups to print the invoice.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    Print
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            );
            })}

            {visiblePartySummaries.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No parties found.</div>
            ) : null}
          </div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payment" : "Add Payment"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData((s) => ({ ...s, date: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={formData.direction} onValueChange={(v) => setFormData((s) => ({ ...s, direction: v as PaymentDirection }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In">Received (In)</SelectItem>
                    <SelectItem value="Out">Paid (Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={(e) => setFormData((s) => ({ ...s, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={(v) => setFormData((s) => ({ ...s, method: v as PaymentMethod }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((s) => ({ ...s, status: v as PaymentStatus }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="UTR / Receipt no / Invoice no"
                />
              </div>

              <div className="space-y-2">
                <Label>Party Type</Label>
                <Select
                  value={formData.partyType}
                  onValueChange={(v) =>
                    setFormData((s) => ({
                      ...s,
                      partyType: v as PaymentRecord["partyType"],
                      partyId: "",
                      partyName: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select party type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.partyType === "other" ? (
                <div className="space-y-2">
                  <Label htmlFor="partyName">Party Name</Label>
                  <Input id="partyName" value={formData.partyName} onChange={(e) => setFormData((s) => ({ ...s, partyName: e.target.value }))} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Party</Label>
                  <Select value={formData.partyId} onValueChange={(v) => setFormData((s) => ({ ...s, partyId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={formData.partyType === "customer" ? "Select customer" : "Select supplier"} />
                    </SelectTrigger>
                    <SelectContent>
                      {partyOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
