import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
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

type TabType = "overview" | "income" | "expenses" | "invoices";

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: string;
  type: "Income" | "Expense";
  date: string;
  status: "Completed" | "Pending" | "Failed";
  reference: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  customer: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  status: "Paid" | "Pending" | "Overdue";
}

const transactions: Transaction[] = [];

const invoices: Invoice[] = [];

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const transactionColumns = [
    { key: "description" as keyof Transaction, header: "Description" },
    { key: "category" as keyof Transaction, header: "Category" },
    { 
      key: "amount" as keyof Transaction, 
      header: "Amount",
      render: (item: Transaction) => (
        <span className={item.type === "Income" ? "text-success font-medium" : "text-destructive font-medium"}>
          {item.type === "Income" ? "+" : "-"}{item.amount}
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
        <span className="font-medium text-foreground">{item.amount}</span>
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

  return (
    <>
      <AppHeader title="Accounting" subtitle="Financial overview and transaction management" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Revenue"
            value={`₹${(incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(1)}L`}
            change="+15%"
            changeType="positive"
            icon={DollarSign}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Total Expenses"
            value={`₹${(expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(1)}L`}
            change="+8%"
            changeType="negative"
            icon={CreditCard}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Net Profit"
            value={`₹${((incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0) - 
                          expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0)) / 100000).toFixed(1)}L`}
            change="+22%"
            changeType="positive"
            icon={Wallet}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Pending Invoices"
            value={`₹${(invoices.filter(i => i.status === "Pending" || i.status === "Overdue").reduce((sum, i) => sum + parseFloat(i.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(2)}L`}
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
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
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
                View All <ArrowRight className="w-4 h-4" />
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
                ? `₹${(incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(1)}L`
                : "₹0"}
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
                ? `₹${(expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(1)}L`
                : "₹0"}
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
                ? `₹${(invoices.filter(i => i.status !== "Paid").reduce((sum, i) => sum + parseFloat(i.amount.replace(/[₹,]/g, '')), 0) / 100000).toFixed(1)}L`
                : "₹0"}
            </p>
            <p className="text-sm text-warning mt-1">{invoices.filter(i => i.status !== "Paid").length} pending invoices</p>
          </div>
        </div>
      </div>
    </>
  );
}
