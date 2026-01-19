import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  Boxes, 
  TrendingUp,
  ArrowRight,
  Download,
  Filter,
  Activity,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProcessedInventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  reorderLevel: string;
  status: "Adequate" | "Low" | "Critical" | "Overstocked";
  batchNo: string;
  processedDate: string;
  lastUpdated: string;
}

const processedInventory: ProcessedInventoryItem[] = [
  { id: "PI001", name: "Paracetamol Granules", category: "Intermediate", quantity: "200", unit: "kg", location: "Production Bay 1", reorderLevel: "50 kg", status: "Adequate", batchNo: "PG-2024-001", processedDate: "2024-01-10", lastUpdated: "2024-01-15" },
  { id: "PI002", name: "Ibuprofen Blend", category: "Intermediate", quantity: "150", unit: "kg", location: "Production Bay 2", reorderLevel: "75 kg", status: "Adequate", batchNo: "IB-2024-012", processedDate: "2024-01-12", lastUpdated: "2024-01-14" },
  { id: "PI003", name: "Amoxicillin Powder", category: "Intermediate", quantity: "30", unit: "kg", location: "Production Bay 1", reorderLevel: "40 kg", status: "Low", batchNo: "AP-2024-008", processedDate: "2024-01-13", lastUpdated: "2024-01-15" },
  { id: "PI004", name: "Omeprazole Granules", category: "Intermediate", quantity: "180", unit: "kg", location: "Production Bay 3", reorderLevel: "60 kg", status: "Adequate", batchNo: "OG-2024-015", processedDate: "2024-01-14", lastUpdated: "2024-01-15" },
  { id: "PI005", name: "Cetirizine Blend", category: "Intermediate", quantity: "95", unit: "kg", location: "Production Bay 2", reorderLevel: "50 kg", status: "Adequate", batchNo: "CB-2024-020", processedDate: "2024-01-11", lastUpdated: "2024-01-14" },
  { id: "PI006", name: "Metformin Granules", category: "Intermediate", quantity: "25", unit: "kg", location: "Production Bay 1", reorderLevel: "45 kg", status: "Critical", batchNo: "MG-2024-005", processedDate: "2024-01-09", lastUpdated: "2024-01-15" },
];

export default function ProcessedInventory() {
  const inventoryColumns = [
    { key: "name" as keyof ProcessedInventoryItem, header: "Material Name" },
    { key: "category" as keyof ProcessedInventoryItem, header: "Category" },
    { key: "batchNo" as keyof ProcessedInventoryItem, header: "Batch No." },
    { 
      key: "quantity" as keyof ProcessedInventoryItem, 
      header: "Quantity",
      render: (item: ProcessedInventoryItem) => `${item.quantity} ${item.unit}`
    },
    { key: "location" as keyof ProcessedInventoryItem, header: "Location" },
    { key: "processedDate" as keyof ProcessedInventoryItem, header: "Processed Date" },
    { key: "reorderLevel" as keyof ProcessedInventoryItem, header: "Reorder Level" },
    { 
      key: "status" as keyof ProcessedInventoryItem, 
      header: "Status",
      render: (item: ProcessedInventoryItem) => (
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
    { key: "lastUpdated" as keyof ProcessedInventoryItem, header: "Last Updated" },
  ];

  return (
    <>
      <AppHeader title="Processed Inventory Management" subtitle="Monitor intermediate products ready for final processing" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Processed Materials"
            value={89}
            change="+12%"
            changeType="positive"
            icon={Boxes}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Ready for Production"
            value={67}
            change="+15%"
            changeType="positive"
            icon={CheckCircle2}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="In Production"
            value={18}
            change="+3"
            changeType="positive"
            icon={Activity}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Average Yield"
            value="97.6%"
            change="+0.8%"
            changeType="positive"
            icon={TrendingUp}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="section-title">Processed Material Inventory</h2>
              <p className="section-subtitle">Intermediate products ready for final processing</p>
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
              data={processedInventory}
              columns={inventoryColumns}
              keyField="id"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Processing Value</h3>
            <p className="text-3xl font-bold text-foreground">$1.8M</p>
            <p className="text-sm text-success mt-1">+12% from last month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Batches This Month</h3>
            <p className="text-3xl font-bold text-foreground">42</p>
            <p className="text-sm text-success mt-1">+8 from last month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Quality Pass Rate</h3>
            <p className="text-3xl font-bold text-foreground">98.5%</p>
            <p className="text-sm text-success mt-1">Above target</p>
          </div>
        </div>
      </div>
    </>
  );
}
