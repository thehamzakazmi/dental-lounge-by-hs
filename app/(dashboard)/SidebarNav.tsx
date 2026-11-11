"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarNav() {
  const pathname = usePathname();

  const isPatientsActive = pathname === "/" || pathname.startsWith("/patient");
  const isCalendarActive = pathname.startsWith("/calendar");
  const isBillingActive = pathname.startsWith("/billing");

  return (
    <nav className="flex-1 px-4 py-6 space-y-2">
      <Link
        href="/"
        className={`block px-4 py-2.5 rounded-lg transition-colors ${
          isPatientsActive
            ? "bg-blue-600 font-medium text-white shadow-md shadow-blue-900/30"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        👥 Patients
      </Link>
      <Link
        href="/calendar"
        className={`block px-4 py-2.5 rounded-lg transition-colors ${
          isCalendarActive
            ? "bg-blue-600 font-medium text-white shadow-md shadow-blue-900/30"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        📅 Calendar
      </Link>
      <Link
        href="/billing"
        className={`block px-4 py-2.5 rounded-lg transition-colors ${
          isBillingActive
            ? "bg-blue-600 font-medium text-white shadow-md shadow-blue-900/30"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        💳 Billing
      </Link>
      <Link
        href="#"
        className="block px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
      >
        📦 Inventory
      </Link>
    </nav>
  );
}
