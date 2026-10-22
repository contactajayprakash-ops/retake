"""Builds a practice-test PDF that looks like a teacher's review packet, for
trying the upload flow and for the demo. Questions mirror the bundled sample
set so the parsed result can be checked against a known answer."""

import json
import subprocess
import sys

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

# Pull the questions out of sample.ts with node so there is one source of truth.
node = """
const fs=require('fs');const src=fs.readFileSync('src/lib/questions/sample.ts','utf8');
const m=src.match(/const raw[^=]*=\\s*(\\[[\\s\\S]*?\\n\\]);/);
const raw=eval(m[1]);console.log(JSON.stringify(raw));
"""
raw = json.loads(subprocess.check_output(["node", "-e", node], text=True))

out = sys.argv[1] if len(sys.argv) > 1 else "public/AP-Bio-Unit-2-Practice-Test.pdf"
doc = SimpleDocTemplate(out, pagesize=letter, leftMargin=1 * inch, rightMargin=1 * inch, topMargin=0.9 * inch, bottomMargin=0.9 * inch,
                        title="AP Biology Unit 2 Practice Test", author="Retake sample")

title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=10.5, leading=14, spaceAfter=14)
q = ParagraphStyle("q", fontName="Times-Roman", fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=3)
c = ParagraphStyle("c", fontName="Times-Roman", fontSize=11.5, leading=15, leftIndent=22)
key = ParagraphStyle("key", fontName="Times-Roman", fontSize=11.5, leading=16)

story = [
    Paragraph("AP Biology — Unit 2 Practice Test", title),
    Paragraph("Cell Structure and Function · Membrane Transport<br/>"
              "Directions: Each of the questions below is followed by four suggested answers. "
              "Select the one that is best in each case. Mark your answer on the answer sheet.", sub),
]
for i, (stem, choices, _) in enumerate(raw, start=1):
    story.append(Paragraph(f"{i}. {stem}", q))
    for letter_, text in zip("ABCD", choices):
        story.append(Paragraph(f"({letter_}) {text}", c))
    if i == 7:
        story.append(PageBreak())

story += [PageBreak(), Paragraph("Answer Key", title), Spacer(1, 6)]
for i, (_, _, ans) in enumerate(raw, start=1):
    story.append(Paragraph(f"{i}. {'ABCD'[ans]}", key))

doc.build(story)
print("wrote", out, "with", len(raw), "questions")
