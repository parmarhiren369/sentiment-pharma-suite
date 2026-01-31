import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";

type InvoiceStatus = "Paid" | "Pending" | "Overdue";

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

interface PartyOption {
  id: string;
  name: string;
}

interface InvoiceFormState {
  invoiceNo: string;
  cuNumber: string;
  pin: string;
  partyType: "customer" | "supplier";
  partyId: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  tax: string;
  status: InvoiceStatus;
  notes: string;
}

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export default function InvoiceNew() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [processedInventoryOptions, setProcessedInventoryOptions] = useState<ProcessedInventoryOption[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<InvoiceFormState>({
    invoiceNo: "",
    cuNumber: "",
    pin: "",
    partyType: "customer",
    partyId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    subtotal: "",
    tax: "0",
    status: "Pending",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  const partyOptions = useMemo(() => (formData.partyType === "supplier" ? suppliers : customers), [customers, suppliers, formData.partyType]);
  const selectedParty = useMemo(() => partyOptions.find((p) => p.id === formData.partyId) || null, [partyOptions, formData.partyId]);

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
    const tax = safeNumber(formData.tax);
    return Math.max(0, computedSubtotal + tax);
  }, [computedSubtotal, formData.tax]);

  const fetchOptions = async () => {
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
      const [customersSnap, suppliersSnap, processedInvSnap] = await Promise.all([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "suppliers")),
        getDocs(collection(db, "processedInventory")),
      ]);

      const customersList = customersSnap.docs
        .map((d) => ({ id: d.id, name: (d.data().name || "").toString() }))
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      const suppliersList = suppliersSnap.docs
        .map((d) => ({ id: d.id, name: (d.data().name || "").toString() }))
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      const processedList = processedInvSnap.docs
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

      setCustomers(customersList);
      setSuppliers(suppliersList);
      setProcessedInventoryOptions(processedList);
    } catch (error) {
      console.error("Error loading invoice options", error);
      toast({ title: "Load failed", description: "Could not load customers/suppliers/items.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    setFormData((s) => ({ ...s, partyId: "" }));
  }, [formData.partyType]);

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

    if (!formData.invoiceNo.trim()) {
      toast({ title: "Validation error", description: "Invoice number is required.", variant: "destructive" });
      return;
    }

    if (!formData.partyId) {
      toast({ title: "Validation error", description: "Select a party.", variant: "destructive" });
      return;
    }

    const tax = safeNumber(formData.tax);
    if (computedSubtotal < 0 || tax < 0) {
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
      subtotal: computedSubtotal,
      tax,
      total: computedTotal,
      status: formData.status,
      notes: formData.notes.trim(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "invoices"), payload);
      toast({ title: "Saved", description: "Invoice saved to Firestore." });
      navigate("/invoices");
    } catch (error) {
      console.error("Error saving invoice", error);
      toast({ title: "Save failed", description: "Could not save invoice.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="New Invoice" subtitle="Create invoice (full page)" />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-lg font-semibold">Create New Invoice</div>
              <div className="text-sm text-muted-foreground">This will be stored in Firestore.</div>
            </div>
          </div>

          <Button variant="outline" className="gap-2" onClick={() => navigate("/invoices")} disabled={isSubmitting}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNo">System Invoice *</Label>
                <Input id="invoiceNo" value={formData.invoiceNo} onChange={(e) => setFormData((s) => ({ ...s, invoiceNo: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuNumber">CU Number</Label>
                <Input id="cuNumber" value={formData.cuNumber} onChange={(e) => setFormData((s) => ({ ...s, cuNumber: e.target.value }))} placeholder="Optional" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input id="pin" value={formData.pin} onChange={(e) => setFormData((s) => ({ ...s, pin: e.target.value }))} placeholder="Optional" />
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
                  onValueChange={(v) => setFormData((s) => ({ ...s, partyType: v as "customer" | "supplier" }))}
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
                <Label>Party *</Label>
                <Select value={formData.partyId} onValueChange={(v) => setFormData((s) => ({ ...s, partyId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? "Loading..." : formData.partyType === "customer" ? "Select customer" : "Select supplier"} />
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
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="font-semibold">Items (from Processed Inventory)</div>
                <div className="text-sm text-muted-foreground">Add items; subtotal auto-calculates</div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setLineItems((prev) => [...prev, { processedInventoryId: "", name: "", unit: "pcs", quantity: 1, rate: 0 }])}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items added. You can still enter subtotal manually below.</div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((it, idx) => {
                  const resolved = it.processedInventoryId ? processedInventoryById.get(it.processedInventoryId) : undefined;
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
                        <div className="text-xs text-muted-foreground">{resolved?.unit ? `Unit: ${resolved.unit}` : ""}</div>
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
                        <Button type="button" variant="destructive" size="sm" onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/invoices")} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
