from pathlib import Path
import pandas as pd
from rapidfuzz import process, fuzz

DATA_DIR = Path(__file__).resolve().parent / "data"

_food_df = None
_food_names = None


def load_food_data():
    global _food_df, _food_names

    if _food_df is not None:
        return _food_df, _food_names

    dfs = []
    for file in DATA_DIR.iterdir():
        if file.suffix.lower() == ".csv":
            df = pd.read_csv(file)
            df.columns = [c.strip().lower() for c in df.columns]
            dfs.append(df)

    _food_df = pd.concat(dfs, ignore_index=True)
    _food_df["food"] = _food_df["food"].astype(str).str.lower()
    _food_names = _food_df["food"].tolist()

    return _food_df, _food_names


def normalize_row(row):
    data = {}
    for k, v in row.items():
        if pd.isna(v):
            data[k] = 0.0
        else:
            try:
                data[k] = float(v)
            except (ValueError, TypeError):
                data[k] = str(v)
    return data

def match_food(food_name: str, score_cutoff=75):
    df, names = load_food_data()

    match = process.extractOne(
        food_name.lower(),
        names,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=score_cutoff
    )

    if not match:
        return None

    matched_name = match[0]
    row = df[df["food"] == matched_name].iloc[0]

    return normalize_row(row)


def get_food_exact(food_name: str):
    """Look up one catalog food without substituting a different dish."""
    df, _ = load_food_data()
    rows = df[df["food"] == food_name.strip().lower()]
    if rows.empty:
        return None
    return normalize_row(rows.iloc[0])
