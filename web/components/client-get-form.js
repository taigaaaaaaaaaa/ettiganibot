"use client";

import { useRouter } from "next/navigation";

export default function ClientGetForm({ action, children, className, style }) {
  const router = useRouter();

  function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.append(key, value);
    }

    const query = params.toString();
    router.push(query ? `${action}?${query}` : action);
  }

  return (
    <form action={action} className={className} onSubmit={submit} style={style}>
      {children}
    </form>
  );
}
