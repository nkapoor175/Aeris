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
    print("HTAD-06 Anemia Detection — ML Training Pipeline v2")
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

    # FIX #1: Add Red/IR ratio as an engineered feature
    # This is the mathematical core of SpO2 estimation and dramatically
    # improves the model's ability to separate anemia classes.
    df['RedIR_ratio'] = df['Red'] / df['IR']

    class_counts = df['RiskLevel'].value_counts().sort_index()
    print(f"  Class distribution:")
    print(f"    LOW  (0 - Healthy):  {class_counts.get(0, 0)} samples")
    print(f"    MED  (1 - Anemic):   {class_counts.get(1, 0)} samples")
    print(f"    HIGH (2 - Severe):   {class_counts.get(2, 0)} samples")

    # Use Red, IR, and the ratio as features (3 inputs)
    X = df[['Red', 'IR', 'RedIR_ratio']]
    y = df['RiskLevel']

    # 3. Train Model
    print("\n[3/5] Training Decision Tree (improved)...")

    # FIX #2: Stratified split to maintain class proportions in both sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # FIX #3: class_weight='balanced' gives equal importance to rare classes
    # FIX #4: max_depth=7 allows slightly more complexity for 3 features
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
    for name, imp in zip(['Red', 'IR', 'RedIR_ratio'], clf.feature_importances_):
        print(f"    {name}: {imp:.3f}")
    print(f"  Tree node count: {clf.tree_.node_count}")

    # 5. Export to C++
    print("\n[5/5] Exporting trained model to C++...")
    c_code = port(clf, classname="AnemiaDecisionTree")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(OUTPUT_FILE, "w") as f:
        f.write(c_code)
    print(f"  Saved to: {OUTPUT_FILE}")

    # Also copy directly to HardwareTest folder
    with open(ESP_OUTPUT, "w") as f:
        f.write(c_code)
    print(f"  Copied to: {ESP_OUTPUT}")

    print("\n" + "=" * 60)
    print("DONE! Model trained and exported successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()
