import type { Question } from "./types";

/**
 * A short set for trying Retake without a PDF. Written for this project;
 * it covers the kind of cell-structure and transport content that shows up
 * on an AP Biology Unit 2 review.
 */
export const SAMPLE_TITLE = "AP Bio Unit 2 review (sample)";

const raw: Array<[string, string[], number]> = [
  ["Which organelle is the main site of ATP production in a eukaryotic cell?", ["Ribosome", "Mitochondrion", "Golgi apparatus", "Lysosome"], 1],
  ["A cell is placed in a solution and swells. Compared with the cell, the solution is", ["hypertonic", "isotonic", "hypotonic", "saturated"], 2],
  [
    "Which of the following moves across the membrane without a transport protein?",
    ["Glucose", "Sodium ions", "Oxygen", "Amino acids"],
    2,
  ],
  ["Why do small cells exchange materials with their surroundings more efficiently than large cells?", ["They have more organelles", "Their surface area to volume ratio is higher", "Their membranes are thinner", "They contain less water"], 1],
  ["Which structure is found in plant cells but not in animal cells?", ["Mitochondrion", "Plasma membrane", "Cell wall", "Nucleus"], 2],
  ["The sodium-potassium pump is an example of", ["simple diffusion", "facilitated diffusion", "osmosis", "active transport"], 3],
  ["Proteins destined for secretion are first assembled on ribosomes attached to the", ["smooth ER", "rough ER", "Golgi apparatus", "nuclear envelope"], 1],
  [
    "Water potential of pure water at atmospheric pressure is",
    ["positive", "negative", "zero", "undefined"],
    2,
  ],
  ["Which best describes the fluid mosaic model?", ["A rigid bilayer of proteins", "A flexible phospholipid bilayer with embedded proteins", "A single layer of lipids", "A wall of cellulose fibres"], 1],
  ["Aquaporins increase the rate of", ["ion transport", "protein synthesis", "water movement", "ATP hydrolysis"], 2],
  ["Which organelle breaks down worn-out cell parts?", ["Lysosome", "Peroxisome", "Vacuole", "Centrosome"], 0],
  ["Endosymbiotic theory is supported by the observation that mitochondria", ["have a single membrane", "lack ribosomes", "contain their own circular DNA", "are found only in plants"], 2],
];

export const SAMPLE_QUESTIONS: Question[] = raw.map(([stem, choices, answer], i) => ({
  id: `q${i + 1}`,
  number: i + 1,
  stem,
  choices: choices.map((text, j) => ({ key: "ABCD"[j] as "A" | "B" | "C" | "D", text })),
  answer: "ABCD"[answer] as "A" | "B" | "C" | "D",
  warnings: [],
}));
