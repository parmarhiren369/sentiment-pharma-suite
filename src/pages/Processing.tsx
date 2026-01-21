import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  FlaskConical, 
  Package, 
  Beaker, 
  CheckCircle2,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, Timestamp, query, orderBy, limit, updateDoc, doc } from "firebase/firestore";
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

interface RawInventoryItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  location: string;
  supplier: string;
}

interface BatchItem {
  rawItemId: string;
  rawItemName: string;
  currentQuantity: number;
  unit: string;
  useQuantity: number;
}

interface Batch {
  id: string;
  batchNo: string;
  items: BatchItem[];
  createdAt: Date;
  status: string;
}

const rawMaterialsData: RawMaterial[] = [];

const processedMaterialsData: ProcessedMaterial[] = [];

export default function Processing() {
  const [activeTab, setActiveTab] = useState<"raw" | "processed">("raw");
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawInventory, setRawInventory] = useState<RawInventoryItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([
    { rawItemId: "", rawItemName: "", currentQuantity: 0, unit: "", useQuantity: 0 }
  ]);
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

  const fetchRawInventory = async () => {
    try {
      const inventoryRef = collection(db, "rawInventory");
      const snapshot = await getDocs(inventoryRef);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RawInventoryItem[];
      setRawInventory(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  const fetchBatches = async () => {
    try {
      const batchesRef = collection(db, "batches");
      const snapshot = await getDocs(batchesRef);
      const batchData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Batch[];
      setBatches(batchData);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  const generateBatchNumber = async () => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = now.getFullYear().toString().slice(-2);
    
    try {
      const batchesRef = collection(db, "batches");
      const q = query(batchesRef, orderBy("createdAt", "desc"), limit(1));
      const snapshot = await getDocs(q);
      
      let serialNumber = 1;
      if (!snapshot.empty) {
        const lastBatch = snapshot.docs[0].data();
        const lastBatchNo = lastBatch.batchNo as string;
        // Extract the serial number from last batch (e.g., BTCJAN26001 -> 001)
        const lastSerial = parseInt(lastBatchNo.slice(-3));
        serialNumber = lastSerial + 1;
      }
      
      const serialStr = serialNumber.toString().padStart(3, '0');
      return `BTC${month}${year}${serialStr}`;
    } catch (error) {
      console.error("Error generating batch number:", error);
      return `BTC${month}${year}001`;
    }
  };

  useEffect(() => {
    fetchRawMaterials();
    fetchRawInventory();
    fetchBatches();
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

  const handleAddBatchItem = () => {
    setBatchItems([...batchItems, { rawItemId: "", rawItemName: "", currentQuantity: 0, unit: "", useQuantity: 0 }]);
  };

  const handleRemoveBatchItem = (index: number) => {
    if (batchItems.length > 1) {
      const newItems = batchItems.filter((_, i) => i !== index);
      setBatchItems(newItems);
    }
  };

  const handleBatchItemChange = (index: number, field: keyof BatchItem, value: string | number) => {
    const newItems = [...batchItems];
    
    if (field === "rawItemId") {
      const selectedItem = rawInventory.find(item => item.id === value);
      if (selectedItem) {
        newItems[index] = {
          ...newItems[index],
          rawItemId: selectedItem.id,
          rawItemName: selectedItem.name,
          currentQuantity: parseFloat(selectedItem.quantity) || 0,
          unit: selectedItem.unit,
          useQuantity: 0
        };
      }
    } else if (field === "useQuantity") {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      if (numValue <= newItems[index].currentQuantity) {
        newItems[index][field] = numValue;
      } else {
        toast({
          title: "Error",
          description: "Use quantity cannot exceed current quantity",
          variant: "destructive",
        });
        return;
      }
    } else {
      newItems[index][field] = value as never;
    }
    
    setBatchItems(newItems);
  };

  const handleSaveBatch = async () => {
    // Validation
    const validItems = batchItems.filter(item => item.rawItemId && item.useQuantity > 0);
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item with quantity",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const batchNo = await generateBatchNumber();
      
      // Save batch to Firebase
      const batchesRef = collection(db, "batches");
      await addDoc(batchesRef, {
        batchNo,
        items: validItems,
        status: "In Progress",
        createdAt: Timestamp.now(),
      });

      // Update raw inventory quantities
      for (const item of validItems) {
        const inventoryDocRef = doc(db, "rawInventory", item.rawItemId);
        const currentItem = rawInventory.find(inv => inv.id === item.rawItemId);
        if (currentItem) {
          const newQuantity = parseFloat(currentItem.quantity) - item.useQuantity;
          await updateDoc(inventoryDocRef, {
            quantity: newQuantity.toString(),
          });
        }
      }

      toast({
        title: "Success",
        description: `Batch ${batchNo} created successfully`,
      });

      // Reset form and refresh data
      setBatchItems([{ rawItemId: "", rawItemName: "", currentQuantity: 0, unit: "", useQuantity: 0 }]);
      setIsAddRecipeOpen(false);
      await fetchRawInventory();
      await fetchBatches();
    } catch (error) {
      console.error("Error saving batch:", error);
      toast({
        title: "Error",
        description: "Failed to create batch",
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

  const batchColumns = [
    { key: "batchNo" as keyof Batch, header: "Batch No." },
    { 
      key: "items" as keyof Batch, 
      header: "Materials Used",
      render: (item: Batch) => (
        <div className="text-sm">
          {item.items.map((batchItem, idx) => (
            <div key={idx} className="text-muted-foreground">
              {batchItem.rawItemName}: {batchItem.useQuantity} {batchItem.unit}
            </div>
          ))}
        </div>
      )
    },
    { 
      key: "status" as keyof Batch, 
      header: "Status",
      render: (item: Batch) => (
        <span className={`badge-type ${
          item.status === "Completed" ? "badge-processed" : 
          item.status === "In Progress" ? "badge-raw" : 
          "bg-warning/20 text-warning"
        }`}>
          {item.status}
        </span>
      )
    },
    { 
      key: "createdAt" as keyof Batch, 
      header: "Created At",
      render: (item: Batch) => (
        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
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
            value={rawMaterials.length + rawMaterialsData.length}
            change="+12%"
            changeType="positive"
            icon={Package}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Active Batches"
            value={processedMaterialsData.filter(m => m.status === "In Progress").length}
            change="+8%"
            changeType="positive"
            icon={FlaskConical}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Quality Checks"
            value={processedMaterialsData.filter(m => m.status === "Quality Check").length}
            change="+5%"
            changeType="positive"
            icon={Beaker}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
          <StatCard
            title="Completed Today"
            value={processedMaterialsData.filter(m => m.status === "Completed").length}
            change="+15%"
            changeType="positive"
            icon={CheckCircle2}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex gap-2">
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
            <Button onClick={() => setIsAddRecipeOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Recipe
            </Button>
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

        {/* Batches Table */}
        {batches.length > 0 && (
          <div className="mt-6 bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="section-title">Created Batches</h2>
              <p className="section-subtitle">View all batches created from raw materials</p>
            </div>
            <div className="p-6">
              <DataTable
                data={batches}
                columns={batchColumns}
                keyField="id"
              />
            </div>
          </div>
        )}

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

        {/* Add Recipe/Batch Dialog */}
        <Dialog open={isAddRecipeOpen} onOpenChange={setIsAddRecipeOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                {batchItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 border border-border rounded-lg bg-muted/30">
                    <div className="col-span-11 grid grid-cols-3 gap-3">
                      {/* Raw Item Selection */}
                      <div className="space-y-2">
                        <Label>Raw Item</Label>
                        <Select
                          value={item.rawItemId}
                          onValueChange={(value) => handleBatchItemChange(index, "rawItemId", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawInventory.map((invItem) => (
                              <SelectItem key={invItem.id} value={invItem.id}>
                                {invItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Current Quantity Display */}
                      <div className="space-y-2">
                        <Label>Current Quantity</Label>
                        <Input
                          value={item.currentQuantity > 0 ? `${item.currentQuantity} ${item.unit}` : ""}
                          disabled
                          className="bg-background"
                          placeholder="Select item first"
                        />
                      </div>

                      {/* Use Quantity Input */}
                      <div className="space-y-2">
                        <Label>Use Quantity ({item.unit || "unit"})</Label>
                        <Input
                          type="number"
                          value={item.useQuantity || ""}
                          onChange={(e) => handleBatchItemChange(index, "useQuantity", e.target.value)}
                          placeholder="Enter quantity"
                          max={item.currentQuantity}
                          min={0}
                          disabled={!item.rawItemId}
                        />
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-1 flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBatchItem(index)}
                        disabled={batchItems.length === 1}
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add More Items Button */}
                <Button
                  variant="outline"
                  onClick={handleAddBatchItem}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Raw Item
                </Button>
              </div>

              {/* Summary */}
              {batchItems.some(item => item.useQuantity > 0) && (
                <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Batch Summary</h4>
                  <div className="space-y-1 text-sm">
                    {batchItems.filter(item => item.useQuantity > 0).map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.rawItemName}</span>
                        <span className="font-medium">{item.useQuantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddRecipeOpen(false);
                setBatchItems([{ rawItemId: "", rawItemName: "", currentQuantity: 0, unit: "", useQuantity: 0 }]);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveBatch} disabled={loading}>
                {loading ? "Saving..." : "Save Batch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
