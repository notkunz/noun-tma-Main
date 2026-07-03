import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { amount, provider } = await req.json();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
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

  if (!profile)
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );

  // Create a pending transaction first
  const { data: transaction } = await supabase
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

  if (provider === "paystack") {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile.email,
        amount: amount * 100, // Paystack uses kobo
        reference: transaction.id, // use transaction ID as reference
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/wallet?verify=paystack`,
      }),
    });
    const data = await res.json();
    return NextResponse.json({ url: data.data.authorization_url });
  }

  /*if (provider === 'flutterwave') {
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tx_ref: transaction.id,
        amount,
        currency: 'NGN',
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/wallet?verify=flutterwave`,
        customer: { email: profile.email }
      })
    })
    const data = await res.json()
    return NextResponse.json({ url: data.data.link })
  }*/
}
