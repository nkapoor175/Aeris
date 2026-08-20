#include "AnemiaClassifier.h"
#include "AnemiaDecisionTree.h"

int predictAnemiaRisk(float redValue, float irValue) {
  // -------------------------------------------------------------------------
  // MACHINE LEARNING MODEL LOGIC (v2 - Improved)
  // This uses the Decision Tree trained on the Hb PPG dataset.
  // We feed it raw Red, IR, AND the Red/IR ratio for 97% accuracy.
  // -------------------------------------------------------------------------
  
  // Safety check: avoid division by zero if sensor gives bad data
  if (irValue <= 0.0f) {
    return RISK_HIGH; // Assume worst case on bad reading
  }

  // Compute the Red/IR ratio — the most important feature (47% importance)
  // This is the mathematical basis of SpO2 estimation
  float redIR_ratio = redValue / irValue;

  // Instantiate the generated ML model
  Eloquent::ML::Port::AnemiaDecisionTree clf;
  
  // Format the inputs exactly as the model expects: [Red, IR, RedIR_ratio]
  float features[3] = { redValue, irValue, redIR_ratio };
  
  // Predict and return the Risk Level (0: Green, 1: Yellow, 2: Red)
  return clf.predict(features);
}
