import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from micromlgen import port
import os

# Define paths
DATA_PATH = r"C:\Users\ADMIN\Desktop\Healthcare\datasets\Hemoglobin Photoplethysmography Dataset\Dataset Hb PPG.csv"
OUTPUT_DIR = r"C:\Users\ADMIN\Desktop\Healthcare\ML_Model"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "AnemiaDecisionTree.h")
ESP_OUTPUT = r"C:\Users\ADMIN\Desktop\Healthcare\HardwareTest\AnemiaDecisionTree.h"

def main():
    print("=" * 60)
    print("HTAD-06 Anemia Detection — ML Training Pipeline v3")
    print("Now with Age & Gender for clinical accuracy!")
    print("=" * 60)

    # 1. Load & Inspect
    print("\n[1/5] Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"  Total rows: {len(df)}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Null values: {df.isnull().sum().sum()}")

    # 2. Preprocessing & Feature Engineering
    print("\n[2/5] Preprocessing & Feature Engineering...")

    # Map Hemoglobin (Hb) to Risk Levels
    # Normal:               Hb >= 12.0 → Risk 0 (Green LED)
    # Mild/Moderate Anemia: 10.0 <= Hb < 12.0 → Risk 1 (Yellow LED)
    # Severe Anemia:        Hb < 10.0 → Risk 2 (Red LED)
    def get_risk_level(hb):
        if hb < 10.0:
            return 2
        elif hb < 12.0:
            return 1
        else:
            return 0

    df['RiskLevel'] = df['Hb'].apply(get_risk_level)

    # Feature 1: Red/IR ratio (core of SpO2 math, 30% importance)
    df['RedIR_ratio'] = df['Red'] / df['IR']

    # Feature 2: Gender as binary (0 = Female, 1 = Male)
    # Clinically important: normal Hb for females is ~12-16 g/dL,
    # for males it's ~14-18 g/dL. Same SpO2 reading means different
    # anemia risk depending on gender.
    df['Gender_M'] = (df['Gender'] == 'Male').astype(int)

    class_counts = df['RiskLevel'].value_counts().sort_index()
    print(f"  Class distribution:")
    print(f"    LOW  (0 - Healthy):  {class_counts.get(0, 0)} samples")
    print(f"    MED  (1 - Anemic):   {class_counts.get(1, 0)} samples")
    print(f"    HIGH (2 - Severe):   {class_counts.get(2, 0)} samples")
    print(f"  Gender: {df['Gender'].value_counts().to_dict()}")
    print(f"  Age range: {df['Age'].min()} - {df['Age'].max()}")

    # 5 features: Red, IR, RedIR_ratio, Age, Gender_M
    FEATURE_NAMES = ['Red', 'IR', 'RedIR_ratio', 'Age', 'Gender_M']
    X = df[FEATURE_NAMES]
    y = df['RiskLevel']

    # 3. Train Model
    print("\n[3/5] Training Decision Tree (v3 with demographics)...")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = DecisionTreeClassifier(
        max_depth=7,
        class_weight='balanced',
        random_state=42
    )
    clf.fit(X_train, y_train)

    # 4. Evaluate
    print("\n[4/5] Evaluating model...")
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n  Overall Accuracy: {acc * 100:.2f}%")
    print(f"\n  Per-class Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=['LOW (Healthy)', 'MEDIUM (Anemic)', 'HIGH (Severe)'],
        zero_division=0
    ))
    print(f"  Feature Importances:")
    for name, imp in zip(FEATURE_NAMES, clf.feature_importances_):
        print(f"    {name}: {imp:.3f}")
    print(f"  Tree node count: {clf.tree_.node_count}")

    # 5. Export to C++
    print("\n[5/5] Exporting trained model to C++...")
    c_code = port(clf, classname="AnemiaDecisionTree")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(OUTPUT_FILE, "w") as f:
        f.write(c_code)
    print(f"  Saved to: {OUTPUT_FILE}")

    with open(ESP_OUTPUT, "w") as f:
        f.write(c_code)
    print(f"  Copied to: {ESP_OUTPUT}")

    print("\n" + "=" * 60)
    print("DONE! v3 Model (5 features) trained and exported.")
    print(f"Features order: {FEATURE_NAMES}")
    print("ESP32 must pass: [Red, IR, RedIR_ratio, Age, Gender_M]")
    print("=" * 60)

if __name__ == "__main__":
    main()
