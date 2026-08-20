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
                        if (x[2] <= 1.1493759155273438) {
                            if (x[2] <= 1.0818556547164917) {
                                if (x[1] <= 83002.25) {
                                    return 0;
                                }

                                else {
                                    if (x[1] <= 88805.44921875) {
                                        return 1;
                                    }

                                    else {
                                        if (x[1] <= 108584.5) {
                                            if (x[2] <= 1.0651205778121948) {
                                                if (x[2] <= 0.9916947484016418) {
                                                    return 0;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }

                                            else {
                                                if (x[1] <= 100657.25) {
                                                    return 1;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }
                                        }

                                        else {
                                            if (x[0] <= 115595.8515625) {
                                                if (x[2] <= 0.9800862371921539) {
                                                    return 1;
                                                }

                                                else {
                                                    return 1;
                                                }
                                            }

                                            else {
                                                return 0;
                                            }
                                        }
                                    }
                                }
                            }

                            else {
                                if (x[2] <= 1.105643093585968) {
                                    if (x[0] <= 106808.296875) {
                                        if (x[1] <= 90493.1484375) {
                                            if (x[0] <= 93156.55078125) {
                                                if (x[1] <= 79745.59765625) {
                                                    return 0;
                                                }

                                                else {
                                                    return 2;
                                                }
                                            }

                                            else {
                                                if (x[2] <= 1.094111979007721) {
                                                    return 1;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }
                                        }

                                        else {
                                            if (x[2] <= 1.0821773409843445) {
                                                if (x[0] <= 102464.3984375) {
                                                    return 1;
                                                }

                                                else {
                                                    return 2;
                                                }
                                            }

                                            else {
                                                if (x[2] <= 1.0891801714897156) {
                                                    return 2;
                                                }

                                                else {
                                                    return 2;
                                                }
                                            }
                                        }
                                    }

                                    else {
                                        if (x[2] <= 1.082351565361023) {
                                            return 0;
                                        }

                                        else {
                                            return 0;
                                        }
                                    }
                                }

                                else {
                                    if (x[0] <= 121887.44921875) {
                                        if (x[1] <= 90951.0) {
                                            return 0;
                                        }

                                        else {
                                            if (x[1] <= 103211.5) {
                                                if (x[2] <= 1.1331777572631836) {
                                                    return 1;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }

                                            else {
                                                if (x[0] <= 115655.19921875) {
                                                    return 0;
                                                }

                                                else {
                                                    return 0;
                                                }
                                            }
                                        }
                                    }

                                    else {
                                        if (x[2] <= 1.1372063755989075) {
                                            return 0;
                                        }

                                        else {
                                            if (x[1] <= 107221.34765625) {
                                                return 2;
                                            }

                                            else {
                                                return 2;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        else {
                            if (x[0] <= 89889.75) {
                                return 0;
                            }

                            else {
                                if (x[2] <= 1.1969612836837769) {
                                    if (x[2] <= 1.1692736744880676) {
                                        if (x[0] <= 114114.0) {
                                            if (x[0] <= 102508.25) {
                                                return 0;
                                            }

                                            else {
                                                return 1;
                                            }
                                        }

                                        else {
                                            return 0;
                                        }
                                    }

                                    else {
                                        return 0;
                                    }
                                }

                                else {
                                    if (x[0] <= 126786.0) {
                                        if (x[2] <= 1.2844141125679016) {
                                            if (x[1] <= 74911.84765625) {
                                                return 0;
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

                                        else {
                                            if (x[2] <= 1.3663930296897888) {
                                                return 0;
                                            }

                                            else {
                                                if (x[0] <= 101244.55078125) {
                                                    return 1;
                                                }

                                                else {
                                                    return 1;
                                                }
                                            }
                                        }
                                    }

                                    else {
                                        if (x[2] <= 1.2053219079971313) {
                                            return 0;
                                        }

                                        else {
                                            return 0;
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