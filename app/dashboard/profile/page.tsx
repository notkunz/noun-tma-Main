"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [stats, setStats] = useState({ walletBalance: 0, totalTMAs: 0 });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = (await supabase
      .from("users")
      .select("*")
      .eq("auth_id", user.id)
      .single()) as { data: any };
    setProfile(p);
    setFullName(p?.full_name || "");

    const { data: w } = (await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", p?.id)
      .single()) as { data: any };
    const { count } = await supabase
      .from("tma_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p?.id);

    setStats({ walletBalance: w?.balance || 0, totalTMAs: count || 0 });
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("users")
      .update({ full_name: fullName.trim() })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      setMessage("Failed to update name");
      setMessageType("error");
    } else {
      setMessage("Name updated successfully");
      setMessageType("success");
      loadProfile();
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters");
      setMessageType("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setMessageType("error");
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setMessage("Failed to update password: " + error.message);
      setMessageType("error");
    } else {
      setMessage("Password updated successfully");
      setMessageType("success");
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!profile) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile</h2>

      {message && (
        <div
          className={`p-3 rounded-xl mb-4 text-sm ${
            messageType === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-400 text-xs mb-1">Wallet Balance</p>
          <p className="text-xl font-bold text-green-600">
            ₦{stats.walletBalance.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-gray-400 text-xs mb-1">TMAs Completed</p>
          <p className="text-xl font-bold text-gray-800">{stats.totalTMAs}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 mb-4">
        <h3 className="font-bold text-gray-800 mb-4">Account Details</h3>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded-lg p-3 text-sm text-black"
          />
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">
            Email Address
          </label>
          <input
            value={profile.email}
            disabled
            className="w-full bg-gray-50 border rounded-lg p-3 text-sm text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">
            Contact support to change your email
          </p>
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">
            Matric Number
          </label>
          <input
            value={profile.matric_number || ""}
            disabled
            className="w-full bg-gray-50 border rounded-lg p-3 text-sm text-gray-400 cursor-not-allowed"
          />
        </div>

        <button
          onClick={handleSaveName}
          disabled={saving || fullName === profile.full_name}
          className="w-full bg-green-600 text-white rounded-lg py-2.5 font-bold text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800">Password</h3>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="text-xs text-green-600 hover:underline"
          >
            {showPasswordForm ? "Cancel" : "Change Password"}
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm text-black"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm text-black"
            />
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="w-full bg-green-600 text-white rounded-lg py-2.5 font-bold text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {passwordSaving ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 border border-red-200 text-red-600 rounded-xl py-3 font-semibold text-sm hover:bg-red-100"
      >
        Logout
      </button>
    </div>
  );
}
