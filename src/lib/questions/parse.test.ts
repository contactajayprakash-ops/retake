import { describe, expect, it } from "vitest";
import { parseQuestions } from "./parse";

describe("parseQuestions", () => {
  it("reads a classic packet with parenthesised choices and an answer key", () => {
    const text = `AP Biology Unit 2 Review
Directions: Choose the best answer for each question.

1. Which organelle is the site of ATP synthesis in eukaryotic cells?
(A) Ribosome
(B) Mitochondrion
(C) Golgi apparatus
(D) Lysosome

2. Water moves across a membrane from a region of
(A) high solute concentration to low solute concentration
(B) low water potential to high water potential
(C) high water potential to low water potential
(D) low pressure to high pressure

Page 1 of 3

Answer Key
1. B
2. C`;
    const r = parseQuestions(text);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].stem).toBe("Which organelle is the site of ATP synthesis in eukaryotic cells?");
    expect(r.questions[0].choices.map((c) => c.text)).toEqual(["Ribosome", "Mitochondrion", "Golgi apparatus", "Lysosome"]);
    expect(r.questions[0].answer).toBe("B");
    expect(r.questions[1].answer).toBe("C");
    expect(r.keyedAnswers).toBe(2);
    expect(r.questions[1].warnings).toEqual([]);
  });

  it("handles choices on one line and a hyphenated key", () => {
    const text = `3) The pH of a solution with [H+] = 1 x 10^-4 M is A. 4 B. 10 C. -4 D. 14
4) Which bond holds water molecules to each other? A. covalent B. hydrogen C. ionic D. peptide

1-C, 2-A, 3-A, 4-B`;
    const r = parseQuestions(text);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].number).toBe(3);
    expect(r.questions[0].choices.map((c) => c.text)).toEqual(["4", "10", "-4", "14"]);
    expect(r.questions[0].answer).toBe("A");
    expect(r.questions[1].answer).toBe("B");
  });

  it("reads AP Classroom style printouts where the letter sits alone on a line", () => {
    const text = `Question 1
A student measures the rate of photosynthesis at several light intensities. Which of the following best explains the plateau at high intensity?
A
The light-dependent reactions are saturated.
B
Chlorophyll is destroyed by bright light.
C
The Calvin cycle stops.
D
Water becomes limiting.

Question 2
Which molecule carries energy from the light reactions to the Calvin cycle?
A
Glucose
B
Oxygen
C
ATP
D
Pyruvate`;
    const r = parseQuestions(text);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].choices[0].text).toBe("The light-dependent reactions are saturated.");
    expect(r.questions[1].choices[2].text).toBe("ATP");
    expect(r.questions[0].answer).toBeNull();
    expect(r.questions[0].warnings).toContain("No correct answer found. Pick one.");
  });

  it("takes inline Answer: lines and strips explanations", () => {
    const text = `1. Enzymes speed up reactions by
a) raising the activation energy
b) lowering the activation energy
c) changing the equilibrium
d) adding energy to the products
Answer: b
Explanation: Enzymes stabilise the transition state.

2. A starred choice marks the key
A. wrong
*B. right
C. wrong
D. wrong`;
    const r = parseQuestions(text);
    expect(r.questions[0].answer).toBe("B");
    expect(r.questions[0].choices[3].text).toBe("adding energy to the products");
    expect(r.questions[1].answer).toBe("B");
    expect(r.questions[1].choices[1].text).toBe("right");
  });

  it("ignores letters that are not a well ordered run of choices", () => {
    const text = `1. In the U.S. A. Lincoln is remembered for which of the following?
(A) The Louisiana Purchase
(B) The Emancipation Proclamation
(C) The New Deal
(D) The Monroe Doctrine`;
    const r = parseQuestions(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].choices).toHaveLength(4);
    expect(r.questions[0].stem).toContain("Lincoln");
  });

  it("does not treat decimal numbers as question starts", () => {
    const text = `1. A solution contains
3.5 moles of NaCl in 2 L. What is the molarity?
A. 1.75 M
B. 7 M
C. 0.57 M
D. 3.5 M`;
    const r = parseQuestions(text);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].stem).toBe("A solution contains 3.5 moles of NaCl in 2 L. What is the molarity?");
  });

  it("reports when nothing numbered is found", () => {
    const r = parseQuestions("Just some notes about mitochondria.");
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].number).toBeNull();
    expect(r.questions[0].warnings).toContain("Fewer than 2 answer choices found.");
  });
});
