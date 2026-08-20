/**
 * Faithful Node.js port of HardwareTest/AnemiaClassifier.cpp +
 * HardwareTest/AnemiaDecisionTree.h (Eloquent::ML::Port::AnemiaDecisionTree).
 *
 * This is a 1:1 structural port, not a reinterpretation: same 5-feature
 * vector [red, ir, redIrRatio, age, genderMale], the exact same threshold
 * constants (copied verbatim from the generated C++ tree), the exact same
 * branch structure, and the same 0/1/2 output mapping. Do not "simplify"
 * or re-derive the thresholds — if the model is retrained, regenerate this
 * file from the new AnemiaDecisionTree.h instead of hand-editing it.
 */

export const RISK_LOW = 0;
export const RISK_MEDIUM = 1;
export const RISK_HIGH = 2;

// Direct port of Eloquent::ML::Port::AnemiaDecisionTree::predict(float *x)
// x[0] = red, x[1] = ir, x[2] = redIrRatio, x[3] = age, x[4] = genderMale
function predictTree(x) {
  if (x[4] <= 0.5) {
    if (x[3] <= 44.5) {
      if (x[0] <= 104399.8984375) {
        if (x[2] <= 1.1125571131706238) {
          if (x[2] <= 1.0711936950683594) {
            return 0;
          } else {
            return 2;
          }
        } else {
          if (x[1] <= 69456.498046875) {
            return 0;
          } else {
            if (x[1] <= 75821.5) {
              return 1;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[3] <= 42.5) {
          if (x[3] <= 40.0) {
            if (x[0] <= 126786.0) {
              if (x[2] <= 1.0385342240333557) {
                return 1;
              } else {
                return 1;
              }
            } else {
              if (x[1] <= 109481.5) {
                return 0;
              } else {
                return 0;
              }
            }
          } else {
            if (x[2] <= 1.116475224494934) {
              return 0;
            } else {
              return 0;
            }
          }
        } else {
          return 2;
        }
      }
    } else {
      if (x[2] <= 1.0966391563415527) {
        if (x[0] <= 83984.94921875) {
          return 0;
        } else {
          if (x[3] <= 47.0) {
            return 0;
          } else {
            if (x[1] <= 87925.6484375) {
              return 1;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[2] <= 1.406266450881958) {
          return 0;
        } else {
          if (x[0] <= 102306.69921875) {
            return 1;
          } else {
            return 1;
          }
        }
      }
    }
  } else {
    if (x[2] <= 1.1973699927330017) {
      if (x[1] <= 62851.849609375) {
        return 0;
      } else {
        return 0;
      }
    } else {
      if (x[3] <= 43.0) {
        return 0;
      } else {
        if (x[1] <= 74911.84765625) {
          if (x[1] <= 69064.3984375) {
            return 1;
          } else {
            return 0;
          }
        } else {
          if (x[0] <= 90029.19921875) {
            return 1;
          } else {
            return 1;
          }
        }
      }
    }
  }
}

/**
 * Faithful port of predictAnemiaRisk(redValue, irValue, age, genderMale)
 * from AnemiaClassifier.cpp — same divide-by-zero safety check, same
 * feature vector construction, same tree, same 0/1/2 output.
 *
 * @param {number} redValue    Raw Red optical value from MAX30102
 * @param {number} irValue     Raw IR optical value from MAX30102
 * @param {number} age         Patient age in years
 * @param {number} genderMale  0 = Female, 1 = Male
 * @returns {number} risk level (0: Low, 1: Medium, 2: High)
 */
export function predictAnemiaRisk(redValue, irValue, age, genderMale) {
  if (irValue <= 0) {
    return RISK_HIGH; // matches C++ safety check: avoid divide-by-zero on bad sensor data
  }

  const redIrRatio = redValue / irValue;
  const features = [redValue, irValue, redIrRatio, age, genderMale];
  return predictTree(features);
}
