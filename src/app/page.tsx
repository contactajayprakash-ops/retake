import type { Metadata } from "next";
import { Shell } from "@/components/ui";
import { Dropzone } from "./Dropzone";

export const metadata: Metadata = {
  title: "Retake · Practice test to live review game",
};

export default function HomePage() {
  return (
    <Shell>
      <section className="pt-6 sm:pt-12">
        <h1 className="display max-w-3xl text-[2.6rem] sm:text-6xl">
          Drop a practice test. Play it as a class. See what everyone missed.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-graphite">
          Retake reads the questions out of a PDF or pasted text, runs a live game your class joins from their phones,
          and ends with the list of questions the room actually got wrong.
        </p>
      </section>

      <section className="mt-10">
        <Dropzone />
      </section>

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="text-lg font-bold">1. Upload</h2>
          <p className="mt-1 text-graphite">
            A review packet, a released exam, screenshots turned into a PDF. Numbered questions with lettered choices are
            all it needs. An answer key at the end gets picked up automatically.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">2. Host from anything</h2>
          <p className="mt-1 text-graphite">
            Put the join code on the board. Phones, Chromebooks, no accounts, no app. Works on school wifi because
            every message is tiny.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">3. Study the misses</h2>
          <p className="mt-1 text-graphite">
            The game ends with a miss heatmap: which questions the room got wrong, and which wrong answer everyone fell
            for. That is your study list for the test.
          </p>
        </div>
      </section>
    </Shell>
  );
}
