"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      setIsSigningIn(false);
    } else {
      router.push("/");
    }
  };

  return (
    <main className="login-gradient relative min-h-screen overflow-hidden px-5 py-10 text-white">
      <div className="login-noise" aria-hidden="true" />
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center justify-center lg:justify-end">
        <section className="hidden max-w-xl flex-1 pr-16 lg:block">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl">
              <span className="text-3xl" aria-hidden="true">🦷</span>
            </div>
            <span className="text-lg font-semibold tracking-wide">Dental Lounge</span>
          </div>
          <h1 className="max-w-lg text-7xl font-light leading-[0.92] tracking-tight">
            Care that
            <span className="block font-semibold">smiles.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-white/65">
            A calm, modern workspace for patient care, appointments, prescriptions and billing.
          </p>
        </section>

        <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/55 p-7 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl sm:p-9">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="text-3xl" aria-hidden="true">🦷</span>
            <span className="text-lg font-semibold">Dental Lounge</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Welcome back</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your account</h2>
          <p className="mt-2 text-sm text-white/55">Enter your credentials to continue.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-white placeholder-white/35 outline-none transition focus:border-cyan-300/70 focus:bg-white/10 focus:ring-4 focus:ring-cyan-300/10"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-white placeholder-white/35 outline-none transition focus:border-cyan-300/70 focus:bg-white/10 focus:ring-4 focus:ring-cyan-300/10"
              required
            />
          </div>
          <button type="submit" disabled={isSigningIn} className="mt-2 w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isSigningIn ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      </div>
    </main>
  );
}
