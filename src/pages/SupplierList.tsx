import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { DataTable } from "@/components/tables/DataTable";
import { 
  Users, 
  Plus,
  Pencil,
  Trash2,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

interface Supplier {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gst: string;
  opening: string;
  createdAt: Date;
}

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    gst: "",
    opening: ""
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const filtered = suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.gst.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSuppliers(filtered);
  }, [searchTerm, suppliers]);

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
      const suppliersCollection = collection(db, "suppliers");
      const supplierSnapshot = await getDocs(suppliersCollection);
      const supplierList = supplierSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Supplier[];
      
      setSuppliers(supplierList);
      setFilteredSuppliers(supplierList);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
      gst: "",
      opening: ""
    });
    setIsDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      address: supplier.address,
      phone: supplier.phone,
      email: supplier.email,
      gst: supplier.gst,
      opening: supplier.opening
    });
    setIsDialogOpen(true);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;

    try {
      await deleteDoc(doc(db, "suppliers", supplierId));
      toast({
        title: "Success",
        description: "Supplier deleted successfully"
      });
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast({
        title: "Error",
        description: "Name and Phone are required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingSupplier) {
        // Update existing supplier
        await updateDoc(doc(db, "suppliers", editingSupplier.id), {
          ...formData,
          updatedAt: new Date()
        });
        toast({
          title: "Success",
          description: "Supplier updated successfully"
        });
      } else {
        // Add new supplier
        await addDoc(collection(db, "suppliers"), {
          ...formData,
          createdAt: new Date()
        });
        toast({
          title: "Success",
          description: "Supplier added successfully"
        });
      }
      
      setIsDialogOpen(false);
      fetchSuppliers();
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        gst: "",
        opening: ""
      });
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast({
        title: "Error",
        description: "Failed to save supplier",
        variant: "destructive"
      });
    }
  };

  const columns = [
    {
      header: "Name",
      accessorKey: "name"
    },
    {
      header: "Address",
      accessorKey: "address"
    },
    {
      header: "Phone",
      accessorKey: "phone"
    },
    {
      header: "Email",
      accessorKey: "email"
    },
    {
      header: "GST",
      accessorKey: "gst"
    },
    {
      header: "Opening Balance",
      accessorKey: "opening"
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: Supplier) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditSupplier(row)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteSupplier(row.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader 
        title="Supplier List" 
        icon={Users}
      />
      
      <div className="p-6 space-y-6">
        {/* Search and Add Section */}
        <div className="card p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAddSupplier} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">All Suppliers</h2>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading suppliers...</p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={filteredSuppliers}
              />
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter supplier name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gst">GST Number</Label>
                <Input
                  id="gst"
                  value={formData.gst}
                  onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                  placeholder="Enter GST number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="opening">Opening Balance</Label>
                <Input
                  id="opening"
                  value={formData.opening}
                  onChange={(e) => setFormData({ ...formData, opening: e.target.value })}
                  placeholder="Enter opening balance"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingSupplier ? "Update Supplier" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierList;
