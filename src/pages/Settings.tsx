import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { 
  Settings as SettingsIcon, 
  Trash2,
  AlertTriangle,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const deleteAllData = async () => {
    if (!db) {
      toast({
        title: "Error",
        description: "Database connection not available",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    let totalDeleted = 0;

    try {
      // Collections to delete
      const collections = [
        "batches",
        "rawInventory",
        "processedInventory",
        "itemNameSuggestions"
      ];

      // Delete all documents from each collection
      for (const collectionName of collections) {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        console.log(`Deleting ${snapshot.size} documents from ${collectionName}...`);
        
        // Delete each document
        const deletePromises = snapshot.docs.map(document => 
          deleteDoc(doc(db, collectionName, document.id))
        );
        
        await Promise.all(deletePromises);
        totalDeleted += snapshot.size;
        
        console.log(`Deleted ${snapshot.size} documents from ${collectionName}`);
      }

      toast({
        title: "Success",
        description: `All data deleted successfully. ${totalDeleted} records removed.`,
      });

      // Close dialogs
      setShowDeleteDialog(false);
      setShowConfirmDialog(false);

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Error deleting data:", error);
      toast({
        title: "Error",
        description: "Failed to delete all data. Some records may remain.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleFirstConfirm = () => {
    setShowDeleteDialog(false);
    setShowConfirmDialog(true);
  };

  return (
    <>
      <AppHeader 
        title="Settings" 
        subtitle="Manage your application settings and data" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Database Management Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Database Management</h2>
                  <p className="text-sm text-muted-foreground">Manage your application data</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Delete all data from the database. This action will permanently remove:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 mb-6 ml-4">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                        All batch records and processing data
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                        All raw inventory items
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                        All processed inventory items
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                        All item name suggestions
                      </li>
                    </ul>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="destructive"
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? "Deleting..." : "Delete All Data"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This action cannot be undone
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* General Settings Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-info/20 flex items-center justify-center">
                  <SettingsIcon className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">General Settings</h2>
                  <p className="text-sm text-muted-foreground">Configure application preferences</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Application Version</p>
                    <p className="text-xs text-muted-foreground mt-1">Current version of the system</p>
                  </div>
                  <span className="text-sm font-mono bg-muted px-3 py-1 rounded">v1.0.0</span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Database Status</p>
                    <p className="text-xs text-muted-foreground mt-1">Connection status</p>
                  </div>
                  <span className="text-sm font-medium text-success flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                    Connected
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Environment</p>
                    <p className="text-xs text-muted-foreground mt-1">Current environment mode</p>
                  </div>
                  <span className="text-sm font-mono bg-muted px-3 py-1 rounded">Production</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* First Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data from your database including:
              <ul className="mt-3 space-y-1 text-sm">
                <li>• All batch records</li>
                <li>• All inventory data</li>
                <li>• All saved configurations</li>
              </ul>
              <p className="mt-3 font-semibold text-destructive">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFirstConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Final Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="font-semibold mb-2">This is your last chance to cancel!</p>
              <p className="mb-3">
                Once you click "Delete All Data", all records will be permanently removed from the database.
              </p>
              <p className="text-destructive font-semibold">
                Are you 100% sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllData}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete All Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
