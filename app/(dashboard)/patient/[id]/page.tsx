"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Standard Universal Numbering System
const UPPER_TEETH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const LOWER_TEETH = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

const PRESET_PROCEDURES = [
  { name: "Composite Filling", color: "bg-blue-600 hover:bg-blue-500", tag: "Filling" },
  { name: "Extraction", color: "bg-red-600 hover:bg-red-500", tag: "Extraction" },
  { name: "Crown", color: "bg-amber-600 hover:bg-amber-500", tag: "Crown" },
  { name: "Root Canal", color: "bg-purple-600 hover:bg-purple-500", tag: "Root Canal" },
  { name: "Dental Implant", color: "bg-emerald-600 hover:bg-emerald-500", tag: "Implant" },
  { name: "Scaling / Cleaning", color: "bg-cyan-600 hover:bg-cyan-500", tag: "Cleaning" },
];

interface PatientDocument {
  id: string;
  patient_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
}

interface PatientAppointment {
  id: string;
  appointment_date: string;
  status: string;
  notes?: string;
  duration_minutes?: number;
}

function getToothStatus(toothNum: number, notes: any[]) {
  // Find all notes for this tooth, most recent first
  const toothNotes = notes.filter((n) => String(n.tooth_number) === String(toothNum));
  if (toothNotes.length === 0) return null;

  const latestNote = toothNotes[0];
  const proc = (latestNote.procedure_type || "").toLowerCase();

  if (proc.includes("fill") || proc.includes("composite") || proc.includes("amalgam")) {
    return {
      type: "Filling",
      badgeText: "Fill",
      cardBg: "bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-900/70",
      dotBg: "bg-blue-400",
      notesCount: toothNotes.length,
      latestNote,
    };
  }
  if (proc.includes("extract") || proc.includes("pull") || proc.includes("missing")) {
    return {
      type: "Extraction",
      badgeText: "Ext",
      cardBg: "bg-red-900/50 border-red-500 text-red-200 hover:bg-red-900/70",
      dotBg: "bg-red-400",
      notesCount: toothNotes.length,
      latestNote,
    };
  }
  if (proc.includes("crown") || proc.includes("cap")) {
    return {
      type: "Crown",
      badgeText: "Crn",
      cardBg: "bg-amber-900/50 border-amber-500 text-amber-200 hover:bg-amber-900/70",
      dotBg: "bg-amber-400",
      notesCount: toothNotes.length,
      latestNote,
    };
  }
  if (proc.includes("root") || proc.includes("canal") || proc.includes("endo")) {
    return {
      type: "Root Canal",
      badgeText: "RCT",
      cardBg: "bg-purple-900/50 border-purple-500 text-purple-200 hover:bg-purple-900/70",
      dotBg: "bg-purple-400",
      notesCount: toothNotes.length,
      latestNote,
    };
  }
  if (proc.includes("implant")) {
    return {
      type: "Implant",
      badgeText: "Imp",
      cardBg: "bg-emerald-900/50 border-emerald-500 text-emerald-200 hover:bg-emerald-900/70",
      dotBg: "bg-emerald-400",
      notesCount: toothNotes.length,
      latestNote,
    };
  }

  // Generic procedure
  return {
    type: latestNote.procedure_type,
    badgeText: "Tx",
    cardBg: "bg-cyan-900/50 border-cyan-500 text-cyan-200 hover:bg-cyan-900/70",
    dotBg: "bg-cyan-400",
    notesCount: toothNotes.length,
    latestNote,
  };
}

function ToothIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.5 2 7.8 3.5 7.2 5.5C6.5 7.8 6.5 10.5 7 13.5C7.5 16.5 8 20 9.5 22C10.5 22.5 11.2 21 11.5 19C11.8 17 12 17 12 17C12 17 12.2 17 12.5 19C12.8 21 13.5 22.5 14.5 22C16 20 16.5 16.5 17 13.5C17.5 10.5 17.5 7.8 16.8 5.5C16.2 3.5 14.5 2 12 2Z" />
    </svg>
  );
}

