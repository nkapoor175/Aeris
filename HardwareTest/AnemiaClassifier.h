#ifndef ANEMIA_CLASSIFIER_H
#define ANEMIA_CLASSIFIER_H

// Risk Level Constants
#define RISK_LOW    0  // Green LED
#define RISK_MEDIUM 1  // Yellow LED
#define RISK_HIGH   2  // Red LED

/**
 * Predicts the anemia/malnutrition risk level using the trained ML Decision Tree.
 * 
 * @param redValue The raw Red optical value from MAX30102
 * @param irValue The raw IR optical value from MAX30102
 * @return int The risk level (0: Low, 1: Medium, 2: High)
 */
int predictAnemiaRisk(float redValue, float irValue);

#endif
