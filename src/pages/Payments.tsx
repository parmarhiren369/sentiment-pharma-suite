import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ArrowUpRight, Clock, HandCoins, Plus, RefreshCw, Users, Wallet } from "lucide-react";

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

export default function Payments() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);

  const [activePartyType, setActivePartyType] = useState<PartyType>("customer");
  const [partySearch, setPartySearch] = useState("");
  const [openPartyId, setOpenPartyId] = useState<string | null>(null);

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

  const rupees = (n: number): string => {
    const value = Number.isFinite(n) ? n : 0;
    return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
    if (!partySearch.trim()) return partySummaries;
    const q = partySearch.toLowerCase();
    return partySummaries.filter((p) => p.name.toLowerCase().includes(q));
  }, [partySearch, partySummaries]);

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
      <AppHeader title="Payments" subtitle="Track payments received and paid" />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total outstanding"
            value={rupees(topStats.totalOutstanding)}
            change={activePartyType === "customer" ? "To receive" : "To pay"}
            changeType="neutral"
            icon={Wallet}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
          <StatCard
            title="Overdue amount"
            value={rupees(topStats.overdueAmount)}
            change={"Past due"}
            changeType="negative"
            icon={Clock}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Advance payments"
            value={rupees(topStats.advancePayments)}
            change={"Extra paid"}
            changeType="positive"
            icon={HandCoins}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Active parties"
            value={topStats.activeCount.toString()}
            change={activePartyType === "customer" ? "Customers" : "Suppliers"}
            changeType="neutral"
            icon={Users}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
        </div>

        <Card className="p-4 mb-4">
          <div className="flex items-center justify-center">
            <div className="flex w-full max-w-3xl gap-4">
            <Button
              size="lg"
              variant={activePartyType === "customer" ? "default" : "outline"}
              className="h-12 flex-1 text-base"
              onClick={() => {
                setActivePartyType("customer");
                setOpenPartyId(null);
              }}
            >
              Customers
            </Button>
            <Button
              size="lg"
              variant={activePartyType === "supplier" ? "default" : "outline"}
              className="h-12 flex-1 text-base"
              onClick={() => {
                setActivePartyType("supplier");
                setOpenPartyId(null);
              }}
            >
              Suppliers
            </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <Button variant="outline" className="gap-2" onClick={fetchAll} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {visiblePartySummaries.map((p) => {
            const isOpen = openPartyId === p.id;
            const settledLabel = activePartyType === "customer" ? "Received" : "Paid";
            const dueLabel = activePartyType === "customer" ? "To Receive" : "To Pay";
            const txRows = isOpen ? buildPartyTransactions(p) : [];

            const MetricButton = ({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) => (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-2 py-1 justify-start"
                onClick={() => toggleParty(p.id)}
              >
                <span className="text-xs text-muted-foreground mr-2">{label}</span>
                <span className={`text-sm font-medium ${valueClassName || ""}`}>{value}</span>
              </Button>
            );

            return (
              <Card key={p.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-base truncate">{p.name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <MetricButton label="Total invoiced:" value={rupees(p.totalInvoiced)} />
                      <MetricButton label={`${settledLabel}:`} value={rupees(p.settled)} valueClassName={activePartyType === "customer" ? "text-success" : ""} />
                      <MetricButton label="Return/ Adjustments:" value={rupees(p.creditAdjustments)} />
                      <MetricButton label={`${dueLabel}:`} value={rupees(p.outstanding)} valueClassName={activePartyType === "customer" ? "text-destructive" : ""} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" className="gap-2" onClick={() => printPartyStatement(p)}>
                      <ArrowUpRight className="w-4 h-4" />
                      Print
                    </Button>
                    <Button className="gap-2" onClick={() => openAddForParty(activePartyType, p.id, p.name)}>
                      <Plus className="w-4 h-4" />
                      Add payment
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 rounded-md border overflow-x-auto">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
                      <div className="text-sm font-medium">Transaction history</div>
                      <div className="text-xs text-muted-foreground">Balance: {rupees(p.balance)}</div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Date</TableHead>
                          <TableHead className="w-[140px]">Type</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="w-[140px] text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {txRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              No transactions found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          txRows.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.date || "—"}</TableCell>
                              <TableCell>{r.kind}</TableCell>
                              <TableCell className="truncate max-w-[520px]">{r.ref || "—"}</TableCell>
                              <TableCell className={`text-right font-medium ${r.amount >= 0 ? "text-foreground" : "text-success"}`}>
                                {rupees(r.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </Card>
            );
          })}

          {visiblePartySummaries.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">No parties found.</Card>
          ) : null}
        </div>
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
