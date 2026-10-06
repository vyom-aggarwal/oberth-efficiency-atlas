"""Regression test for the engine-comparison animation (scripts/anim_engines.py).

Bug (found by the reproducibility audit, 2026-10-06): draw() left the spacecraft dot unchanged on frames
before the path starts, so frame 0 showed the dots of whatever frame was drawn before it (the final-frame
still). Each frame must depend only on its time.
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import anim_engines as A  # noqa: E402


def _pixels(fig) -> np.ndarray:
    fig.canvas.draw()
    return np.asarray(fig.canvas.buffer_rgba()).copy()


def test_frame_is_independent_of_draw_order():
    fig, draw, frame_t, *_ = A.build_figure(5)
    try:
        draw(frame_t[0])
        fresh = _pixels(fig)
        draw(frame_t[-1])          # the still, as main() draws it before the MP4
        draw(frame_t[0])
        again = _pixels(fig)
    finally:
        A.plt.close(fig)
    assert np.array_equal(fresh, again)
