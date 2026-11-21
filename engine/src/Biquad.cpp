#include "core/Biquad.h"

#include <algorithm>
#include <cmath>

namespace core
{

namespace
{
    constexpr double pi = 3.14159265358979323846;

    double clampCutoff (double cutoffHz, double sampleRate) noexcept
    {
        return std::clamp (cutoffHz, 10.0, sampleRate * 0.49);
    }

    double alphaFor (double w0, double qDb) noexcept
    {
        return std::sin (w0) / (2.0 * std::pow (10.0, qDb / 20.0));
    }
} // namespace

BiquadCoeffs designLowPass (double cutoffHz, double qDb, double sampleRate) noexcept
{
    const double w0 = 2.0 * pi * clampCutoff (cutoffHz, sampleRate) / sampleRate;
    const double cosW0 = std::cos (w0);
    const double alpha = alphaFor (w0, qDb);
    const double a0 = 1.0 + alpha;

    BiquadCoeffs c;
    c.b0 = ((1.0 - cosW0) * 0.5) / a0;
    c.b1 = (1.0 - cosW0) / a0;
    c.b2 = c.b0;
    c.a1 = (-2.0 * cosW0) / a0;
    c.a2 = (1.0 - alpha) / a0;
    return c;
}

BiquadCoeffs designHighPass (double cutoffHz, double qDb, double sampleRate) noexcept
{
    const double w0 = 2.0 * pi * clampCutoff (cutoffHz, sampleRate) / sampleRate;
    const double cosW0 = std::cos (w0);
    const double alpha = alphaFor (w0, qDb);
    const double a0 = 1.0 + alpha;

    BiquadCoeffs c;
    c.b0 = ((1.0 + cosW0) * 0.5) / a0;
    c.b1 = -(1.0 + cosW0) / a0;
    c.b2 = c.b0;
    c.a1 = (-2.0 * cosW0) / a0;
    c.a2 = (1.0 - alpha) / a0;
    return c;
}

BiquadCoeffs designBandPass (double centreHz, double q, double sampleRate) noexcept
{
    const double w0 = 2.0 * pi * clampCutoff (centreHz, sampleRate) / sampleRate;
    const double cosW0 = std::cos (w0);
    const double alpha = std::sin (w0) / (2.0 * std::max (q, 1.0e-4));
    const double a0 = 1.0 + alpha;

    BiquadCoeffs c;
    c.b0 = alpha / a0;
    c.b1 = 0.0;
    c.b2 = -alpha / a0;
    c.a1 = (-2.0 * cosW0) / a0;
    c.a2 = (1.0 - alpha) / a0;
    return c;
}

BiquadCoeffs designOnePoleLowPass (double cutoffHz, double sampleRate) noexcept
{
    const double k = std::tan (pi * clampCutoff (cutoffHz, sampleRate) / sampleRate);
    BiquadCoeffs c;
    c.b0 = k / (1.0 + k);
    c.b1 = c.b0;
    c.a1 = (k - 1.0) / (k + 1.0);
    return c;
}

BiquadCoeffs designOnePoleHighPass (double cutoffHz, double sampleRate) noexcept
{
    const double k = std::tan (pi * clampCutoff (cutoffHz, sampleRate) / sampleRate);
    BiquadCoeffs c;
    c.b0 = 1.0 / (1.0 + k);
    c.b1 = -c.b0;
    c.a1 = (k - 1.0) / (k + 1.0);
    return c;
}

} // namespace core
