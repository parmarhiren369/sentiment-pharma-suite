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
import { ArrowDownRight, ArrowUpRight, CreditCard, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

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

  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) =>
      `${p.partyName ?? ""} ${p.reference} ${p.method} ${p.status}`.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const stats = useMemo(() => {
    const received = payments
      .filter((p) => p.direction === "In")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const paid = payments
      .filter((p) => p.direction === "Out")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      total: payments.length,
      received,
      paid,
      net: received - paid,
    };
  }, [payments]);

  const exportRows = useMemo(
    () =>
      filtered.map((p) => ({
        Date: p.date,
        Direction: p.direction,
        Amount: p.amount,
        Party: p.partyName || "",
        Method: p.method,
        Status: p.status,
        Reference: p.reference,
        Notes: p.notes || "",
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
      await Promise.all([fetchParties(), fetchPayments()]);
    } catch (error) {
      console.error("Error fetching payments", error);
      toast({
        title: "Load failed",
        description: "Could not load payments from Firestore.",
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

  const columns = useMemo(
    () => [
      { key: "date", header: "Date" },
      {
        key: "direction",
        header: "Direction",
        render: (p: PaymentRecord) => (
          <span className={p.direction === "In" ? "text-success font-medium" : "text-destructive font-medium"}>
            {p.direction === "In" ? "Received" : "Paid"}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        render: (p: PaymentRecord) => <span className="font-medium">₹{(p.amount || 0).toLocaleString("en-IN")}</span>,
      },
      { key: "partyName", header: "Party" },
      { key: "method", header: "Method" },
      { key: "status", header: "Status" },
      { key: "reference", header: "Reference" },
      {
        key: "actions",
        header: "Actions",
        render: (p: PaymentRecord) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(p)}>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleDelete(p.id)}>
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
      <AppHeader title="Payments" subtitle="Track payments received and paid" />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total"
            value={stats.total.toString()}
            change={"All payments"}
            changeType="neutral"
            icon={CreditCard}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Received"
            value={`₹${stats.received.toLocaleString("en-IN")}`}
            change={""}
            changeType="positive"
            icon={ArrowUpRight}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Paid"
            value={`₹${stats.paid.toLocaleString("en-IN")}`}
            change={""}
            changeType="negative"
            icon={ArrowDownRight}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Net"
            value={`₹${stats.net.toLocaleString("en-IN")}`}
            change={stats.net >= 0 ? "Net received" : "Net paid"}
            changeType={stats.net >= 0 ? "positive" : "negative"}
            icon={CreditCard}
            iconBgColor="bg-secondary"
            iconColor="text-foreground"
          />
        </div>

        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search party, method, reference..."
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
              <ExportExcelButton rows={exportRows} fileName="payments" sheetName="Payments" label="Export" variant="outline" />
              <Button className="gap-2" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Payment
              </Button>
            </div>
          </div>
        </Card>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4">
            <DataTable data={filtered} columns={columns} keyField="id" onRowClick={openEdit} />
          </div>
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
