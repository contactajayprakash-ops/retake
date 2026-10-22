import { Suspense } from "react";
import { PlayScreen } from "./PlayScreen";

export default function PlayPage({ params }: PageProps<"/play/[code]">) {
  return (
    <Suspense fallback={<p className="p-6 text-graphite">Loading…</p>}>
      {params.then(({ code }) => (
        <PlayScreen code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
