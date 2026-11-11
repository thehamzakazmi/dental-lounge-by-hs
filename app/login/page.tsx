"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [sessionInfo, setSessionInfo] = useState<{ duration?: string; loggedOutAt?: string } | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Signup modal state
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupProfilePic, setSignupProfilePic] = useState<File | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState("");

  // Forget password state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // Clear form when arriving from logout (query param ?logged_out=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loggedOut = params.get("logged_out");
    const sessionDuration = params.get("session_duration");

    if (loggedOut === "1") {
      setEmail("");
      setPassword("");
      setError("");
      setIsSigningIn(false);
      if (sessionDuration) {
        setSessionInfo({
          duration: sessionDuration,
          loggedOutAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
  }, []);

  // Handle login
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSigningIn(true);

    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message || "Invalid email or password. Please try again.");
        setIsSigningIn(false);
      } else {
        localStorage.setItem("dl_login_time", Date.now().toString());
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
      setIsSigningIn(false);
    }
  }, [email, password, router]);

  // Handle signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setIsSigningUp(true);

    if (!signupEmail || !signupFirstName || !signupLastName || !signupPassword) {
      setSignupError("Please fill in all required fields.");
      setIsSigningUp(false);
      return;
    }

    if (signupPassword.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      setIsSigningUp(false);
      return;
    }

    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            first_name: signupFirstName,
            last_name: signupLastName,
          },
        },
      });

      if (err) {
        setSignupError(err.message || "Failed to create account. Please try again.");
        setIsSigningUp(false);
        return;
      }

      if (data.user && signupProfilePic) {
        const fileExt = signupProfilePic.name.split(".").pop();
        const fileName = `${data.user.id}/profile.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from("patient_files")
          .upload(fileName, signupProfilePic);

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("patient_files")
            .getPublicUrl(fileName);
          await supabase.auth.updateUser({
            data: { avatar_url: urlData.publicUrl },
          });
        }
      }

      setSignupError("");
      setIsSigningUp(false);
      setIsSignupOpen(false);
      setSignupEmail("");
      setSignupFirstName("");
      setSignupLastName("");
      setSignupPassword("");
      setSignupProfilePic(null);

      alert("Account created successfully! Please check your email to confirm your account, then sign in.");
    } catch (err: any) {
      setSignupError(err.message || "An unexpected error occurred. Please try again.");
      setIsSigningUp(false);
    }
  };

  // Handle forget password reset
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");
    setIsResetting(true);

    if (!forgotEmail) {
      setResetMessage("Please enter your email address.");
      setIsResetting(false);
      return;
    }

    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (err) {
        setResetMessage(err.message || "Failed to send reset email. Please try again.");
        setIsResetting(false);
        return;
      }

      setResetMessage("A password reset link has been sent to your email address.");
      setIsResetting(false);
    } catch (err: any) {
      setResetMessage(err.message || "An unexpected error occurred. Please try again.");
      setIsResetting(false);
    }
  };

  // Handle logout session end
  const handleSessionEnd = useCallback(() => {
    const loginTime = localStorage.getItem("dl_login_time");
    if (loginTime) {
      const durationMs = Date.now() - parseInt(loginTime, 10);
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      setSessionInfo({
        duration: `${minutes}m ${seconds}s`,
        loggedOutAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
    localStorage.removeItem("dl_login_time");
    setEmail("");
    setPassword("");
    setError("");
  }, []);

  return (
    <>
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
            <div className="text-left">
              <span className="block text-lg font-semibold tracking-wide">Dental Lounge</span>
              <span className="block text-sm font-medium text-white/70">By HS</span>
              <span className="block text-sm font-medium text-white/70">Implant Studio</span>
            </div>
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
            <div className="text-left">
              <span className="block text-lg font-semibold">Dental Lounge</span>
              <span className="block text-sm font-medium text-white/70">By HS</span>
              <span className="block text-sm font-medium text-white/70">Implant Studio</span>
            </div>
          </div>

          {/* Session info banner (shown after logout) */}
          {sessionInfo && (
            <div className="mb-6 p-4 rounded-xl bg-blue-900/30 border border-blue-500/30 text-blue-200 text-sm">
              <p className="font-semibold mb-1">Session Ended</p>
              <p className="text-xs text-blue-300/80">
                Previous session lasted <strong>{sessionInfo.duration}</strong>. Logged out at {sessionInfo.loggedOutAt}.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}
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
              autoCapitalize="none"
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <label className="mb-2 block text-sm font-medium text-white/80">Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 pr-12 text-white placeholder-white/35 outline-none transition focus:border-cyan-300/70 focus:bg-white/10 focus:ring-4 focus:ring-cyan-300/10"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <button type="submit" disabled={isSigningIn} className="mt-2 w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isSigningIn ? "Signing in..." : "Sign in"}
          </button>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setIsForgotOpen(true)}
              className="text-cyan-300 hover:text-white underline decoration-cyan-300/30 hover:decoration-cyan-300 transition"
            >
              Forget password?
            </button>
            <button
              type="button"
              onClick={() => setIsSignupOpen(true)}
              className="text-cyan-300 hover:text-white underline decoration-cyan-300/30 hover:decoration-cyan-300 transition"
            >
              Create new account
            </button>
          </div>
        </form>

          <p className="mt-8 text-xs text-white/40 text-center">
            Dental Lounge By HS Implant Studio &copy; {currentYear}
          </p>
        </div>
      </div>
    </main>

      {/* Signup Modal */}
      {isSignupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSignupOpen(false)}
          />
          <div className="relative w-full max-w-md bg-slate-950 border border-white/15 rounded-[2rem] p-7 shadow-2xl z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Create New Account</h3>
              <button
                onClick={() => setIsSignupOpen(false)}
                className="text-white/60 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            {signupError && (
              <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 text-sm">
                {signupError}
              </div>
            )}
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/70 uppercase">First Name</label>
                  <input
                    type="text"
                    value={signupFirstName}
                    onChange={(e) => setSignupFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/70"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/70 uppercase">Last Name</label>
                  <input
                    type="text"
                    value={signupLastName}
                    onChange={(e) => setSignupLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/70"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/70 uppercase">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/70"
                  required
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/70 uppercase">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/70"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/70 uppercase">Profile Picture (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSignupProfilePic(e.target.files[0]);
                    }
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white/70 outline-none transition focus:border-cyan-300/70"
                />
              </div>
              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningUp ? "Creating account..." : "Create Account"}
              </button>
            </form>
            <p className="mt-4 text-xs text-white/50 text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsSignupOpen(false)}
                className="text-cyan-300 hover:text-white underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Forget Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsForgotOpen(false)}
          />
          <div className="relative w-full max-w-md bg-slate-950 border border-white/15 rounded-[2rem] p-7 shadow-2xl z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Reset Password</h3>
              <button
                onClick={() => setIsForgotOpen(false)}
                className="text-white/60 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            {resetMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                resetMessage.includes("sent") || resetMessage.includes("success")
                  ? "bg-emerald-900/40 border border-emerald-500/30 text-emerald-200"
                  : "bg-red-900/40 border border-red-500/30 text-red-200"
              }`}
              >
                {resetMessage}
              </div>
            )}
            <p className="mb-6 text-sm text-white/60">
              Enter your email address and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/70 uppercase">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/70"
                  required
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={isResetting}
                className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResetting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p className="mt-4 text-xs text-white/50 text-center">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => setIsForgotOpen(false)}
                className="text-cyan-300 hover:text-white underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
