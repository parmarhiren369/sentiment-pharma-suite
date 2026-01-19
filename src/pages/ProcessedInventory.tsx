import { useState } from "react";
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
  CheckCircle2,
  Plus,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "kg",
    location: "",
    reorderLevel: "",
    status: "Adequate" as "Adequate" | "Low" | "Critical" | "Overstocked",
    batchNo: "",
    processedDate: "",
  });
  const { toast } = useToast();

  // Filter data based on search and date range
  const filteredData = processedInventory.filter((item) => {
    const matchesSearch = searchQuery === "" || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batchNo.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDateRange = (!startDate || new Date(item.processedDate) >= new Date(startDate)) &&
                             (!endDate || new Date(item.processedDate) <= new Date(endDate));
    
    return matchesSearch && matchesDateRange;
  });

  const handleAddItem = () => {
    if (!formData.name || !formData.category || !formData.quantity || !formData.location || !formData.batchNo || !formData.processedDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Item added successfully",
    });
    setIsAddItemOpen(false);
    setFormData({
      name: "",
      category: "",
      quantity: "",
      unit: "kg",
      location: "",
      reorderLevel: "",
      status: "Adequate",
      batchNo: "",
      processedDate: "",
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

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
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="search" className="text-sm font-medium mb-2 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, category, or batch number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm font-medium mb-2 block">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setIsAddItemOpen(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
                <div className="text-sm text-muted-foreground ml-auto">
                  Showing {filteredData.length} of {processedInventory.length} items
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            <DataTable
              data={filteredData}
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

      {/* Add Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Processed Material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="itemName">Material Name *</Label>
                <Input
                  id="itemName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paracetamol Granules"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Intermediate"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="batchNo">Batch Number *</Label>
                <Input
                  id="batchNo"
                  value={formData.batchNo}
                  onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                  placeholder="e.g., PG-2024-001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="processedDate">Processed Date *</Label>
                <Input
                  id="processedDate"
                  type="date"
                  value={formData.processedDate}
                  onChange={(e) => setFormData({ ...formData, processedDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="mL">mL</SelectItem>
                    <SelectItem value="units">units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  placeholder="50 kg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Production Bay 1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as "Adequate" | "Low" | "Critical" | "Overstocked" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Adequate">Adequate</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="Overstocked">Overstocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
