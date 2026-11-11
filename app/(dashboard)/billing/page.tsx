"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Invoice {
  id: string;
  patient_id: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  created_at?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

interface ProcedurePrice {
  id: string;
  name: string;
  price: number;
}

interface InvoiceItem {
  invoice_id: string;
  procedure_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-900/40 border-emerald-700 text-emerald-300",
  pending: "bg-amber-900/40 border-amber-700 text-amber-300",
  overdue: "bg-red-900/40 border-red-700 text-red-300",
};

export default function BillingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"invoices" | "procedures">("invoices");
  const [procedures, setProcedures] = useState<ProcedurePrice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [procedureName, setProcedureName] = useState("");
  const [procedurePrice, setProcedurePrice] = useState("");
  const formatCurrency = (amount: number) => `PKR ${Number(amount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
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
    const [invRes, patRes, procRes, itemRes] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("patients").select("id, first_name, last_name, phone_number"),
      supabase.from("procedure_prices").select("*").order("name"),
      supabase.from("invoice_items").select("*"),
    ]);
    if (invRes.data) setInvoices(invRes.data);
    if (patRes.data) setPatients(patRes.data);
    if (procRes.data) setProcedures(procRes.data);
    if (itemRes.data) setInvoiceItems(itemRes.data);
  }

  async function handleAddProcedure(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(procedurePrice);
    if (!procedureName.trim() || !Number.isFinite(price) || price < 0) return;
    const { data, error } = await supabase.from("procedure_prices").insert({
      name: procedureName.trim(),
      price,
    }).select().single();
    if (!error && data) {
      setProcedures((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setProcedureName("");
      setProcedurePrice("");
    } else {
      alert("Failed to save procedure: " + error?.message);
    }
  }

  async function handleUpdateProcedure(procedure: ProcedurePrice, price: number) {
    if (!Number.isFinite(price) || price < 0) return;
    const { error } = await supabase.from("procedure_prices").update({ price }).eq("id", procedure.id);
    if (!error) setProcedures((current) => current.map((item) => item.id === procedure.id ? { ...item, price } : item));
    else alert("Failed to update procedure: " + error.message);
  }

  async function handleDeleteProcedure(procedure: ProcedurePrice) {
    if (!confirm(`Delete ${procedure.name}?`)) return;
    const { error } = await supabase.from("procedure_prices").delete().eq("id", procedure.id);
    if (!error) setProcedures((current) => current.filter((item) => item.id !== procedure.id));
    else alert("Failed to delete procedure: " + error.message);
  }

  function handlePrintInvoice(inv: Invoice) {
    const patient = patientMap.get(inv.patient_id);
    const items = invoiceItems.filter((item) => item.invoice_id === inv.id);
    const fallback = items.length === 0 ? [{ procedure_name: "Dental procedures", quantity: 1, unit_price: inv.total_amount, total_price: inv.total_amount }] : items;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Invoice ${inv.id.slice(0, 8)}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:40px}.header{border-bottom:3px solid #2563eb;padding-bottom:16px}.header h1{color:#2563eb;margin:0}.meta,.total{display:flex;justify-content:space-between}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}.total{font-size:18px;font-weight:bold;margin-top:20px}</style>
      </head><body><div class="header"><h1>Dental Lounge</h1><p>Patient Invoice</p></div>
      <div class="meta"><div><strong>Bill To</strong><br>${patient ? `${patient.first_name} ${patient.last_name}` : "Unknown Patient"}<br>${patient?.phone_number || ""}</div><div><strong>Invoice</strong><br>#${inv.id.slice(0, 8)}<br>${inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}</div></div>
      <table><thead><tr><th>Procedure</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>
      ${fallback.map((item) => `<tr><td>${item.procedure_name}</td><td>${item.quantity}</td><td>${formatCurrency(item.unit_price)}</td><td>${formatCurrency(item.total_price)}</td></tr>`).join("")}
      </tbody></table><div class="total"><span>Total</span><span>${formatCurrency(inv.total_amount)}</span></div><div style="margin-top:12px">Paid: ${formatCurrency(inv.amount_paid || 0)}<br>Balance: ${formatCurrency(Math.max(0, inv.total_amount - (inv.amount_paid || 0)))}</div>
      <p>Status: ${inv.status.toUpperCase()}</p><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  }

  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount_paid || 0), 0);
    const pending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);
    const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);
    return { total, paid, pending, overdue };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const patient = patientMap.get(inv.patient_id);
      const name = patient ? `${patient.first_name} ${patient.last_name}`.toLowerCase() : "";
      const matchSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || inv.id.includes(searchTerm);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, patientMap, searchTerm, statusFilter]);

  async function handleMarkPaid(inv: Invoice) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", amount_paid: inv.total_amount })
      .eq("id", inv.id);
    if (!error) {
      setInvoices((prev) =>
        prev.map((i) => i.id === inv.id ? { ...i, status: "paid", amount_paid: i.total_amount } : i)
      );
    } else {
      alert("Error: " + error.message);
    }
  }

  async function handleMarkOverdue(inv: Invoice) {
    const { error } = await supabase.from("invoices").update({ status: "overdue" }).eq("id", inv.id);
    if (!error) {
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: "overdue" } : i));
    } else {
      alert("Error: " + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (!error) {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } else {
      alert("Error: " + error.message);
    }
  }

  async function handleResetBilling() {
    if (!confirm("Reset all billing totals by deleting all invoices? This cannot be undone.")) return;
    const { error } = await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      alert("Failed to reset billing: " + error.message);
      return;
    }
    setInvoices([]);
    setInvoiceItems([]);
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">💳 Billing & Invoices</h1>
            <p className="text-slate-400 text-sm mt-1">Manage patient invoices and track payments</p>
          </div>
          <button onClick={handleResetBilling} className="px-4 py-2 rounded-lg border border-red-800 text-red-300 hover:bg-red-950 text-sm font-medium">
            Reset Billing Totals
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go to Patients to generate invoices →
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Billed", amount: stats.total, color: "text-white", bg: "bg-slate-800 border-slate-700" },
            { label: "Total Collected", amount: stats.paid, color: "text-emerald-300", bg: "bg-emerald-900/20 border-emerald-800" },
            { label: "Pending Balance", amount: stats.pending, color: "text-amber-300", bg: "bg-amber-900/20 border-amber-800" },
            { label: "Overdue Balance", amount: stats.overdue, color: "text-red-300", bg: "bg-red-900/20 border-red-800" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl border p-5 shadow-lg`}>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>
                {formatCurrency(s.amount || 0)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-b border-slate-700">
          <button onClick={() => setActiveTab("invoices")} className={`px-5 py-3 text-sm font-medium border-b-2 ${activeTab === "invoices" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
            Invoices
          </button>
          <button onClick={() => setActiveTab("procedures")} className={`px-5 py-3 text-sm font-medium border-b-2 ${activeTab === "procedures" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
            Procedure Prices
          </button>
        </div>

        {activeTab === "procedures" ? (
          <div className="space-y-6">
            <form onSubmit={handleAddProcedure} className="bg-slate-800 border border-slate-700 rounded-xl p-5 grid gap-4 sm:grid-cols-[1fr_220px_auto] items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Procedure name</label>
                <input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} placeholder="e.g. Tooth Whitening" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Price (PKR)</label>
                <input type="number" min="0" step="0.01" value={procedurePrice} onChange={(e) => setProcedurePrice(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <button className="bg-blue-600 hover:bg-blue-500 rounded-lg px-5 py-2.5 font-medium">Add Procedure</button>
            </form>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              {procedures.map((procedure) => (
                <div key={procedure.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-700 last:border-0">
                  <span className="font-medium">{procedure.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">PKR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={procedure.price}
                      key={`${procedure.id}-${procedure.price}`}
                      onBlur={(e) => handleUpdateProcedure(procedure, Number(e.target.value))}
                      className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-right text-white"
                    />
                    <button onClick={() => handleDeleteProcedure(procedure)} className="text-red-400 hover:text-red-300 px-2 py-2">Delete</button>
                  </div>
                </div>
              ))}
              {procedures.length === 0 && <p className="p-8 text-center text-slate-500">No procedures configured yet.</p>}
            </div>
          </div>
        ) : (
        <>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-700">Patient</th>
                  <th className="px-6 py-4 border-b border-slate-700">Date</th>
                  <th className="px-6 py-4 border-b border-slate-700">Total</th>
                  <th className="px-6 py-4 border-b border-slate-700">Paid</th>
                  <th className="px-6 py-4 border-b border-slate-700">Balance</th>
                  <th className="px-6 py-4 border-b border-slate-700">Status</th>
                  <th className="px-6 py-4 border-b border-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => {
                    const patient = patientMap.get(inv.patient_id);
                    const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
                    const statusStyle = STATUS_STYLES[inv.status] || "bg-slate-900/40 border-slate-600 text-slate-300";

                    return (
                      <tr key={inv.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          {patient ? (
                            <button
                              onClick={() => router.push(`/patient/${patient.id}`)}
                              className="font-semibold text-white hover:text-blue-400 transition-colors text-left"
                            >
                              {patient.first_name} {patient.last_name}
                            </button>
                          ) : (
                            <span className="text-slate-500 text-sm">Unknown Patient</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">{formatCurrency(inv.total_amount || 0)}</td>
                        <td className="px-6 py-4 text-emerald-400 font-medium">{formatCurrency(inv.amount_paid || 0)}</td>
                        <td className="px-6 py-4">
                          <span className={balance > 0 ? "text-amber-300 font-semibold" : "text-slate-400"}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${statusStyle}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePrintInvoice(inv)}
                              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              🖨 Print
                            </button>
                            {inv.status !== "paid" && (
                              <button
                                onClick={() => handleMarkPaid(inv)}
                                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                ✓ Mark Paid
                              </button>
                            )}
                            {inv.status === "pending" && (
                              <button
                                onClick={() => handleMarkOverdue(inv)}
                                className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                Flag Overdue
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(inv.id)}
                              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      {invoices.length === 0
                        ? "No invoices yet. Open a Patient Profile to generate one."
                        : "No invoices match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
