import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  Package, 
  AlertTriangle,
  ArrowRight,
  Download,
  Filter,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RawInventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  reorderLevel: string;
  status: "Adequate" | "Low" | "Critical" | "Overstocked";
  supplier: string;
  lastUpdated: string;
}

const rawInventory: RawInventoryItem[] = [
  { id: "RI001", name: "Paracetamol API", category: "Active Ingredient", quantity: "500", unit: "kg", location: "Warehouse A", reorderLevel: "100 kg", status: "Adequate", supplier: "ChemPharma Ltd", lastUpdated: "2024-01-15" },
  { id: "RI002", name: "Microcrystalline Cellulose", category: "Excipient", quantity: "75", unit: "kg", location: "Warehouse B", reorderLevel: "100 kg", status: "Low", supplier: "ExciPure Inc", lastUpdated: "2024-01-14" },
  { id: "RI003", name: "Magnesium Stearate", category: "Lubricant", quantity: "25", unit: "kg", location: "Warehouse A", reorderLevel: "50 kg", status: "Critical", supplier: "PharmaChem Co", lastUpdated: "2024-01-15" },
  { id: "RI004", name: "Lactose Monohydrate", category: "Filler", quantity: "800", unit: "kg", location: "Warehouse C", reorderLevel: "200 kg", status: "Overstocked", supplier: "DairyPharma", lastUpdated: "2024-01-13" },
  { id: "RI005", name: "Sodium Starch Glycolate", category: "Disintegrant", quantity: "120", unit: "kg", location: "Warehouse B", reorderLevel: "50 kg", status: "Adequate", supplier: "StarchTech Ltd", lastUpdated: "2024-01-15" },
  { id: "RI006", name: "Ibuprofen API", category: "Active Ingredient", quantity: "350", unit: "kg", location: "Warehouse A", reorderLevel: "100 kg", status: "Adequate", supplier: "ChemPharma Ltd", lastUpdated: "2024-01-14" },
  { id: "RI007", name: "Croscarmellose Sodium", category: "Disintegrant", quantity: "45", unit: "kg", location: "Warehouse B", reorderLevel: "60 kg", status: "Low", supplier: "ExciPure Inc", lastUpdated: "2024-01-15" },
];

export default function RawInventory() {
  const inventoryColumns = [
    { key: "name" as keyof RawInventoryItem, header: "Material Name" },
    { key: "category" as keyof RawInventoryItem, header: "Category" },
    { 
      key: "quantity" as keyof RawInventoryItem, 
      header: "Quantity",
      render: (item: RawInventoryItem) => `${item.quantity} ${item.unit}`
    },
    { key: "location" as keyof RawInventoryItem, header: "Location" },
    { key: "supplier" as keyof RawInventoryItem, header: "Supplier" },
    { key: "reorderLevel" as keyof RawInventoryItem, header: "Reorder Level" },
    { 
      key: "status" as keyof RawInventoryItem, 
      header: "Status",
      render: (item: RawInventoryItem) => (
        <span className={`badge-type ${
          item.status === "Adequate" ? "badge-processed" : 
          item.status === "Low" ? "bg-warning/20 text-warning" : 
          item.status === "Critical" ? "bg-destructive/20 text-destructive" :
          "badge-raw"
        }`}>
          {item.status}
        </span>
      )
    },
    { key: "lastUpdated" as keyof RawInventoryItem, header: "Last Updated" },
  ];

  return (
    <>
      <AppHeader title="Raw Inventory Management" subtitle="Track and manage raw material stock levels" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Raw Materials"
            value={156}
            change="+5%"
            changeType="positive"
            icon={Package}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Adequate Stock"
            value={124}
            change="+8%"
            changeType="positive"
            icon={CheckCircle2}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Low Stock Items"
            value={24}
            change="-3"
            changeType="positive"
            icon={TrendingUp}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
          <StatCard
            title="Critical Alerts"
            value={8}
            change="-2"
            changeType="positive"
            icon={AlertTriangle}
            iconBgColor="bg-destructive/20"
            iconColor="text-destructive"
          />
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="section-title">Raw Material Inventory</h2>
              <p className="section-subtitle">Complete overview of raw material stock levels</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button size="sm" className="gap-2">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-6">
            <DataTable
              data={rawInventory}
              columns={inventoryColumns}
              keyField="id"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Inventory Value</h3>
            <p className="text-3xl font-bold text-foreground">$2.4M</p>
            <p className="text-sm text-success mt-1">+5% from last month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Reorder Requests</h3>
            <p className="text-3xl font-bold text-foreground">12</p>
            <p className="text-sm text-muted-foreground mt-1">Pending approval</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Suppliers Active</h3>
            <p className="text-3xl font-bold text-foreground">34</p>
            <p className="text-sm text-success mt-1">All verified</p>
          </div>
        </div>
      </div>
    </>
  );
}
