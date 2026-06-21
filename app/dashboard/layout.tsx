"use client";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  full_name: string;
}

interface WalletData {
  balance: number;
}

interface PayloadData {
  new: WalletData;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [lastScroll, setLastScroll] = useState(0);
  const [, startTransition] = useTransition();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        const data = await res.json();
        const stored = localStorage.getItem("app_version");

        if (stored && stored !== data.version) {
          setShowUpdateBanner(true);
        }
        if (!stored) {
          localStorage.setItem("app_version", data.version);
        }
      } catch (e) {
        console.error("Version check failed", e);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    const res = await fetch("/version.json", { cache: "no-store" });
    const data = await res.json();
    localStorage.setItem("app_version", data.version);
    window.location.reload();
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return void router.push("/login");
      const { data: profile } = (await supabase
        .from("users")
        .select("id, full_name")
        .eq("auth_id", user.id)
        .single()) as { data: User };
      setUser(profile);
      setUserId(profile?.id);
      const { data: walletData } = (await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", profile?.id)
        .single()) as { data: WalletData };
      setWallet(walletData?.balance || 0);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startTransition(() => {
      setOpen(false);
    });
  }, [pathname, startTransition]);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current < 10) setNavVisible(true);
      else if (current < lastScroll) setNavVisible(true);
      else setNavVisible(false);
      setLastScroll(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("wallet-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload: PayloadData) => {
          setWallet(payload.new.balance);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "All Courses", href: "/dashboard/courses" },
    { label: "My TMAs", href: "/dashboard/my-tmas" },
    { label: "Wallet", href: "/dashboard/wallet" },
    { label: "Support", href: "/dashboard/support" },
    { label: "Profile", href: "/dashboard/profile" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4" }}>
      {/* Top Navbar */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "#15803d",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 40,
          transform: navVisible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.3s ease",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        {showUpdateBanner && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              background: "#eab308",
              color: "#111827",
              padding: "10px 16px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 600,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <span>🎉 A new update is available</span>
            <button
              onClick={handleUpdate}
              style={{
                background: "#111827",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh Now
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "white",
              fontSize: "18px",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: "8px",
            }}
          >
            {open ? "✕" : "☰"}
          </button>
          <div>
            <span style={{ fontWeight: 800, fontSize: "16px", color: "white" }}>
              NOUN TMA
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.7)",
                margin: 0,
              }}
            >
              Wallet
            </p>
            <p
              style={{
                fontWeight: 800,
                fontSize: "14px",
                color: "white",
                margin: 0,
              }}
            >
              ₦{wallet.toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/wallet")}
            style={{
              fontSize: "12px",
              background: "white",
              color: "#15803d",
              border: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Top Up
          </button>
        </div>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 45,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100%",
          width: "260px",
          background: "#14532d",
          zIndex: 50,
          transform: open ? "translateX(0)" : "translateX(-260px)",
          transition: "transform 0.3s ease",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "24px" }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: "13px",
              cursor: "pointer",
              marginBottom: "24px",
            }}
          >
            ✕ Close
          </button>

          <div style={{ marginBottom: "16px" }}>
            <p
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.5)",
                margin: 0,
              }}
            >
              Logged in as
            </p>
            <p style={{ fontWeight: 700, color: "white", margin: "2px 0 0" }}>
              {user?.full_name || "Student"}
            </p>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "24px",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.6)",
                margin: "0 0 4px",
              }}
            >
              Wallet Balance
            </p>
            <p
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: "white",
                margin: "0 0 8px",
              }}
            >
              ₦{wallet.toLocaleString()}
            </p>
            <button
              onClick={() => router.push("/dashboard/wallet")}
              style={{
                fontSize: "11px",
                background: "#16a34a",
                color: "white",
                border: "none",
                padding: "5px 14px",
                borderRadius: "999px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Top Up
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontSize: "14px",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  background:
                    pathname === link.href
                      ? "rgba(255,255,255,0.15)"
                      : "transparent",
                  color:
                    pathname === link.href ? "white" : "rgba(255,255,255,0.65)",
                  fontWeight: pathname === link.href ? 700 : 400,
                  transition: "background 0.2s",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                fontSize: "13px",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                border: "none",
                padding: "10px 12px",
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ paddingTop: "64px", padding: "72px 16px 32px" }}>
        {children}
      </main>
    </div>
  );
}
