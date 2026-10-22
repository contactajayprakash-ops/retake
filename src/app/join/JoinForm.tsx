"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "@/components/ui";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  return (
    <form
      className="mt-6 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 6) router.push(`/play/${clean}`);
      }}
    >
      <input
        className={`${inputClass} text-2xl uppercase tracking-[0.3em]`}
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC123"
        aria-label="Game code"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        autoFocus
      />
      <Button type="submit" size="lg" disabled={clean.length !== 6}>
        Go
      </Button>
    </form>
  );
}
