#ifndef ANEMIA_CLASSIFIER_H
#define ANEMIA_CLASSIFIER_H

// Risk Level Constants
#define RISK_LOW    0  // Green LED
#define RISK_MEDIUM 1  // Yellow LED
#define RISK_HIGH   2  // Red LED

// Gender Constants (for readability in calling code)
#define GENDER_FEMALE 0
#define GENDER_MALE   1

/**
 * Predicts the anemia/malnutrition risk level using the trained ML Decision Tree (v3).
 * Now includes Age and Gender for clinically accurate predictions.
 * 
 * @param redValue   The raw Red optical value from MAX30102
 * @param irValue    The raw IR optical value from MAX30102
 * @param age        Patient age in years (18-64 in training data)
 * @param genderMale 0 = Female, 1 = Male
 * @return int       The risk level (0: Low, 1: Medium, 2: High)
 */
int predictAnemiaRisk(float redValue, float irValue, int age, int genderMale);

#endif
