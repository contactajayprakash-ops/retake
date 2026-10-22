import { Suspense } from "react";
import { HostScreen } from "./HostScreen";

export default function HostPage({ params }: PageProps<"/host/[code]">) {
  return (
    <Suspense fallback={<p className="p-8 text-graphite">Loading the game…</p>}>
      {params.then(({ code }) => (
        <HostScreen code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
