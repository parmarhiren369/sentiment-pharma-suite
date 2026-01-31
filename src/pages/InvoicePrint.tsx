import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Printer } from "lucide-react";

const COMPANY_NAME = "Sentiment Pharma";
const COMPANY_SUBTITLE = "Invoice Summary";

type InvoiceLineItem = {
  processedInventoryId?: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
};

type InvoiceDoc = {
  invoiceNo: string;
  manualInvoiceNo?: string;
  issueDate?: string;
  partyName?: string;
  customer?: {
    gst?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items?: InvoiceLineItem[];
  subtotal?: number;
  taxPercent?: number;
  tax?: number;
  total?: number;
  status?: string;
  notes?: string;
};

export default function InvoicePrint() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);

  const lineRows = useMemo(() => {
    const items = Array.isArray(invoice?.items) ? invoice?.items : [];
    return items.map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const amount = qty * rate;
      return { idx: idx + 1, name: it.name, unit: it.unit, qty, rate, amount };
    });
  }, [invoice?.items]);

  const subtotal = useMemo(() => {
    if (typeof invoice?.subtotal === "number") return invoice.subtotal;
    return lineRows.reduce((s, r) => s + r.amount, 0);
  }, [invoice?.subtotal, lineRows]);

  const taxAmount = useMemo(() => {
    if (typeof invoice?.tax === "number") return invoice.tax;
    const pct = typeof invoice?.taxPercent === "number" ? invoice.taxPercent : 0;
    return (subtotal * pct) / 100;
  }, [invoice?.tax, invoice?.taxPercent, subtotal]);

  const taxPercentLabel = useMemo(() => {
    const pct = typeof invoice?.taxPercent === "number" ? invoice.taxPercent : undefined;
    if (typeof pct === "number" && Number.isFinite(pct)) return `${pct}%`;
    return undefined;
  }, [invoice?.taxPercent]);

  const total = useMemo(() => {
    if (typeof invoice?.total === "number") return invoice.total;
    return subtotal + taxAmount;
  }, [invoice?.total, subtotal, taxAmount]);

  useEffect(() => {
    const run = async () => {
      if (!db) {
        toast({
          title: "Database unavailable",
          description: "Firebase is not initialized. Please check your environment variables.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!invoiceId) {
        toast({ title: "Invalid invoice", description: "Invoice id missing.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "invoices", invoiceId));
        if (!snap.exists()) {
          toast({ title: "Not found", description: "Invoice not found.", variant: "destructive" });
          setInvoice(null);
          return;
        }
        setInvoice(snap.data() as InvoiceDoc);
      } catch (e) {
        console.error("Failed to load invoice", e);
        toast({ title: "Load failed", description: "Could not load invoice.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [invoiceId, toast]);

  useEffect(() => {
    if (!isLoading && invoice) {
      // Auto-open print dialog for a one-click workflow.
      // User can cancel and still see the preview.
      setTimeout(() => window.print(), 50);
    }
  }, [isLoading, invoice]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-sm text-muted-foreground">Loading invoice…</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" onClick={() => navigate("/invoices")}>Back</Button>
          <div className="mt-4 text-sm text-muted-foreground">Invoice not available.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6 print:bg-white print:p-0 print:text-black">
      <div className="max-w-4xl mx-auto print:max-w-none print:mx-0 print:p-6">
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/invoices")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>

        <Card className="p-8 shadow-lg border border-border/60 rounded-2xl print:shadow-none print:border-0 print:rounded-none print:p-0">
          <div className="print:p-0">
            <div className="text-center">
              <div className="text-3xl font-extrabold tracking-wide leading-tight">{COMPANY_NAME}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground print:text-black/70">{COMPANY_SUBTITLE}</div>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/60 bg-white/60 p-4 print:bg-transparent">
                <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/70">Bill To</div>
                <div className="mt-1 text-base font-semibold">{invoice.partyName || "—"}</div>

                <div className="mt-3 grid grid-cols-1 gap-1 text-sm">
                  <div>
                    <span className="text-muted-foreground print:text-black/70">GST:</span> {invoice.customer?.gst || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black/70">Phone:</span> {invoice.customer?.phone || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black/70">Email:</span> {invoice.customer?.email || "—"}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/70">Address</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{invoice.customer?.address || "—"}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-white/60 p-4 md:text-right print:bg-transparent">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/70">System Invoice No</div>
                  <div className="mt-1 text-base font-semibold">{invoice.invoiceNo || "—"}</div>
                </div>

                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/70">Manual Invoice No</div>
                  <div className="mt-1 text-sm font-medium">{invoice.manualInvoiceNo || "—"}</div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1 text-sm md:justify-items-end">
                  <div>
                    <span className="text-muted-foreground print:text-black/70">Issue Date:</span> {invoice.issueDate || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black/70">Status:</span> {invoice.status || "—"}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <div className="font-semibold">Items</div>
              <div className="text-xs text-muted-foreground print:text-black/70">All amounts in INR (₹)</div>
            </div>

            <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
              <Table className="text-sm">
                <TableHeader className="bg-muted/30 print:bg-transparent">
                  <TableRow>
                    <TableHead className="w-[48px]">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-[90px]">Qty</TableHead>
                    <TableHead className="w-[90px]">Unit</TableHead>
                    <TableHead className="text-right w-[120px]">Rate</TableHead>
                    <TableHead className="text-right w-[140px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground">No items</TableCell>
                    </TableRow>
                  ) : (
                    lineRows.map((r) => (
                      <TableRow key={r.idx} className={r.idx % 2 === 0 ? "bg-muted/10 print:bg-transparent" : ""}>
                        <TableCell className="text-muted-foreground print:text-black/70">{r.idx}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.qty}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className="text-right">₹{r.rate.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{r.amount.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm rounded-lg border border-border/60 bg-white/60 p-4 print:bg-transparent">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-black/70">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-black/70">Tax{taxPercentLabel ? ` (${taxPercentLabel})` : ""}</span>
                  <span className="font-medium">₹{taxAmount.toLocaleString("en-IN")}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {invoice.notes ? (
              <>
                <Separator className="my-6" />
                <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/70">Notes</div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{invoice.notes}</div>
              </>
            ) : null}

            <Separator className="my-6" />
            <div className="text-xs text-muted-foreground print:text-black/70 flex items-center justify-between">
              <span>Computer generated invoice</span>
              <span>Printed on {new Date().toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
