import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { ClipboardList, Hash, IndianRupee, PackagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

interface ItemRecord {
  id: string;
  code: string;
  name: string;
  openingBalance: number;
  unit: string;
  notes?: string;
  createdAt?: Date;
}

const defaultFormState = {
  code: "",
  name: "",
  openingBalance: "0",
  unit: "pcs",
  notes: "",
};

export default function Items() {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const totalOpening = items.reduce((sum, item) => sum + (item.openingBalance || 0), 0);
    const latest = items[0]?.name || "—";
    const avgBalance = items.length ? totalOpening / items.length : 0;

    return {
      totalItems: items.length,
      totalOpening,
      latest,
      avgBalance,
    };
  }, [items]);

  const fetchItems = async () => {
    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const itemsQuery = query(collection(db, "items"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(itemsQuery);
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          code: data.code || "",
          name: data.name || "",
          openingBalance:
            typeof data.openingBalance === "number"
              ? data.openingBalance
              : parseFloat(data.openingBalance) || 0,
          unit: data.unit || "pcs",
          notes: data.notes || "",
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as ItemRecord;
      });
      setItems(list);
    } catch (error) {
      console.error("Error fetching items", error);
      toast({
        title: "Fetch failed",
        description: "Could not load items from Firestore.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormData(defaultFormState);
    setEditingItem(null);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData(defaultFormState);
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: ItemRecord) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      openingBalance: (item.openingBalance ?? 0).toString(),
      unit: item.unit || "pcs",
      notes: item.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await deleteDoc(doc(db, "items", itemId));
      toast({ title: "Item deleted", description: "The item has been removed." });
      fetchItems();
    } catch (error) {
      console.error("Error deleting item", error);
      toast({
        title: "Delete failed",
        description: "Could not delete the item. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!db) {
      toast({
        title: "Database unavailable",
        description: "Firebase is not initialized. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.code.trim()) {
      toast({
        title: "Validation error",
        description: "Item code is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Item name is required.",
        variant: "destructive",
      });
      return;
    }

    const openingValue = parseFloat(formData.openingBalance);
    if (Number.isNaN(openingValue) || openingValue < 0) {
      toast({
        title: "Validation error",
        description: "Opening balance must be a number greater than or equal to zero.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        openingBalance: openingValue,
        unit: formData.unit.trim() || "pcs",
        notes: formData.notes.trim(),
        updatedAt: Timestamp.now(),
      };

      if (editingItem) {
        await updateDoc(doc(db, "items", editingItem.id), payload);
        toast({ title: "Item updated", description: "The item has been updated." });
      } else {
        await addDoc(collection(db, "items"), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        toast({ title: "Item added", description: "The item has been saved to Firestore." });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error("Error adding item", error);
      toast({
        title: "Save failed",
        description: "Could not save the item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "code",
      header: "Item Code",
      render: (item: ItemRecord) => (
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="font-mono text-xs">{item.code}</Badge>
        </div>
      ),
    },
    {
      key: "name",
      header: "Item Name",
      render: (item: ItemRecord) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.notes && (
            <p className="text-xs text-muted-foreground line-clamp-1">{item.notes}</p>
          )}
        </div>
      ),
    },
    {
      key: "openingBalance",
      header: "Opening Balance",
      render: (item: ItemRecord) => (
        <div className="flex items-center gap-1 font-semibold">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          <span>{item.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      render: (item: ItemRecord) => (
        <span className="text-sm text-muted-foreground uppercase">{item.unit}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item: ItemRecord) => (
        <span className="text-sm text-muted-foreground">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: ItemRecord) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditItem(item)}
            className="hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteItem(item.id)}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Item Master" subtitle="Manage your item catalog and opening balances" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Items"
            value={stats.totalItems}
            icon={ClipboardList}
            change={`Avg ₹${stats.avgBalance.toFixed(2)}`}
            subtitle="Items tracked in Firestore"
          />
          <StatCard
            title="Opening Balance"
            value={`₹${stats.totalOpening.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            icon={IndianRupee}
            changeType="neutral"
            subtitle="Aggregate opening value"
          />
          <StatCard
            title="Latest Item"
            value={stats.latest}
            icon={PackagePlus}
            changeType="neutral"
            subtitle="Most recently added"
          />
          <StatCard
            title="Searchable"
            value={`${filteredItems.length} results`}
            icon={RefreshCw}
            changeType="neutral"
            subtitle={search ? "Filtered view" : "Showing all items"}
          />
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search by code or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72"
              />
              <Button variant="secondary" onClick={fetchItems} disabled={isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <Button onClick={handleAddItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-10 text-center text-muted-foreground">
              {isLoading ? "Loading items..." : "No items found. Add your first item."}
            </div>
          ) : (
            <DataTable data={filteredItems} columns={columns} keyField="id" />
          )}
        </Card>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Item Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="E.g. ITM-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Paracetamol 500mg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openingBalance">Opening Balance</Label>
                  <Input
                    id="openingBalance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="pcs / kg / box"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional remarks about the item"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingItem ? "Update Item" : "Save Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
