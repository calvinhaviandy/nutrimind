import os
import pandas as pd
from rapidfuzz import process, fuzz

DATA_DIR = "data"

_food_df = None
_food_names = None


def load_food_data():
    global _food_df, _food_names

    if _food_df is not None:
        return _food_df, _food_names

    dfs = []
    for file in os.listdir(DATA_DIR):
        if file.endswith(".csv"):
            df = pd.read_csv(os.path.join(DATA_DIR, file))
            df.columns = [c.strip().lower() for c in df.columns]
            dfs.append(df)

    _food_df = pd.concat(dfs, ignore_index=True)
    _food_df["food"] = _food_df["food"].astype(str).str.lower()
    _food_names = _food_df["food"].tolist()

    return _food_df, _food_names


def normalize_row(row):
    """
    Convert pandas row → clean dict
    """
    data = {}
    for k, v in row.items():
        if pd.isna(v):
            data[k] = 0
        elif isinstance(v, (int, float)):
            data[k] = float(v)
        else:
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
