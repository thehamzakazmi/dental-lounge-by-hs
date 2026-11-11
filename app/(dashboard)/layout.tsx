"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarNav from "./SidebarNav";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <h2 className="text-xl font-bold tracking-wide text-blue-400">Dental Lounge</h2>
        </div>

        <Suspense
          fallback={
            <nav className="flex-1 px-4 py-6 space-y-2">
              <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
            </nav>
          }
        >
          <SidebarNav />
        </Suspense>

        {/* Bottom User Area */}
        <div className="relative p-4 border-t border-slate-700">
          <button onClick={() => setShowAccountMenu((value) => !value)} className="relative w-full flex items-center gap-3 text-left rounded-lg hover:bg-slate-800 p-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold text-white">
              Dr
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white">Admin</p>
            </div>
          </button>
          {showAccountMenu && (
            <div className="absolute bottom-20 left-4 w-56 rounded-lg border border-slate-700 bg-slate-800 shadow-xl overflow-hidden z-50">
              <button onClick={() => { setShowAccountMenu(false); router.push("/billing?tab=procedures"); }} className="block w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-700">
                Clinic Settings
              </button>
              <button onClick={handleLogout} className="block w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-slate-700 border-t border-slate-700">
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        {children}
      </main>
    </div>
  );
}
