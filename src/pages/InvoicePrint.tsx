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
const SYSTEM_NAME = "Sentiment Pharma Suite - Invoice System";
const CURRENCY = "₹";

// These can later be moved to Settings/Firestore.
const INVOICE_FROM = {
  name: COMPANY_NAME,
  pin: "—",
  address: "—",
  mobile: "—",
};

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
  cuNumber?: string;
  pin?: string;
  issueDate?: string;
  partyName?: string;
  customer?: {
    gst?: string;
    address?: string;
    phone?: string;
    email?: string;
    pin?: string;
  };
  items?: InvoiceLineItem[];
  subtotal?: number;
  taxPercent?: number;
  tax?: number;
  total?: number;
  status?: string;
  notes?: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateTime(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateTimeWithSeconds(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} at ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatMoney(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return `${CURRENCY} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

  const printedAt = useMemo(() => new Date(), []);

  const total = useMemo(() => {
    if (typeof invoice?.total === "number") return invoice.total;
    return subtotal + taxAmount;
  }, [invoice?.total, subtotal, taxAmount]);

  const taxSummaryRows = useMemo(() => {
    const pct = typeof invoice?.taxPercent === "number" ? invoice.taxPercent : 0;
    const hasNonZero = Number.isFinite(pct) && pct > 0;
    const rows: Array<{ rate: string; taxable: number; tax: number; total: number }> = [];

    if (hasNonZero) {
      rows.push({ rate: `${pct}%`, taxable: subtotal, tax: taxAmount, total });
      rows.push({ rate: "0%", taxable: 0, tax: 0, total: 0 });
    } else {
      rows.push({ rate: "0%", taxable: subtotal, tax: 0, total });
    }

    rows.push({ rate: "Ex.", taxable: 0, tax: 0, total: 0 });
    return rows;
  }, [invoice?.taxPercent, subtotal, taxAmount, total]);

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
      <div className="max-w-5xl mx-auto print:max-w-none print:mx-0 print:p-6">
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

        <Card className="p-6 shadow-lg border border-border/60 rounded-2xl print:shadow-none print:border-0 print:rounded-none print:p-0">
          <div className="text-sm text-muted-foreground print:text-black/70">
            {formatDateTime(printedAt)} Invoice - {invoice.invoiceNo || "—"} {invoice.partyName || ""}
          </div>

          <div className="mt-3 text-center">
            <div className="text-2xl font-extrabold tracking-wide">{COMPANY_NAME}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground print:text-black/70">INVOICE</div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold tracking-wide">INVOICE FROM</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground print:text-black/70">NAME:</span> {INVOICE_FROM.name}
                </div>
                <div>
                  <span className="text-muted-foreground print:text-black/70">PIN:</span> {INVOICE_FROM.pin}
                </div>
                <div className="whitespace-pre-wrap">
                  <span className="text-muted-foreground print:text-black/70">ADDRESS:</span> {INVOICE_FROM.address}
                </div>
                <div>
                  <span className="text-muted-foreground print:text-black/70">MOBILE:</span> {INVOICE_FROM.mobile}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wide">INVOICE TO</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground print:text-black/70">NAME:</span> {invoice.partyName || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground print:text-black/70">Customer PIN:</span> {invoice.customer?.pin || invoice.pin || "—"}
                </div>
                <div className="whitespace-pre-wrap">
                  <span className="text-muted-foreground print:text-black/70">ADDRESS:</span> {invoice.customer?.address || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground print:text-black/70">MOBILE:</span> {invoice.customer?.phone || "—"}
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <div className="text-xs font-semibold tracking-wide">INVOICE NO.</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground print:text-black/70">Invoice:</span> {invoice.invoiceNo || "—"}
              </div>
              <div>
                <span className="text-muted-foreground print:text-black/70">CU Number:</span> {invoice.cuNumber || "—"}
              </div>
              <div>
                <span className="text-muted-foreground print:text-black/70">Date:</span> {invoice.issueDate || "—"}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[56px]">S/N</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead className="text-right w-[110px]">Qty</TableHead>
                <TableHead className="w-[80px]">Unit</TableHead>
                <TableHead className="text-right w-[130px]">Unit Price</TableHead>
                <TableHead className="text-right w-[90px]">Rate</TableHead>
                <TableHead className="text-right w-[160px]">Amt incl. Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">No items</TableCell>
                </TableRow>
              ) : (
                lineRows.map((r) => {
                  const base = r.amount;
                  const allocTax = subtotal > 0 ? (base / subtotal) * taxAmount : 0;
                  const amtInclTax = base + allocTax;
                  return (
                    <TableRow key={r.idx}>
                      <TableCell>{r.idx}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.qty.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.rate)}</TableCell>
                      <TableCell className="text-right">{taxPercentLabel || "0%"}</TableCell>
                      <TableCell className="text-right">{formatMoney(amtInclTax)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="text-xs font-semibold tracking-wide">TAX SUMMARY</div>
          <div className="mt-2 rounded-lg border border-border/60 overflow-hidden">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30 print:bg-transparent">
                <TableRow>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead className="text-right">Taxable Amt</TableHead>
                  <TableHead className="text-right">Tax Amt</TableHead>
                  <TableHead className="text-right">Total Amt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxSummaryRows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.rate}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.taxable)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.tax)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Totals</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(subtotal)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(taxAmount)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {invoice.notes ? (
            <>
              <Separator className="my-4" />
              <div className="text-xs font-semibold tracking-wide">NOTES</div>
              <div className="mt-2 text-sm whitespace-pre-wrap">{invoice.notes}</div>
            </>
          ) : null}

          <Separator className="my-4" />
          <div className="text-xs text-muted-foreground print:text-black/70 space-y-1">
            <div>This invoice was generated on {formatDateTimeWithSeconds(printedAt)}</div>
            <div>{SYSTEM_NAME}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
