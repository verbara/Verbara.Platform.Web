"""Unit tests for check-widget-in-dist.py (the WebChat widget is in the image's dist/).

Builds tmp dist/ trees shaped like `npm run build:all` output and runs the script as a
subprocess. Stdlib unittest only — no pip deps.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, os.pardir, "check-widget-in-dist.py")

_EMBED_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Verbara Chat</title>
    <script type="module" crossorigin src="/webchat/embed/assets/index-AbC123.js"></script>
    <link rel="stylesheet" crossorigin href="/webchat/embed/assets/index-DeF456.css">
  </head>
  <body><div id="root"></div></body>
</html>
"""


class CheckWidgetInDistTests(unittest.TestCase):
    def setUp(self):
        self._dist = tempfile.mkdtemp()
        self._write("index.html", "<!doctype html><title>console</title>")
        self._write("assets/index-console.js", "console.log(1)")
        self._write("webchat/v1/verbara-webchat.js", "var VerbaraWebChat=function(){}();")
        self._write("webchat/embed/index.html", _EMBED_HTML)
        self._write("webchat/embed/assets/index-AbC123.js", "import'x';")
        self._write("webchat/embed/assets/index-DeF456.css", ".flex{display:flex}")

    def tearDown(self):
        shutil.rmtree(self._dist)

    def _write(self, rel, text):
        path = os.path.join(self._dist, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)

    def _remove(self, rel):
        os.unlink(os.path.join(self._dist, rel))

    def _run(self, dist=None):
        return subprocess.run(
            [sys.executable, _SCRIPT, dist if dist is not None else self._dist],
            capture_output=True,
            text=True,
            check=False,
        )

    def _assert_fails(self, needle):
        result = self._run()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(needle, result.stdout + result.stderr)

    def test_main_ShouldPass_WhenWidgetIsComplete(self):
        result = self._run()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("webchat/v1/verbara-webchat.js", result.stdout)
        self.assertIn("webchat/embed/assets/index-DeF456.css", result.stdout)

    def test_main_ShouldFail_WhenDistHasNoWidgetAtAll(self):
        shutil.rmtree(os.path.join(self._dist, "webchat"))
        self._assert_fails("webchat/v1/verbara-webchat.js")

    def test_main_ShouldFail_WhenSdkBundleIsMissing(self):
        self._remove("webchat/v1/verbara-webchat.js")
        self._assert_fails("webchat/v1/verbara-webchat.js")

    def test_main_ShouldFail_WhenSdkBundleIsEmpty(self):
        self._write("webchat/v1/verbara-webchat.js", "")
        self._assert_fails("webchat/v1/verbara-webchat.js")

    def test_main_ShouldFail_WhenEmbedPageIsMissing(self):
        self._remove("webchat/embed/index.html")
        self._assert_fails("webchat/embed/index.html")

    def test_main_ShouldFail_WhenEmbedPageLinksNoStylesheet(self):
        self._write(
            "webchat/embed/index.html",
            _EMBED_HTML.replace(
                '<link rel="stylesheet" crossorigin href="/webchat/embed/assets/index-DeF456.css">', ""
            ),
        )
        self._assert_fails("stylesheet")

    def test_main_ShouldFail_WhenEmbedPageStillPointsAtSource(self):
        self._write(
            "webchat/embed/index.html",
            _EMBED_HTML.replace("/webchat/embed/assets/index-AbC123.js", "./main.tsx"),
        )
        self._assert_fails("./main.tsx")

    def test_main_ShouldFail_WhenEmbedScriptAssetIsMissing(self):
        self._remove("webchat/embed/assets/index-AbC123.js")
        self._assert_fails("webchat/embed/assets/index-AbC123.js")

    def test_main_ShouldFail_WhenEmbedStylesheetAssetIsEmpty(self):
        self._write("webchat/embed/assets/index-DeF456.css", "")
        self._assert_fails("webchat/embed/assets/index-DeF456.css")

    def test_main_ShouldFail_WhenAssetUrlIsOutsideTheEmbedPrefix(self):
        self._write("assets/index-DeF456.css", ".x{}")
        self._write(
            "webchat/embed/index.html",
            _EMBED_HTML.replace("/webchat/embed/assets/index-DeF456.css", "/assets/index-DeF456.css"),
        )
        self._assert_fails("/assets/index-DeF456.css")

    def test_main_ShouldFail_WhenASourcemapShipsUnderWebchat(self):
        self._write("webchat/v1/verbara-webchat.js.map", "{}")
        self._write("webchat/embed/assets/index-AbC123.js.map", "{}")
        result = self._run()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("webchat/v1/verbara-webchat.js.map", result.stdout)
        self.assertIn("webchat/embed/assets/index-AbC123.js.map", result.stdout)

    def test_main_ShouldPass_WhenTheConsoleHasItsOwnSourcemaps(self):
        self._write("assets/index-console.js.map", "{}")
        result = self._run()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_main_ShouldFail_WhenDistDirectoryDoesNotExist(self):
        result = self._run(os.path.join(self._dist, "nope"))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
