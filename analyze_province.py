import pandas as pd
import scipy.stats as stats

file_path = 'mental_health_iot_dataset_2500.csv.xlsx'

try:
    df = pd.read_excel(file_path)
except:
    df = pd.read_csv(file_path)

print("--- Unique Provinces ---")
print(df['Province'].unique())
print("\n--- Unique Mental States ---")
print(df['Mental_State_Label'].unique())

print("\n--- Cross Tabulation (Count) ---")
crosstab = pd.crosstab(df['Province'], df['Mental_State_Label'])
print(crosstab)

print("\n--- Cross Tabulation (Percentage within Province) ---")
# Show percentage to see if one province has a higher RATE of stress than others
crosstab_pct = pd.crosstab(df['Province'], df['Mental_State_Label'], normalize='index') * 100
print(crosstab_pct.round(2))

# Chi-Square Test
chi2, p, dof, expected = stats.chi2_contingency(crosstab)
print(f"\n--- Chi-Square Test Results ---")
print(f"Chi2: {chi2}")
print(f"P-value: {p}")
if p < 0.05:
    print("Conclusion: Statistically SIGNIFICANT relationship (Province might matter).")
else:
    print("Conclusion: NO statistically significant relationship (Province likely irrelevant).")
