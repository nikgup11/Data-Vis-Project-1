import pandas as pd

# Load the datasets
temp_df = pd.read_csv("C:/Users/nikhi/School Work/Data Visualization/projects/Project 1/average-monthly-surface-temperature.filtered/average-monthly-surface-temperature.csv")
ph_df = pd.read_csv("C:/Users/nikhi/School Work/Data Visualization/projects/Project 1/seawater-ph/seawater-ph.csv")

# Inspect the first few rows and info for the temperature dataset
print("--- Temperature Dataset ---")
print(temp_df.head())
print(temp_df.info())
print(temp_df['Entity'].unique())

# Inspect the first few rows and info for the pH dataset
print("\n--- Seawater pH Dataset ---")
print(ph_df.head())
print(ph_df.info())
print(ph_df['Entity'].unique())

# 1. Load and Format
temp_df['Day'] = pd.to_datetime(temp_df['Day'])
ph_df['Day'] = pd.to_datetime(ph_df['Day'])

# 2. Aggregate pH to monthly mean
ph_monthly = ph_df.groupby(ph_df['Day'].dt.to_period('M'))['Monthly average'].mean().reset_index()
ph_monthly.columns = ['YearMonth', 'Seawater_pH']

# 3. Format Temperature
temp_df['YearMonth'] = temp_df['Day'].dt.to_period('M')
temp_subset = temp_df[['YearMonth', 'Monthly average']].rename(columns={'Monthly average': 'Surface_Temp_C'})

# 4. Merge
combined_df = pd.merge(temp_subset, ph_monthly, on='YearMonth', how='inner')
combined_df.to_csv('C:/Users/nikhi/School Work/Data Visualization/projects/Project 1/working_us_ocean_data.csv')