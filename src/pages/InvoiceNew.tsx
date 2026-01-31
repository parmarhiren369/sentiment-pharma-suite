import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { ArrowLeft, Check, ChevronsUpDown, FileText, Plus, Trash2 } from "lucide-react";

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
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
}

interface InvoiceFormState {
  invoiceNo: string;
  manualInvoiceNo: string;
  cuNumber: string;
  pin: string;
  partyId: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxPercent: string;
  status: InvoiceStatus;
  notes: string;
}

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function generateSystemInvoiceNo(date: string): string {
  const ymd = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${suffix}`;
}

export default function InvoiceNew() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [processedInventoryOptions, setProcessedInventoryOptions] = useState<ProcessedInventoryOption[]>([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<InvoiceFormState>({
    invoiceNo: "",
    manualInvoiceNo: "",
    cuNumber: "",
    pin: "",
    partyId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    subtotal: "",
    taxPercent: "0",
    status: "Pending",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  const selectedCustomer = useMemo(() => customers.find((p) => p.id === formData.partyId) || null, [customers, formData.partyId]);

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

  const computedTaxAmount = useMemo(() => {
    const pct = safeNumber(formData.taxPercent);
    return Math.max(0, (computedSubtotal * pct) / 100);
  }, [computedSubtotal, formData.taxPercent]);

  const computedTotal = useMemo(() => {
    return Math.max(0, computedSubtotal + computedTaxAmount);
  }, [computedSubtotal, computedTaxAmount]);

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
      const [customersSnap, processedInvSnap] = await Promise.all([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "processedInventory")),
      ]);

      const customersList = customersSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name || "").toString(),
            address: (data.address || "").toString() || undefined,
            phone: (data.phone || "").toString() || undefined,
            email: (data.email || "").toString() || undefined,
            gst: (data.gst || "").toString() || undefined,
          } as PartyOption;
        })
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
    setFormData((s) => {
      if (s.invoiceNo) return s;
      return { ...s, invoiceNo: generateSystemInvoiceNo(s.issueDate) };
    });
  }, []);

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

    if (!formData.manualInvoiceNo.trim()) {
      toast({ title: "Validation error", description: "Manual invoice number is required.", variant: "destructive" });
      return;
    }

    if (!formData.partyId) {
      toast({ title: "Validation error", description: "Select a customer.", variant: "destructive" });
      return;
    }

    const taxPercent = safeNumber(formData.taxPercent);
    if (computedSubtotal < 0 || taxPercent < 0) {
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
      manualInvoiceNo: formData.manualInvoiceNo.trim(),
      cuNumber: formData.cuNumber.trim(),
      pin: formData.pin.trim(),
      partyType: "customer" as const,
      partyId: formData.partyId,
      partyName: selectedCustomer?.name || "",
      customer: {
        address: selectedCustomer?.address || "",
        phone: selectedCustomer?.phone || "",
        email: selectedCustomer?.email || "",
        gst: selectedCustomer?.gst || "",
      },
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      items: sanitizedItems,
      subtotal: computedSubtotal,
      taxPercent,
      tax: computedTaxAmount,
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
                <Label htmlFor="invoiceNo">System Invoice No</Label>
                <Input id="invoiceNo" value={formData.invoiceNo} readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualInvoiceNo">Manual Invoice No *</Label>
                <Input
                  id="manualInvoiceNo"
                  value={formData.manualInvoiceNo}
                  onChange={(e) => setFormData((s) => ({ ...s, manualInvoiceNo: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Customer *</Label>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerPickerOpen}
                      className="w-full justify-between"
                      disabled={isLoading}
                    >
                      {selectedCustomer?.name || (isLoading ? "Loading..." : "Select customer")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setFormData((s) => ({ ...s, partyId: c.id }));
                                setCustomerPickerOpen(false);
                              }}
                            >
                              <Check className={"mr-2 h-4 w-4 " + (formData.partyId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date (Invoice)</Label>
                <Input id="issueDate" type="date" value={formData.issueDate} onChange={(e) => setFormData((s) => ({ ...s, issueDate: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuNumber">CU Number</Label>
                <Input id="cuNumber" value={formData.cuNumber} onChange={(e) => setFormData((s) => ({ ...s, cuNumber: e.target.value }))} placeholder="Optional" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input id="pin" value={formData.pin} onChange={(e) => setFormData((s) => ({ ...s, pin: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold mb-3">Customer Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>GST No</Label>
                <Input value={selectedCustomer?.gst || ""} readOnly disabled={!selectedCustomer} />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={selectedCustomer?.phone || ""} readOnly disabled={!selectedCustomer} />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedCustomer?.email || ""} readOnly disabled={!selectedCustomer} />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={selectedCustomer?.address || ""} readOnly disabled={!selectedCustomer} />
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
            <div className="font-semibold mb-3">Other Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData((s) => ({ ...s, dueDate: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))} />
            </div>
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
                <Label htmlFor="taxPercent">Tax (%)</Label>
                <Input
                  id="taxPercent"
                  type="number"
                  inputMode="decimal"
                  value={formData.taxPercent}
                  onChange={(e) => setFormData((s) => ({ ...s, taxPercent: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Total</Label>
                <Input value={computedTotal.toString()} readOnly />
              </div>
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
