import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { QuickActionCard } from "@/components/cards/QuickActionCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  FlaskConical, 
  Package, 
  Beaker, 
  CheckCircle2,
  Plus,
  FileText,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface RawMaterial {
  id: string;
  name: string;
  batchNo: string;
  quantity: string;
  status: "In Stock" | "Low Stock" | "Processing";
  supplier: string;
  expiryDate: string;
}

interface ProcessedMaterial {
  id: string;
  name: string;
  batchNo: string;
  quantity: string;
  processDate: string;
  status: "Completed" | "In Progress" | "Quality Check";
  yield: string;
}

const rawMaterialsData: RawMaterial[] = [
  { id: "RM001", name: "Paracetamol API", batchNo: "PCM-2024-001", quantity: "500 kg", status: "In Stock", supplier: "ChemPharma Ltd", expiryDate: "2026-03-15" },
  { id: "RM002", name: "Microcrystalline Cellulose", batchNo: "MCC-2024-012", quantity: "200 kg", status: "Low Stock", supplier: "ExciPure Inc", expiryDate: "2027-01-20" },
  { id: "RM003", name: "Magnesium Stearate", batchNo: "MGS-2024-008", quantity: "50 kg", status: "Processing", supplier: "PharmaChem Co", expiryDate: "2026-08-10" },
  { id: "RM004", name: "Lactose Monohydrate", batchNo: "LAC-2024-003", quantity: "300 kg", status: "In Stock", supplier: "DairyPharma", expiryDate: "2026-12-01" },
  { id: "RM005", name: "Sodium Starch Glycolate", batchNo: "SSG-2024-007", quantity: "100 kg", status: "In Stock", supplier: "StarchTech Ltd", expiryDate: "2027-05-22" },
];

const processedMaterialsData: ProcessedMaterial[] = [
  { id: "PM001", name: "Paracetamol 500mg Tablets", batchNo: "TAB-2024-101", quantity: "50,000 units", processDate: "2024-01-10", status: "Completed", yield: "98.5%" },
  { id: "PM002", name: "Ibuprofen 400mg Tablets", batchNo: "TAB-2024-102", quantity: "30,000 units", processDate: "2024-01-12", status: "Quality Check", yield: "97.2%" },
  { id: "PM003", name: "Amoxicillin 250mg Capsules", batchNo: "CAP-2024-045", quantity: "25,000 units", processDate: "2024-01-14", status: "In Progress", yield: "95.8%" },
  { id: "PM004", name: "Omeprazole 20mg Capsules", batchNo: "CAP-2024-046", quantity: "40,000 units", processDate: "2024-01-15", status: "Completed", yield: "99.1%" },
];

