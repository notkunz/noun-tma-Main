import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { amount, provider } = await req.json();

  // User auth inline (scoped to this handler)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rest stays the same (all DB ops use supabaseAdmin)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("auth_id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile lookup failed:", profileError);
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  const { data: transaction, error: txnError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: profile.id,
      type: "credit",
      amount,
      description: "Wallet top-up",
      payment_provider: provider,
      status: "pending",
    })
    .select()
    .single();

  if (txnError || !transaction) {
    console.error("Transaction insert failed:", txnError);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }

  if (provider === "paystack") {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile.email,
        amount: amount * 100,
        reference: transaction.id,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/wallet?verify=paystack`,
      }),
    });
    const data = await res.json();
    return NextResponse.json({ url: data.data.authorization_url });
  }
}
