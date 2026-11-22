import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TermsConsent } from "@/components/verification-flow";
import { getTermsSession } from "@/lib/verification";
import { createVerificationRequestId, logVerificationEvent } from "@/lib/verification-internal";

export const dynamic = "force-dynamic";
export const metadata = { title: "サーバー規約への同意" };

export default async function VerificationTermsPage() {
  const requestId = createVerificationRequestId();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("ettigani_verify_session")?.value;
  let session;
  try {
    session = getTermsSession(sessionCookie);
  } catch (error) {
    logVerificationEvent("error", "terms.session_lookup_failed", {
      requestId,
      sessionCookiePresent: Boolean(sessionCookie),
      error: error.message,
      errorCode: error.code || null,
    });
    redirect("/verify/error?reason=database_error");
  }
  if (!session) {
    logVerificationEvent("error", "terms.session_missing_or_expired", {
      requestId,
      sessionCookiePresent: Boolean(sessionCookie),
    });
    redirect("/verify/error?reason=invalid_state");
  }
  logVerificationEvent("info", "terms.session_validated", {
    requestId,
    guildId: session.guild_id,
    userId: session.user_id,
  });
  return <TermsConsent username={session.username} />;
}
