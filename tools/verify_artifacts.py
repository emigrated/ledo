#!/usr/bin/env python3
"""Verify presence of required Wave 1-3 artifacts as defined by Artifact_Spec.yaml.

This script is a lightweight, non-destructive checker that ensures all declared
artifacts exist in the repository before patch packaging or execution planning.
"""
import os, sys, re

ARTIFACT_SPEC = os.path.join('artifacts', 'Artifact_Spec.yaml')

def parse_artifact_spec(path: str):
    required = []
    if not os.path.exists(path):
        print(f"Artifact spec not found at {path}", file=sys.stderr)
        return required
    with open(path, 'r') as f:
        for line in f:
            m = re.match(r'^\s*-\s+(.+)$', line)
            if m:
                required.append(m.group(1).strip())
    return required

def map_to_path(name: str):
    mapping = {
        "Runbook 3.1": "Runbooks/Runbook_3.1.md",
        "Runbook 3.2": "Runbooks/Runbook_3.2.md",
        "Runbook 3.3": "Runbooks/Runbook_3.3.md",
        "Runbook 3.4": "Runbooks/Runbook_3.4.md",
        "Runbook 3.5": "Runbooks/Runbook_3.5.md",
        "StartWork_Entrypoint.md": "StartWork_Entrypoint.md",
        "Vault_Runtime_Injection_Plan.md": "Vault_Runtime_Injection_Plan.md",
        "Evidence_Metadata_Schema.md": "Evidence_Metadata_Schema.md",
        "Wave1_Results.yaml": "Wave1_Results.yaml",
        "Wave1_TestReport.json": "Wave1_TestReport.json",
        "Wave1_CodeCoverage.csv": "Wave1_CodeCoverage.csv",
        "Wave1_Evidence_Log.txt": "Wave1_Evidence_Log.txt",
        "Wave3_Evidence_Log.txt": "Wave3_Evidence_Log.txt",
        "Final_Verification_Report.md": "Final_Verification_Report.md",
        "Verification_Ledger.xlsx": "Verification_Ledger.xlsx",
    }
    return mapping.get(name)

def main():
    required = parse_artifact_spec(ARTIFACT_SPEC)
    missing = []
    for name in required:
        path = map_to_path(name)
        if not path or not os.path.exists(path):
            missing.append((name, path))
    if missing:
        print("Missing required artifacts:")
        for name, path in missing:
            print(f"- {name} -> expected at {path or 'UNKNOWN'}")
        sys.exit(2)
    print("All required artifacts present.")
    sys.exit(0)

if __name__ == '__main__':
    main()
