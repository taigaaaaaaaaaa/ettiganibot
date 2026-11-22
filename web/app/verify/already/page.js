import { VerificationMessage } from "@/components/verification-flow";

export const metadata = { title: "認証済み" };

export default async function AlreadyVerifiedPage({ searchParams }) {
  const params = await searchParams;
  return (
    <VerificationMessage
      guildId={typeof params.guild === "string" ? params.guild : ""}
      kind="already"
    />
  );
}
