import { useState } from "react";
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
    supplier: "",
  });
  const { toast } = useToast();

  // Filter data based on search and date range
  const filteredData = rawInventory.filter((item) => {
    const matchesSearch = searchQuery === "" || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDateRange = (!startDate || new Date(item.lastUpdated) >= new Date(startDate)) &&
                             (!endDate || new Date(item.lastUpdated) <= new Date(endDate));
    
    return matchesSearch && matchesDateRange;
  });

  const handleAddItem = () => {
    if (!formData.name || !formData.category || !formData.quantity || !formData.location || !formData.supplier) {
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
      supplier: "",
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

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
                      placeholder="Search by name, category, or supplier..."
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
                  Showing {filteredData.length} of {rawInventory.length} items
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

      {/* Add Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Raw Material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="itemName">Material Name *</Label>
                <Input
                  id="itemName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paracetamol API"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Active Ingredient"
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
                  placeholder="500"
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
                  placeholder="100 kg"
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
                  placeholder="e.g., Warehouse A"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g., ChemPharma Ltd"
                />
              </div>
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
