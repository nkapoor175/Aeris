#pragma once
#include <cstdarg>
namespace Eloquent {
    namespace ML {
        namespace Port {
            class AnemiaDecisionTree {
                public:
                    /**
                    * Predict class for features vector
                    */
                    int predict(float *x) {
                        if (x[4] <= 0.5) {
                            if (x[3] <= 44.5) {
                                if (x[0] <= 104399.8984375) {
                                    if (x[2] <= 1.1125571131706238) {
                                        if (x[2] <= 1.0711936950683594) {
                                            return 0;
                                        }

                                        else {
                                            return 2;
                                        }
                                    }

                                    else {
                                        if (x[1] <= 69456.498046875) {
                                            return 0;
                                        }

                                        else {
                                            if (x[1] <= 75821.5) {
                                                return 1;
                                            }

                                            else {
                                                return 1;
                                            }
                                        }
                                    }
                                }

                                else {
                                    if (x[3] <= 42.5) {
                                        if (x[3] <= 40.0) {
                                            if (x[0] <= 126786.0) {
                                                if (x[2] <= 1.0385342240333557) {
                                                    return 1;
                                                }

                                                else {
                                                    return 1;
                                                }
                                            }

                                            else {
                                                if (x[1] <= 109481.5) {
                                                    return 0;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }
                                        }

                                        else {
                                            if (x[2] <= 1.116475224494934) {
                                                return 0;
                                            }

                                            else {
                                                return 0;
                                            }
                                        }
                                    }

                                    else {
                                        return 2;
                                    }
                                }
                            }

                            else {
                                if (x[2] <= 1.0966391563415527) {
                                    if (x[0] <= 83984.94921875) {
                                        return 0;
                                    }

                                    else {
                                        if (x[3] <= 47.0) {
                                            return 0;
                                        }

                                        else {
                                            if (x[1] <= 87925.6484375) {
                                                return 1;
                                            }

                                            else {
                                                return 1;
                                            }
                                        }
                                    }
                                }

                                else {
                                    if (x[2] <= 1.406266450881958) {
                                        return 0;
                                    }

                                    else {
                                        if (x[0] <= 102306.69921875) {
                                            return 1;
                                        }

                                        else {
                                            return 1;
                                        }
                                    }
                                }
                            }
                        }

                        else {
                            if (x[2] <= 1.1973699927330017) {
                                if (x[1] <= 62851.849609375) {
                                    return 0;
                                }

                                else {
                                    return 0;
                                }
                            }

                            else {
                                if (x[3] <= 43.0) {
                                    return 0;
                                }

                                else {
                                    if (x[1] <= 74911.84765625) {
                                        if (x[1] <= 69064.3984375) {
                                            return 1;
                                        }

                                        else {
                                            return 0;
                                        }
                                    }

                                    else {
                                        if (x[0] <= 90029.19921875) {
                                            return 1;
                                        }

                                        else {
                                            return 1;
                                        }
                                    }
                                }
                            }
                        }
                    }

                protected:
                };
            }
        }
    }