function PatientProfileContent() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Treatment Notes State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [treatmentNotes, setTreatmentNotes] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [newNote, setNewNote] = useState({ procedure: "", tooth: "", notes: "" });

  // Tooth Modal State (for clicking a specific tooth on the Odontogram)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothProcedure, setToothProcedure] = useState("Composite Filling");
  const [toothNotes, setToothNotes] = useState("");
  const [isSavingTooth, setIsSavingTooth] = useState(false);

  // Documents & X-Rays State
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedDocPreview, setSelectedDocPreview] = useState<PatientDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Prescription State
  interface Prescription {
    id: string;
    patient_id: string;
    prescription_id?: string | null;
    medication: string;
    dosage: string;
    instructions: string;
    created_at?: string;
  }
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxMedicines, setRxMedicines] = useState([{ medication: "", dosage: "", instructions: "" }]);
  const [isSavingRx, setIsSavingRx] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  useEffect(() => {
    async function fetchPatient() {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching patient:", error);
      } else {
        setPatient(data);
      }
      setLoading(false);
    }

    async function fetchNotes() {
      const { data, error } = await supabase
        .from("treatment_notes")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (data) setTreatmentNotes(data);
      if (error) console.error("Error fetching notes:", error);
    }

    async function fetchDocuments() {
      const { data, error } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (data) setDocuments(data);
      if (error) console.error("Error fetching documents:", error);
    }

    async function fetchPrescriptions() {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (data) setPrescriptions(data as any);
      if (error) console.error("Error fetching prescriptions:", error);
    }

    async function fetchAppointments() {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, notes, duration_minutes")
        .eq("patient_id", id)
        .order("appointment_date", { ascending: false });
      if (data) setAppointments(data);
      if (error) console.error("Error fetching appointments:", error);
    }

    if (id) {
      fetchPatient();
      fetchNotes();
      fetchDocuments();
      fetchPrescriptions();
      fetchAppointments();
    }
  }, [id]);

  async function reloadNotes() {
    const { data } = await supabase
      .from("treatment_notes")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    if (data) setTreatmentNotes(data);
  }

  async function reloadDocuments() {
    const { data } = await supabase
      .from("patient_documents")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
  }

  async function reloadPrescriptions() {
    const { data } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    if (data) setPrescriptions(data as any);
  }

  // Handle Save Prescription
  const handleSaveRx = async (e: React.FormEvent) => {
    e.preventDefault();
    const medicines = rxMedicines
      .map((medicine) => ({
        medication: medicine.medication.trim(),
        dosage: medicine.dosage.trim(),
        instructions: medicine.instructions.trim(),
      }))
      .filter((medicine) => medicine.medication);
    if (medicines.length === 0) return;
    setIsSavingRx(true);
    const prescriptionId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase.from("prescriptions").insert(
      medicines.map((medicine) => ({
        patient_id: id,
        prescription_id: prescriptionId,
        ...medicine,
      }))
    );
    if (!error) {
      setShowRxModal(false);
      setRxMedicines([{ medication: "", dosage: "", instructions: "" }]);
      reloadPrescriptions();
    } else {
      alert("Failed to save prescription: " + error.message);
    }
    setIsSavingRx(false);
  };

  // Handle Delete Prescription
  const handleDeleteRx = async (rx: Prescription[]) => {
    if (!confirm("Delete this prescription?")) return;
    const prescriptionId = rx[0].prescription_id;
    let query = supabase.from("prescriptions").delete().eq("patient_id", id);
    query = prescriptionId ? query.eq("prescription_id", prescriptionId) : query.eq("id", rx[0].id);
    const { error } = await query;
    if (!error) {
      const ids = new Set(rx.map((item) => item.id));
      setPrescriptions((prev) => prev.filter((r) => !ids.has(r.id)));
    } else {
      alert("Failed to delete prescription: " + error.message);
    }
  };

  const prescriptionGroups = useMemo(() => {
    const groups = new Map<string, Prescription[]>();
    prescriptions.forEach((prescription) => {
      const key = prescription.prescription_id || prescription.id;
      const group = groups.get(key) || [];
      group.push(prescription);
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [prescriptions]);

  // Download Prescription as PDF using jsPDF
  const handleDownloadRxPDF = async (rxItems: Prescription[]) => {
    const jsPDFModule = await import("jspdf");
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;

    // --- Clinic Header ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 42, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Dental Lounge", margin, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Digital Prescription", margin, 30);
    const prescriptionDate = rxItems[0]?.created_at || "";
    doc.text(`Date: ${prescriptionDate ? new Date(prescriptionDate).toLocaleDateString() : new Date().toLocaleDateString()}`, pageW - margin, 30, { align: "right" });
    y = 55;

    // --- Patient Info ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Patient:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${patient.first_name} ${patient.last_name}`, margin + 20, y);
    if (patient.date_of_birth) {
      doc.setFont("helvetica", "bold");
      doc.text("DOB:", margin + 90, y);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(patient.date_of_birth).toLocaleDateString(), margin + 100, y);
    }
    y += 7;
    if (patient.phone_number) {
      doc.setFont("helvetica", "bold");
      doc.text("Phone:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(patient.phone_number, margin + 20, y);
    }
    y += 10;

    // Divider
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // --- Rx Symbol & Medication ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246); // blue-500
    doc.text("℞", margin, y + 2);
    rxItems.forEach((rx, index) => {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.text(`${index + 1}. ${rx.medication}`, margin + 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Dosage: ${rx.dosage || "As directed"}`, margin + 14, y);
      y += 7;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Instructions:", margin + 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(rx.instructions || "As per doctor's advice", pageW - margin * 2 - 14);
      doc.text(lines, margin + 14, y);
      y += lines.length * 5 + 10;
    });

    // Divider
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 15;

    // Signature line
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Doctor's Signature: ___________________________", margin, y);
    doc.text("Date: _______________", pageW - margin - 60, y);
    y += 20;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This prescription was generated digitally by Dental Lounge.", margin, y, { maxWidth: pageW - margin * 2 });

    const fileName = `Rx_${patient.last_name}_${Date.now()}.pdf`;
    doc.save(fileName);
  };

  // Handle Generate Invoice
  const handleGenerateInvoice = async () => {
    if (!patient) return;
    if (!confirm(`Generate an invoice for ${patient.first_name} ${patient.last_name} based on ${treatmentNotes.length} procedure(s)?`)) return;
    setIsGeneratingInvoice(true);

    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const { data: procedurePrices, error: pricesError } = await supabase
      .from("procedure_prices")
      .select("name, price");
    if (pricesError) {
      alert("Failed to load procedure prices: " + pricesError.message);
      setIsGeneratingInvoice(false);
      return;
    }

    const priceMap = new Map(
      (procedurePrices || []).map((procedure) => [normalize(procedure.name), Number(procedure.price || 0)])
    );
    const quantities = new Map<string, number>();
    treatmentNotes.forEach((note) => {
      const name = String(note.procedure_type || "Other Procedure").trim();
      const key = normalize(name);
      quantities.set(key, (quantities.get(key) || 0) + 1);
    });

    const items = Array.from(quantities.entries()).map(([key, quantity]) => {
      const procedure = (procedurePrices || []).find((item) => normalize(item.name) === key);
      const name = procedure?.name || treatmentNotes.find((note) => normalize(String(note.procedure_type || "")) === key)?.procedure_type || "Other Procedure";
      const unitPrice = Number(priceMap.get(key) || 0);
      return { procedure_name: String(name), quantity, unit_price: unitPrice, total_price: quantity * unitPrice };
    });
    const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
    const { data: invoice, error } = await supabase.from("invoices").insert({
      patient_id: patient.id,
      total_amount: totalAmount,
      amount_paid: 0,
      status: "pending",
    }).select("id").single();

    if (error || !invoice) {
      alert("Failed to generate invoice: " + (error?.message || "Invoice was not created."));
      setIsGeneratingInvoice(false);
      return;
    }

    const { error: itemsError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({ invoice_id: invoice.id, ...item }))
    );
    if (itemsError) {
      alert("Invoice created, but line items could not be saved: " + itemsError.message);
    } else {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 20;
      let y = 25;
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("Dental Lounge", margin, y);
      doc.setFontSize(10);
      doc.text("Patient Invoice", margin, y + 8);
      y = 52;
      doc.setTextColor(30, 41, 59);
      doc.text(`Invoice #: ${String(invoice.id).slice(0, 8)}`, margin, y);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 145, y);
      y += 9;
      doc.text(`Patient: ${patient.first_name} ${patient.last_name}`, margin, y);
      y += 12;
      items.forEach((item) => {
        doc.text(item.procedure_name, margin, y);
        doc.text(`Qty ${item.quantity}`, 120, y);
        doc.text(`PKR ${item.total_price.toFixed(2)}`, 165, y);
        y += 8;
      });
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Total: PKR ${totalAmount.toFixed(2)}`, margin, y);
      doc.save(`Invoice_${patient.last_name}_${Date.now()}.pdf`);
      alert(`✅ Invoice generated and PDF downloaded for PKR ${totalAmount.toFixed(2)}.`);
    }
    setIsGeneratingInvoice(false);
  };

  // Handle saving general note modal
  const handleSaveNote = async () => {
    const { error } = await supabase.from("treatment_notes").insert([
      {
        patient_id: id,
        procedure_type: newNote.procedure,
        tooth_number: newNote.tooth || null,
        clinical_notes: newNote.notes,
      },
    ]);

    if (!error) {
      setShowNoteModal(false);
      setNewNote({ procedure: "", tooth: "", notes: "" });
      reloadNotes();
    } else {
      console.error("Error saving note:", error);
      alert("Failed to save note: " + error.message);
    }
  };

  // Handle deleting a single treatment note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this treatment note?")) return;

    const { error } = await supabase.from("treatment_notes").delete().eq("id", noteId);

    if (!error) {
      reloadNotes();
    } else {
      console.error("Error deleting note:", error);
      alert("Failed to delete note: " + error.message);
    }
  };

  // Handle saving tooth-specific procedure from Odontogram
  const handleSaveToothProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTooth) return;

    setIsSavingTooth(true);

    const { error } = await supabase.from("treatment_notes").insert([
      {
        patient_id: id,
        procedure_type: toothProcedure,
        tooth_number: String(selectedTooth),
        clinical_notes: toothNotes.trim() || null,
      },
    ]);

    if (!error) {
      setSelectedTooth(null);
      setToothProcedure("Composite Filling");
      setToothNotes("");
      reloadNotes();
    } else {
      console.error("Error saving tooth procedure:", error);
      alert("Failed to save procedure: " + error.message);
    }

    setIsSavingTooth(false);
  };

  // Handle Undo / Remove procedure for a tooth (Revert to Healthy)
  const handleUndoToothProcedure = async (toothNum: number) => {
    if (!confirm(`Reset Tooth #${toothNum} to Healthy and remove its procedure record?`)) return;

    const { data: toothRecords, error: fetchError } = await supabase
      .from("treatment_notes")
      .select("id")
      .eq("patient_id", id)
      .eq("tooth_number", String(toothNum));

    let error = fetchError;
    if (!error && toothRecords?.length) {
      const recordIds = toothRecords.map((record) => record.id);
      const deleteResult = await supabase.from("treatment_notes").delete().in("id", recordIds);
      error = deleteResult.error;
    }

    if (!error) {
      setSelectedTooth(null);
      await reloadNotes();
    } else {
      console.error("Error undoing tooth procedure:", error);
      alert("Failed to undo procedure: " + error.message);
    }
  };

  // Open tooth modal
  const handleToothClick = (toothNum: number) => {
    setSelectedTooth(toothNum);
    setToothProcedure("Composite Filling");
    setToothNotes("");
  };

  // Existing history for the currently selected tooth in modal
  const selectedToothHistory = useMemo(() => {
    if (!selectedTooth) return [];
    return treatmentNotes.filter((n) => String(n.tooth_number) === String(selectedTooth));
  }, [selectedTooth, treatmentNotes]);

  // Handle X-Ray & Document Upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError("");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${id}/${Date.now()}_${cleanFileName}`;

        // 1. Upload file to Supabase Storage bucket
        const { error: uploadErr } = await supabase.storage
          .from("patient_files")
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          setUploadError(
            `Upload error: ${uploadErr.message}. (Make sure the 'patient_files' bucket exists in Supabase Storage)`
          );
          setIsUploading(false);
          return;
        }

        // 2. Get Public URL
        const { data: urlData } = supabase.storage.from("patient_files").getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl || "";

        // 3. Save reference in patient_documents table
        const { error: dbErr } = await supabase.from("patient_documents").insert([
          {
            patient_id: id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type || fileExt,
            file_size: file.size,
          },
        ]);

        if (dbErr) {
          console.error("Database document record error:", dbErr);
          setUploadError(`Database error: ${dbErr.message}`);
        }
      }

      await reloadDocuments();
    } catch (err: any) {
      console.error("Upload handler caught error:", err);
      setUploadError(err.message || "An error occurred while uploading.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Document Delete
  const handleDeleteDocument = async (doc: PatientDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.file_name}"?`)) return;

    const { error: dbErr } = await supabase.from("patient_documents").delete().eq("id", doc.id);

    if (!dbErr) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (selectedDocPreview?.id === doc.id) {
        setSelectedDocPreview(null);
      }
    } else {
      alert("Failed to delete document: " + dbErr.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 min-h-screen bg-slate-900">Loading patient profile...</div>;
  }

  if (!patient) {
    return <div className="p-8 text-red-400 min-h-screen bg-slate-900">Patient not found.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="text-blue-400 hover:text-blue-300 mb-2 inline-block text-sm font-medium transition-colors"
            >
              &larr; Back to Patients
            </button>
            <h1 className="text-3xl font-bold text-white">
              {patient.first_name} {patient.last_name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowRxModal(true)}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-900/20"
            >
              ✍️ Write Rx
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={isGeneratingInvoice || treatmentNotes.length === 0}
              className="bg-amber-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingInvoice ? "Generating…" : "💳 Generate Invoice"}
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
            >
              📅 Book Appointment
            </button>
          </div>
        </div>

        {/* Patient Demographics Card */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
          <h2 className="text-lg font-bold text-white mb-4">Patient Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Phone</p>
              <p className="text-base font-medium text-slate-200 mt-1">{patient.phone_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Date of Birth</p>
              <p className="text-base font-medium text-slate-200 mt-1">
                {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Medical Alerts</p>
              {patient.medical_alerts && patient.medical_alerts !== "None" ? (
                <span className="inline-block mt-1 bg-red-900/40 border border-red-800 text-red-300 px-3 py-1 rounded-md text-xs font-semibold">
                  ⚠️ {patient.medical_alerts}
                </span>
              ) : (
                <p className="text-base font-medium text-slate-200 mt-1">None</p>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Odontogram Section */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🦷</span> Interactive Odontogram
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Universal Numbering System (1–32). Click any tooth to record or undo procedures.
              </p>
            </div>

            {/* Visual Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700">
              <span className="flex items-center gap-1.5 text-blue-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Filling
              </span>
              <span className="flex items-center gap-1.5 text-red-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Extraction
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Crown
              </span>
              <span className="flex items-center gap-1.5 text-purple-300">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Root Canal
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Implant
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span> Untreated
              </span>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[760px] space-y-6">
              
              {/* Upper Arch (Maxillary): 1-16 */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-2 px-2 uppercase tracking-wider">
                  <span>Right (1–8)</span>
                  <span className="text-slate-200">Upper Arch (Maxillary)</span>
                  <span>Left (9–16)</span>
                </div>

                <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 p-3 bg-slate-900/60 rounded-xl border border-slate-700/80">
                  {UPPER_TEETH.map((toothNum) => {
                    const status = getToothStatus(toothNum, treatmentNotes);
                    const isMidline = toothNum === 8;

                    return (
                      <button
                        key={toothNum}
                        onClick={() => handleToothClick(toothNum)}
                        className={`group relative flex flex-col items-center justify-between p-2 rounded-lg border transition-all text-center ${
                          status
                            ? status.cardBg
                            : "bg-slate-800/90 border-slate-700 text-slate-300 hover:border-blue-500 hover:bg-slate-750"
                        } ${isMidline ? "border-r-2 border-r-slate-500" : ""}`}
                        title={
                          status
                            ? `Tooth #${toothNum}: ${status.latestNote.procedure_type}`
                            : `Tooth #${toothNum}: Click to log procedure`
                        }
                      >
                        <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-white">
                          #{toothNum}
                        </span>

                        <div className="my-1 transition-transform group-hover:scale-110">
                          <ToothIcon
                            className={`w-5 h-5 ${status ? "text-current" : "text-slate-400 group-hover:text-blue-400"}`}
                          />
                        </div>

                        {status ? (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-black/40 uppercase tracking-tighter truncate max-w-full">
                            {status.badgeText}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600 group-hover:text-slate-400 font-medium tracking-tighter">
                            +Add
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lower Arch (Mandibular): 32-17 */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-2 px-2 uppercase tracking-wider">
                  <span>Right (32–25)</span>
                  <span className="text-slate-200">Lower Arch (Mandibular)</span>
                  <span>Left (24–17)</span>
                </div>

                <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 p-3 bg-slate-900/60 rounded-xl border border-slate-700/80">
                  {LOWER_TEETH.map((toothNum) => {
                    const status = getToothStatus(toothNum, treatmentNotes);
                    const isMidline = toothNum === 25;

                    return (
                      <button
                        key={toothNum}
                        onClick={() => handleToothClick(toothNum)}
                        className={`group relative flex flex-col items-center justify-between p-2 rounded-lg border transition-all text-center ${
                          status
                            ? status.cardBg
                            : "bg-slate-800/90 border-slate-700 text-slate-300 hover:border-blue-500 hover:bg-slate-750"
                        } ${isMidline ? "border-r-2 border-r-slate-500" : ""}`}
                        title={
                          status
                            ? `Tooth #${toothNum}: ${status.latestNote.procedure_type}`
                            : `Tooth #${toothNum}: Click to log procedure`
                        }
                      >
                        <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-white">
                          #{toothNum}
                        </span>

                        <div className="my-1 transition-transform group-hover:scale-110">
                          <ToothIcon
                            className={`w-5 h-5 ${status ? "text-current" : "text-slate-400 group-hover:text-blue-400"}`}
                          />
                        </div>

                        {status ? (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-black/40 uppercase tracking-tighter truncate max-w-full">
                            {status.badgeText}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600 group-hover:text-slate-400 font-medium tracking-tighter">
                            +Add
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* X-Rays & Clinical Documents Section */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🩻</span> X-Rays & Clinical Documents
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Upload radiographs, panoramic X-rays, and patient documents (PNG, JPG, PDF)
              </p>
            </div>
            <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
              {documents.length} {documents.length === 1 ? "file" : "files"} uploaded
            </span>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-950/40"
                : "border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-blue-400">
                📤
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Drag and drop X-rays here, or{" "}
                  <label className="text-blue-400 hover:text-blue-300 cursor-pointer underline">
                    browse files
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG, and PDF</p>
              </div>

              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-blue-400 font-medium">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  Uploading to secure storage...
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-900/40 border border-red-800 text-red-300 rounded-lg text-xs max-w-md">
                  {uploadError}
                </div>
              )}
            </div>
          </div>

          {/* Documents & X-Rays Grid */}
          {documents.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
              {documents.map((doc) => {
                const isImage =
                  doc.file_type?.startsWith("image/") ||
                  /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.file_url || doc.file_name);

                return (
                  <div
                    key={doc.id}
                    className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden group hover:border-blue-500 transition-all flex flex-col justify-between"
                  >
                    {/* Thumbnail / Preview */}
                    <div
                      onClick={() => setSelectedDocPreview(doc)}
                      className="h-36 bg-slate-950 flex items-center justify-center cursor-pointer relative overflow-hidden group/img"
                    >
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={doc.file_url}
                          alt={doc.file_name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                          <span className="text-3xl mb-1">📄</span>
                          <span className="text-[11px] uppercase font-bold text-slate-500">Document</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs font-medium text-white gap-1.5 backdrop-blur-[2px]">
                        <span>🔍</span> View Fullscreen
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3 bg-slate-900/90 border-t border-slate-800">
                      <p className="text-xs font-semibold text-white truncate" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                      <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-400 text-xs transition-colors"
                            title="Open in new tab"
                          >
                            ↗
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="text-red-400 hover:text-red-300 text-xs transition-colors"
                            title="Delete document"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs mt-4">
              No X-rays or files uploaded yet. Drag a file above to add to this patient&apos;s chart.
            </div>
          )}
        </div>

        {/* Treatment History Section with Delete Action */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Treatment History & Clinical Notes</h2>
              <p className="text-xs text-slate-400 mt-0.5">Chronological record of patient visits and procedures</p>
            </div>
            <button
              onClick={() => setShowNoteModal(true)}
              className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>+</span> Add Custom Note
            </button>
          </div>

          {treatmentNotes.length > 0 ? (
            <div className="space-y-3">
              {treatmentNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 bg-slate-900/60 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{note.procedure_type}</span>
                      {note.tooth_number && (
                        <span className="inline-block bg-blue-900/40 border border-blue-700 text-blue-300 text-xs px-2 py-0.5 rounded font-mono font-medium">
                          Tooth #{note.tooth_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {note.created_at ? new Date(note.created_at).toLocaleDateString() : ""}
                      </span>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-slate-500 hover:text-red-400 text-xs transition-colors p-1"
                        title="Delete this note"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  {note.clinical_notes && (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">{note.clinical_notes}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-dashed border-slate-600">
              <p className="text-slate-400 text-sm">No treatment notes or procedures recorded yet.</p>
              <p className="text-xs text-slate-500 mt-1">Click any tooth on the Odontogram above to record a procedure.</p>
            </div>
          )}
        </div>

      </div>

      {/* Tooth Procedure Modal (Triggered by clicking any tooth) */}
      {selectedTooth !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700 text-white">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🦷</span> Tooth #{selectedTooth}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedTooth <= 16 ? "Upper Arch (Maxillary)" : "Lower Arch (Mandibular)"}
                </p>
              </div>
              <button
                onClick={() => setSelectedTooth(null)}
                className="text-slate-400 hover:text-white text-xl font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Prior Treatment for this tooth */}
            {selectedToothHistory.length > 0 && (
              <div className="mb-4 bg-slate-900/70 p-3 rounded-lg border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Existing Procedure for Tooth #{selectedTooth}:
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUndoToothProcedure(selectedTooth)}
                    className="text-xs text-red-400 hover:text-red-300 font-medium underline flex items-center gap-1"
                    title="Remove procedure and reset tooth to healthy"
                  >
                    <span>↩</span> Undo / Reset to Healthy
                  </button>
                </div>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {selectedToothHistory.map((h) => (
                    <div key={h.id} className="text-xs flex justify-between text-slate-300">
                      <span className="font-medium text-white">{h.procedure_type}</span>
                      <span className="text-slate-500">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveToothProcedure} className="space-y-4">
              
              {/* Quick Select Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Quick Select Procedure:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_PROCEDURES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setToothProcedure(preset.name)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                        toothProcedure === preset.name
                          ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/30"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Procedure input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Procedure Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={toothProcedure}
                  onChange={(e) => setToothProcedure(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Composite Filling, Extraction..."
                />
              </div>

              {/* Clinical Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Clinical Notes (Surfaces, Material, Details)
                </label>
                <textarea
                  rows={3}
                  value={toothNotes}
                  onChange={(e) => setToothNotes(e.target.value)}
                  placeholder="e.g. MOD composite placed, decay removed, etched & bonded..."
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                {selectedToothHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleUndoToothProcedure(selectedTooth)}
                    className="px-3 py-2 bg-red-950 border border-red-800 text-red-300 hover:bg-red-900 rounded-lg text-xs font-medium transition-colors"
                  >
                    Reset Tooth
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTooth(null)}
                    className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTooth}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20 text-sm"
                  >
                    {isSavingTooth ? "Saving..." : "Save Procedure"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* General Add Treatment Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg w-full max-w-md border border-slate-700 text-white">
            <h3 className="text-xl font-bold text-white mb-4">Add Treatment Note</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Procedure</label>
                <input
                  type="text"
                  value={newNote.procedure}
                  onChange={(e) => setNewNote({ ...newNote, procedure: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                  placeholder="e.g. Composite Filling"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tooth Number (Optional, 1–32)</label>
                <input
                  type="text"
                  value={newNote.tooth}
                  onChange={(e) => setNewNote({ ...newNote, tooth: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                  placeholder="e.g. 14"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Clinical Notes</label>
                <textarea
                  value={newNote.notes}
                  onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2 h-24 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                  placeholder="Details..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Document / X-Ray Lightbox Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="w-full max-w-5xl flex justify-between items-center text-white mb-3 px-2">
            <div>
              <h3 className="text-lg font-bold truncate max-w-md">{selectedDocPreview.file_name}</h3>
              <p className="text-xs text-slate-400">
                Uploaded {selectedDocPreview.created_at ? new Date(selectedDocPreview.created_at).toLocaleString() : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={selectedDocPreview.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition-colors"
              >
                Open Original ↗
              </a>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-lg transition-colors"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="max-w-5xl max-h-[80vh] w-full bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center p-2">
            {selectedDocPreview.file_type?.startsWith("image/") ||
            /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(selectedDocPreview.file_url || selectedDocPreview.file_name) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={selectedDocPreview.file_url}
                alt={selectedDocPreview.file_name}
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            ) : (
              <iframe
                src={selectedDocPreview.file_url}
                title={selectedDocPreview.file_name}
                className="w-full h-[75vh] border-0 rounded"
              />
            )}
          </div>
        </div>
      )}

        {/* Appointments */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">Appointments</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-blue-300 uppercase mb-3">Upcoming</h3>
              <div className="space-y-2">
                {appointments.filter((appointment) => new Date(appointment.appointment_date) >= new Date() && !["cancelled", "completed"].includes(appointment.status)).map((appointment) => (
                  <div key={appointment.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                    <p className="font-medium">{new Date(appointment.appointment_date).toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{appointment.status}</p>
                  </div>
                ))}
                {appointments.filter((appointment) => new Date(appointment.appointment_date) >= new Date() && !["cancelled", "completed"].includes(appointment.status)).length === 0 && <p className="text-sm text-slate-500">No upcoming appointments.</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase mb-3">Previous</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {appointments.filter((appointment) => new Date(appointment.appointment_date) < new Date() || ["completed", "cancelled"].includes(appointment.status)).map((appointment) => (
                  <div key={appointment.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                    <p className="font-medium">{new Date(appointment.appointment_date).toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{appointment.status}</p>
                    {appointment.notes && <p className="text-xs text-slate-500 mt-1">{appointment.notes}</p>}
                  </div>
                ))}
                {appointments.filter((appointment) => new Date(appointment.appointment_date) < new Date() || ["completed", "cancelled"].includes(appointment.status)).length === 0 && <p className="text-sm text-slate-500">No previous appointments.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Prescriptions Section ── */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>💊</span> Prescriptions
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Digital prescriptions — download as PDF.
              </p>
            </div>
            <button
              onClick={() => setShowRxModal(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
            >
              ✍️ Write Prescription
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No prescriptions yet. Click "Write Prescription" to add one.
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptionGroups.map((rxGroup) => (
                <div
                  key={rxGroup[0].prescription_id || rxGroup[0].id}
                  className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-500 text-xs mb-2">
                      {rxGroup[0].created_at ? new Date(rxGroup[0].created_at).toLocaleString() : ""}
                    </div>
                    {rxGroup.map((rx) => (
                      <div key={rx.id} className="mb-2 last:mb-0">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold text-base">℞</span>
                          <span className="text-white font-semibold text-sm">{rx.medication}</span>
                          {rx.dosage && <span className="text-slate-400 text-xs">— {rx.dosage}</span>}
                        </div>
                        {rx.instructions && <p className="text-slate-400 text-xs mt-0.5 ml-6">{rx.instructions}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownloadRxPDF(rxGroup)}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      ⬇ Download PDF
                    </button>
                    <button
                      onClick={() => handleDeleteRx(rxGroup)}
                      className="text-slate-500 hover:text-red-400 transition-colors text-sm"
                      title="Delete prescription"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* ── Write Prescription Modal ── */}
      {showRxModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">✍️ Write Prescription</h2>
              <button
                onClick={() => { setShowRxModal(false); setRxMedicines([{ medication: "", dosage: "", instructions: "" }]); }}
                className="text-slate-400 hover:text-white transition-colors text-xl font-bold"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveRx} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {rxMedicines.map((medicine, index) => (
                <div key={index} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Medicine {index + 1}</span>
                    {rxMedicines.length > 1 && (
                      <button type="button" onClick={() => setRxMedicines((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={medicine.medication}
                    onChange={(e) => setRxMedicines((current) => current.map((item, i) => i === index ? { ...item, medication: e.target.value } : item))}
                    placeholder="Medication, e.g. Amoxicillin 500mg"
                    required={index === 0}
                    className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                  />
                  <input
                    type="text"
                    value={medicine.dosage}
                    onChange={(e) => setRxMedicines((current) => current.map((item, i) => i === index ? { ...item, dosage: e.target.value } : item))}
                    placeholder="Dosage, e.g. 1 capsule 3× daily"
                    className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                  />
                  <textarea
                    value={medicine.instructions}
                    onChange={(e) => setRxMedicines((current) => current.map((item, i) => i === index ? { ...item, instructions: e.target.value } : item))}
                    placeholder="Instructions"
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm resize-none"
                  />
                </div>
              ))}
              <button type="button" onClick={() => setRxMedicines((current) => [...current, { medication: "", dosage: "", instructions: "" }])} className="w-full py-2 rounded-lg border border-dashed border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 text-sm font-medium">
                + Add Another Medicine
              </button>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowRxModal(false); setRxMedicines([{ medication: "", dosage: "", instructions: "" }]); }}
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRx}
                  className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {isSavingRx ? "Saving…" : "Save & Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function PatientProfile() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 min-h-screen bg-slate-900">Loading patient profile...</div>}>
      <PatientProfileContent />
    </Suspense>
  );
}
