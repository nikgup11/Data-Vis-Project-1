import pandas as pd

# 1. Load all three datasets
co2_df = pd.read_csv('owid-co2-data.csv')
gdp_df = pd.read_csv('gdp-per-capita-worldbank.csv')
renew_df = pd.read_csv('renewable-energy-data.csv')

# 2. Standardize CO2 dataset columns
co2_df_cleaned = co2_df.rename(columns={
    'country': 'Entity',
    'year': 'Year',
    'iso_code': 'Code'
})
co2_subset = co2_df_cleaned[['Entity', 'Year', 'Code', 'co2_per_capita']]

# 3. Standardize Renewable Energy dataset columns
renew_df_cleaned = renew_df.rename(columns={
    'country': 'Entity',
    'year': 'Year',
    'iso_code': 'Code'
})
# Extract the relevant renewable energy attributes for the project
renew_subset = renew_df_cleaned[['Entity', 'Year', 'Code', 'renewables_energy_per_capita', 'renewables_share_energy']]

# --- MERGE 1: CO2 Emissions + Renewable Energy ---
merged_co2_renew = pd.merge(co2_subset, renew_subset, on=['Entity', 'Year', 'Code'], how='inner')
# Clean out rows missing either metric
merged_co2_renew = merged_co2_renew.dropna(subset=['co2_per_capita', 'renewables_energy_per_capita'])
merged_co2_renew.to_csv('merged_co2_renewable.csv', index=False)
print(f"Created merged_co2_renewable.csv with {len(merged_co2_renew)} rows.")

# --- MERGE 2: GDP per capita + Renewable Energy ---
merged_gdp_renew = pd.merge(gdp_df, renew_subset, on=['Entity', 'Year', 'Code'], how='inner')
# Clean out rows missing either metric
merged_gdp_renew = merged_gdp_renew.dropna(subset=['GDP per capita', 'renewables_energy_per_capita'])
merged_gdp_renew.to_csv('merged_gdp_renewable.csv', index=False)
print(f"Created merged_gdp_renewable.csv with {len(merged_gdp_renew)} rows.")

# --- MERGE 3: ALL 3 INDICATORS ---
# Merging the already combined CO2/Renewable df with the GDP df
merged_all = pd.merge(merged_co2_renew, gdp_df, on=['Entity', 'Year', 'Code'], how='inner')
merged_all = merged_all.dropna(subset=['co2_per_capita', 'renewables_energy_per_capita', 'GDP per capita'])
merged_all.to_csv('merged_all_indicators.csv', index=False)
print(f"Created merged_all_indicators.csv with {len(merged_all)} rows.")
