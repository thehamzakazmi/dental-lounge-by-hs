"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PatientDirectory() {
  const router = useRouter();

  // Add a loading state for the auth check
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    date_of_birth: "",
    medical_alerts: "",
  });

  // Check if user is logged in
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setIsCheckingAuth(false);
        fetchPatients();
      }
    }
    checkUser();
  }, [router]);

  // Fetch data
  async function fetchPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPatients(data);
    if (error) console.error("Error fetching data:", error);
  }

  // Handle Form Submission
  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      phone_number: formData.phone_number.trim(),
      date_of_birth: formData.date_of_birth ? formData.date_of_birth : null,
      medical_alerts: formData.medical_alerts.trim() || null,
    };

    const { data, error } = await supabase
      .from("patients")
      .insert([payload])
      .select();

    if (error) {
      console.error("Error adding patient:", error);
      alert("Failed to add patient.");
    } else if (data) {
      setPatients([data[0], ...patients]);
      setFormData({ first_name: "", last_name: "", phone_number: "", date_of_birth: "", medical_alerts: "" });
      setIsModalOpen(false);
    }
    
    setIsSubmitting(false);
  }

  async function handleDeletePatient(patient: { id: string; first_name: string; last_name: string }) {
    if (!confirm(`Delete ${patient.first_name} ${patient.last_name} and all linked records?`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      alert("Failed to delete patient: " + error.message);
      return;
    }
    setPatients((current) => current.filter((item) => item.id !== patient.id));
  }

  // If we are still checking auth, show a blank screen or spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center text-slate-400 font-medium">
        Loading...
      </div>
    );
  }

  // Filter patients based on search input
  const filteredPatients = patients.filter((patient) => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           (patient.phone_number && patient.phone_number.includes(searchTerm));
  });

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white relative">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-white">Patient Directory</h1>
          <div className="flex gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="w-full md:w-80 px-4 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors shadow-lg shadow-blue-900/20"
            >
              + Add Patient
            </button>
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/50 text-slate-300 font-semibold text-sm">
              <tr>
                <th className="px-6 py-4 border-b border-slate-700">Name</th>
                <th className="px-6 py-4 border-b border-slate-700">Phone Number</th>
                <th className="px-6 py-4 border-b border-slate-700">Date of Birth</th>
                <th className="px-6 py-4 border-b border-slate-700">Medical Alerts</th>
                <th className="px-6 py-4 border-b border-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr 
                    key={patient.id} 
                    onClick={() => router.push(`/patient/${patient.id}`)} 
                    className="hover:bg-slate-700 transition-colors cursor-pointer text-slate-200"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {patient.first_name} {patient.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{patient.phone_number || "N/A"}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {patient.medical_alerts === 'None' || !patient.medical_alerts ? (
                        <span className="text-slate-400 text-sm">None</span>
                      ) : (
                        <span className="inline-block bg-red-900/40 border border-red-800 text-red-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                          {patient.medical_alerts}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeletePatient(patient);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-red-800 text-red-300 hover:bg-red-950 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Patient Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden text-white border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Add New Patient</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xl font-bold">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddPatient} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                <input required type="tel" className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date of Birth</label>
                <input type="date" className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Medical Alerts (Allergies, Conditions)</label>
                <input type="text" placeholder="e.g., None, Allergic to Penicillin" className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500"
                  value={formData.medical_alerts} onChange={(e) => setFormData({...formData, medical_alerts: e.target.value})} />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
