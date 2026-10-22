import type { Metadata } from "next";
import { Shell } from "@/components/ui";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Join a game" };

export default function JoinPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-md pt-10">
        <h1 className="display text-4xl">Join a game</h1>
        <p className="mt-3 text-graphite">Type the six-letter code from the board.</p>
        <JoinForm />
      </div>
    </Shell>
  );
}
