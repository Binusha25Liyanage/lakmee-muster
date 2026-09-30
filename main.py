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

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    debug = "--debug" in sys.argv
    index = os.path.join(HERE, "ui", "dist", "index.html")
    if not os.path.exists(index):
        raise SystemExit("ui/dist/index.html is missing. Build the UI first:  cd ui && npm install && npm run build")
    api = Api()
    window = webview.create_window(
        APP_NAME + " - Attendance Management System", index,
        js_api=api, width=1440, height=900, min_size=(1100, 700),
        frameless=True, easy_drag=False, background_color="#F5EFE0")
    api._bind(window)
    icon = os.path.join(HERE, "assets", "icon.ico")
    webview.start(debug=debug, icon=icon if os.path.exists(icon) else None)


if __name__ == "__main__":
    main()
