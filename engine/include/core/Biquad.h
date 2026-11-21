#pragma once

namespace core
{

    /** Normalised biquad coefficients (a0 == 1). One-pole sections set b2 = a2 = 0. */
    struct BiquadCoeffs
    {
        double b0 = 1.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0;
    };

    /** Transposed direct form II state for one channel of one section. */
    struct BiquadState
    {
        double z1 = 0.0, z2 = 0.0;

        float process(float x, const BiquadCoeffs &c) noexcept
        {
            const double y = c.b0 * x + z1;
            z1 = c.b1 * x - c.a1 * y + z2;
            z2 = c.b2 * x - c.a2 * y;
            return static_cast<float>(y);
        }

        void reset() noexcept { z1 = z2 = 0.0; }
    };

    /**
        RBJ cookbook sections with Web Audio BiquadFilterNode conventions, so the C++ kit matches the
        browser prototype:
          - low/high-pass: qDb is in dB, alpha = sin(w0) / (2 * 10^(qDb/20)) (Web Audio's default Q is 1)
          - band-pass: q is linear, alpha = sin(w0) / (2q), 0 dB at the centre frequency
    */
    BiquadCoeffs designLowPass(double cutoffHz, double qDb, double sampleRate) noexcept;
    BiquadCoeffs designHighPass(double cutoffHz, double qDb, double sampleRate) noexcept;
    BiquadCoeffs designBandPass(double centreHz, double q, double sampleRate) noexcept;
    BiquadCoeffs designOnePoleLowPass(double cutoffHz, double sampleRate) noexcept;
    BiquadCoeffs designOnePoleHighPass(double cutoffHz, double sampleRate) noexcept;

} // namespace core
