import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { 
  Stethoscope, 
  Users, 
  Calendar,
  MessageSquare,
  ArrowRight,
  Plus,
  Filter,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TabType = "all" | "active" | "meetings";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  city: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive" | "New";
  lastVisit: string;
  prescriptions: number;
}

interface Meeting {
  id: string;
  doctorName: string;
  purpose: string;
  date: string;
  time: string;
  location: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  representative: string;
}

const doctors: Doctor[] = [
  { id: "D001", name: "Dr. Rajesh Sharma", specialization: "General Physician", hospital: "Apollo Hospital", city: "Mumbai", phone: "+91 98765 43210", email: "rajesh.sharma@apollo.com", status: "Active", lastVisit: "2024-01-14", prescriptions: 145 },
  { id: "D002", name: "Dr. Priya Patel", specialization: "Cardiologist", hospital: "Fortis Healthcare", city: "Delhi", phone: "+91 98765 43211", email: "priya.patel@fortis.com", status: "Active", lastVisit: "2024-01-13", prescriptions: 89 },
  { id: "D003", name: "Dr. Amit Kumar", specialization: "Orthopedic", hospital: "Max Hospital", city: "Bangalore", phone: "+91 98765 43212", email: "amit.kumar@max.com", status: "New", lastVisit: "2024-01-15", prescriptions: 12 },
  { id: "D004", name: "Dr. Sneha Reddy", specialization: "Pediatrician", hospital: "Rainbow Hospital", city: "Hyderabad", phone: "+91 98765 43213", email: "sneha.reddy@rainbow.com", status: "Active", lastVisit: "2024-01-12", prescriptions: 210 },
  { id: "D005", name: "Dr. Mohammed Ali", specialization: "Neurologist", hospital: "NIMHANS", city: "Bangalore", phone: "+91 98765 43214", email: "mohammed.ali@nimhans.com", status: "Inactive", lastVisit: "2024-01-01", prescriptions: 56 },
];

const meetings: Meeting[] = [
  { id: "M001", doctorName: "Dr. Rajesh Sharma", purpose: "Product Introduction - Paracetamol Plus", date: "2024-01-16", time: "10:30 AM", location: "Apollo Hospital, Mumbai", status: "Scheduled", representative: "Rahul Verma" },
  { id: "M002", doctorName: "Dr. Priya Patel", purpose: "Follow-up on Cardiac Range", date: "2024-01-15", time: "2:00 PM", location: "Fortis Healthcare, Delhi", status: "Completed", representative: "Sneha Gupta" },
  { id: "M003", doctorName: "Dr. Amit Kumar", purpose: "New Doctor Onboarding", date: "2024-01-17", time: "11:00 AM", location: "Max Hospital, Bangalore", status: "Scheduled", representative: "Vikram Singh" },
  { id: "M004", doctorName: "Dr. Sneha Reddy", purpose: "Pediatric Range Discussion", date: "2024-01-14", time: "3:30 PM", location: "Rainbow Hospital, Hyderabad", status: "Completed", representative: "Priya Menon" },
];

