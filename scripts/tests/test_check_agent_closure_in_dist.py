"""Unit tests for check-agent-closure-in-dist.py (the /agent first load, ADR-0014).

Builds tmp dist/ trees shaped like `npm run build:all` output (hashed chunks, hidden
source maps, a map-less rolldown runtime) and runs the script as a subprocess. Stdlib
unittest only — no pip deps.
"""
import gzip
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, os.pardir, "check-agent-closure-in-dist.py")

_ENTRY = "assets/index-Ab12Cd34.js"
_RUNTIME = "assets/rolldown-runtime-Zz99Yy88.js"
_SHARED = "assets/shared-Ss11Tt22.js"
_AGENT_LAYOUT = "assets/agent-layout-Aa11Bb22.js"
_CONVERSATION_VIEW = "assets/conversation-view-Cc33Dd44.js"
_STYLESHEET = "assets/index-Ef56Gh78.css"
_LAZY_CHARTS = "assets/vendor-charts-Xx11Yy22.js"
_ADMIN_LAYOUT = "assets/admin-layout-Ee55Ff66.js"
_FLOW_DESIGNER = "assets/flow-designer-Gg77Hh88.js"
_ANALYTICS_LAYOUT = "assets/analytics-layout-Ii99Jj00.js"
_DASHBOARD_PAGE = "assets/dashboard-page-Kk11Ll22.js"
_CDR_PAGE = "assets/cdr-page-Mm33Nn4-.js"
_OPERATIONS_LAYOUT = "assets/operations-layout-Oo55Pp66.js"
_EXTRA = "assets/extra-Qq77Rr88.js"
_EXTRA_NEXT = "assets/extra-next-Ss99Tt00.js"
_PADDING = "assets/padding-Uu11Vv22.js"

_PENDING = "src/operations/stores/campaign-metrics-store.ts"
_ENTRY_SOURCES = ["src/main.tsx", "src/core/hooks/use-sse.ts", _PENDING, "node_modules/react/index.js"]
_CLEAN_SOURCES = ["src/core/ui/extra.tsx"]

_ENTRY_CLOSURE = (_ENTRY, _RUNTIME, _SHARED)
_AGENT_CLOSURE = (*_ENTRY_CLOSURE, _AGENT_LAYOUT, _CONVERSATION_VIEW)

_CSS = ".flex{display:flex}"

_INDEX_HTML = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Verbara</title>
    <script type="module" crossorigin src="/{_ENTRY}"></script>
    <link rel="modulepreload" crossorigin href="/{_RUNTIME}">
    <link rel="modulepreload" crossorigin href="/{_SHARED}">
    <link rel="stylesheet" crossorigin href="/{_STYLESHEET}">
  </head>
  <body><div id="root"></div></body>
