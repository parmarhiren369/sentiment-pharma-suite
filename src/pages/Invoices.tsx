import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { FileText, IndianRupee, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

type InvoiceStatus = "Approved" | "In Process" | "Paid" | "Pending" | "Overdue";

interface ProcessedInventoryOption {
  id: string;
  name: string;
  unit?: string;
}

interface InvoiceLineItem {
  processedInventoryId: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
}

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  cuNumber?: string;
  pin?: string;
  partyType: "customer" | "supplier";
  partyId: string;
  partyName: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  items?: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt?: Date;
}

interface PartyOption {
  id: string;
  name: string;
}

const defaultFormState = {
  invoiceNo: "",
  cuNumber: "",
  pin: "",
  partyType: "customer" as InvoiceRecord["partyType"],
  partyId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  subtotal: "",
  tax: "0",
  status: "Pending" as InvoiceStatus,
  notes: "",
};

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [processedInventoryOptions, setProcessedInventoryOptions] = useState<ProcessedInventoryOption[]>([]);

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceRecord | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  const { toast } = useToast();

  const partyOptions = useMemo(() => (formData.partyType === "supplier" ? suppliers : customers), [customers, suppliers, formData.partyType]);
  const selectedParty = useMemo(() => partyOptions.find((p) => p.id === formData.partyId), [partyOptions, formData.partyId]);

  const processedInventoryById = useMemo(() => {
    const map = new Map<string, ProcessedInventoryOption>();
    for (const it of processedInventoryOptions) map.set(it.id, it);
    return map;
  }, [processedInventoryOptions]);

  const computedSubtotal = useMemo(() => {
    if (lineItems.length) {
      return lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
    }
    return safeNumber(formData.subtotal);
  }, [formData.subtotal, lineItems]);

  const computedTotal = useMemo(() => {
    const subtotal = computedSubtotal;
    const tax = safeNumber(formData.tax);
    return Math.max(0, subtotal + tax);
  }, [computedSubtotal, formData.tax]);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((i) => `${i.invoiceNo} ${i.partyName} ${i.status}`.toLowerCase().includes(q));
  }, [invoices, search]);

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const pendingTotal = invoices
      .filter((i) => i.status === "Pending" || i.status === "Overdue")
      .reduce((sum, i) => sum + (i.total || 0), 0);
    const paidTotal = invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + (i.total || 0), 0);

    return {
      count: invoices.length,
      total,
      pendingCount: invoices.filter((i) => i.status === "Pending" || i.status === "Overdue").length,
      pendingTotal,
      paidTotal,
    };
  }, [invoices]);

  const exportRows = useMemo(
    () =>
      filtered.map((i) => ({
        "System Invoice": i.invoiceNo,
        "Manual Invoice": (i as any).manualInvoiceNo || "",
        "CU Number": i.cuNumber || "",
        Date: i.issueDate,
        Party: i.partyName,
        PIN: i.pin || "",
        Items: (i.items || [])
          .map((x) => {
            const resolved = x.processedInventoryId ? processedInventoryById.get(x.processedInventoryId) : undefined;
            const name = resolved?.name || x.name;
            const unit = resolved?.unit || x.unit;
            return `${name} (${x.quantity} ${unit})`;
          })
          .join(", "),
        "Total Amount": i.total,
        Status: i.status,
        Notes: i.notes || "",
      })),
    [filtered, processedInventoryById]
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

  const fetchProcessedInventoryOptions = async () => {
    const snap = await getDocs(collection(db, "processedInventory"));
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: (data.name || "").toString(),
          unit: (data.unit || "").toString() || undefined,
        } as ProcessedInventoryOption;
      })
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    setProcessedInventoryOptions(list);
  };

  const fetchInvoices = async () => {
    const qy = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();

      const rawItems = Array.isArray(data.items) ? data.items : [];
      const items: InvoiceLineItem[] = rawItems
        .map((it: any) => {
          const quantity = typeof it.quantity === "number" ? it.quantity : parseFloat(it.quantity) || 0;
          const rate = typeof it.rate === "number" ? it.rate : parseFloat(it.rate) || 0;
          return {
            processedInventoryId: (it.processedInventoryId || "").toString(),
            name: (it.name || "").toString(),
            unit: (it.unit || "").toString() || "pcs",
            quantity,
            rate,
          } as InvoiceLineItem;
        })
        .filter((it: InvoiceLineItem) => it.name);

      return {
        id: d.id,
        invoiceNo: (data.invoiceNo || "").toString(),
        cuNumber: (data.cuNumber || "").toString() || undefined,
        pin: (data.pin || "").toString() || undefined,
        partyType: (data.partyType || "customer") as InvoiceRecord["partyType"],
        partyId: (data.partyId || "").toString(),
        partyName: (data.partyName || "").toString(),
        issueDate: (data.issueDate || "").toString(),
        dueDate: (data.dueDate || "").toString(),
        items,
        subtotal: typeof data.subtotal === "number" ? data.subtotal : parseFloat(data.subtotal) || 0,
        tax: typeof data.tax === "number" ? data.tax : parseFloat(data.tax) || 0,
        total: typeof data.total === "number" ? data.total : parseFloat(data.total) || 0,
        status: (data.status || "Pending") as InvoiceStatus,
        notes: (data.notes || "").toString() || undefined,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as InvoiceRecord;
    });
    setInvoices(list);
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
      await Promise.all([fetchParties(), fetchProcessedInventoryOptions(), fetchInvoices()]);
    } catch (error) {
      console.error("Error fetching invoices", error);
      toast({
        title: "Load failed",
        description: "Could not load invoices from Firestore.",
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
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      tax: "0",
    });
    setLineItems([]);
  };

  const openEdit = (row: InvoiceRecord) => {
    setEditing(row);
    setFormData({
      invoiceNo: row.invoiceNo,
      cuNumber: row.cuNumber || "",
      pin: row.pin || "",
      partyType: row.partyType,
      partyId: row.partyId,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      subtotal: (row.subtotal ?? 0).toString(),
      tax: (row.tax ?? 0).toString(),
      status: row.status,
      notes: row.notes || "",
    });
    setLineItems(row.items || []);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("Delete this invoice?")) return;

    try {
      await deleteDoc(doc(db, "invoices", id));
      toast({ title: "Deleted", description: "Invoice removed." });
      fetchInvoices();
    } catch (error) {
      console.error("Error deleting invoice", error);
      toast({
        title: "Delete failed",
        description: "Could not delete invoice.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editing) {
      toast({
        title: "Create invoice",
        description: "Use Add Invoice to open the full-page create form.",
      });
      return;
    }

    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.invoiceNo.trim()) {
      toast({ title: "Validation error", description: "Invoice number is required.", variant: "destructive" });
      return;
    }

    if (!formData.partyId) {
      toast({ title: "Validation error", description: "Select a party.", variant: "destructive" });
      return;
    }

    const subtotal = computedSubtotal;
    const tax = safeNumber(formData.tax);
    if (subtotal < 0 || tax < 0) {
      toast({ title: "Validation error", description: "Amounts cannot be negative.", variant: "destructive" });
      return;
    }

    const sanitizedItems: InvoiceLineItem[] = lineItems
      .map((it) => ({
        processedInventoryId: (it.processedInventoryId || "").toString(),
        name: (it.name || "").toString(),
        unit: (it.unit || "").toString() || "pcs",
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
      }))
      .filter((it) => it.name && it.quantity > 0);

    const payload = {
      invoiceNo: formData.invoiceNo.trim(),
      cuNumber: formData.cuNumber.trim(),
      pin: formData.pin.trim(),
      partyType: formData.partyType,
      partyId: formData.partyId,
      partyName: selectedParty?.name || "",
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      items: sanitizedItems,
      subtotal,
      tax,
      total: computedTotal,
      status: formData.status,
      notes: formData.notes.trim(),
      updatedAt: Timestamp.now(),
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "invoices", editing.id), payload);
        toast({ title: "Updated", description: "Invoice updated." });
      } else {
        await addDoc(collection(db, "invoices"), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        toast({ title: "Saved", description: "Invoice saved to Firestore." });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error("Error saving invoice", error);
      toast({
        title: "Save failed",
        description: "Could not save invoice.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: "invoiceNo", header: "System Invoice" },
      {
        key: "cuNumber",
        header: "CU Number",
        render: (i: InvoiceRecord) => <span className="font-medium">{i.cuNumber || "—"}</span>,
      },
      { key: "issueDate", header: "Date" },
      { key: "partyName", header: "Customer" },
      {
        key: "pin",
        header: "PIN",
        render: (i: InvoiceRecord) => <span className="font-medium">{i.pin || "—"}</span>,
      },
      {
        key: "items",
        header: "Items",
        render: (i: InvoiceRecord) => {
          const label = (i.items || [])
            .map((x) => {
              const resolved = x.processedInventoryId ? processedInventoryById.get(x.processedInventoryId) : undefined;
              const name = resolved?.name || x.name;
              const unit = resolved?.unit || x.unit;
              return `${name} (${x.quantity} ${unit})`;
            })
            .join(", ");
          return <span className="text-sm text-muted-foreground">{label || "—"}</span>;
        },
      },
      {
        key: "total",
        header: "Total Amount",
        render: (i: InvoiceRecord) => <span className="font-medium">₹{(i.total || 0).toLocaleString("en-IN")}</span>,
      },
      { key: "status", header: "Status" },
      {
        key: "actions",
        header: "Actions",
        render: (i: InvoiceRecord) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(i)}>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleDelete(i.id)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [processedInventoryById]
  );

  return (
    <>
      <AppHeader title="Invoices" subtitle="Create and manage invoices" />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Invoices"
            value={stats.count.toString()}
            change={"All invoices"}
            changeType="neutral"
            icon={FileText}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Total"
            value={`₹${stats.total.toLocaleString("en-IN")}`}
            change={""}
            changeType="neutral"
            icon={IndianRupee}
            iconBgColor="bg-secondary"
            iconColor="text-foreground"
          />
          <StatCard
            title="Pending"
            value={`${stats.pendingCount}`}
            change={`₹${stats.pendingTotal.toLocaleString("en-IN")}`}
            changeType="negative"
            icon={FileText}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
          <StatCard
            title="Paid"
            value={`₹${stats.paidTotal.toLocaleString("en-IN")}`}
            change={""}
            changeType="positive"
            icon={IndianRupee}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
        </div>

        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search invoice no, party, status..."
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
              <ExportExcelButton rows={exportRows} fileName="invoices" sheetName="Invoices" label="Export" variant="outline" />
              <Button className="gap-2" onClick={() => navigate("/invoices/new")}>
                <Plus className="w-4 h-4" />
                Add Invoice
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
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNo">System Invoice</Label>
                <Input id="invoiceNo" value={formData.invoiceNo} onChange={(e) => setFormData((s) => ({ ...s, invoiceNo: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuNumber">CU Number</Label>
                <Input
                  id="cuNumber"
                  value={(formData as any).cuNumber || ""}
                  onChange={(e) => setFormData((s: any) => ({ ...s, cuNumber: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  value={(formData as any).pin || ""}
                  onChange={(e) => setFormData((s: any) => ({ ...s, pin: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((s) => ({ ...s, status: v as InvoiceStatus }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Party Type</Label>
                <Select
                  value={formData.partyType}
                  onValueChange={(v) => setFormData((s) => ({ ...s, partyType: v as InvoiceRecord["partyType"], partyId: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input id="issueDate" type="date" value={formData.issueDate} onChange={(e) => setFormData((s) => ({ ...s, issueDate: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData((s) => ({ ...s, dueDate: e.target.value }))} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Items (from Processed Inventory)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLineItems((prev) => [
                        ...prev,
                        { processedInventoryId: "", name: "", unit: "pcs", quantity: 1, rate: 0 },
                      ])
                    }
                  >
                    Add Item
                  </Button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No items added. You can still enter subtotal manually.</div>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((it, idx) => {
                      const amount = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                      return (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                          <div className="md:col-span-5 space-y-1">
                            <Label className="text-xs text-muted-foreground">Item</Label>
                            <Select
                              value={it.processedInventoryId}
                              onValueChange={(v) => {
                                const selected = processedInventoryOptions.find((o) => o.id === v);
                                setLineItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          processedInventoryId: v,
                                          name: selected?.name || x.name,
                                          unit: selected?.unit || x.unit || "pcs",
                                        }
                                      : x
                                  )
                                );
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select processed item" />
                              </SelectTrigger>
                              <SelectContent>
                                {processedInventoryOptions.map((o) => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {o.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={String(it.quantity)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setLineItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number.isFinite(v) ? v : 0 } : x)));
                              }}
                            />
                          </div>

                          <div className="md:col-span-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Unit</Label>
                            <Input value={it.unit} readOnly />
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Rate</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={String(it.rate)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setLineItems((prev) => prev.map((x, i) => (i === idx ? { ...x, rate: Number.isFinite(v) ? v : 0 } : x)));
                              }}
                            />
                          </div>

                          <div className="md:col-span-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Amt</Label>
                            <Input value={amount.toFixed(2)} readOnly />
                          </div>

                          <div className="md:col-span-1">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtotal">Subtotal</Label>
                <Input
                  id="subtotal"
                  type="number"
                  inputMode="decimal"
                  value={computedSubtotal.toString()}
                  onChange={(e) => setFormData((s) => ({ ...s, subtotal: e.target.value }))}
                  placeholder="0"
                  readOnly={lineItems.length > 0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax">Tax</Label>
                <Input id="tax" type="number" inputMode="decimal" value={formData.tax} onChange={(e) => setFormData((s) => ({ ...s, tax: e.target.value }))} placeholder="0" />
              </div>

              <div className="space-y-2">
                <Label>Total</Label>
                <Input value={computedTotal.toString()} readOnly />
              </div>
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
                {isSubmitting ? "Saving..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