export default function Processing() {
  const [activeTab, setActiveTab] = useState<"raw" | "processed">("raw");
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    batchNo: "",
    quantity: "",
    status: "In Stock" as "In Stock" | "Low Stock" | "Processing",
    supplier: "",
    expiryDate: "",
  });
  const { toast } = useToast();

  const fetchRawMaterials = async () => {
    try {
      const materialsRef = collection(db, "rawMaterials");
      const snapshot = await getDocs(materialsRef);
      const materials = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RawMaterial[];
      setRawMaterials(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
    }
  };

  useEffect(() => {
    fetchRawMaterials();
  }, []);

  const handleAddMaterial = async () => {
    if (!formData.name || !formData.batchNo || !formData.quantity || !formData.supplier || !formData.expiryDate) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    console.log("Starting to add material...", formData);
    
    try {
      const materialsRef = collection(db, "rawMaterials");
      console.log("Collection ref obtained:", materialsRef.path);
      
      const materialData = {
        name: formData.name,
        batchNo: formData.batchNo,
        quantity: formData.quantity,
        status: formData.status,
        supplier: formData.supplier,
        expiryDate: formData.expiryDate,
        createdAt: Timestamp.now(),
      };
      console.log("Data to save:", materialData);
      
      const docRef = await addDoc(materialsRef, materialData);
      console.log("Document written with ID: ", docRef.id);
      
      toast({
        title: "Success",
        description: "Material added successfully",
      });
      setIsAddMaterialOpen(false);
      setFormData({
        name: "",
        batchNo: "",
        quantity: "",
        status: "In Stock",
        supplier: "",
        expiryDate: "",
      });
      await fetchRawMaterials();
    } catch (error: unknown) {
      console.error("Error adding material:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add material";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const rawMaterialColumns = [
    { key: "name" as keyof RawMaterial, header: "Material Name" },
    { key: "batchNo" as keyof RawMaterial, header: "Batch No." },
    { key: "quantity" as keyof RawMaterial, header: "Quantity" },
    { 
      key: "status" as keyof RawMaterial, 
      header: "Status",
      render: (item: RawMaterial) => (
        <span className={`badge-type ${
          item.status === "In Stock" ? "badge-processed" : 
          item.status === "Low Stock" ? "bg-warning/20 text-warning" : 
          "badge-raw"
        }`}>
          {item.status}
        </span>
      )
    },
    { key: "supplier" as keyof RawMaterial, header: "Supplier" },
    { key: "expiryDate" as keyof RawMaterial, header: "Expiry Date" },
  ];

  const processedMaterialColumns = [
    { key: "name" as keyof ProcessedMaterial, header: "Product Name" },
    { key: "batchNo" as keyof ProcessedMaterial, header: "Batch No." },
    { key: "quantity" as keyof ProcessedMaterial, header: "Quantity" },
    { key: "processDate" as keyof ProcessedMaterial, header: "Process Date" },
    { 
      key: "status" as keyof ProcessedMaterial, 
      header: "Status",
      render: (item: ProcessedMaterial) => (
        <span className={`badge-type ${
          item.status === "Completed" ? "badge-processed" : 
          item.status === "Quality Check" ? "bg-warning/20 text-warning" : 
          "badge-raw"
        }`}>
          {item.status}
        </span>
      )
    },
    { 
      key: "yield" as keyof ProcessedMaterial, 
      header: "Yield",
      render: (item: ProcessedMaterial) => (
        <span className="text-success font-medium">{item.yield}</span>
      )
    },
  ];

  return (
    <>
      <AppHeader title="Processing Dashboard" subtitle="Manage raw materials and processed products" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Raw Materials"
            value={85}
            change="+12%"
            changeType="positive"
            icon={Package}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Active Batches"
            value={24}
            change="+8%"
            changeType="positive"
            icon={FlaskConical}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Quality Checks"
            value={12}
            change="+5%"
            changeType="positive"
            icon={Beaker}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
          <StatCard
            title="Completed Today"
            value={8}
            change="+15%"
            changeType="positive"
            icon={CheckCircle2}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`tab-item ${activeTab === "raw" ? "tab-item-active" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  Raw Materials
                </button>
                <button
                  onClick={() => setActiveTab("processed")}
                  className={`tab-item ${activeTab === "processed" ? "tab-item-active" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <FlaskConical className="w-4 h-4 inline mr-2" />
                  Processed Materials
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="section-title">
                      {activeTab === "raw" ? "Raw Material Inventory" : "Processed Products"}
                    </h2>
                    <p className="section-subtitle">
                      {activeTab === "raw" 
                        ? "Track and manage incoming raw materials" 
                        : "Monitor production batches and yields"}
                    </p>
                  </div>
                  <Button className="gap-2">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

{activeTab === "raw" ? (
                    <DataTable
                      data={[...rawMaterials, ...rawMaterialsData]}
                      columns={rawMaterialColumns}
                      keyField="id"
                    />
                  ) : (
                  <DataTable
                    data={processedMaterialsData}
                    columns={processedMaterialColumns}
                    keyField="id"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="section-title mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionCard title="Add Material" icon={Plus} onClick={() => setIsAddMaterialOpen(true)} />
                <QuickActionCard title="New Batch" icon={FlaskConical} />
                <QuickActionCard title="Reports" icon={FileText} />
                <QuickActionCard title="Analytics" icon={TrendingUp} />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="section-title mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  { text: "Batch PCM-2024-001 completed", time: "10 mins ago", type: "success" },
                  { text: "New raw material received", time: "1 hour ago", type: "info" },
                  { text: "Quality check initiated", time: "2 hours ago", type: "warning" },
                ].map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === "success" ? "bg-success" :
                      activity.type === "warning" ? "bg-warning" : "bg-info"
                    }`} />
                    <div>
                      <p className="text-sm text-foreground">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
</div>
            </div>
          </div>
        </div>

        <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Raw Material</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Material Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paracetamol API"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="batchNo">Batch Number</Label>
                  <Input
                    id="batchNo"
                    value={formData.batchNo}
                    onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                    placeholder="e.g., PCM-2024-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g., 500 kg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as "In Stock" | "Low Stock" | "Processing" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="Low Stock">Low Stock</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g., ChemPharma Ltd"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddMaterialOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMaterial} disabled={loading}>
                {loading ? "Adding..." : "Add Material"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
