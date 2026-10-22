import { Suspense } from "react";
import { Shell } from "@/components/ui";
import { ResultsScreen } from "./ResultsScreen";

export default function ResultsPage({ params }: PageProps<"/results/[code]">) {
  return (
    <Shell wide>
      <Suspense fallback={<p className="pt-8 text-graphite">Loading results…</p>}>
        {params.then(({ code }) => (
          <ResultsScreen code={code.toUpperCase()} />
        ))}
      </Suspense>
    </Shell>
  );
}
