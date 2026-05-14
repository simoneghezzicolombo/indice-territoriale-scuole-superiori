from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(args: list[str]) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full reproducible school-index pipeline.")
    parser.add_argument("--skip-docente", action="store_true", help="Reuse existing Docente CSV inputs.")
    parser.add_argument("--workers-docente", type=int, default=4)
    parser.add_argument("--workers-eduscopio", type=int, default=6)
    parser.add_argument("--delay-docente", type=float, default=0.05)
    parser.add_argument("--delay-eduscopio", type=float, default=0.02)
    parser.add_argument("--range-km", type=int, default=30)
    parser.add_argument("--refresh-docente", action="store_true")
    parser.add_argument("--strict-validate", action="store_true")
    args = parser.parse_args()

    if not args.skip_docente:
        docente_cmd = [
            sys.executable,
            "scripts/scrape_docente_italia_superiori.py",
            "--workers",
            str(args.workers_docente),
            "--delay",
            str(args.delay_docente),
        ]
        if args.refresh_docente:
            docente_cmd.append("--refresh")
        run(docente_cmd)

    run(
        [
            sys.executable,
            "scripts/build_docente_eduscopio_fair_index.py",
            "--benchmark-input",
            "output/docente_italia_comuni_superiori_completi.csv",
            "--target-input",
            "output/docente_italia_comuni_superiori_completi.csv",
            "--range-km",
            str(args.range_km),
            "--workers",
            str(args.workers_eduscopio),
            "--delay",
            str(args.delay_eduscopio),
        ]
    )
    run([sys.executable, "scripts/make_subrankings.py"])

    validate = [sys.executable, "scripts/validate_outputs.py"]
    if args.strict_validate:
        validate.append("--strict")
    run(validate)


if __name__ == "__main__":
    main()
