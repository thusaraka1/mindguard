import pandas as pd
import os

file_path = 'mental_health_iot_dataset_2500.csv.xlsx'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

try:
    # Try reading as Excel
    df = pd.read_excel(file_path)
    print("Successfully read as Excel.")
except Exception as e:
    print(f"Failed to read as Excel: {e}")
    try:
        # Try reading as CSV despite extension
        df = pd.read_csv(file_path)
        print("Successfully read as CSV.")
    except Exception as e2:
        print(f"Failed to read as CSV: {e2}")
        exit(1)

print("\n--- Columns ---")
print(df.columns.tolist())

print("\n--- Data Types ---")
print(df.dtypes)

print("\n--- First 5 Rows ---")
print(df.head())

print("\n--- Description ---")
print(df.describe())
