import { VerificationError } from "@/components/verification-flow";

export const metadata = { title: "認証エラー" };

export default async function VerificationErrorPage({ searchParams }) {
  const params = await searchParams;
  return <VerificationError reason={typeof params.reason === "string" ? params.reason : ""} />;
}
