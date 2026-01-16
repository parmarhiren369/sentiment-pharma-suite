import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  Package, 
  Boxes, 
  PackageCheck,
  AlertTriangle,
  ArrowRight,
  Download,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TabType = "raw" | "processed" | "finished";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  reorderLevel: string;
  status: "Adequate" | "Low" | "Critical" | "Overstocked";
  lastUpdated: string;
}

interface FinishedGoods {
  id: string;
  productName: string;
  batchNo: string;
  rawMaterialUsed: string;
  processedFrom: string;
  outputQuantity: string;
  productionDate: string;
  status: "In Stock" | "Dispatched" | "Reserved";
}

const rawInventory: InventoryItem[] = [
  { id: "RI001", name: "Paracetamol API", category: "Active Ingredient", quantity: "500", unit: "kg", location: "Warehouse A", reorderLevel: "100 kg", status: "Adequate", lastUpdated: "2024-01-15" },
  { id: "RI002", name: "Microcrystalline Cellulose", category: "Excipient", quantity: "75", unit: "kg", location: "Warehouse B", reorderLevel: "100 kg", status: "Low", lastUpdated: "2024-01-14" },
  { id: "RI003", name: "Magnesium Stearate", category: "Lubricant", quantity: "25", unit: "kg", location: "Warehouse A", reorderLevel: "50 kg", status: "Critical", lastUpdated: "2024-01-15" },
  { id: "RI004", name: "Lactose Monohydrate", category: "Filler", quantity: "800", unit: "kg", location: "Warehouse C", reorderLevel: "200 kg", status: "Overstocked", lastUpdated: "2024-01-13" },
];

const processedInventory: InventoryItem[] = [
  { id: "PI001", name: "Paracetamol Granules", category: "Intermediate", quantity: "200", unit: "kg", location: "Production Bay 1", reorderLevel: "50 kg", status: "Adequate", lastUpdated: "2024-01-15" },
  { id: "PI002", name: "Ibuprofen Blend", category: "Intermediate", quantity: "150", unit: "kg", location: "Production Bay 2", reorderLevel: "75 kg", status: "Adequate", lastUpdated: "2024-01-14" },
  { id: "PI003", name: "Amoxicillin Powder", category: "Intermediate", quantity: "30", unit: "kg", location: "Production Bay 1", reorderLevel: "40 kg", status: "Low", lastUpdated: "2024-01-15" },
];

