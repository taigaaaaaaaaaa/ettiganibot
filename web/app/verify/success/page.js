import { VerificationMessage } from "@/components/verification-flow";

export const metadata = { title: "認証完了" };

export default async function VerificationSuccessPage({ searchParams }) {
  const params = await searchParams;
  return (
    <VerificationMessage
      guildId={typeof params.guild === "string" ? params.guild : ""}
      kind="success"
      logWarning={params.logWarning === "1"}
    />
  );
}