</html>
"""

# Shaped like the real entry: __vite__mapDeps names every lazy chunk as a plain string,
# ahead of the imports, and the router reaches them through dynamic imports.
_ENTRY_BODY = (
    f'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["{_LAZY_CHARTS}","{_ADMIN_LAYOUT}"])))=>i.map(i=>d[i]);'
    f'import{{i as e}}from"./{os.path.basename(_RUNTIME)}";import{{t}}from"./{os.path.basename(_SHARED)}";'
    f'const a=()=>import("./{os.path.basename(_LAZY_CHARTS)}"),b=()=>import("./{os.path.basename(_ADMIN_LAYOUT)}");'
)

_FORBIDDEN_MODULES = [
    "src/admin/users/users-page.tsx",
    "src/admin/flows/node-palette.tsx",
    "src/analytics/cdr/cdr-page.tsx",
    "src/operations/monitor/monitor-page.tsx",
    "node_modules/recharts/es6/index.js",
    "node_modules/jspdf/dist/jspdf.es.min.js",
    "node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs",
    "node_modules/html2canvas/dist/html2canvas.js",
    "node_modules/ag-grid/dist/index.js",
    "node_modules/ag-grid-community/dist/package/main.esm.mjs",
    "node_modules/ag-grid-react/dist/package/index.mjs",
    "node_modules/ag-grid-other/dist/index.mjs",
    "node_modules/@xyflow/react/dist/esm/index.js",
    "node_modules/@xyflow/system/dist/esm/index.js",
    "node_modules/@xyflow/other/dist/esm/index.js",
]


def _gzip9(data):
    return len(gzip.compress(data, compresslevel=9))


def _import_of(rel):
    return f'import{{a}}from"./{os.path.basename(rel)}";'


class _DistFixture(unittest.TestCase):
    def setUp(self):
        self._root = tempfile.mkdtemp()
        self._dist = os.path.join(self._root, "dist")
        self._write("index.html", _INDEX_HTML)
        self._write(_STYLESHEET, _CSS)
        self._write(_RUNTIME, "var e=Object.defineProperty;export{e as i};")
        self._chunk(_ENTRY, _ENTRY_SOURCES, _ENTRY_BODY)
        self._chunk(_SHARED, ["src/core/ui/button.tsx"], "export const t=1;")
        self._chunk(_AGENT_LAYOUT, ["src/pages/agent/agent-layout.tsx"], _import_of(_SHARED))
        self._chunk(_CONVERSATION_VIEW, ["src/agent/conversation/conversation-view.tsx"], _import_of(_SHARED))
        self._chunk(_LAZY_CHARTS, ["node_modules/recharts/es6/index.js"], "export const c=1;")
        self._chunk(_ADMIN_LAYOUT, ["src/pages/admin/admin-layout.tsx"], "export const admin=1;")
        self._chunk(_FLOW_DESIGNER, ["src/admin/flows/flow-designer.tsx"], "export const flow='designer';")
        self._chunk(_ANALYTICS_LAYOUT, ["src/pages/analytics/analytics-layout.tsx"], "export const l='analytics';")
        self._chunk(_DASHBOARD_PAGE, ["src/analytics/dashboard/dashboard-page.tsx"], "export const d='dashboard';")
        self._chunk(_CDR_PAGE, ["src/analytics/cdr/cdr-page.tsx"], "export const c='call detail records';")
        self._chunk(_OPERATIONS_LAYOUT, ["src/pages/operations/operations-layout.tsx"], "export const o='operations';")

    def tearDown(self):
        shutil.rmtree(self._root)

    def _write(self, rel, content):
        path = os.path.join(self._dist, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = content.encode("utf-8") if isinstance(content, str) else content
        with open(path, "wb") as handle:
            handle.write(data)

    def _read(self, rel):
        with open(os.path.join(self._dist, rel), "rb") as handle:
            return handle.read()

    def _remove(self, rel):
        os.unlink(os.path.join(self._dist, rel))

    def _chunk(self, rel, sources, body="export{};"):
        self._write(rel, body)
        self._write(f"{rel}.map", json.dumps({"version": 3, "sources": [f"../../{s}" for s in sources]}))

    def _link(self, importer, target):
        """Adds a static import of target to importer."""
        self._write(importer, _import_of(target).encode("utf-8") + self._read(importer))

    def _run(self, *args, dist=None):
        return subprocess.run(
            [sys.executable, _SCRIPT, dist if dist is not None else self._dist, *args],
            capture_output=True,
            text=True,
            check=False,
        )

    def _assert_passes(self, *args):
        result = self._run(*args)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("FAIL", result.stdout)
        return result

    def _assert_fails(self, *needles, args=()):
        result = self._run(*args)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        for needle in needles:
            self.assertIn(needle, result.stdout + result.stderr)
        return result

    def _total(self, *rels):
        return sum(_gzip9(self._read(rel)) for rel in (*rels, _STYLESHEET))


class ForbiddenModuleTests(_DistFixture):
    def test_main_ShouldPass_WhenClosureIsClean(self):
        result = self._assert_passes()
        self.assertIn("closure: 5 chunks", result.stdout)

    def test_main_ShouldFailNamingChunkAndModule_WhenAForbiddenModuleIsInItsOwnChunk(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        for module in _FORBIDDEN_MODULES:
            with self.subTest(module=module):
                self._chunk(_EXTRA, ["src/core/ui/extra.tsx", module])
                self._assert_fails(f"FAIL {_EXTRA}: forbidden module {module}")

    def test_main_ShouldFailNamingTheEntry_WhenAForbiddenModuleIsHoistedIntoIt(self):
        for module in _FORBIDDEN_MODULES:
            with self.subTest(module=module):
                self._chunk(_ENTRY, [*_ENTRY_SOURCES, module], _ENTRY_BODY)
                self._assert_fails(f"FAIL {_ENTRY}: forbidden module {module}")

    def test_main_ShouldFail_WhenAForbiddenModuleSitsBehindAConversationViewImport(self):
        self._link(_CONVERSATION_VIEW, _EXTRA)
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        self._assert_fails(f"{_EXTRA}: forbidden module src/admin/users/users-page.tsx")

    def test_main_ShouldFail_WhenTheForbiddenModuleIsNestedInAnotherPackage(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        nested = "node_modules/some-wrapper/node_modules/recharts/es6/index.js"
        self._chunk(_EXTRA, [nested])
        self._assert_fails(nested)

    def test_main_ShouldFail_WhenADomainModuleSitsUnderAnotherPrefix(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        for module in ("../src/admin/users/users-page.tsx", "apps/console/src/analytics/cdr/cdr-page.tsx"):
            with self.subTest(module=module):
                self._chunk(_EXTRA, [module])
                self._assert_fails(f"FAIL {_EXTRA}: forbidden module {module}")

    def test_main_ShouldGroupAVendorPackage_WhenItBringsManyModules(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        self._chunk(_EXTRA, [f"node_modules/recharts/es6/m{i}.js" for i in range(4)])
        result = self._assert_fails("node_modules/recharts/es6/m0.js and 3 more from node_modules/recharts/")
        self.assertEqual(result.stdout.count("forbidden module"), 1)

    def test_main_ShouldListEverySourceModule_WhenSeveralAreForbidden(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        self._chunk(_EXTRA, ["src/admin/a.ts", "src/admin/b.ts"])
        self._assert_fails("forbidden module src/admin/a.ts", "forbidden module src/admin/b.ts")

    def test_main_ShouldFailOnTheFileName_WhenAVendorChunkHasACleanMap(self):
        for name in ("charts", "pdf", "grid", "flow"):
            with self.subTest(name=name):
                chunk = f"assets/vendor-{name}-Ww11Xx22.js"
                self._chunk(chunk, _CLEAN_SOURCES)
                self._chunk(_CONVERSATION_VIEW, _CLEAN_SOURCES, _import_of(chunk))
                self._assert_fails(f"FAIL {chunk}: forbidden chunk name")

    def test_main_ShouldPass_WhenAModuleOnlyLooksForbidden(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        for module in (
            "src/administration/settings.ts",
            "src/core/admin/helper.ts",
            "src/agent/operations/helper.ts",
            "node_modules/some-package/src/admin/index.js",
            "node_modules/recharts-scale/es6/index.js",
            "node_modules/jspdf-lookalike/index.js",
            "node_modules/@xyflowish/index.js",
        ):
            with self.subTest(module=module):
                self._chunk(_EXTRA, [module])
                self._assert_passes()

    def test_main_ShouldPass_WhenAChunkOnlyLooksForbidden(self):
        for chunk in ("assets/vendor-ui-Ww11Xx22.js", "assets/vendor-chartsy-Ww11Xx22.js"):
            with self.subTest(chunk=chunk):
                self._chunk(chunk, _CLEAN_SOURCES)
                self._chunk(_CONVERSATION_VIEW, _CLEAN_SOURCES, _import_of(chunk))
                self._assert_passes()


class StaticImportTests(_DistFixture):
    def test_main_ShouldPass_WhenForbiddenChunksAreOnlyDynamicallyImported(self):
        result = self._assert_passes()
        self.assertNotIn("vendor-charts", result.stdout)
        self.assertNotIn("admin-layout", result.stdout)

    def test_main_ShouldFollowEveryStaticImportForm(self):
        target = os.path.basename(_EXTRA)
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        for form in (
            f'import{{a as b}}from"./{target}";',
            f'import b from"./{target}";',
            f'import b,{{c}}from"./{target}";',
            f'import*as b from"./{target}";',
            f'import"./{target}";',
            f'export{{a}}from"./{target}";',
            f'export*from"./{target}";',
            f"import {{ a }} from './{target}';",
            f"import './{target}';",
            f'import{{a}}from"/{_EXTRA}";',
            f'const x=1;import{{a}}from"./{target}";',
        ):
            with self.subTest(form=form):
                self._chunk(_CONVERSATION_VIEW, _CLEAN_SOURCES, form)
                self._assert_fails(f"{_EXTRA}: forbidden module src/admin/users/users-page.tsx")

    def test_main_ShouldFollowImportsTransitively_WhenChunksImportEachOtherInACycle(self):
        self._chunk(_EXTRA, _CLEAN_SOURCES, _import_of(_EXTRA_NEXT))
        self._chunk(_EXTRA_NEXT, ["src/analytics/cdr/cdr-page.tsx"], _import_of(_EXTRA))
        self._link(_AGENT_LAYOUT, _EXTRA)
        self._assert_fails(f"{_EXTRA_NEXT}: forbidden module src/analytics/cdr/cdr-page.tsx")

    def test_main_ShouldFollowEveryImportOfAChunk(self):
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        body = _import_of(_SHARED) + _import_of(_EXTRA) + _import_of(_RUNTIME)
        self._chunk(_CONVERSATION_VIEW, _CLEAN_SOURCES, body)
        self._assert_fails(f"{_EXTRA}: forbidden module src/admin/users/users-page.tsx")

    def test_main_ShouldFollowEveryEntryScript_WhenIndexHtmlHasSeveral(self):
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        self._write("index.html", _INDEX_HTML.replace("</head>", f'<script src="/{_EXTRA}"></script></head>'))
        self._assert_fails(f"{_EXTRA}: forbidden module src/admin/users/users-page.tsx")

    def test_main_ShouldFollowEveryChunk_WhenTwoMatchARoot(self):
        second = "assets/agent-layout-Zz00Yy99.js"
        self._chunk(second, ["src/admin/users/users-page.tsx"])
        self._assert_fails(f"{second}: forbidden module src/admin/users/users-page.tsx")


class BudgetTests(_DistFixture):
    def _fill_closure_to(self, target):
        """Pads the closure with incompressible bytes until it measures exactly target."""
        self._link(_CONVERSATION_VIEW, _PADDING)
        self._chunk(_PADDING, _CLEAN_SOURCES)
        noise = random.Random(14).randbytes(target)
        for nudge in range(64):
            self._write(_STYLESHEET, _CSS + "x" * nudge)
            want = target - self._total(*_AGENT_CLOSURE)
            low, high = want - 2048, want
            while low < high:
                middle = (low + high) // 2
                if _gzip9(noise[:middle]) < want:
                    low = middle + 1
                else:
                    high = middle
            if _gzip9(noise[:low]) == want:
                self._write(_PADDING, noise[:low])
                self.assertEqual(self._total(*_AGENT_CLOSURE, _PADDING), target)
                return
        self.fail(f"could not reach exactly {target} B")

    def test_main_ShouldPass_WhenTotalIsUnderTheBudget(self):
        self._fill_closure_to(499_999)
        self.assertIn("499,999 B gzip-9", self._assert_passes().stdout)

    def test_main_ShouldPass_WhenTotalIsAtTheBudget(self):
        self._fill_closure_to(500_000)
        self.assertIn("500,000 B gzip-9", self._assert_passes().stdout)

    def test_main_ShouldFailPrintingTotalAndBudget_WhenTotalIsOverTheBudget(self):
        self._fill_closure_to(500_001)
        self._assert_fails("FAIL budget: 500,001 B gzip-9", "over the 500,000 B limit")

    def test_main_ShouldMeasureEachFileAloneAndTheEntryStylesheet(self):
        self._write(_STYLESHEET, _CSS * 40)
        expected = self._total(*_AGENT_CLOSURE)
        self.assertIn(f"{expected:,} B gzip-9", self._assert_passes().stdout)

    def test_main_ShouldCountEveryStylesheet_WhenIndexHtmlLinksSeveral(self):
        second = "assets/extra-Vv33Ww44.css"
        self._write(second, _CSS * 40)
        link = f'<link rel="stylesheet" crossorigin href="/{_STYLESHEET}">'
        self._write("index.html", _INDEX_HTML.replace(link, f'{link}<link rel="stylesheet" href="/{second}">'))
        expected = self._total(*_AGENT_CLOSURE, second)
        self.assertIn(f"{expected:,} B gzip-9", self._assert_passes().stdout)

    def test_main_ShouldNotCountAChunk_WhenItIsOutsideTheClosure(self):
        self._write(_LAZY_CHARTS, random.Random(14).randbytes(600_000))
        self._assert_passes()

    def test_main_ShouldReportBothProblems_WhenForbiddenAndOverBudget(self):
        self._fill_closure_to(500_001)
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        self._link(_AGENT_LAYOUT, _EXTRA)
        self._assert_fails("forbidden module src/admin/users/users-page.tsx", "FAIL budget:")


class FailClosedTests(_DistFixture):
    def _remove_all_maps(self):
        assets = os.path.join(self._dist, "assets")
        for name in os.listdir(assets):
            if name.endswith(".map"):
                os.unlink(os.path.join(assets, name))

    def test_main_ShouldFail_WhenDistIsMissing(self):
        result = self._run(dist=os.path.join(self._root, "nowhere"))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("is not a directory", result.stdout)

    def test_main_ShouldFail_WhenDistIsAFile(self):
        result = self._run(dist=os.path.join(self._dist, "index.html"))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_main_ShouldFail_WhenIndexHtmlIsMissing(self):
        self._remove("index.html")
        self._assert_fails("index.html is missing")

    def test_main_ShouldFail_WhenAssetsIsMissing(self):
        shutil.rmtree(os.path.join(self._dist, "assets"))
        self._assert_fails("root agent-layout-*", "root conversation-view-*")

    def test_main_ShouldFail_WhenIndexHtmlHasNoEntryScript(self):
        self._write("index.html", _INDEX_HTML.replace(f'src="/{_ENTRY}"', ""))
        self._assert_fails("no entry script")

    def test_main_ShouldFail_WhenTheEntryScriptIsMissing(self):
        self._remove(_ENTRY)
        self._assert_fails(f"{_ENTRY}: imported by index.html but missing from dist")

    def test_main_ShouldFail_WhenTheEntryScriptIsOutsideDist(self):
        self._write("index.html", _INDEX_HTML.replace(f"/{_ENTRY}", "https://cdn.example.test/index.js"))
        self._assert_fails("missing from dist")

    def test_main_ShouldFail_WhenIndexHtmlLinksNoStylesheet(self):
        html = _INDEX_HTML.replace(f'<link rel="stylesheet" crossorigin href="/{_STYLESHEET}">', "")
        self._write("index.html", html)
        self._assert_fails("no stylesheet link")

    def test_main_ShouldFail_WhenTheEntryStylesheetIsMissing(self):
        self._remove(_STYLESHEET)
        self._assert_fails(f"{_STYLESHEET}: linked by index.html but missing from dist")

    def test_main_ShouldFailNamingTheRoot_WhenAgentLayoutMatchesNoChunk(self):
        self._remove(_AGENT_LAYOUT)
        self._assert_fails("root agent-layout-*")

    def test_main_ShouldPrintNoClosureNorBudget_WhenARootIsMissing(self):
        self._remove(_AGENT_LAYOUT)
        result = self._assert_fails("root agent-layout-*")
        self.assertNotIn("closure:", result.stdout)
        self.assertNotIn("budget:", result.stdout)

    def test_main_ShouldFailNamingTheRoot_WhenConversationViewMatchesNoChunk(self):
        self._remove(_CONVERSATION_VIEW)
        self._assert_fails("root conversation-view-*")

    def test_main_ShouldFail_WhenOnlyALongerChunkNameStartsLikeTheRoot(self):
        self._remove(_AGENT_LAYOUT)
        self._chunk("assets/agent-layout-context-Aa11Bb22.js", _CLEAN_SOURCES)
        self._assert_fails("root agent-layout-*")

    def test_main_ShouldFail_WhenAStaticImportIsNotInDist(self):
        self._write(_AGENT_LAYOUT, 'import{a}from"./gone-Aa11Bb22.js";')
        self._assert_fails(f"assets/gone-Aa11Bb22.js: imported by {_AGENT_LAYOUT} but missing from dist")

    def test_main_ShouldFail_WhenAStaticImportLeavesDist(self):
        self._write(_AGENT_LAYOUT, 'import{a}from"../../outside.js";')
        self._write("../outside.js", "export const a=1;")
        self._assert_fails("../outside.js: imported by", "missing from dist")

    def test_main_ShouldFail_WhenTheBuildHasNoSourceMaps(self):
        self._remove_all_maps()
        result = self._assert_fails("cannot read the origin")
        self.assertNotIn("PENDING_PR2", result.stdout)

    def test_main_ShouldFailNamingTheChunk_WhenOneMapIsMissing(self):
        for chunk in (_ENTRY, _SHARED, _AGENT_LAYOUT, _CONVERSATION_VIEW):
            with self.subTest(chunk=chunk):
                content = self._read(f"{chunk}.map")
                self._remove(f"{chunk}.map")
                self._assert_fails(f"{chunk}: no source map, cannot read the origin")
                self._write(f"{chunk}.map", content)

    def test_main_ShouldFail_WhenAMapIsUnreadable(self):
        for content in (
            "not json",
            "[]",
            "{}",
            '{"sources":[]}',
            '{"sources":"src/core/ui/button.tsx"}',
            '{"sources":[null]}',
            b"\xff\xfe",
        ):
            with self.subTest(content=content):
                self._write(f"{_SHARED}.map", content)
                self._assert_fails(f"{_SHARED}.map: unreadable, cannot read the origin")

    def test_main_ShouldAllowNoMap_WhenTheChunkIsTheRolldownRuntime(self):
        self.assertFalse(os.path.exists(os.path.join(self._dist, f"{_RUNTIME}.map")))
        self.assertNotIn(_RUNTIME, self._assert_passes().stdout)

    def test_main_ShouldReadTheRuntimeMap_WhenTheBuildEmitsOne(self):
        self._chunk(_RUNTIME, ["src/admin/users/users-page.tsx"])
        self._assert_fails(f"{_RUNTIME}: forbidden module src/admin/users/users-page.tsx")

    def test_main_ShouldFail_WhenAMapLessChunkOnlyLooksLikeTheRuntime(self):
        for chunk in (
            "assets/rolldown-helpers-Aa11Bb22.js",
            "assets/runtime-Aa11Bb22.js",
            "assets/not-rolldown-runtime-Aa11Bb22.js",
            "assets/rolldown-runtime-Aa11.Bb22.js",
            "assets/rolldown-runtime-Aa11Bb22.jsx",
        ):
            with self.subTest(chunk=chunk):
                self._write(chunk, "export{};")
                self._write(_CONVERSATION_VIEW, _import_of(chunk))
                self._assert_fails(f"{chunk}: no source map")

    def test_main_ShouldPass_WhenAChunkOutsideTheClosureHasNoMap(self):
        self._remove(f"{_LAZY_CHARTS}.map")
        self._assert_passes()


class PendingPr2Tests(_DistFixture):
    def test_main_ShouldPassNamingTheException_WhenThePendingModuleIsInTheClosure(self):
        self.assertIn(f"ok   PENDING_PR2 {_PENDING} in {_ENTRY}", self._assert_passes().stdout)

    def test_main_ShouldPass_WhenThePendingModuleMovesToAnotherClosureChunk(self):
        self._chunk(_ENTRY, ["src/main.tsx"], _ENTRY_BODY)
        self._chunk(_EXTRA, [_PENDING])
        self._link(_AGENT_LAYOUT, _EXTRA)
        self.assertIn(f"ok   PENDING_PR2 {_PENDING} in {_EXTRA}", self._assert_passes().stdout)

    def test_main_ShouldFail_WhenThePendingModuleLeavesTheClosure(self):
        self._chunk(_ENTRY, ["src/main.tsx"], _ENTRY_BODY)
        self._assert_fails(f"FAIL PENDING_PR2 entry {_PENDING} is no longer in the closure")

    def test_main_ShouldFail_WhenThePendingModuleIsOnlyInALazyChunk(self):
        self._chunk(_ENTRY, ["src/main.tsx"], _ENTRY_BODY)
        self._chunk(_LAZY_CHARTS, [_PENDING])
        self._assert_fails("PENDING_PR2 entry")

    def test_main_ShouldFail_WhenAnotherOperationsModuleIsInTheClosure(self):
        for module in (
            "src/operations/stores/agent-states-store.ts",
            "src/operations/stores/campaign-metrics-store.tsx",
            "src/operations/stores/campaign-metrics-store.test.ts",
            "src/operations/stores/campaign-metrics-store.ts/child.ts",
            "src/operations/campaign-metrics-store.ts",
            "apps/console/src/operations/stores/campaign-metrics-store.ts",
        ):
            with self.subTest(module=module):
                self._chunk(_ENTRY, [*_ENTRY_SOURCES, module], _ENTRY_BODY)
                self._assert_fails(f"{_ENTRY}: forbidden module {module}")


class ReportTests(_DistFixture):
    def _rows(self):
        return [
            ("/agent/conversation/:id", _AGENT_CLOSURE),
            ("analytics dashboard", (*_ENTRY_CLOSURE, _ANALYTICS_LAYOUT, _DASHBOARD_PAGE)),
            ("CDR", (*_ENTRY_CLOSURE, _ANALYTICS_LAYOUT, _CDR_PAGE)),
            ("flow designer", (*_ENTRY_CLOSURE, _ADMIN_LAYOUT, _FLOW_DESIGNER)),
            ("operations", (*_ENTRY_CLOSURE, _OPERATIONS_LAYOUT)),
        ]

    def test_main_ShouldPrintEveryRouteWithTheGuardsMeasure_WhenReportIsAsked(self):
        result = self._assert_passes("--report")
        for route, chunks in self._rows():
            self.assertIn(f"| {route} | {len(chunks)} | {self._total(*chunks):,} |", result.stdout)

    def test_main_ShouldPrintNoTable_WhenReportIsNotAsked(self):
        self.assertNotIn("| Route |", self._assert_passes().stdout)

    def test_main_ShouldAcceptReportBeforeTheDist(self):
        result = subprocess.run(
            [sys.executable, _SCRIPT, "--report", self._dist],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("| Route |", result.stdout)

    def test_main_ShouldStillFailWithTheTable_WhenTheGuardFails(self):
        self._link(_AGENT_LAYOUT, _EXTRA)
        self._chunk(_EXTRA, ["src/admin/users/users-page.tsx"])
        self._assert_fails("forbidden module src/admin/users/users-page.tsx", "| Route |", args=("--report",))

    def test_main_ShouldFailOnlyWithReport_WhenAReportedRouteMatchesNoChunk(self):
        for chunk, stem in (
            (_ANALYTICS_LAYOUT, "analytics-layout"),
            (_DASHBOARD_PAGE, "dashboard-page"),
            (_CDR_PAGE, "cdr-page"),
            (_ADMIN_LAYOUT, "admin-layout"),
            (_FLOW_DESIGNER, "flow-designer"),
            (_OPERATIONS_LAYOUT, "operations-layout"),
        ):
            with self.subTest(stem=stem):
                content = self._read(chunk)
                self._remove(chunk)
                self._assert_fails(f"root {stem}-*", args=("--report",))
                self._assert_passes()
                self._write(chunk, content)


class UsageTests(_DistFixture):
    def test_main_ShouldFail_WhenNoDistIsGiven(self):
        result = subprocess.run([sys.executable, _SCRIPT], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("usage", result.stderr)

    def test_main_ShouldFail_WhenGivenTwoDists(self):
        result = self._run(self._dist)
        self.assertEqual(result.returncode, 1)
        self.assertIn("usage", result.stderr)


if __name__ == "__main__":
    unittest.main()
