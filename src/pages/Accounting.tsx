import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  CreditCard,
  ArrowRight,
  Download,
  Filter,
  Receipt,
  Wallet,
  PiggyBank
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

type TabType = "overview" | "income" | "expenses" | "invoices";

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  type: "Income" | "Expense";
  date: string;
  status: "Completed" | "Pending" | "Failed";
  reference: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  customer: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "Paid" | "Pending" | "Overdue";
}

const rupees = (value: number) => `₹${(value || 0).toLocaleString("en-IN")}`;

export default function Accounting() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const transactionColumns = [
    { key: "description" as keyof Transaction, header: "Description" },
    { key: "category" as keyof Transaction, header: "Category" },
    { 
      key: "amount" as keyof Transaction, 
      header: "Amount",
      render: (item: Transaction) => (
        <span className={item.type === "Income" ? "text-success font-medium" : "text-destructive font-medium"}>
          {item.type === "Income" ? "+" : "-"}{rupees(item.amount)}
        </span>
      )
    },
    { 
      key: "type" as keyof Transaction, 
      header: "Type",
      render: (item: Transaction) => (
        <span className={`badge-type ${item.type === "Income" ? "badge-processed" : "bg-destructive/20 text-destructive"}`}>
          {item.type}
        </span>
      )
    },
    { key: "date" as keyof Transaction, header: "Date" },
    { 
      key: "status" as keyof Transaction, 
      header: "Status",
      render: (item: Transaction) => (
        <span className={`badge-type ${
          item.status === "Completed" ? "badge-processed" : 
          item.status === "Pending" ? "bg-warning/20 text-warning" : 
          "bg-destructive/20 text-destructive"
        }`}>
          {item.status}
        </span>
      )
    },
    { key: "reference" as keyof Transaction, header: "Reference" },
  ];

  const invoiceColumns = [
    { key: "invoiceNo" as keyof Invoice, header: "Invoice No." },
    { key: "customer" as keyof Invoice, header: "Customer" },
    { 
      key: "amount" as keyof Invoice, 
      header: "Amount",
      render: (item: Invoice) => (
        <span className="font-medium text-foreground">{rupees(item.amount)}</span>
      )
    },
    { key: "issueDate" as keyof Invoice, header: "Issue Date" },
    { key: "dueDate" as keyof Invoice, header: "Due Date" },
    { 
      key: "status" as keyof Invoice, 
      header: "Status",
      render: (item: Invoice) => (
        <span className={`badge-type ${
          item.status === "Paid" ? "badge-processed" : 
          item.status === "Pending" ? "bg-warning/20 text-warning" : 
          "bg-destructive/20 text-destructive"
        }`}>
          {item.status}
        </span>
      )
    },
  ];

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: DollarSign },
    { key: "income", label: "Income", icon: TrendingUp },
    { key: "expenses", label: "Expenses", icon: TrendingDown },
    { key: "invoices", label: "Invoices", icon: Receipt },
  ];

  const incomeTransactions = transactions.filter(t => t.type === "Income");
  const expenseTransactions = transactions.filter(t => t.type === "Expense");

  const fetchTransactions = async () => {
    const qy = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        description: (data.description || "").toString(),
        category: (data.category || "General").toString(),
        amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
        type: (data.type || "Income") as Transaction["type"],
        date: (data.date || "").toString(),
        status: (data.status || "Completed") as Transaction["status"],
        reference: (data.reference || "").toString(),
      } as Transaction;
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
        customer: (data.partyName || data.customer || "").toString(),
        amount: typeof data.total === "number" ? data.total : typeof data.amount === "number" ? data.amount : parseFloat(data.total ?? data.amount) || 0,
        issueDate: (data.issueDate || data.date || "").toString(),
        dueDate: (data.dueDate || "").toString(),
        status: (data.status || "Pending") as Invoice["status"],
      } as Invoice;
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
      await Promise.all([fetchTransactions(), fetchInvoices()]);
    } catch (error) {
      console.error("Error loading accounting data", error);
      toast({
        title: "Load failed",
        description: "Could not load transactions/invoices from Firestore.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const exportRows = useMemo(() => {
    switch (activeTab) {
      case "income":
        return incomeTransactions.map((t) => ({
          Date: t.date,
          Type: t.type,
          Amount: t.amount,
          Category: t.category,
          Description: t.description,
          Status: t.status,
          Reference: t.reference,
        }));
      case "expenses":
        return expenseTransactions.map((t) => ({
          Date: t.date,
          Type: t.type,
          Amount: t.amount,
          Category: t.category,
          Description: t.description,
          Status: t.status,
          Reference: t.reference,
        }));
      case "invoices":
        return invoices.map((i) => ({
          "Invoice No": i.invoiceNo,
          Customer: i.customer,
          Amount: i.amount,
          "Issue Date": i.issueDate,
          "Due Date": i.dueDate,
          Status: i.status,
        }));
      case "overview":
      default:
        return transactions.map((t) => ({
          Date: t.date,
          Type: t.type,
          Amount: t.amount,
          Category: t.category,
          Description: t.description,
          Status: t.status,
          Reference: t.reference,
        }));
    }
  }, [activeTab, incomeTransactions, expenseTransactions]);

  const exportFileName = useMemo(() => {
    switch (activeTab) {
      case "income":
        return "accounting-income";
      case "expenses":
        return "accounting-expenses";
      case "invoices":
        return "accounting-invoices";
      case "overview":
      default:
        return "accounting-transactions";
    }
  }, [activeTab]);

  return (
    <>
      <AppHeader title="Accounting" subtitle="Financial overview and transaction management" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Revenue"
            value={rupees(incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0))}
            change="+15%"
            changeType="positive"
            icon={DollarSign}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Total Expenses"
            value={rupees(expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0))}
            change="+8%"
            changeType="negative"
            icon={CreditCard}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Net Profit"
            value={rupees(
              incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) -
                expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
            )}
            change="+22%"
            changeType="positive"
            icon={Wallet}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Pending Invoices"
            value={rupees(invoices.filter((i) => i.status === "Pending" || i.status === "Overdue").reduce((sum, i) => sum + (i.amount || 0), 0))}
            change={`${invoices.filter(i => i.status === "Pending" || i.status === "Overdue").length} invoices`}
            changeType="neutral"
            icon={PiggyBank}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border px-4">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-item flex items-center gap-2 ${
                    activeTab === tab.key 
                      ? "tab-item-active" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 py-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={fetchAll} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <ExportExcelButton
                rows={exportRows as unknown as Array<Record<string, unknown>>}
                fileName={exportFileName}
                sheetName="Accounting"
                label="Export to Excel"
                variant="outline"
              />
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">
                  {activeTab === "overview" && "All Transactions"}
                  {activeTab === "income" && "Income Transactions"}
                  {activeTab === "expenses" && "Expense Transactions"}
                  {activeTab === "invoices" && "Invoice Management"}
                </h2>
                <p className="section-subtitle">
                  {activeTab === "overview" && "Complete transaction history"}
                  {activeTab === "income" && "Revenue from product sales and services"}
                  {activeTab === "expenses" && "Operational and procurement expenses"}
                  {activeTab === "invoices" && "Track and manage customer invoices"}
                </p>
              </div>
              <Button className="gap-2">
                {activeTab === "invoices" ? (
                  <span className="flex items-center gap-2" onClick={() => navigate("/invoices")}>
                    View All <ArrowRight className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="flex items-center gap-2" onClick={() => navigate("/transactions")}>
                    View All <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>

            {activeTab === "invoices" ? (
              <DataTable
                data={invoices}
                columns={invoiceColumns}
                keyField="id"
              />
            ) : (
              <DataTable
                data={
                  activeTab === "income" ? incomeTransactions :
                  activeTab === "expenses" ? expenseTransactions :
                  transactions
                }
                columns={transactionColumns}
                keyField="id"
              />
            )}
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">This Month</h3>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {incomeTransactions.length > 0 
                ? rupees(incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0))
                : rupees(0)}
            </p>
            <p className="text-sm text-success mt-1">{incomeTransactions.length} transactions</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Total Expenses</h3>
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {expenseTransactions.length > 0 
                ? rupees(expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0))
                : rupees(0)}
            </p>
            <p className="text-sm text-destructive mt-1">{expenseTransactions.length} transactions</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Outstanding</h3>
              <Receipt className="w-5 h-5 text-warning" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {invoices.filter(i => i.status !== "Paid").length > 0 
                ? rupees(invoices.filter(i => i.status !== "Paid").reduce((sum, i) => sum + (i.amount || 0), 0))
                : rupees(0)}
            </p>
            <p className="text-sm text-warning mt-1">{invoices.filter(i => i.status !== "Paid").length} pending invoices</p>
          </div>
        </div>
      </div>
    </>
  );
}
