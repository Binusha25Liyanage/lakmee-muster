"""
Lakmee Muster - Attendance Management System
Entry point: opens the React UI (ui/dist) in a frameless PyWebView window.

Run:   python main.py
       python main.py --debug     (adds right-click > Inspect for the UI)
"""
import os
import sys

import webview

from core.api import Api, APP_NAME

# Inside the .exe the bundled files live in sys._MEIPASS; when run from source they sit next to main.py
HERE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def selftest():
    """python main.py --selftest : checks files, modules and database without opening a window."""
    api = Api()
    info = api.app_info()
    index = os.path.join(HERE, "ui", "dist", "index.html")
    ok = os.path.exists(index) and all("error" not in m for m in info["modules"])
    st = api.db_stats()
    print("Lakmee Muster", info["version"], "| modules:", ", ".join(f"{m['name']} v{m['version']}" for m in info["modules"]))
    print("UI found:", os.path.exists(index), "| database:", st["path"], "| tables ready")
    print("SELFTEST", "OK" if ok else "FAILED")
    try:                                    # the windowed .exe has no console, so also leave the result in a file
        from core import storage
        with open(os.path.join(storage.data_dir(), "selftest.txt"), "w", encoding="utf-8") as f:
            f.write(f"Lakmee Muster {info['version']}\nmodules: " + ", ".join(f"{m['name']} v{m['version']}" for m in info["modules"])
                    + f"\nUI found: {os.path.exists(index)}\ndatabase: {st['path']}\nSELFTEST {'OK' if ok else 'FAILED'}\n")
    except Exception:
        pass
    return 0 if ok else 1


def start_geometry():
    """A window that fits this screen: 90% of it (max 1440x900), centred. Falls back to 1280x800."""
    try:
        s = webview.screens[0]
        w, h = min(1440, int(s.width * 0.9)), min(900, int(s.height * 0.9))
        return w, h, max(0, (s.width - w) // 2), max(0, (s.height - h) // 2)
    except Exception:
        return 1280, 800, None, None


def main():
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    debug = "--debug" in sys.argv
    index = os.path.join(HERE, "ui", "dist", "index.html")
    if not os.path.exists(index):
        raise SystemExit("ui/dist/index.html is missing. Build the UI first:  cd ui && npm install && npm run build")
    api = Api()
    w, h, x, y = start_geometry()
    window = webview.create_window(
        APP_NAME + " - Attendance Management System", index,
        js_api=api, width=w, height=h, x=x, y=y, min_size=(900, 560),
        frameless=True, easy_drag=False, background_color="#F5EFE0")
    api._bind(window)
    icon = os.path.join(HERE, "assets", "icon.ico")
    webview.start(debug=debug, icon=icon if os.path.exists(icon) else None)


if __name__ == "__main__":
    main()
