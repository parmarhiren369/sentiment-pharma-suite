import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { ExportExcelButton } from "@/components/ExportExcelButton";
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
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, IndianRupee, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

type TransactionType = "Income" | "Expense";
type TransactionStatus = "Completed" | "Pending" | "Failed";

interface TransactionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference: string;
  partyType: "customer" | "supplier" | "other";
  partyId?: string;
  partyName?: string;
  notes?: string;
  createdAt?: Date;
}

interface PartyOption {
  id: string;
  name: string;
}

const defaultFormState = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  category: "General",
  amount: "",
  type: "Income" as TransactionType,
  status: "Completed" as TransactionStatus,
  reference: "",
  partyType: "customer" as TransactionRecord["partyType"],
  partyId: "",
  partyName: "",
  notes: "",
};

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRecord | null>(null);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((t) =>
      `${t.description} ${t.category} ${t.reference} ${t.partyName ?? ""}`.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const stats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "Income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expense = transactions
      .filter((t) => t.type === "Expense")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      total: transactions.length,
      income,
      expense,
      net: income - expense,
    };
  }, [transactions]);

  const exportRows = useMemo(
    () =>
      filtered.map((t) => ({
        Date: t.date,
        Type: t.type,
        Amount: t.amount,
        Category: t.category,
        Description: t.description,
        Party: t.partyName || "",
        Status: t.status,
        Reference: t.reference,
        Notes: t.notes || "",
      })),
    [filtered]
  );

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

  const fetchTransactions = async () => {
    const qy = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: (data.date || "").toString(),
        description: (data.description || "").toString(),
        category: (data.category || "General").toString(),
        amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
        type: (data.type || "Income") as TransactionType,
        status: (data.status || "Completed") as TransactionStatus,
        reference: (data.reference || "").toString(),
        partyType: (data.partyType || "customer") as TransactionRecord["partyType"],
        partyId: (data.partyId || "").toString() || undefined,
        partyName: (data.partyName || "").toString() || undefined,
        notes: (data.notes || "").toString() || undefined,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as TransactionRecord;
    });
    setTransactions(list);
  };

  const fetchInvoices = async () => {
    const qy = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        invoiceNo: (data.invoiceNo || "").toString(),
        manualInvoiceNo: (data.manualInvoiceNo || "").toString() || undefined,
        partyType: (data.partyType || "customer").toString(),
        partyId: (data.partyId || "").toString(),
        partyName: (data.partyName || "").toString(),
        issueDate: (data.issueDate || "").toString(),
        total: typeof data.total === "number" ? data.total : parseFloat(data.total) || 0,
      };
    });
    setInvoices(list);
  };

  const fetchPayments = async () => {
    const qy = query(collection(db, "payments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: (data.date || "").toString(),
        invoiceId: (data.invoiceId || "").toString() || undefined,
        invoiceNo: (data.invoiceNo || "").toString() || undefined,
        amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
        method: (data.method || "Cash").toString(),
        reference: (data.reference || "").toString(),
        bankTransferCharge: typeof data.bankTransferCharge === "number" ? data.bankTransferCharge : parseFloat(data.bankTransferCharge) || 0,
        notes: (data.notes || "").toString() || undefined,
        status: (data.status || "Completed").toString(),
        partyId: (data.partyId || "").toString() || undefined,
        partyType: (data.partyType || "customer").toString(),
      };
    });
    setPayments(list);
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
      await Promise.all([fetchParties(), fetchTransactions(), fetchInvoices(), fetchPayments()]);
    } catch (error) {
      console.error("Error fetching transactions", error);
      toast({
        title: "Load failed",
        description: "Could not load transactions from Firestore.",
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

  const openEdit = (row: TransactionRecord) => {
    setEditing(row);
    setFormData({
      date: row.date,
      description: row.description,
      category: row.category,
      amount: (row.amount ?? 0).toString(),
      type: row.type,
      status: row.status,
      reference: row.reference,
      partyType: row.partyType,
      partyId: row.partyId || "",
      partyName: row.partyName || "",
      notes: row.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("Delete this transaction?")) return;

    try {
      await deleteDoc(doc(db, "transactions", id));
      toast({ title: "Deleted", description: "Transaction removed." });
      fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction", error);
      toast({
        title: "Delete failed",
        description: "Could not delete transaction.",
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

    if (!formData.date) {
      toast({ title: "Validation error", description: "Date is required.", variant: "destructive" });
      return;
    }

    if (!formData.description.trim()) {
      toast({ title: "Validation error", description: "Description is required.", variant: "destructive" });
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
      description: formData.description.trim(),
      category: formData.category.trim() || "General",
      amount,
      type: formData.type,
      status: formData.status,
      reference: formData.reference.trim(),
      partyType: formData.partyType,
      partyId: formData.partyType === "other" ? "" : formData.partyId,
      partyName: selectedParty?.name || "",
      notes: formData.notes.trim(),
      updatedAt: Timestamp.now(),
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "transactions", editing.id), payload);
        toast({ title: "Updated", description: "Transaction updated." });
      } else {
        await addDoc(collection(db, "transactions"), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        toast({ title: "Saved", description: "Transaction saved to Firestore." });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error) {
      console.error("Error saving transaction", error);
      toast({
        title: "Save failed",
        description: "Could not save transaction.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: "date", header: "Date" },
      {
        key: "type",
        header: "Type",
        render: (t: TransactionRecord) => (
          <span className={t.type === "Income" ? "text-success font-medium" : "text-destructive font-medium"}>
            {t.type}
          </span>
        ),
      },
      { key: "description", header: "Description" },
      { key: "category", header: "Category" },
      {
        key: "amount",
        header: "Amount",
        render: (t: TransactionRecord) => (
          <span className="font-medium">₹{(t.amount || 0).toLocaleString("en-IN")}</span>
        ),
      },
      { key: "partyName", header: "Party" },
      { key: "status", header: "Status" },
      { key: "reference", header: "Reference" },
      {
        key: "actions",
        header: "Actions",
        render: (t: TransactionRecord) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(t)}>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleDelete(t.id)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <AppHeader title="Transactions" subtitle="Create and manage income/expense transactions" />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total"
            value={stats.total.toString()}
            change={"All entries"}
            changeType="neutral"
            icon={IndianRupee}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Income"
            value={`₹${stats.income.toLocaleString("en-IN")}`}
            change={""}
            changeType="positive"
            icon={ArrowUpRight}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Expense"
            value={`₹${stats.expense.toLocaleString("en-IN")}`}
            change={""}
            changeType="negative"
            icon={ArrowDownRight}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Net"
            value={`₹${stats.net.toLocaleString("en-IN")}`}
            change={stats.net >= 0 ? "Profit" : "Loss"}
            changeType={stats.net >= 0 ? "positive" : "negative"}
            icon={IndianRupee}
            iconBgColor="bg-secondary"
            iconColor="text-foreground"
          />
        </div>

        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search description, party, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-96"
              />
              <Button variant="outline" className="gap-2" onClick={fetchAll} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <ExportExcelButton
                rows={exportRows}
                fileName="transactions"
                sheetName="Transactions"
                label="Export"
                variant="outline"
              />
              <Button className="gap-2" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Transaction
              </Button>
            </div>
          </div>
        </Card>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((t) => {
                      // Check if this transaction has an associated invoice
                      const matchedInvoice = invoices.find((inv) => {
                        const refLower = (t.reference || "").toLowerCase();
                        const invNoLower = (inv.invoiceNo || "").toLowerCase();
                        const manualInvNoLower = (inv.manualInvoiceNo || "").toLowerCase();
                        return (
                          (t.partyType === inv.partyType && 
                           t.partyId === inv.partyId &&
                           (refLower.includes(invNoLower) || refLower.includes(manualInvNoLower)))
                        );
                      });
                      
                      const isExpanded = matchedInvoice && expandedInvoiceIds.has(matchedInvoice.id);
                      
                      // Get payments for this invoice
                      const invoicePayments = matchedInvoice
                        ? payments.filter((p) => {
                            if (p.invoiceId === matchedInvoice.id) return true;
                            const refLower = (p.reference || "").toLowerCase();
                            const invNoLower = (matchedInvoice.invoiceNo || "").toLowerCase();
                            const manualInvNoLower = (matchedInvoice.manualInvoiceNo || "").toLowerCase();
                            return (
                              p.partyType === matchedInvoice.partyType &&
                              p.partyId === matchedInvoice.partyId &&
                              (refLower.includes(invNoLower) || refLower.includes(manualInvNoLower))
                            );
                          }).sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                        : [];
                      
                      // Calculate cumulative amounts
                      let cumulative = 0;
                      const paymentsWithCumulative = invoicePayments.map((p) => {
                        cumulative += p.amount;
                        return { ...p, cumulative };
                      });
                      
                      return (
                        <>
                          <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(t)}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {matchedInvoice && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedInvoiceIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(matchedInvoice.id)) {
                                        next.delete(matchedInvoice.id);
                                      } else {
                                        next.add(matchedInvoice.id);
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>{t.date}</TableCell>
                            <TableCell>
                              <span className={t.type === "Income" ? "text-success font-medium" : "text-destructive font-medium"}>
                                {t.type}
                              </span>
                            </TableCell>
                            <TableCell>{t.description}</TableCell>
                            <TableCell>{t.category}</TableCell>
                            <TableCell>
                              <span className="font-medium">₹{(t.amount || 0).toLocaleString("en-IN")}</span>
                            </TableCell>
                            <TableCell>{t.partyName}</TableCell>
                            <TableCell>{t.status}</TableCell>
                            <TableCell>{t.reference}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(t)}>
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleDelete(t.id)}>
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={10} className="bg-muted/30 p-0">
                                <div className="p-4">
                                  <div className="text-sm font-semibold mb-3">
                                    Payment History for Invoice: {matchedInvoice.manualInvoiceNo || matchedInvoice.invoiceNo}
                                  </div>
                                  <div className="rounded-md border bg-background">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-[60px]">S.No</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Method</TableHead>
                                          <TableHead>Reference</TableHead>
                                          <TableHead className="text-right">Amount</TableHead>
                                          <TableHead className="text-right">Transfer Charge</TableHead>
                                          <TableHead className="text-right">Cumulative</TableHead>
                                          <TableHead>Notes</TableHead>
                                          <TableHead>Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {paymentsWithCumulative.length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={9} className="text-center text-muted-foreground">
                                              No payments found for this invoice.
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          paymentsWithCumulative.map((p, idx) => (
                                            <TableRow key={p.id}>
                                              <TableCell>{idx + 1}</TableCell>
                                              <TableCell>{p.date}</TableCell>
                                              <TableCell>{p.method}</TableCell>
                                              <TableCell>{p.reference || "—"}</TableCell>
                                              <TableCell className="text-right font-medium">
                                                ₹{p.amount.toLocaleString("en-IN")}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {p.bankTransferCharge > 0
                                                  ? `₹${p.bankTransferCharge.toLocaleString("en-IN")}`
                                                  : "—"}
                                              </TableCell>
                                              <TableCell className="text-right font-semibold text-success">
                                                ₹{p.cumulative.toLocaleString("en-IN")}
                                              </TableCell>
                                              <TableCell>{p.notes || "—"}</TableCell>
                                              <TableCell>
                                                <span
                                                  className={
                                                    p.status === "Completed"
                                                      ? "rounded-full bg-success/20 text-success text-[11px] px-2 py-0.5 font-semibold"
                                                      : p.status === "Pending"
                                                        ? "rounded-full bg-warning/20 text-warning text-[11px] px-2 py-0.5 font-semibold"
                                                        : "rounded-full bg-destructive/20 text-destructive text-[11px] px-2 py-0.5 font-semibold"
                                                  }
                                                >
                                                  {p.status}
                                                </span>
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((s) => ({ ...s, date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData((s) => ({ ...s, type: v as TransactionType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
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
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((s) => ({ ...s, status: v as TransactionStatus }))}
                >
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
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData((s) => ({ ...s, category: e.target.value }))}
                  placeholder="General"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="Invoice no / Payment ref"
                />
              </div>

              <div className="space-y-2">
                <Label>Party Type</Label>
                <Select
                  value={formData.partyType}
                  onValueChange={(v) =>
                    setFormData((s) => ({
                      ...s,
                      partyType: v as TransactionRecord["partyType"],
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
                  <Input
                    id="partyName"
                    value={formData.partyName}
                    onChange={(e) => setFormData((s) => ({ ...s, partyName: e.target.value }))}
                    placeholder="Enter name"
                  />
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
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
                placeholder="e.g., Sale receipt / Rent / Purchase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
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
