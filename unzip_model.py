import zipfile
import os

zip_path = 'MindGuard_Models-20260121T040644Z-1-001.zip'
extract_to = 'model_artifacts'

if not os.path.exists(zip_path):
    print(f"Error: Zip file not found at {zip_path}")
    exit(1)

os.makedirs(extract_to, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_to)

print(f"Successfully extracted to: {os.path.abspath(extract_to)}")
print("Files extracted:")
for root, dirs, files in os.walk(extract_to):
    for file in files:
        print(f" - {file}")
