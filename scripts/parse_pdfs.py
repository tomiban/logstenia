#!/usr/bin/env python3
"""Extrae texto de los PDFs a scripts/output/<name>.txt para curación manual."""
import subprocess, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = ROOT
OUT = os.path.join(ROOT, "scripts", "output")
os.makedirs(OUT, exist_ok=True)

for pdf in sorted(glob.glob(os.path.join(PDF_DIR, "*.pdf"))):
    name = os.path.splitext(os.path.basename(pdf))[0]
    out = os.path.join(OUT, name + ".txt")
    subprocess.run(["pdftotext", "-layout", pdf, out], check=False)
    print("extracted", name, "->", out)
print("done")