const finishedGoods: FinishedGoods[] = [
  { id: "FG001", productName: "Paracetamol 500mg Tablets", batchNo: "TAB-2024-101", rawMaterialUsed: "Paracetamol API, MCC, Lactose", processedFrom: "Paracetamol Granules", outputQuantity: "50,000 units", productionDate: "2024-01-10", status: "In Stock" },
  { id: "FG002", productName: "Ibuprofen 400mg Tablets", batchNo: "TAB-2024-102", rawMaterialUsed: "Ibuprofen API, Starch, MCC", processedFrom: "Ibuprofen Blend", outputQuantity: "30,000 units", productionDate: "2024-01-12", status: "Reserved" },
  { id: "FG003", productName: "Amoxicillin 250mg Capsules", batchNo: "CAP-2024-045", rawMaterialUsed: "Amoxicillin API, Lactose", processedFrom: "Amoxicillin Powder", outputQuantity: "25,000 units", productionDate: "2024-01-14", status: "Dispatched" },
  { id: "FG004", productName: "Omeprazole 20mg Capsules", batchNo: "CAP-2024-046", rawMaterialUsed: "Omeprazole API, MCC, Talc", processedFrom: "Omeprazole Granules", outputQuantity: "40,000 units", productionDate: "2024-01-15", status: "In Stock" },
];

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<TabType>("raw");

  const inventoryColumns = [
    { key: "name" as keyof InventoryItem, header: "Material Name" },
    { key: "category" as keyof InventoryItem, header: "Category" },
    { 
      key: "quantity" as keyof InventoryItem, 
      header: "Quantity",
      render: (item: InventoryItem) => `${item.quantity} ${item.unit}`
    },
    { key: "location" as keyof InventoryItem, header: "Location" },
    { key: "reorderLevel" as keyof InventoryItem, header: "Reorder Level" },
    { 
      key: "status" as keyof InventoryItem, 
      header: "Status",
      render: (item: InventoryItem) => (
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
    { key: "lastUpdated" as keyof InventoryItem, header: "Last Updated" },
  ];

  const finishedGoodsColumns = [
    { key: "productName" as keyof FinishedGoods, header: "Product Name" },
    { key: "batchNo" as keyof FinishedGoods, header: "Batch No." },
    { key: "rawMaterialUsed" as keyof FinishedGoods, header: "Raw Materials Used" },
    { key: "processedFrom" as keyof FinishedGoods, header: "Processed From" },
    { key: "outputQuantity" as keyof FinishedGoods, header: "Output Quantity" },
    { key: "productionDate" as keyof FinishedGoods, header: "Production Date" },
    { 
      key: "status" as keyof FinishedGoods, 
      header: "Status",
      render: (item: FinishedGoods) => (
        <span className={`badge-type ${
          item.status === "In Stock" ? "badge-processed" : 
          item.status === "Reserved" ? "bg-warning/20 text-warning" : 
          "badge-raw"
        }`}>
          {item.status}
        </span>
      )
    },
  ];

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "raw", label: "Raw Materials", icon: Package },
    { key: "processed", label: "Processed Materials", icon: Boxes },
    { key: "finished", label: "Finished Goods", icon: PackageCheck },
  ];

  const getActiveData = () => {
    switch (activeTab) {
      case "raw":
        return { data: rawInventory, columns: inventoryColumns, keyField: "id" as keyof InventoryItem };
      case "processed":
        return { data: processedInventory, columns: inventoryColumns, keyField: "id" as keyof InventoryItem };
      case "finished":
        return { data: finishedGoods, columns: finishedGoodsColumns, keyField: "id" as keyof FinishedGoods };
    }
  };

  return (
    <>
      <AppHeader title="Inventory Management" subtitle="Track materials and finished goods across your supply chain" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Raw Materials"
            value={156}
            change="+5%"
            changeType="positive"
            icon={Package}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Processed Items"
            value={89}
            change="+12%"
            changeType="positive"
            icon={Boxes}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Finished Goods"
            value="145K"
            change="+18%"
            changeType="positive"
            icon={PackageCheck}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Low Stock Alerts"
            value={8}
            change="-3"
            changeType="negative"
            icon={AlertTriangle}
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
                  {activeTab === "raw" && "Raw Material Inventory"}
                  {activeTab === "processed" && "Processed Material Inventory"}
                  {activeTab === "finished" && "Finished Goods Inventory"}
                </h2>
                <p className="section-subtitle">
                  {activeTab === "raw" && "Complete overview of raw material stock levels"}
                  {activeTab === "processed" && "Intermediate products ready for final processing"}
                  {activeTab === "finished" && "Finished products with traceability information"}
                </p>
              </div>
              <Button className="gap-2">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {activeTab === "finished" ? (
              <DataTable
                data={finishedGoods}
                columns={finishedGoodsColumns}
                keyField="id"
              />
            ) : (
              <DataTable
                data={activeTab === "raw" ? rawInventory : processedInventory}
                columns={inventoryColumns}
                keyField="id"
              />
            )}
          </div>
        </div>

        {/* Finished Goods Summary */}
        {activeTab === "finished" && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Output This Month</h3>
              <p className="text-3xl font-bold text-foreground">145,000</p>
              <p className="text-sm text-success mt-1">+18% from last month</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Average Yield Rate</h3>
              <p className="text-3xl font-bold text-foreground">97.6%</p>
              <p className="text-sm text-success mt-1">+0.8% improvement</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Batches Completed</h3>
              <p className="text-3xl font-bold text-foreground">24</p>
              <p className="text-sm text-success mt-1">All quality approved</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
