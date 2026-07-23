#include "lateral_guidance.h"

double limit_bank_command(double command_degrees, double limit_degrees)
{
    if (command_degrees > limit_degrees) {
        return limit_degrees;
    }
    if (command_degrees < -limit_degrees) {
        return -limit_degrees;
    }
    return command_degrees;
}