export default function Doctors() {
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const doctorColumns = [
    { 
      key: "name" as keyof Doctor, 
      header: "Doctor Name",
      render: (item: Doctor) => (
        <div>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.specialization}</p>
        </div>
      )
    },
    { key: "hospital" as keyof Doctor, header: "Hospital" },
    { 
      key: "city" as keyof Doctor, 
      header: "Location",
      render: (item: Doctor) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {item.city}
        </div>
      )
    },
    { 
      key: "phone" as keyof Doctor, 
      header: "Contact",
      render: (item: Doctor) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm">
            <Phone className="w-3 h-3 text-muted-foreground" />
            {item.phone}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            {item.email}
          </div>
        </div>
      )
    },
    { 
      key: "status" as keyof Doctor, 
      header: "Status",
      render: (item: Doctor) => (
        <span className={`badge-type ${
          item.status === "Active" ? "badge-processed" : 
          item.status === "New" ? "badge-raw" : 
          "bg-muted text-muted-foreground"
        }`}>
          {item.status}
        </span>
      )
    },
    { key: "lastVisit" as keyof Doctor, header: "Last Visit" },
    { 
      key: "prescriptions" as keyof Doctor, 
      header: "Prescriptions",
      render: (item: Doctor) => (
        <span className="text-primary font-medium">{item.prescriptions}</span>
      )
    },
  ];

  const meetingColumns = [
    { 
      key: "doctorName" as keyof Meeting, 
      header: "Doctor",
      render: (item: Meeting) => (
        <span className="font-medium text-foreground">{item.doctorName}</span>
      )
    },
    { key: "purpose" as keyof Meeting, header: "Purpose" },
    { 
      key: "date" as keyof Meeting, 
      header: "Date & Time",
      render: (item: Meeting) => (
        <div>
          <p className="font-medium">{item.date}</p>
          <p className="text-xs text-muted-foreground">{item.time}</p>
        </div>
      )
    },
    { key: "location" as keyof Meeting, header: "Location" },
    { key: "representative" as keyof Meeting, header: "Representative" },
    { 
      key: "status" as keyof Meeting, 
      header: "Status",
      render: (item: Meeting) => (
        <span className={`badge-type ${
          item.status === "Completed" ? "badge-processed" : 
          item.status === "Scheduled" ? "badge-raw" : 
          "bg-destructive/20 text-destructive"
        }`}>
          {item.status}
        </span>
      )
    },
  ];

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "All Doctors", icon: Users },
    { key: "active", label: "Active Doctors", icon: Stethoscope },
    { key: "meetings", label: "Meetings", icon: Calendar },
  ];

  const activeDoctors = doctors.filter(d => d.status === "Active");

  return (
    <>
      <AppHeader title="Doctors Module" subtitle="Manage doctor relationships and meetings" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Doctors"
            value={156}
            change="+12"
            changeType="positive"
            icon={Stethoscope}
            iconBgColor="bg-primary/20"
            iconColor="text-primary"
          />
          <StatCard
            title="Active Doctors"
            value={128}
            change="+8%"
            changeType="positive"
            icon={Users}
            iconBgColor="bg-success/20"
            iconColor="text-success"
          />
          <StatCard
            title="Meetings This Week"
            value={24}
            change="+5"
            changeType="positive"
            icon={Calendar}
            iconBgColor="bg-info/20"
            iconColor="text-info"
          />
          <StatCard
            title="Total Prescriptions"
            value="1.2K"
            change="+15%"
            changeType="positive"
            icon={MessageSquare}
            iconBgColor="bg-warning/20"
            iconColor="text-warning"
          />
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border px-4">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-item flex items-center gap-2 ${
                    activeTab === tab.key 
                      ? "tab-item-active" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 py-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Doctor
              </Button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">
                  {activeTab === "all" && "All Registered Doctors"}
                  {activeTab === "active" && "Active Doctor Network"}
                  {activeTab === "meetings" && "Scheduled Meetings"}
                </h2>
                <p className="section-subtitle">
                  {activeTab === "all" && "Complete directory of registered healthcare professionals"}
                  {activeTab === "active" && "Doctors actively prescribing our products"}
                  {activeTab === "meetings" && "Upcoming and past doctor meetings"}
                </p>
              </div>
              <Button variant="outline" className="gap-2">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {activeTab === "meetings" ? (
              <DataTable
                data={meetings}
                columns={meetingColumns}
                keyField="id"
              />
            ) : (
              <DataTable
                data={activeTab === "active" ? activeDoctors : doctors}
                columns={doctorColumns}
                keyField="id"
              />
            )}
          </div>
        </div>

        {/* Doctor Insights */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Top Prescriber</h3>
            <p className="text-lg font-bold text-foreground">Dr. Sneha Reddy</p>
            <p className="text-sm text-primary mt-1">210 prescriptions this month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">New Doctors Added</h3>
            <p className="text-3xl font-bold text-foreground">12</p>
            <p className="text-sm text-success mt-1">This month</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Meeting Success Rate</h3>
            <p className="text-3xl font-bold text-foreground">94%</p>
            <p className="text-sm text-success mt-1">+5% from last month</p>
          </div>
        </div>
      </div>
    </>
  );
}
