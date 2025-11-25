#!/usr/bin/env python3
"""
Sync Employee Directory CSV → BigQuery
=====================================

This utility treats `Employee Directory __ Vyro - V1 - Employees Data.csv`
as the source of truth for employee statuses (including re-joins) and pushes
both the latest snapshot and the full re-join history to BigQuery tables.

* Canonical statuses are normalised to `Active` or `Resigned/Terminated`.
* Duplicate IDs (re-joins) are ordered by Joining Date to build a timeline.
* Missing IDs receive deterministic TEMP identifiers so that the history
  table can track them until an official ID is issued.
* Two tables are updated:
    - EmployeeDirectoryLatest_v1   → one row per employee (current status)
    - EmployeeDirectoryHistory_v1  → one row per record in the CSV

Usage:
    GOOGLE_APPLICATION_CREDENTIALS=Credentials/test-imagine-web-18d4f9a43aef.json \\
    python3 sync_employee_directory_csv.py

Author: AI Assistant
Date: 18-Nov-2025
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from collections import defaultdict
import json
from pathlib import Path
from typing import Optional

import pandas as pd
from google.cloud import bigquery

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "Employee Directory __ Vyro - V1 - Employees Data.csv"
SCHEMA_MAP_PATH = BASE_DIR / "EmployeeData" / "employee_directory_column_map.json"

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.environ.get("BQ_DATASET", "Vyro_Business_Paradox")
LATEST_TABLE = os.environ.get("BQ_DIRECTORY_TABLE", "EmployeeDirectoryLatest_v1")
HISTORY_TABLE = os.environ.get("BQ_HISTORY_TABLE", "EmployeeDirectoryHistory_v1")


STATUS_MAP = {
    "active": "Active",
    "current": "Active",
    "inactive": "Resigned/Terminated",
    "terminated": "Resigned/Terminated",
    "resigned": "Resigned/Terminated",
    "former": "Resigned/Terminated",
    "exit": "Resigned/Terminated",
}


@dataclass
class Config:
    csv_path: Path = CSV_PATH
    project_id: str = PROJECT_ID
    dataset_id: str = DATASET_ID
    latest_table: str = LATEST_TABLE
    history_table: str = HISTORY_TABLE

    @property
    def latest_ref(self) -> str:
        return f"{self.project_id}.{self.dataset_id}.{self.latest_table}"

    @property
    def history_ref(self) -> str:
        return f"{self.project_id}.{self.dataset_id}.{self.history_table}"


def normalise_status(value: Optional[str]) -> str:
    if not value or str(value).strip() == "":
        return "Active"
    key = str(value).strip().lower()
    return STATUS_MAP.get(key, "Active" if "active" in key else "Resigned/Terminated")


def clean_employee_id(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if text.endswith(".0"):
        text = text[:-2]
    return text


def parse_join_date(value):
    if pd.isna(value) or value == "":
        return pd.NaT
    return pd.to_datetime(value, errors="coerce")


DATE_COLUMNS = [
    "Joining Date",
    "Probation End Date",
    "Employment End Date",
    "Date of Birth",
    "Spouse DOB",
]


def sanitize_column(name: str) -> str:
    sanitized = name.strip()
    replacements = {
        " ": "_",
        "/": "_",
        "-": "_",
        "(": "",
        ")": "",
        ".": "_",
        "&": "and",
    }
    for old, new in replacements.items():
        sanitized = sanitized.replace(old, new)
    sanitized = "".join(ch for ch in sanitized if ch.isalnum() or ch == "_")
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    if sanitized and sanitized[0].isdigit():
        sanitized = f"C_{sanitized}"
    return sanitized or "Column"


def build_column_mapping(columns: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    usage: defaultdict[str, int] = defaultdict(int)
    for col in columns:
        base = sanitize_column(col)
        usage[base] += 1
        candidate = base if usage[base] == 1 else f"{base}_{usage[base]}"
        mapping[col] = candidate
    return mapping


def add_iso_columns(df: pd.DataFrame, column_mapping: dict[str, str]) -> None:
    for original in DATE_COLUMNS:
        sanitized = column_mapping.get(original)
        if not sanitized or sanitized not in df.columns:
            continue
        iso_col = f"{sanitized}_ISO"
        df[iso_col] = pd.to_datetime(df[sanitized], errors="coerce").dt.strftime("%Y-%m-%d")


def load_csv(path: Path) -> tuple[pd.DataFrame, dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Source CSV not found: {path}")
    df = pd.read_csv(path)
    column_mapping = build_column_mapping(list(df.columns))
    df = df.rename(columns=column_mapping)

    with SCHEMA_MAP_PATH.open("w") as fh:
        json.dump({sanitized: original for original, sanitized in column_mapping.items()}, fh, indent=2)

    id_col = column_mapping.get("ID", "ID")
    df[id_col] = df[id_col].apply(clean_employee_id)
    df["Employee_ID"] = df[id_col]
    df["Employee_ID"] = df.apply(
        lambda row: f"TEMP-{int(row.name)+1:04d}" if row["Employee_ID"] == "" else row["Employee_ID"],
        axis=1,
    )

    add_iso_columns(df, column_mapping)

    status_columns = [
        column_mapping.get("Status.1"),
        column_mapping.get("Status"),
    ]
    status_columns = [col for col in status_columns if col]

    def pick_status(row):
        for col in status_columns:
            if col in row and pd.notna(row[col]) and str(row[col]).strip():
                return row[col]
        return None

    df["Status_Raw"] = df.apply(pick_status, axis=1)
    df["Employment_Status"] = df["Status_Raw"].apply(normalise_status)
    df["Record_Source"] = path.name
    name_col = column_mapping.get("Name", "Name")
    df["Full_Name"] = df[name_col]
    return df, column_mapping


def build_history(df: pd.DataFrame, column_mapping: dict[str, str]) -> pd.DataFrame:
    join_col = column_mapping.get("Joining Date", column_mapping.get("Joining_Date"))
    history = df.copy()
    history["_join_order"] = pd.to_datetime(history[join_col], errors="coerce")
    history["_join_order"] = history["_join_order"].fillna(pd.Timestamp("1900-01-01"))
    history = history.sort_values(["Employee_ID", "_join_order", "Employment_Status"])
    history["Rejoin_Sequence"] = history.groupby("Employee_ID").cumcount() + 1
    history["Latest_Sequence"] = history.groupby("Employee_ID")["Rejoin_Sequence"].transform("max")
    history["Is_Current"] = history["Rejoin_Sequence"] == history["Latest_Sequence"]
    history["Record_UUID"] = history.apply(lambda row: f"{row.Employee_ID}-{row.Rejoin_Sequence}", axis=1)
    history = history.drop(columns=["_join_order"])
    return history


def build_latest(history: pd.DataFrame) -> pd.DataFrame:
    latest = history[history["Is_Current"]].copy()
    latest = latest.drop(columns=["Record_UUID"])
    latest = latest.drop(columns=["Is_Current"], errors="ignore")
    return latest


def load_to_bigquery(cfg: Config, latest: pd.DataFrame, history: pd.DataFrame):
    client = bigquery.Client(project=cfg.project_id)
    job_config = bigquery.LoadJobConfig(write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE)
    print(f"Uploading latest snapshot → {cfg.latest_ref} ({len(latest)} rows)")
    client.load_table_from_dataframe(latest, cfg.latest_ref, job_config=job_config).result()
    print(f"Uploading history → {cfg.history_ref} ({len(history)} rows)")
    client.load_table_from_dataframe(history, cfg.history_ref, job_config=job_config).result()
    print("✅ Sync complete")


def main():
    parser = argparse.ArgumentParser(description="Sync employee directory CSV to BigQuery")
    parser.add_argument("--csv", dest="csv_path", default=CSV_PATH, help="Path to CSV source file")
    args = parser.parse_args()
    cfg = Config(csv_path=Path(args.csv_path))

    df, column_mapping = load_csv(cfg.csv_path)
    history_df = build_history(df, column_mapping)
    latest_df = build_latest(history_df)
    load_to_bigquery(cfg, latest_df, history_df)


if __name__ == "__main__":
    main()


