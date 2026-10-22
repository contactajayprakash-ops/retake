import { Suspense } from "react";
import { Shell } from "@/components/ui";
import { SetEditor } from "./SetEditor";

export default function SetPage({ params }: PageProps<"/sets/[id]">) {
  return (
    <Shell>
      <Suspense fallback={<p className="pt-8 text-graphite">Loading the set…</p>}>
        {params.then(({ id }) => (
          <SetEditor id={id} />
        ))}
      </Suspense>
    </Shell>
  );
}
