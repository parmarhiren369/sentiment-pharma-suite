import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  UserPlus, 
  Users, 
  FileText, 
  LogOut,
  Calendar,
  Search,
  Edit,
  Eye,
  Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataTable } from "@/components/tables/DataTable";
import { StatCard } from "@/components/cards/StatCard";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  bloodGroup?: string;
  address: string;
  medicalHistory: string;
  currentMedication?: string;
  allergies?: string;
  lastVisit: string;
  doctorId: string;
  createdAt: string;
}

export default function DoctorDashboard() {
  const [currentDoctor, setCurrentDoctor] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isViewPatientOpen, setIsViewPatientOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    email: "",
    bloodGroup: "",
    address: "",
    medicalHistory: "",
    currentMedication: "",
    allergies: "",
  });

  useEffect(() => {
    const doctorData = localStorage.getItem("currentDoctor");
    if (!doctorData) {
      navigate("/doctor-login");
      return;
    }
    const doctor = JSON.parse(doctorData);
    setCurrentDoctor(doctor);
    loadPatients(doctor.id);
  }, [navigate]);

  const loadPatients = async (doctorId: string) => {
    try {
      if (!db) return;
      const patientsRef = collection(db, "patients");
      const q = query(
        patientsRef, 
        where("doctorId", "==", doctorId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const patientsData: Patient[] = [];
      querySnapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, ...doc.data() } as Patient);
      });
      setPatients(patientsData);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast({
        title: "Error",
        description: "Failed to load patients",
        variant: "destructive",
      });
    }
  };

  const handleAddPatient = async () => {
    if (!newPatient.name || !newPatient.age || !newPatient.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!db || !currentDoctor) {
        throw new Error("System not ready");
      }

      const patientData = {
        name: newPatient.name,
        age: parseInt(newPatient.age),
        gender: newPatient.gender,
        phone: newPatient.phone,
        email: newPatient.email,
        bloodGroup: newPatient.bloodGroup,
        address: newPatient.address,
        medicalHistory: newPatient.medicalHistory,
        currentMedication: newPatient.currentMedication,
        allergies: newPatient.allergies,
        lastVisit: new Date().toLocaleDateString(),
        doctorId: currentDoctor.id,
        doctorName: currentDoctor.name,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "patients"), patientData);

      toast({
        title: "Patient Added Successfully",
        description: `${newPatient.name} has been added to your patients`,
      });

      setIsAddPatientOpen(false);
      setNewPatient({
        name: "",
        age: "",
        gender: "Male",
        phone: "",
        email: "",
        bloodGroup: "",
        address: "",
        medicalHistory: "",
        currentMedication: "",
        allergies: "",
      });

      loadPatients(currentDoctor.id);
    } catch (error: any) {
      console.error("Error adding patient:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add patient",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentDoctor");
    navigate("/doctor-login");
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const patientColumns = [
    {
      key: "name" as keyof Patient,
      header: "Patient Name",
      render: (item: Patient) => (
        <div>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.age} years, {item.gender}</p>
        </div>
      )
    },
    {
      key: "phone" as keyof Patient,
      header: "Contact",
      render: (item: Patient) => (
        <div className="space-y-1">
          <p className="text-sm">{item.phone}</p>
          {item.email && <p className="text-xs text-muted-foreground">{item.email}</p>}
        </div>
      )
    },
    {
      key: "bloodGroup" as keyof Patient,
      header: "Blood Group",
      render: (item: Patient) => (
        <span className="badge-type badge-raw">
          {item.bloodGroup || "N/A"}
        </span>
      )
    },
    {
      key: "lastVisit" as keyof Patient,
      header: "Last Visit",
    },
    {
      key: "id" as keyof Patient,
      header: "Actions",
      render: (item: Patient) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedPatient(item);
              setIsViewPatientOpen(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ];

  if (!currentDoctor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Doctor Portal</h1>
              <p className="text-sm text-muted-foreground">Dr. {currentDoctor.name} - {currentDoctor.specialization}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Patients"
            value={patients.length}
            icon={Users}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Today's Visits"
            value={patients.filter(p => p.lastVisit === new Date().toLocaleDateString()).length}
            icon={Calendar}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Medical Records"
            value={patients.filter(p => p.medicalHistory).length}
            icon={FileText}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Active Cases"
            value={patients.filter(p => p.currentMedication).length}
            icon={Stethoscope}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
        </div>

        {/* Patients Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Patients</CardTitle>
                <CardDescription>Manage your patient records and medical history</CardDescription>
              </div>
              <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Add New Patient
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Patient</DialogTitle>
                    <DialogDescription>
                      Enter patient details and medical history
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patientName">Full Name *</Label>
                        <Input
                          id="patientName"
                          placeholder="John Doe"
                          value={newPatient.name}
                          onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Age *</Label>
                        <Input
                          id="age"
                          type="number"
                          placeholder="35"
                          value={newPatient.age}
                          onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newPatient.gender}
                          onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bloodGroup">Blood Group</Label>
                        <Input
                          id="bloodGroup"
                          placeholder="O+"
                          value={newPatient.bloodGroup}
                          onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          placeholder="+1 234 567 8900"
                          value={newPatient.phone}
                          onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="patient@email.com"
                        value={newPatient.email}
                        onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        placeholder="Full address"
                        value={newPatient.address}
                        onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="medicalHistory">Medical History</Label>
                      <Textarea
                        id="medicalHistory"
                        placeholder="Previous conditions, surgeries, family history..."
                        value={newPatient.medicalHistory}
                        onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currentMedication">Current Medication</Label>
                      <Textarea
                        id="currentMedication"
                        placeholder="List current medications..."
                        value={newPatient.currentMedication}
                        onChange={(e) => setNewPatient({ ...newPatient, currentMedication: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="allergies">Allergies</Label>
                      <Textarea
                        id="allergies"
                        placeholder="List any known allergies..."
                        value={newPatient.allergies}
                        onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddPatientOpen(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddPatient} disabled={isLoading}>
                      {isLoading ? "Adding..." : "Add Patient"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search patients by name, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <DataTable
              data={filteredPatients}
              columns={patientColumns}
              keyField="id"
            />
          </CardContent>
        </Card>
      </div>

      {/* View Patient Dialog */}
      <Dialog open={isViewPatientOpen} onOpenChange={setIsViewPatientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Complete medical record</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedPatient.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Age / Gender</Label>
                  <p className="font-medium">{selectedPatient.age} years, {selectedPatient.gender}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Blood Group</Label>
                  <p className="font-medium">{selectedPatient.bloodGroup || "N/A"}</p>
                </div>
              </div>
              {selectedPatient.email && (
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedPatient.email}</p>
                </div>
              )}
              {selectedPatient.address && (
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{selectedPatient.address}</p>
                </div>
              )}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Medical History</Label>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {selectedPatient.medicalHistory || "No medical history recorded"}
                </p>
              </div>
              {selectedPatient.currentMedication && (
                <div>
                  <Label className="text-muted-foreground">Current Medication</Label>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{selectedPatient.currentMedication}</p>
                </div>
              )}
              {selectedPatient.allergies && (
                <div>
                  <Label className="text-muted-foreground">Allergies</Label>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{selectedPatient.allergies}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Last Visit</Label>
                <p className="font-medium">{selectedPatient.lastVisit}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
