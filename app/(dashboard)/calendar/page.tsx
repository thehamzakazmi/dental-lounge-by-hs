"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  dentist_id?: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  created_at?: string;
}

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM to 5 PM

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hour = parseInt(parts[0], 10);
  const min = parts[1] || "00";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${min} ${period}`;
}

function formatApptTime(appt?: Appointment | null): string {
  if (!appt) return "";
  if (appt.appointment_date) {
    const d = new Date(appt.appointment_date);
    if (!isNaN(d.getTime())) {
      const hour = d.getHours();
      const min = String(d.getMinutes()).padStart(2, "0");
      const period = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${hour12}:${min} ${period}`;
    }
  }
  return formatTimeDisplay(appt.appointment_time);
}

function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Adjust so Monday is 0, Sunday is 6
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarPage() {
  const router = useRouter();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);
  const [todayIso, setTodayIso] = useState<string>("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    patient_id: "",
    appointment_date: "",
    appointment_time: "09:00",
    duration_minutes: "30",
    notes: "",
  });

  // Auth check & client date initialization
  useEffect(() => {
    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    const today = toISODate(now);

    setCurrentWeekStart(startOfWeek);
    setTodayIso(today);
    setFormData((prev) => ({ ...prev, appointment_date: today }));

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setIsCheckingAuth(false);
        fetchData();
      }
    }
    checkAuth();
  }, [router]);

  async function fetchData() {
    const [patientsRes, apptsRes] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name, phone_number").order("first_name"),
      supabase.from("appointments").select("*").order("appointment_date"),
    ]);

    if (patientsRes.data) setPatients(patientsRes.data);
    if (apptsRes.data) setAppointments(apptsRes.data);
  }

  // Map for fast patient lookup
  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  // Week days array
  const weekDays = useMemo(() => {
    if (!currentWeekStart) return [];
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const d = addDays(currentWeekStart, offset);
      const iso = toISODate(d);
      return {
        date: d,
        iso,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: iso === todayIso,
      };
    });
  }, [currentWeekStart, todayIso]);

  const weekRangeLabel = useMemo(() => {
    if (!currentWeekStart) return "";
    const end = addDays(currentWeekStart, 6);
    return `${currentWeekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [currentWeekStart]);

  // Open modal with prefilled date and time
  function handleOpenBooking(dateStr?: string, timeStr?: string) {
    setFormError("");
    setFormData({
      patient_id: patients[0]?.id || "",
      appointment_date: dateStr || todayIso,
      appointment_time: timeStr || "09:00",
      duration_minutes: "30",
      notes: "",
    });
    setIsModalOpen(true);
  }

  // Handle appointment submit
  async function handleBookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.patient_id) {
      setFormError("Please select a patient.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const newAppointment = {
      patient_id: formData.patient_id,
      appointment_date: `${formData.appointment_date}T${formData.appointment_time}:00`,
      duration_minutes: parseInt(formData.duration_minutes, 10),
      status: "scheduled",
      notes: formData.notes.trim() || null,
    };

    const { data, error } = await supabase.from("appointments").insert([newAppointment]).select();

    if (error) {
      console.error("Error booking appointment:", error);
      setFormError(error.message || "Failed to book appointment.");
      setIsSubmitting(false);
    } else if (data && data[0]) {
      // Instantly refresh local state
      setAppointments((prev) => [...prev, data[0]]);
      setIsModalOpen(false);
      setIsSubmitting(false);
    }
  }

  // Cancel appointment
  async function handleCancelAppointment(appointmentId: string) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: "cancelled" } : a))
      );
      setSelectedAppointment((prev) => (prev ? { ...prev, status: "cancelled" } : null));
    } else {
      console.error("Error cancelling appointment:", error);
      alert("Failed to cancel appointment: " + error.message);
    }
  }

  // Delete appointment
  async function handleDeleteAppointment(appointmentId: string) {
    if (!confirm("Are you sure you want to permanently delete this appointment?")) return;

    const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);

    if (!error) {
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      setSelectedAppointment(null);
    } else {
      console.error("Error deleting appointment:", error);
      alert("Failed to delete appointment: " + error.message);
    }
  }

  if (isCheckingAuth || !currentWeekStart) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center text-slate-400 font-medium">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Calendar & Appointments</h1>
            <p className="text-slate-400 text-sm mt-1">Schedule and manage clinic visits</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenBooking()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"
            >
              <span>+</span> Book Appointment
            </button>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
          
          {/* Week Navigation Toolbar */}
          <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeekStart((prev) => (prev ? addDays(prev, -7) : null))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
                title="Previous Week"
              >
                &larr; Prev
              </button>
              <button
                onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentWeekStart((prev) => (prev ? addDays(prev, 7) : null))}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
                title="Next Week"
              >
                Next &rarr;
              </button>
            </div>

            <div className="text-lg font-bold text-slate-200">
              {weekRangeLabel}
            </div>
          </div>

          {/* Grid Header: Days of the Week */}
          <div className="grid grid-cols-8 border-b border-slate-700 bg-slate-900/60 text-center">
            {/* Corner Cell for Hour Axis */}
            <div className="p-3 border-r border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center">
              Time
            </div>

            {/* 7 Day Headers */}
            {weekDays.map((day) => (
              <div
                key={day.iso}
                className={`p-3 border-r border-slate-700 last:border-r-0 text-center transition-colors ${
                  day.isToday ? "bg-blue-950/40 text-blue-300" : "text-slate-300"
                }`}
              >
                <div className="text-xs font-medium uppercase text-slate-400">{day.dayName}</div>
                <div className={`text-sm font-bold mt-0.5 ${day.isToday ? "text-blue-400 font-extrabold" : "text-slate-100"}`}>
                  {day.displayDate}
                </div>
              </div>
            ))}
          </div>

          {/* Grid Body: Hours x Days */}
          <div className="divide-y divide-slate-700/60">
            {HOURS.map((hour) => {
              const hourTimeStr = `${String(hour).padStart(2, "0")}:00`;

              return (
                <div key={hour} className="grid grid-cols-8 min-h-[90px]">
                  
                  {/* Time Axis Column */}
                  <div className="p-3 border-r border-slate-700 text-xs font-semibold text-slate-400 bg-slate-900/40 flex items-start justify-center">
                    {formatHour(hour)}
                  </div>

                  {/* 7 Day Slot Cells */}
                  {weekDays.map((day) => {
                    // Match appointments for this day and this hour
                    const slotAppointments = appointments.filter((appt) => {
                      if (!appt.appointment_date) return false;
                      const d = new Date(appt.appointment_date);
                      if (isNaN(d.getTime())) return false;
                      const apptIso = toISODate(d);
                      if (apptIso !== day.iso) return false;
                      return d.getHours() === hour;
                    });

                    return (
                      <div
                        key={day.iso}
                        onClick={() => handleOpenBooking(day.iso, hourTimeStr)}
                        className={`p-1.5 border-r border-slate-700/60 last:border-r-0 relative group transition-colors hover:bg-slate-700/30 cursor-pointer ${
                          day.isToday ? "bg-blue-950/10" : ""
                        }`}
                        title={`Click to book on ${day.displayDate} at ${formatHour(hour)}`}
                      >
                        {/* Slot Appointment Cards */}
                        <div className="space-y-1.5">
                          {slotAppointments.map((appt) => {
                            const patient = patientMap.get(appt.patient_id);
                            const patientName = patient
                              ? `${patient.first_name} ${patient.last_name}`
                              : "Unknown Patient";
                            const isCancelled = appt.status === "cancelled";

                            return (
                              <div
                                key={appt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointment(appt);
                                }}
                                className={`rounded-lg p-2 text-xs shadow-md transition-all cursor-pointer group/card border ${
                                  isCancelled
                                    ? "bg-slate-900/80 border-slate-700 text-slate-400 opacity-60 hover:opacity-100"
                                    : "bg-blue-900/80 border-blue-500/80 hover:border-blue-400 text-blue-100 hover:bg-blue-800"
                                }`}
                              >
                                <div className="font-semibold text-white truncate flex items-center justify-between">
                                  <span className={`truncate ${isCancelled ? "line-through text-slate-400" : ""}`}>
                                    {patientName}
                                  </span>
                                  <span className="text-[10px] text-blue-300 font-mono ml-1">
                                    {formatApptTime(appt)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-blue-300 flex items-center gap-1.5 mt-0.5">
                                  <span>⏱ {appt.duration_minutes}m</span>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-1 py-0.2 rounded border ${
                                      isCancelled
                                        ? "bg-red-950/70 border-red-700/50 text-red-300"
                                        : "bg-blue-950/70 border-blue-600/40 text-blue-300"
                                    }`}
                                  >
                                    {appt.status || "scheduled"}
                                  </span>
                                </div>
                                {appt.notes && (
                                  <div className="text-slate-300 truncate text-[11px] mt-1 italic">
                                    {appt.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Hover hint for empty cell */}
                        {slotAppointments.length === 0 && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-slate-500 text-center py-6 select-none pointer-events-none">
                            + Book
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-700 text-white">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <h3 className="text-xl font-bold text-white">Book Appointment</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-800 text-red-300 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="space-y-4">
              
              {/* Patient Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Patient <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select a patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} {p.phone_number ? `(${p.phone_number})` : ""}
                    </option>
                  ))}
                </select>
                {patients.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">No patients found. Please add a patient first.</p>
                )}
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Duration</label>
                <select
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes (Reason for Visit)
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Regular check-up, Toothache on upper molar..."
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
                >
                  {isSubmitting ? "Booking..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Details / View Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-700 text-white">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <h3 className="text-xl font-bold text-white">Appointment Details</h3>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-slate-400 hover:text-white text-xl font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Patient</p>
                <p className="text-lg font-bold text-white">
                  {patientMap.get(selectedAppointment.patient_id)?.first_name}{" "}
                  {patientMap.get(selectedAppointment.patient_id)?.last_name || "Unknown Patient"}
                </p>
                {patientMap.get(selectedAppointment.patient_id)?.phone_number && (
                  <p className="text-sm text-slate-300">
                    📞 {patientMap.get(selectedAppointment.patient_id)?.phone_number}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Date</p>
                  <p className="font-medium text-slate-200">
                    {new Date(selectedAppointment.appointment_date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Time & Duration</p>
                  <p className="font-medium text-slate-200">
                    {formatApptTime(selectedAppointment)} ({selectedAppointment.duration_minutes}m)
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Status</p>
                <span
                  className={`inline-block mt-1 uppercase text-xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedAppointment.status === "cancelled"
                      ? "bg-red-950/80 border-red-700 text-red-300"
                      : "bg-blue-900/50 border-blue-500 text-blue-200"
                  }`}
                >
                  {selectedAppointment.status || "scheduled"}
                </span>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Notes</p>
                  <p className="text-sm text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-700 mt-1 whitespace-pre-wrap">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                  className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <span>🗑</span> Delete
                </button>
                <div className="flex items-center space-x-3">
                  {selectedAppointment.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(selectedAppointment.id)}
                      className="px-3 py-1.5 bg-amber-950/80 border border-amber-800 text-amber-300 hover:bg-amber-900 rounded-lg text-xs font-medium transition-colors"
                    >
                      Cancel Appointment
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedAppointment(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
