"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AreaLayout } from "@/components/AreaLayout";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type MembershipRequest = {
  id: string;
  status: string;
  review_notes: string | null;
  created_at: string;
};

type Associate = {
  id: string;
  status: string;
};

type ProtectedAreaProps = {
  children: React.ReactNode;
};

export function ProtectedArea({ children }: ProtectedAreaProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadArea() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) {
        const fullName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "Usuário";

        const email = user.email || "";

        const { data: createdProfile, error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: fullName,
            email,
            status: "ativo",
          })
          .select("id, full_name, email, status")
          .single();

        if (createProfileError || !createdProfile) {
          setErrorMessage("Não foi possível carregar seu perfil.");
          setLoading(false);
          return;
        }

        profileData = createdProfile;
      }

      setProfile(profileData);

      const { data: requestData } = await supabase
        .from("membership_requests")
        .select("id, status, review_notes, created_at")
        .or(`profile_id.eq.${profileData.id},email.eq.${profileData.email}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setRequest(requestData);

      const { data: associateData } = await supabase
        .from("associates")
        .select("id, status")
        .eq("email", profileData.email)
        .maybeSingle();

      setAssociate(associateData);

      setLoading(false);
    }

    loadArea();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-[#13233a]">
        <div className="rounded-3xl border border-[#e8dccb] bg-white p-8 shadow-sm">
          <p className="font-bold">Carregando sua área...</p>
        </div>
      </main>
    );
  }

  const isApprovedRequest = request?.status === "aprovada";
  const hasNoRequest = !request;
  const isActiveAssociate =
    associate?.status === "ativo" && (isApprovedRequest || hasNoRequest);

  return (
    <AreaLayout
      userName={profile?.full_name}
      userEmail={profile?.email}
      requestStatus={request?.status}
      isAssociate={isActiveAssociate}
    >
      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {children}
    </AreaLayout>
  );
}
