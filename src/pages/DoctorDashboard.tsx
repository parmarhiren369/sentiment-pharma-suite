import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Stethoscope, LayoutDashboard, UserPlus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { database } from "@/lib/firebase";
import { ref, set, get, onValue } from "firebase/database";

type View = "dashboard" | "add" | "history";

interface HistoryEntry {
  id: string;
  date: string;
  note: string;
  doctor?: string;
  prescription?: string;
}

interface Patient {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  notes?: string;
  histories: HistoryEntry[];
}

export default function DoctorDashboard() {
  const [currentDoctor, setCurrentDoctor] = useState<any>(null);
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const doctorData = localStorage.getItem("currentDoctor");
    if (!doctorData) {
      navigate("/doctor-login");
      return;
    }
    const doctor = JSON.parse(doctorData);
    setCurrentDoctor(doctor);
    
    // Load patients from Firebase Realtime Database
    if (database) {
      const patientsRef = ref(database, `doctors/${doctor.id}/patients`);
      const unsubscribe = onValue(patientsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const patientsArray = Object.keys(data).map(key => {
            const patientData = data[key];
            return {
              ...patientData,
              id: key,
              histories: patientData.histories || []
            } as Patient;
          });
          setPatients(patientsArray);
        } else {
          setPatients([]);
        }
      });
      
      return () => unsubscribe();
    }
  }, [navigate]);

  const addPatient = async (p: Omit<Patient, "id" | "histories">) => {
    if (!currentDoctor || !database) return;
    
    const patientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const patient: Patient = {
      id: patientId,
      histories: [],
      ...p,
    } as Patient;
    
    try {
      await set(ref(database, `doctors/${currentDoctor.id}/patients/${patientId}`), patient);
      setView("history");
    } catch (error) {
      console.error("Error adding patient:", error);
      toast({
        title: "Error",
        description: "Failed to add patient",
        variant: "destructive",
      });
    }
  };

  const addHistory = async (patientId: string, entry: Omit<HistoryEntry, "id">) => {
    if (!currentDoctor || !database) return;
    
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    const historyId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newHistory = { id: historyId, ...entry };
    const updatedHistories = [...patient.histories, newHistory];
    
    try {
      await set(ref(database, `doctors/${currentDoctor.id}/patients/${patientId}/histories`), updatedHistories);
    } catch (error) {
      console.error("Error adding history:", error);
      toast({
        title: "Error",
        description: "Failed to add history entry",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentDoctor");
    navigate("/doctor-login");
  };

  const Dashboard = () => {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
        <p className="text-sm text-muted-foreground mb-6">Overview of patients and activities</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card p-4 rounded-lg border"> 
            <h3 className="text-sm text-muted-foreground">Total Patients</h3>
            <div className="text-2xl font-bold">{patients.length}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="text-sm text-muted-foreground">Patients with History</h3>
            <div className="text-2xl font-bold">{patients.filter(p => p.histories.length > 0).length}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="text-sm text-muted-foreground">Total History Entries</h3>
            <div className="text-2xl font-bold">{patients.flatMap(p => p.histories).length}</div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium mb-3">Recent Patients</h3>
          {patients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients yet. Add one from the sidebar.</p>
          ) : (
            <ul className="space-y-3">
              {patients.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.age ? `${p.age} yrs` : "—"} • {p.phone || "—"}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{p.histories.length} entries</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const AddPatient = () => {
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter patient name",
          variant: "destructive",
        });
        return;
      }
      addPatient({ name: name.trim(), age: age ? Number(age) : undefined, gender, phone, notes });
      toast({
        title: "Patient Added",
        description: `${name.trim()} has been added successfully`,
      });
      setName(""); setAge(""); setGender(""); setPhone(""); setNotes("");
    };

    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Add Patient</h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-card p-4 rounded-lg border">
            <div>
              <Label htmlFor="pname">Full Name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="page">Age</Label>
                <Input id="page" value={age} onChange={(e) => setAge(e.target.value)} placeholder="45" />
              </div>
              <div>
                <Label htmlFor="pgender">Gender</Label>
                <Input id="pgender" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Male / Female" />
              </div>
            </div>
            <div>
              <Label htmlFor="pphone">Phone</Label>
              <Input id="pphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890" />
            </div>
            <div>
              <Label htmlFor="pnotes">Notes</Label>
              <Input id="pnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, conditions" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add Patient</Button>
              <Button type="button" variant="outline" onClick={() => { setName(""); setAge(""); setGender(""); setPhone(""); setNotes(""); }}>Reset</Button>
            </div>
          </form>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3">Patient List ({patients.length})</h3>
          {patients.length === 0 ? (
            <div className="bg-card p-6 rounded-lg border text-center text-muted-foreground">
              No patients added yet. Add your first patient using the form above.
            </div>
          ) : (
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">#</th>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Age</th>
                      <th className="text-left p-3 font-medium">Gender</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Notes</th>
                      <th className="text-left p-3 font-medium">Histories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient, index) => (
                      <tr key={patient.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground">{index + 1}</td>
                        <td className="p-3 font-medium">{patient.name}</td>
                        <td className="p-3">{patient.age || "—"}</td>
                        <td className="p-3">{patient.gender || "—"}</td>
                        <td className="p-3">{patient.phone || "—"}</td>
                        <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">{patient.notes || "—"}</td>
                        <td className="p-3">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">
                            {patient.histories?.length || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const PatientHistory = () => {
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patients[0]?.id ?? null);
    const [note, setNote] = useState("");
    const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [doctor, setDoctor] = useState("");
    const [prescription, setPrescription] = useState("");

    useEffect(() => {
      if (!selectedPatientId && patients.length) setSelectedPatientId(patients[0].id);
    }, [patients, selectedPatientId]);

    const handleAddHistory = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPatientId || !note.trim()) {
        toast({
          title: "Missing Information",
          description: "Please select a patient and enter a note",
          variant: "destructive",
        });
        return;
      }
      addHistory(selectedPatientId, { date, note: note.trim(), doctor: doctor.trim() || undefined, prescription: prescription.trim() || undefined });
      const patientName = patients.find(p => p.id === selectedPatientId)?.name || "Patient";
      toast({
        title: "History Added",
        description: `New history entry added for ${patientName}`,
      });
      setNote(""); setDoctor(""); setPrescription("");
    };

    const selPatient = patients.find(p => p.id === selectedPatientId) || null;

    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-2">Patient History</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-card p-4 rounded border">
            <h3 className="font-medium mb-2">Patients</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {patients.length === 0 && <div className="text-sm text-muted-foreground">No patients added</div>}
              {patients.map(p => (
                <button key={p.id} onClick={() => setSelectedPatientId(p.id)} className={`w-full text-left p-2 rounded ${p.id === selectedPatientId ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.phone || "—"}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="bg-card p-4 rounded border">
              <h3 className="font-medium mb-3">Add History Entry</h3>
              {!selPatient ? (
                <p className="text-sm text-muted-foreground">Select a patient to add history</p>
              ) : (
                <form onSubmit={handleAddHistory} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="hdate">Date</Label>
                      <Input id="hdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="hdoctor">Doctor</Label>
                      <Input id="hdoctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. Name" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="hnote">Note</Label>
                    <Input id="hnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visit summary" />
                  </div>
                  <div>
                    <Label htmlFor="hpres">Prescription</Label>
                    <Input id="hpres" value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Medicines" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Add History</Button>
                    <Button type="button" variant="outline" onClick={() => { setNote(""); setDoctor(""); setPrescription(""); }}>Reset</Button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-card p-4 rounded border">
              <h3 className="font-medium mb-3">History for {selPatient?.name ?? "—"} ({selPatient?.histories.length || 0} entries)</h3>
              {!selPatient || selPatient.histories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history entries yet. Add one using the form above.</p>
              ) : (
                <ul className="space-y-3 max-h-[500px] overflow-y-auto">
                  {[...selPatient.histories].reverse().map(h => (
                    <li key={h.id} className="border rounded p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-primary">{h.date}</div>
                          <div className="text-sm mt-1">{h.note}</div>
                          {h.doctor && <div className="text-xs text-muted-foreground mt-1">👨‍⚕️ By: {h.doctor}</div>}
                        </div>
                        {h.prescription && (
                          <div className="ml-3 text-xs bg-primary/10 px-2 py-1 rounded">
                            💊 {h.prescription}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentDoctor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className={`transition-all duration-200 bg-surface border-r ${sidebarOpen ? "w-64" : "w-16"}`}>
        <div className="p-3 flex items-center justify-between border-b">
          <div className="font-bold">{sidebarOpen ? "Doctor Portal" : "DP"}</div>
          <button onClick={() => setSidebarOpen(s => !s)} className="p-1 rounded hover:bg-muted/40">{sidebarOpen ? "‹" : "›"}</button>
        </div>
        <nav className="p-2 space-y-1">
          <button onClick={() => setView("dashboard")} className={`w-full text-left p-2 rounded flex items-center gap-2 ${view === "dashboard" ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}>
            <LayoutDashboard className="w-4 h-4" />
            {sidebarOpen && <span>Dashboard</span>}
          </button>
          <button onClick={() => setView("add")} className={`w-full text-left p-2 rounded flex items-center gap-2 ${view === "add" ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}>
            <UserPlus className="w-4 h-4" />
            {sidebarOpen && <span>Add Patient</span>}
          </button>
          <button onClick={() => setView("history")} className={`w-full text-left p-2 rounded flex items-center gap-2 ${view === "history" ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}>
            <ClipboardList className="w-4 h-4" />
            {sidebarOpen && <span>Patient History</span>}
          </button>
        </nav>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-card border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Dr. {currentDoctor.name}</h1>
              <p className="text-xs text-muted-foreground">{currentDoctor.specialization || "Doctor"}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {view === "dashboard" && <Dashboard />}
          {view === "add" && <AddPatient />}
          {view === "history" && <PatientHistory />}
        </div>
      </div>
    </div>
  );
}
