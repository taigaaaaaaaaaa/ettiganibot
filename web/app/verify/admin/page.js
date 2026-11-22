import { VerificationMessage } from "@/components/verification-flow";

export const metadata = { title: "管理者認証免除" };

export default async function VerificationAdminPage({ searchParams }) {
  const params = await searchParams;
  return (
    <VerificationMessage
      guildId={typeof params.guild === "string" ? params.guild : ""}
      kind="admin"
    />
  );
}
