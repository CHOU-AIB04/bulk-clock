"""
Alarm sounds.

Three tones, each recognisable with the phone face-down in another room — which
is the whole point of giving meals and training different sounds. Written as
plain PCM WAV because Android plays WAV from res/raw with no encoder, and
because a generated file can be tweaked and regenerated rather than hunted for.

Run from the repo root:  python3 android/tools/make-sounds.py
"""

import math
import os
import struct
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "app", "src", "main", "res", "raw")


def note(freq, dur, *, start=0.0, amp=0.5, harmonics=(1.0, 0.45, 0.2, 0.08),
         attack=0.006, decay=None, buf=None, total=None):
    """One struck tone: a few harmonics under an exponential decay."""
    decay = decay if decay is not None else dur
    n = int(RATE * total)
    if buf is None:
        buf = [0.0] * n

    begin = int(start * RATE)
    length = int(dur * RATE)

    for i in range(length):
        if begin + i >= n:
            break
        t = i / RATE
        # Percussive envelope: fast attack, exponential tail.
        env = min(1.0, t / attack) * math.exp(-t * (4.0 / decay))
        s = 0.0
        for k, weight in enumerate(harmonics, start=1):
            s += weight * math.sin(2 * math.pi * freq * k * t)
        buf[begin + i] += amp * env * s / sum(harmonics)

    return buf


def write(name, buf):
    peak = max(1e-9, max(abs(v) for v in buf))
    # Leave headroom so the phone's own limiter has nothing to do.
    gain = 0.89 / peak

    os.makedirs(OUT, exist_ok=True)
    path = os.path.abspath(os.path.join(OUT, name))
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(
            struct.pack("<h", max(-32767, min(32767, int(v * gain * 32767)))) for v in buf
        ))
    print("wrote", path, f"{os.path.getsize(path) / 1024:.0f} KB")


# ── meals: warm, unhurried, food-shaped ─────────────────────
# A rising major third then the fifth above — an invitation, not an order.
TOTAL = 1.9
buf = [0.0] * int(RATE * TOTAL)
note(659.25, 1.4, start=0.00, amp=0.55, decay=0.9, buf=buf, total=TOTAL)   # E5
note(830.61, 1.3, start=0.16, amp=0.45, decay=0.8, buf=buf, total=TOTAL)   # G#5
note(987.77, 1.5, start=0.32, amp=0.50, decay=1.1, buf=buf, total=TOTAL)   # B5
write("alarm_meal.wav", buf)


# ── training: low, insistent, gets you off the sofa ─────────
# Three short low pulses then an octave jump. Squarer harmonics so it cuts
# through a gym bag or a pocket.
TOTAL = 2.1
buf = [0.0] * int(RATE * TOTAL)
PULSE = (1.0, 0.0, 0.55, 0.0, 0.3, 0.0, 0.18)     # odd harmonics — hollow, horn-like
for i in range(3):
    note(146.83, 0.34, start=i * 0.26, amp=0.75, decay=0.18,
         harmonics=PULSE, attack=0.004, buf=buf, total=TOTAL)              # D3
note(293.66, 1.1, start=0.86, amp=0.62, decay=0.55, harmonics=PULSE, buf=buf, total=TOTAL)   # D4
note(440.00, 1.2, start=1.02, amp=0.48, decay=0.7, harmonics=PULSE, buf=buf, total=TOTAL)    # A4
write("alarm_training.wav", buf)


# ── check-in: quiet, end of day, easy to ignore on purpose ──
TOTAL = 1.3
buf = [0.0] * int(RATE * TOTAL)
note(523.25, 1.2, start=0.0, amp=0.42, decay=0.8, harmonics=(1.0, 0.25, 0.08), buf=buf, total=TOTAL)
note(783.99, 1.0, start=0.22, amp=0.30, decay=0.7, harmonics=(1.0, 0.2), buf=buf, total=TOTAL)
write("alarm_checkin.wav", buf)

print("done")
