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

const transactions: Transaction[] = [
  { id: "T001", description: "Sale - Paracetamol Tablets", category: "Product Sales", amount: "₹2,45,000", type: "Income", date: "2024-01-15", status: "Completed", reference: "INV-2024-001" },
  { id: "T002", description: "Raw Material Purchase - API", category: "Procurement", amount: "₹1,20,000", type: "Expense", date: "2024-01-14", status: "Completed", reference: "PO-2024-045" },
  { id: "T003", description: "Sale - Ibuprofen Tablets", category: "Product Sales", amount: "₹1,85,000", type: "Income", date: "2024-01-13", status: "Completed", reference: "INV-2024-002" },
  { id: "T004", description: "Equipment Maintenance", category: "Operations", amount: "₹35,000", type: "Expense", date: "2024-01-12", status: "Pending", reference: "MNT-2024-012" },
  { id: "T005", description: "Packaging Material", category: "Procurement", amount: "₹45,000", type: "Expense", date: "2024-01-11", status: "Completed", reference: "PO-2024-046" },
  { id: "T006", description: "Sale - Amoxicillin Capsules", category: "Product Sales", amount: "₹3,20,000", type: "Income", date: "2024-01-10", status: "Completed", reference: "INV-2024-003" },
];

const invoices: Invoice[] = [
  { id: "I001", invoiceNo: "INV-2024-001", customer: "Apollo Pharmacy", amount: "₹2,45,000", issueDate: "2024-01-15", dueDate: "2024-02-15", status: "Pending" },
  { id: "I002", invoiceNo: "INV-2024-002", customer: "MedPlus Health", amount: "₹1,85,000", issueDate: "2024-01-13", dueDate: "2024-02-13", status: "Paid" },
  { id: "I003", invoiceNo: "INV-2024-003", customer: "Fortis Hospital", amount: "₹3,20,000", issueDate: "2024-01-10", dueDate: "2024-02-10", status: "Paid" },
  { id: "I004", invoiceNo: "INV-2024-004", customer: "Max Healthcare", amount: "₹4,50,000", issueDate: "2024-01-08", dueDate: "2024-02-08", status: "Overdue" },
];

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
            value="₹12.5L"
            change="+15%"
            changeType="positive"
            icon={DollarSign}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Total Expenses"
            value="₹4.2L"
            change="+8%"
            changeType="negative"
            icon={CreditCard}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
          <StatCard
            title="Net Profit"
            value="₹8.3L"
            change="+22%"
            changeType="positive"
            icon={Wallet}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Pending Invoices"
            value="₹6.95L"
            change="5 invoices"
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
            <p className="text-3xl font-bold text-foreground">₹7.5L</p>
            <p className="text-sm text-success mt-1">+18% from last month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">This Quarter</h3>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-3xl font-bold text-foreground">₹22.8L</p>
            <p className="text-sm text-success mt-1">+25% from last quarter</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Year to Date</h3>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-3xl font-bold text-foreground">₹1.2Cr</p>
            <p className="text-sm text-success mt-1">On track for targets</p>
          </div>
        </div>
      </div>
    </>
  );
}
