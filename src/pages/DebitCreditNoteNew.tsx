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
import { ArrowLeft, FileMinus, Plus, Trash2 } from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
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
  partyType: "customer" | "supplier";
  partyId: string;
  partyName: string;
  issueDate: string;
  items: InvoiceLineItem[];
}

interface ReturnRow {
  rowId: string;
  processedInventoryId: string;
  description: string;
  invoiceQty: number;
  returnQty: string;
  rate: string;
}

function safeNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function DebitCreditNoteNew() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [noteNo, setNoteNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");

  const [rows, setRows] = useState<ReturnRow[]>([{ rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }]);

  const customerName = useMemo(() => customers.find((c) => c.id === customerId)?.name || "", [customers, customerId]);

  const customerInvoices = useMemo(() => {
    if (!customerId) return [];
    return invoices
      .filter((i) => i.partyType === "customer" && i.partyId === customerId)
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [invoices, customerId]);

  const selectedInvoice = useMemo(() => customerInvoices.find((i) => i.id === invoiceId) || null, [customerInvoices, invoiceId]);

  const invoiceItemOptions = useMemo(() => {
    const items = selectedInvoice?.items || [];
    return items.filter((it) => it.name);
  }, [selectedInvoice]);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const qty = safeNumber(r.returnQty);
      const rate = safeNumber(r.rate);
      return sum + Math.max(0, qty) * Math.max(0, rate);
    }, 0);
  }, [rows]);

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
      const [customersSnap, invoicesSnap] = await Promise.all([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "invoices")),
      ]);

      const customersList = customersSnap.docs
        .map((d) => ({ id: d.id, name: (d.data().name || "").toString() }))
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      const invoicesList = invoicesSnap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const maybeItems = (data.items ?? []) as unknown;
          const rawItems: unknown[] = Array.isArray(maybeItems) ? maybeItems : [];
          const items: InvoiceLineItem[] = rawItems
            .map((it: unknown) => {
              const obj: Record<string, unknown> = typeof it === "object" && it !== null ? (it as Record<string, unknown>) : {};

              const rawQty = obj.quantity;
              const rawRate = obj.rate;

              const quantity = typeof rawQty === "number" ? rawQty : parseFloat(String(rawQty ?? "0")) || 0;
              const rate = typeof rawRate === "number" ? rawRate : parseFloat(String(rawRate ?? "0")) || 0;
              return {
                processedInventoryId: String(obj.processedInventoryId ?? ""),
                name: String(obj.name ?? ""),
                unit: String(obj.unit ?? "") || "pcs",
                quantity,
                rate,
              } as InvoiceLineItem;
            })
            .filter((it: InvoiceLineItem) => it.name);

          return {
            id: d.id,
            invoiceNo: String(data.invoiceNo ?? ""),
            partyType: (data.partyType || "customer") as InvoiceRecord["partyType"],
            partyId: String(data.partyId ?? ""),
            partyName: String(data.partyName ?? ""),
            issueDate: String(data.issueDate ?? ""),
            items,
          } as InvoiceRecord;
        })
        .filter((i) => i.invoiceNo && i.partyType === "customer");

      setCustomers(customersList);
      setInvoices(invoicesList);
    } catch (error) {
      console.error("Error loading customers/invoices", error);
      toast({
        title: "Load failed",
        description: "Could not load customers or invoices.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    // Reset invoice + rows when customer changes
    setInvoiceId("");
    setRows([{ rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }]);
  }, [customerId]);

  useEffect(() => {
    // When invoice selected, pre-fill rows with invoice items
    if (!selectedInvoice) {
      setRows([{ rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }]);
      return;
    }

    const next = (selectedInvoice.items || []).map((it) => ({
      rowId: uid(),
      processedInventoryId: it.processedInventoryId || it.name,
      description: it.name,
      invoiceQty: it.quantity,
      returnQty: "",
      rate: (it.rate || 0).toString(),
    }));

    setRows(next.length ? next : [{ rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }]);
  }, [selectedInvoice?.id]);

  const addRow = () => {
    setRows((prev) => [...prev, { rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.rowId !== rowId);
      return next.length ? next : [{ rowId: uid(), processedInventoryId: "", description: "", invoiceQty: 0, returnQty: "", rate: "" }];
    });
  };

  const updateRow = (rowId: string, patch: Partial<ReturnRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const onSelectItem = (rowId: string, value: string) => {
    const item = invoiceItemOptions.find((it) => (it.processedInventoryId || it.name) === value);
    if (!item) {
      updateRow(rowId, { processedInventoryId: value });
      return;
    }
    updateRow(rowId, {
      processedInventoryId: item.processedInventoryId || item.name,
      description: item.name,
      invoiceQty: item.quantity,
      rate: (item.rate || 0).toString(),
    });
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

    if (!noteNo.trim()) {
      toast({ title: "Validation error", description: "Credit note number is required.", variant: "destructive" });
      return;
    }

    if (!customerId) {
      toast({ title: "Validation error", description: "Select customer.", variant: "destructive" });
      return;
    }

    if (!selectedInvoice) {
      toast({ title: "Validation error", description: "Select original sales invoice.", variant: "destructive" });
      return;
    }

    if (!reason.trim()) {
      toast({ title: "Validation error", description: "Reason is required.", variant: "destructive" });
      return;
    }

    const normalizedItems = rows
      .map((r) => {
        const returnQty = safeNumber(r.returnQty);
        const rate = safeNumber(r.rate);
        const invoiceQty = Number(r.invoiceQty) || 0;
        const cappedQty = Math.max(0, Math.min(returnQty, invoiceQty));
        return {
          processedInventoryId: (r.processedInventoryId || "").toString(),
          description: (r.description || "").toString(),
          invoiceQty,
          returnQty: cappedQty,
          rate: Math.max(0, rate),
          amount: cappedQty * Math.max(0, rate),
        };
      })
      .filter((it) => it.returnQty > 0);

    if (!normalizedItems.length) {
      toast({ title: "Validation error", description: "Add at least one returned item with Return Qty > 0.", variant: "destructive" });
      return;
    }

    // Warn (but don’t block) if user entered Return Qty > Invoice Qty; we already cap.
    const hasOver = rows.some((r) => safeNumber(r.returnQty) > (Number(r.invoiceQty) || 0) && (Number(r.invoiceQty) || 0) > 0);
    if (hasOver) {
      toast({
        title: "Adjusted quantities",
        description: "Some Return Qty exceeded Invoice Qty and was capped.",
      });
    }

    const amount = normalizedItems.reduce((sum, it) => sum + (it.amount || 0), 0);

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "debitCreditNotes"), {
        noteType: "Credit",
        noteNo: noteNo.trim(),
        date,
        partyType: "customer",
        partyId: customerId,
        partyName: customerName,
        amount,
        relatedInvoiceNo: selectedInvoice.invoiceNo,
        relatedInvoiceId: selectedInvoice.id,
        originalTransactionType: "Sale",
        reason: reason.trim(),
        items: normalizedItems,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast({ title: "Saved", description: "Credit note saved." });
      navigate("/debit-credit-notes");
    } catch (error) {
      console.error("Error saving credit note", error);
      toast({ title: "Save failed", description: "Could not save credit note.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Credit Note" subtitle="Customer Return" />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
              <FileMinus className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-lg font-semibold">CREDIT NOTE - Customer Return</div>
              <div className="text-sm text-muted-foreground">
                Customer returns sold items: adds stock back, reduces Amount to Receive, and creates a credit entry.
              </div>
            </div>
          </div>

          <Button variant="outline" className="gap-2" onClick={() => navigate("/debit-credit-notes")}
            disabled={isSubmitting}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Note Type</Label>
                <Select value="credit-return" onValueChange={() => {}} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Credit Note (Return from Customer)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit-return">Credit Note (Return from Customer)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Customer returns sold items - Adds stock back, reduces Amount to Receive</p>
              </div>

              <div className="space-y-2">
                <Label>Original Transaction Type</Label>
                <Select value="sale" onValueChange={() => {}} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Sale (Customer Invoice)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Sale (Customer Invoice)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Linked to original sales invoice</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="noteNo">Credit Note No *</Label>
                <Input id="noteNo" value={noteNo} onChange={(e) => setNoteNo(e.target.value)} placeholder="e.g., CN-0001" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Customer Name (returning goods to us) *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? "Loading customers..." : "Select Customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Original Sales Invoice Number *</Label>
                <Select value={invoiceId} onValueChange={setInvoiceId} disabled={!customerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={!customerId ? "Select party first" : "Select Sales Invoice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNo} ({inv.issueDate || "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Customer Return</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Customer returned damaged goods, wrong items delivered, quality issues, etc."
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">Items Being Returned (from customer)</div>
                <div className="text-sm text-muted-foreground">Add items and enter Return Qty (Amount auto-calculates)</div>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={addRow} disabled={!selectedInvoice}>
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3">Item Code</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Invoice Qty</th>
                    <th className="p-3">Return Qty</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const amount = Math.max(0, safeNumber(r.returnQty)) * Math.max(0, safeNumber(r.rate));
                    const returnQtyNum = safeNumber(r.returnQty);
                    const invoiceQtyNum = Number(r.invoiceQty) || 0;
                    const isOver = invoiceQtyNum > 0 && returnQtyNum > invoiceQtyNum;

                    return (
                      <tr key={r.rowId} className="border-t border-border align-top">
                        <td className="p-3 min-w-[220px]">
                          <Select
                            value={r.processedInventoryId}
                            onValueChange={(v) => onSelectItem(r.rowId, v)}
                            disabled={!selectedInvoice}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={!selectedInvoice ? "Select Sales Invoice" : "Select Item"} />
                            </SelectTrigger>
                            <SelectContent>
                              {invoiceItemOptions.map((it) => {
                                const key = it.processedInventoryId || it.name;
                                return (
                                  <SelectItem key={key} value={key}>
                                    {it.name} ({it.quantity} {it.unit})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 min-w-[260px]">
                          <Input value={r.description} readOnly placeholder="Item description (auto-filled)" />
                        </td>
                        <td className="p-3 min-w-[120px]">
                          <Input value={r.invoiceQty ? String(r.invoiceQty) : ""} readOnly placeholder="-" />
                        </td>
                        <td className="p-3 min-w-[140px]">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.returnQty}
                            onChange={(e) => updateRow(r.rowId, { returnQty: e.target.value })}
                            placeholder="Qty"
                            className={isOver ? "border-destructive" : ""}
                          />
                          {isOver ? <div className="text-xs text-destructive mt-1">Return Qty exceeds invoice qty</div> : null}
                        </td>
                        <td className="p-3 min-w-[140px]">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.rate}
                            onChange={(e) => updateRow(r.rowId, { rate: e.target.value })}
                            placeholder="Rate"
                          />
                        </td>
                        <td className="p-3 min-w-[140px]">
                          <Input value={amount ? amount.toFixed(2) : ""} readOnly placeholder="0" />
                        </td>
                        <td className="p-3">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(r.rowId)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end mt-3">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div className="text-lg font-semibold">₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/debit-credit-notes")} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Credit Note"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
