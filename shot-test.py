"""Cometfall Harvest screenshots + smoke test, headless Chromium via Playwright.

Screenshots: load each ?shot= mode, wait for window.__shotReady, capture
1280x720 JPEG into repo/screenshots/.
Smoke test: load ?autoplay=1&fast=1, watch window.__cometfall for waves
cleared / game over with 0 page errors / 0 console errors.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path("/home/hatch/workspace/makefun-bounties/best-game-01/repo")
SHOTS = REPO / "screenshots"
BASE = "http://127.0.0.1:8080"
SHOTS_LIST = [
    ("1-start.jpg", "?shot=start&seed=1"),
    ("2-play.jpg", "?shot=play&seed=1"),
    ("3-win.jpg", "?shot=win&seed=1"),
    ("4-end.jpg", "?shot=end&seed=1"),
]

errors = []


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

        for name, query in SHOTS_LIST:
            page.goto(BASE + "/" + query, wait_until="load")
            try:
                page.wait_for_function("window.__shotReady === true", timeout=30000)
            except Exception as exc:
                print(f"SHOT {name}: __shotReady never fired: {exc}")
                page.screenshot(path=str(SHOTS / name), type="jpeg", quality=85)
                continue
            time.sleep(0.4)
            page.screenshot(path=str(SHOTS / name), type="jpeg", quality=85)
            size = (SHOTS / name).stat().st_size
            print(f"SHOT {name}: {size} bytes")

        # Smoke test: autoplay through waves, fast timers, small viewport.
        page.close()
        page2 = browser.new_page(viewport={"width": 640, "height": 360})
        page2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page2.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page2.goto(BASE + "/?autoplay=1&fast=1", wait_until="load")
        deadline = time.time() + 420
        waves = 0
        last_wave = 1
        outcome = None
        best_got = 0
        while time.time() < deadline:
            state = page2.evaluate(
                "window.__cometfall ? {ph: window.__cometfall.phase, w: window.__cometfall.wave, "
                "score: window.__cometfall.score, launches: window.__cometfall.launches, "
                "left: window.__cometfall.shardsLeft, got: window.__cometfall.shardsCollected, "
                "lost: window.__cometfall.cometsLost} : null"
            )
            if state is None:
                print("SMOKE: __cometfall missing")
                break
            best_got = max(best_got, state["got"])
            if state["w"] != last_wave:
                print(f"SMOKE: wave {last_wave} cleared -> wave {state['w']} score={state['score']} got={state['got']}")
                last_wave = state["w"]
                waves += 1
            if state["ph"] in ("gameover", "victory"):
                outcome = state
                print(f"SMOKE: {state['ph']} at wave {state['w']} score={state['score']} got={state['got']} lost={state['lost']}")
                break
            time.sleep(2)
        else:
            print(f"SMOKE: timeout, waves cleared = {waves}, last state wave={last_wave} best got={best_got}")
        # Restart check: press R on the end screen; autoplay fires within a
        # frame, so read quickly: a fresh game has wave 1, score 0, and is
        # aiming or already flying.
        restarted = False
        if outcome is not None:
            page2.keyboard.press("r")
            time.sleep(0.3)
            after = page2.evaluate("window.__cometfall ? {ph: window.__cometfall.phase, w: window.__cometfall.wave, score: window.__cometfall.score} : null")
            print(f"SMOKE: after R: {after}")
            restarted = after is not None and after["ph"] in ("aiming", "flying") and after["w"] == 1 and after["score"] < outcome["score"]
        browser.close()

    print(f"ERRORS: {len(errors)}")
    for e in errors[:20]:
        print("  " + e)
    ok = outcome is not None and restarted and not errors
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run())
