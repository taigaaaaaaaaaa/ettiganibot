import { VerificationStart } from "@/components/verification-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "サーバー認証" };

export default async function VerificationPage({ searchParams }) {
  const params = await searchParams;
  return (
    <VerificationStart
      guildId={typeof params.guild === "string" ? params.guild : ""}
      siteKey={process.env.TURNSTILE_SITE_KEY || ""}
    />
  );
}
