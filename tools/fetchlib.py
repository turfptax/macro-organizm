#!/usr/bin/env python3
"""Shared helpers for tools/fetch_debt.py and tools/fetch_prices.py.

    python tools/fetchlib.py --selftest      run the offline self-test (a local test server, no internet)

Python 3.12 standard library only. Import it as `import fetchlib` and run the fetchers as plain
`python tools/fetch_x.py` (not `python -I`, which hides the script directory).

What is here
  Raw             download cache: data/raw/<pipeline>/ plus manifest.json (url, retrieved date, bytes, sha256),
                  retries, user-agent handling, validation before a cached file is replaced, offline mode
  FetchError, ParseError, warn
  decode_text, read_rows, read_dicts, read_json, to_float, code_of   text, csv and number parsing
  read_xlsx, XlsxBook, Sheet, xl_date                           zip-based xlsx reader
  iter_zip_csv, iter_zip_lines, zip_members, zip_read           zip helpers that stream large members
  norm_period, period_add, period_seq, to_annual, r_dp, r_sig  period and rounding helpers
  check_plausible                                               per-series plausible-range checks
  render_js, write_js, read_js_global, ascii_fold               one window.<NAME> global, ASCII, no em dash
  make_parser, parse_only, online_for, Skipped, print_table     command line and run-report helpers
"""
import argparse
import contextlib
import csv
import datetime as dt
import hashlib
import http.client
import io
import json
import math
import os
import posixpath
import re
import sys
import time
import unicodedata
import unittest
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parent.parent
RAW_ROOT = ROOT / "data" / "raw"
TODAY = dt.date.today().isoformat()

# User-agent kinds. Hosts disagree: IMF answers 403 to "Mozilla/5.0" but accepts urllib's own agent;
# JST, BoE, the Fed, NBER and BLS answer 403 to urllib's agent; BLS also wants a contact address.
UA_BROWSER = "browser"    # "Mozilla/5.0"
UA_PYTHON = "python"      # no header set, so urllib sends its own "Python-urllib/3.x"
UA_CONTACT = "contact"    # "MacroOrganizm/1.0 (contact: <email>)", needed for BLS
CONTACT_ENV = "MACRO_FETCH_CONTACT"

EM_DASH = chr(0x2014)
MAX_DOWNLOAD = 256 * 1024 * 1024
MAX_MEMBER = 512 * 1024 * 1024
KINDS = ("json", "csv", "text", "html", "zip", "xlsx")


class FetchError(Exception):
    """A download failed. network is True for connection-level failures, status is the HTTP code if any."""

    def __init__(self, msg, network=False, status=None):
        super().__init__(msg)
        self.network = network
        self.status = status


class ParseError(Exception):
    """A response arrived but is not usable (wrong shape, missing column, implausible value)."""


def _ascii(s):
    return str(s).encode("ascii", "replace").decode("ascii")


def warn(msg):
    print("warning: " + _ascii(msg), file=sys.stderr)


# ------------------------------------------------------------------ urls and agents

_SECRET_PARAM = re.compile(r"(?i)([?&](?:api_?key|key|token|registrationkey|password)=)[^&#]*")


def redact_url(url):
    """Replace the value of key-like query parameters so a secret never reaches the manifest or a message."""
    return _SECRET_PARAM.sub(r"\1REDACTED", url)


def build_url(base, params=None, safe="[],:"):
    """Append query parameters. Brackets, commas and colons stay literal (Treasury Fiscal Data syntax)."""
    if not params:
        return base
    q = urllib.parse.urlencode(params, doseq=True, quote_via=urllib.parse.quote, safe=safe)
    return base + ("&" if "?" in base else "?") + q


def user_agent(kind, contact=None):
    """Header value for a user-agent kind; None means leave urllib's own default. Any other text is used as is."""
    if kind == UA_PYTHON:
        return None
    if kind == UA_BROWSER:
        return "Mozilla/5.0"
    if kind == UA_CONTACT:
        c = (contact or os.environ.get(CONTACT_ENV, "")).strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", c):
            raise FetchError(f"this source needs a contact email in the User-Agent; set {CONTACT_ENV} or pass --contact")
        return f"MacroOrganizm/1.0 (contact: {c})"
    return kind


def sniff(body, kind):
    """Cheap shape test for a response body. Raises on a mismatch, returns None otherwise."""
    if kind in ("csv", "text"):
        head = body[:1024].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
        if head.startswith((b"<!doctype", b"<html")):
            raise ValueError("got a web page, not data")
    elif kind == "json":
        json.loads(decode_text(body))
    elif kind == "zip":
        if not zipfile.is_zipfile(io.BytesIO(body)):
            raise ValueError("not a zip file")
    elif kind == "xlsx":
        if not zipfile.is_zipfile(io.BytesIO(body)) or "xl/workbook.xml" not in zipfile.ZipFile(io.BytesIO(body)).namelist():
            raise ValueError("not an xlsx workbook")
    elif kind != "html":
        raise ValueError("unknown kind " + repr(kind))


# ------------------------------------------------------------------- raw cache

class Got(NamedTuple):
    """Result of Raw.get and Raw.get_parsed. fell_back is True only when a download was tried and failed."""
    value: object
    retrieved: str
    fell_back: bool


class Raw:
    """Download cache for one pipeline: data/raw/<pipeline>/<name> plus manifest.json.

    Raw("debt", offline=args.offline, contact=args.contact). Cache file names are flat (no folders).
    The manifest records, per file, the public url, the retrieval date, the size and a sha256.
    """

    def __init__(self, pipeline, offline=False, *, ua=UA_BROWSER, contact=None, root=None, today=None,
                 retry_delay=1.5, opener=None):
        if not re.fullmatch(r"[a-z0-9_-]+", pipeline):
            raise ValueError("pipeline name must be lower case letters, digits, - or _")
        self.pipeline = pipeline
        self.dir = Path(root or RAW_ROOT) / pipeline
        self.offline = offline
        self.ua = ua
        self.contact = contact
        self.today = today or TODAY
        self.retry_delay = retry_delay
        self.opener = opener           # a urllib OpenerDirector, for tests
        self.throttle = {}             # host -> minimum seconds between requests, e.g. {"www.ons.gov.uk": 5}
        self._last = {}
        self.session = {}              # bodies downloaded in this run, by name
        self.fell_back = set()         # names whose download failed and were read from the cache instead
        self.manifest = {}
        mp = self.dir / "manifest.json"
        if mp.exists():
            try:
                self.manifest = json.loads(mp.read_text("utf-8"))
            except ValueError as e:
                raise FetchError(f"{mp} is not valid JSON ({e}); restore or delete it")

    # ---- paths

    def path(self, name):
        if name != Path(name).name or name.startswith(".") or name.endswith(".part") or name == "manifest.json":
            raise ValueError("bad cache file name: " + repr(name))
        return self.dir / name

    # ---- download

    def download(self, name, url, public_url=None, headers=None, timeout=45, attempts=2, check=None,
                 kind=None, ua=None, data=None, min_fraction=None, max_bytes=MAX_DOWNLOAD):
        """Fetch url into the cache as name and return the body.

        check(body) must accept the body before it replaces the cache. kind ("json", "csv", "text", "html",
        "zip", "xlsx") adds a cheap shape test first. ua picks a user-agent kind (default: the Raw setting);
        a 401, 403 or 406 retries once with the other of browser and python. data is a POST body.
        min_fraction rejects a body smaller than that fraction of the cached file. public_url is what the
        manifest shows (secrets are masked automatically when it is omitted).
        """
        if self.offline:
            raise FetchError("offline mode")
        if name in self.session:
            return self.session[name]
        if kind is not None and kind not in KINDS:
            raise ValueError("unknown kind " + repr(kind))
        target = self.path(name)
        shown = public_url or redact_url(url)
        chain = self._ua_chain(ua or self.ua)
        err = None
        for i in range(max(1, attempts)):
            delay = self.retry_delay * (i + 1)
            try:
                self._pace(url)
                body = self._request(url, data, headers, chain, timeout, max_bytes)
                if not body:
                    raise FetchError("empty response from " + shown)
                try:
                    if kind:
                        sniff(body, kind)
                    if check:
                        check(body)
                except FetchError:
                    raise
                except Exception as e:
                    raise FetchError(f"unusable response from {shown}: {e}")
                if min_fraction and target.exists() and len(body) < min_fraction * target.stat().st_size:
                    raise FetchError(f"response from {shown} is {len(body)} bytes, much smaller than the cached "
                                     f"{target.stat().st_size}")
                self.dir.mkdir(parents=True, exist_ok=True)
                tmp = self.dir / (name + ".part")
                tmp.write_bytes(body)
                tmp.replace(target)
                self.manifest[name] = {"url": shown, "retrieved": self.today, "bytes": len(body),
                                       "sha256": hashlib.sha256(body).hexdigest()}
                self.session[name] = body
                return body
            except urllib.error.HTTPError as e:
                e.close()
                err = FetchError(f"HTTP {e.code} from {shown}", status=e.code)
                if not (e.code in (408, 425, 429) or e.code >= 500):
                    break
                try:
                    delay = min(30.0, float(e.headers.get("Retry-After", ""))) if e.code in (429, 503) else delay
                except ValueError:
                    pass
            except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
                err = FetchError(f"{type(e).__name__}: {getattr(e, 'reason', e)} ({shown})", network=True)
            except FetchError as e:
                err = e
            if i + 1 < attempts:
                time.sleep(delay)
        raise err

    def _ua_chain(self, ua):
        chain = {UA_BROWSER: [UA_BROWSER, UA_PYTHON], UA_PYTHON: [UA_PYTHON, UA_BROWSER]}.get(ua, [ua])
        for k in chain:
            user_agent(k, self.contact)   # raises now, before any request, if a contact email is missing
        return chain

    def _pace(self, url):
        host = urllib.parse.urlsplit(url).hostname or ""
        gap = self.throttle.get(host, 0)
        if gap:
            wait = self._last.get(host, 0) + gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last[host] = time.monotonic()

    def _request(self, url, data, headers, chain, timeout, max_bytes):
        open_ = self.opener.open if self.opener else urllib.request.urlopen
        for n, kind in enumerate(chain):
            hdrs = dict(headers or {})
            if not any(k.lower() == "user-agent" for k in hdrs):
                v = user_agent(kind, self.contact)
                if v:
                    hdrs["User-Agent"] = v
            try:
                with open_(urllib.request.Request(url, data=data, headers=hdrs), timeout=timeout) as resp:
                    buf = bytearray()
                    while True:
                        chunk = resp.read(1 << 20)
                        if not chunk:
                            break
                        buf += chunk
                        if len(buf) > max_bytes:
                            raise FetchError(f"response larger than {max_bytes} bytes")
                    want = resp.headers.get("Content-Length", "")
                    if want.isdigit() and int(want) != len(buf) and not resp.headers.get("Content-Encoding"):
                        raise FetchError(f"truncated download ({len(buf)} of {want} bytes)", network=True)
                    return bytes(buf)
            except urllib.error.HTTPError as e:
                if e.code in (401, 403, 406) and n + 1 < len(chain):
                    e.close()
                    continue
                raise

    # ---- reading

    def cached(self, name):
        """(body, retrieved date) of a cached file, or (None, None)."""
        p = self.path(name)
        if not p.exists():
            return None, None
        return p.read_bytes(), self.retrieved_of(name)

    def retrieved_of(self, name):
        p = self.path(name)
        when = self.manifest.get(name, {}).get("retrieved")
        if when or not p.exists():
            return when
        return dt.date.fromtimestamp(p.stat().st_mtime).isoformat()

    def url_of(self, name, default):
        return self.manifest.get(name, {}).get("url", default)

    def newest_retrieved(self, names=None):
        """Newest retrieval date among names (default: everything in the manifest); None if there are none.

        Use it as the `generated` date so an offline rebuild reproduces the file it was built from.
        """
        dates = [self.retrieved_of(n) for n in (names if names is not None else self.manifest)]
        dates = [d for d in dates if d]
        return max(dates) if dates else None

    def get(self, name, url, online=True, **kw):
        """Download, else use the cached copy. Returns Got(body, retrieved, fell_back).

        A deliberate cache read (offline, or online=False for a series left out of --only) is not a
        fallback: fell_back is True only when a download was tried and failed.
        """
        if online and not self.offline:
            try:
                return Got(self.download(name, url, **kw), self.today, False)
            except FetchError as e:
                warn(f"{name}: {e}; trying cache")
                self.fell_back.add(name)
        body, when = self.cached(name)
        if body is None:
            raise FetchError(f"{name}: download failed and no cached copy" if online and not self.offline
                             else f"{name}: no cached copy in {self.dir}")
        return Got(body, when, name in self.fell_back)

    def get_parsed(self, name, url, parse, online=True, **kw):
        """Like get, but returns the parsed value. parse(body) also gates the download, so a body that does
        not parse never replaces the cache and the cached copy is parsed instead."""
        box = {}
        user_check = kw.pop("check", None)

        def check(b):
            if user_check:
                user_check(b)
            box["body"], box["value"] = b, parse(b)

        body, when, fell = self.get(name, url, online, check=check, **kw)
        if box.get("body") is body:
            return Got(box["value"], when, fell)
        try:
            return Got(parse(body), when, fell)
        except Exception as e:
            raise ParseError(f"{name}: {type(e).__name__}: {e}") from e

    def save_manifest(self):
        """Write manifest.json (sorted, stable). Returns False when nothing changed, so a rerun leaves it alone."""
        text = json.dumps(self.manifest, indent=1, sort_keys=True) + "\n"
        p = self.dir / "manifest.json"
        if (p.exists() and p.read_text("utf-8") == text) or (not p.exists() and not self.manifest):
            return False
        self.dir.mkdir(parents=True, exist_ok=True)
        p.write_text(text, "utf-8", newline="\n")
        return True


# ---------------------------------------------------------------- text, csv, json

def decode_text(body, encodings=("utf-8-sig", "cp1252")):
    for enc in encodings:
        try:
            return body.decode(enc)
        except UnicodeDecodeError:
            pass
    return body.decode("latin-1")


def read_rows(body, delimiter=",", skip=0, encoding=None):
    """All rows of a delimited file as lists of strings."""
    text = body.decode(encoding) if encoding else decode_text(body)
    rows = list(csv.reader(io.StringIO(text, newline=""), delimiter=delimiter))
    return rows[skip:]


def code_of(text):
    """The code part of a "CODE: label" cell as BIS writes them ("Q: Quarterly" -> "Q")."""
    return text.split(":", 1)[0].strip()


def _unique(names, codes=False):
    seen, out = {}, []
    for n in names:
        n = code_of(n) if codes else n.strip()
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}.{seen[n]}")
    return out


def read_dicts(body, delimiter=",", header_row=0, strip=True, encoding=None, code_headers=False):
    """Rows as dicts keyed by the header row. Blank rows are dropped, short rows padded, values stripped.
    BLS flat files are tab separated with padded series ids, so read_dicts(body, "\\t") suits them.
    code_headers=True keeps only the code of a "CODE:Label" header (BIS)."""
    rows = read_rows(body, delimiter, 0, encoding)
    if len(rows) <= header_row:
        raise ParseError("no header row")
    head = _unique(rows[header_row], code_headers)
    out = []
    for r in rows[header_row + 1:]:
        if not r or all(not c.strip() for c in r):
            continue
        r = r + [""] * (len(head) - len(r))
        out.append({h: (c.strip() if strip else c) for h, c in zip(head, r)})
    return out


def read_json(body):
    try:
        return json.loads(decode_text(body))
    except ValueError as e:
        raise ParseError(f"not JSON: {e}")


NA_TOKENS = frozenset(["", ".", "..", "...", "-", "--", "na", "n/a", "nan", "nd", "null", "none", "x",
                       "(na)", "(x)", "(d)", "(s)", "(z)"])


def to_float(x, na=NA_TOKENS):
    """Float from text or a number. A recognised not-available token gives None; anything else that is not
    a number raises ValueError (so a format change fails loudly instead of becoming a gap)."""
    if x is None:
        return None
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        return float(x) if math.isfinite(x) else None
    s = str(x).strip()
    if s.lower() in na:
        return None
    v = float(s.replace(",", "").replace("$", "").replace("%", "").strip()) if re.search(r"\d", s) else None
    if v is None or not math.isfinite(v):
        raise ValueError("not a number: " + ascii(s))
    return v


# ------------------------------------------------------------------ periods

_MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}


def _month(y, m):
    m = int(m)
    if not 1 <= m <= 12:
        raise ValueError(f"month {m} out of range")
    return f"{int(y):04d}-{m:02d}"


def norm_period(s):
    """Normalise a period label to YYYY, YYYY-MM or YYYY-Qn. Accepts 1913, 1913M01, 2020Q1, 2020-Q1,
    2020-03, 2020-03-31, 202003, 20200331, "2020 MAR" and "Mar 2020". Raises ValueError otherwise."""
    s = str(s).strip()
    m = re.fullmatch(r"(\d{4})", s)
    if m:
        return m.group(1)
    m = re.fullmatch(r"(\d{4})\s*[-_/ ]?\s*[Qq]([1-4])", s)
    if m:
        return f"{m.group(1)}-Q{m.group(2)}"
    m = (re.fullmatch(r"(\d{4})\s*[-_/ ]?\s*[Mm](\d{1,2})", s) or re.fullmatch(r"(\d{4})-(\d{1,2})(?:-\d{1,2})?", s)
         or re.fullmatch(r"(\d{4})(\d{2})(?:\d{2})?", s))
    if m:
        return _month(m.group(1), m.group(2))
    m = re.fullmatch(r"(\d{4})\s+([A-Za-z]{3})[A-Za-z]*", s)
    if m and m.group(2).lower() in _MONTHS:
        return _month(m.group(1), _MONTHS[m.group(2).lower()])
    m = re.fullmatch(r"([A-Za-z]{3})[A-Za-z]*[ ,-]+(\d{4})", s)
    if m and m.group(1).lower() in _MONTHS:
        return _month(m.group(2), _MONTHS[m.group(1).lower()])
    raise ValueError("unrecognised period " + ascii(s))


def _split_period(p):
    if len(p) == 4:
        return "A", int(p), 0
    if len(p) == 7 and p[4:6] == "-Q":
        return "Q", int(p[:4]), int(p[6]) - 1
    if len(p) == 7 and p[4] == "-":
        return "M", int(p[:4]), int(p[5:7]) - 1
    raise ValueError("not a normalised period: " + ascii(p))


def period_freq(p):
    """"A", "Q" or "M"."""
    return _split_period(p)[0]


def period_add(p, n):
    f, y, k = _split_period(p)
    if f == "A":
        return f"{y + n:04d}"
    per = 12 if f == "M" else 4
    y, k = divmod(y * per + k + n, per)
    return f"{y:04d}-{k + 1:02d}" if f == "M" else f"{y:04d}-Q{k + 1}"


def period_seq(first, last):
    """Every period from first to last inclusive (same frequency)."""
    if period_freq(first) != period_freq(last):
        raise ValueError("first and last have different frequencies")
    out, p = [], first
    while p <= last:
        out.append(p)
        p = period_add(p, 1)
    return out


def to_annual(data, how="mean", complete=True):
    """{period: value} monthly or quarterly -> {"YYYY": value}. how is mean, last, first or sum.
    complete=True skips years without all 12 months (or 4 quarters). Annual input passes through."""
    need = {"M": 12, "Q": 4, "A": 1}
    groups = {}
    for p, v in data.items():
        if v is not None:
            groups.setdefault(p[:4], []).append((p, v))
    out = {}
    for y, items in sorted(groups.items()):
        freqs = {period_freq(p) for p, _ in items}
        if len(freqs) != 1:
            raise ValueError("mixed frequencies in " + y)
        if complete and len(items) < need[freqs.pop()]:
            continue
        vals = [v for _, v in sorted(items)]
        out[y] = {"mean": lambda: sum(vals) / len(vals), "last": lambda: vals[-1], "first": lambda: vals[0],
                  "sum": lambda: sum(vals)}[how]()
    return out


def r_dp(v, dp=2):
    """Round to dp decimals; whole numbers come back as int, and -0 becomes 0. None passes through."""
    if v is None:
        return None
    if not math.isfinite(v):
        raise ValueError("NaN or infinity cannot be stored")
    x = round(float(v), dp)
    return 0 if x == 0 else int(x) if x == int(x) and abs(x) < 1e15 else x


def r_sig(v, n=6):
    """Round to n significant figures (same rules as r_dp)."""
    if v is None:
        return None
    if not math.isfinite(v):
        raise ValueError("NaN or infinity cannot be stored")
    x = float(f"{v:.{n}g}")
    return 0 if x == 0 else int(x) if x == int(x) and abs(x) < 1e15 else x


# ------------------------------------------------------------------ xlsx

def col_index(letters):
    """A -> 1, Z -> 26, AA -> 27."""
    n = 0
    for ch in letters.upper():
        n = n * 26 + ord(ch) - 64
    return n


def col_name(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def split_ref(ref):
    """"B12" -> (2, 12) as (column number, row number)."""
    m = re.fullmatch(r"([A-Za-z]+)(\d+)", ref)
    if not m:
        raise ValueError("bad cell reference " + repr(ref))
    return col_index(m.group(1)), int(m.group(2))


def xl_date(serial, date1904=False):
    """Excel serial number to a date. Correct for serials from 61 (1 Mar 1900) in the 1900 system."""
    return (dt.date(1904, 1, 1) if date1904 else dt.date(1899, 12, 30)) + dt.timedelta(days=int(serial))


def _local(tag):
    return tag.rpartition("}")[2]


def _si_text(el):
    """Text of a shared-string item or inline string: plain and rich runs, never the phonetic runs."""
    out = []
    for ch in el:
        n = _local(ch.tag)
        if n == "t":
            out.append(ch.text or "")
        elif n == "r":
            out.extend((t.text or "") for t in ch if _local(t.tag) == "t")
    return "".join(out)


class Sheet:
    """One worksheet. cells maps "B12" to a str, float or bool (blank and error cells are absent)."""

    def __init__(self, name, cells, date1904=False):
        self.name = name
        self.cells = cells
        self.date1904 = date1904
        refs = [split_ref(r) for r in cells]
        self.ncols = max((c for c, _ in refs), default=0)
        self.nrows = max((r for _, r in refs), default=0)

    def get(self, ref, default=None):
        return self.cells.get(ref, default)

    def date(self, ref):
        v = self.cells.get(ref)
        return xl_date(v, self.date1904) if isinstance(v, float) else None

    def rows(self):
        """Dense list of rows (row 1 first); blank cells are None."""
        grid = [[None] * self.ncols for _ in range(self.nrows)]
        for ref, v in self.cells.items():
            c, r = split_ref(ref)
            grid[r - 1][c - 1] = v
        return grid

    def find(self, text, exact=True):
        """Refs of string cells equal to (or, with exact=False, containing) text, ignoring case, in row order."""
        t = text.strip().casefold()
        hits = [r for r, v in self.cells.items()
                if isinstance(v, str) and ((v.strip().casefold() == t) if exact else (t in v.casefold()))]
        return sorted(hits, key=lambda r: split_ref(r)[::-1])


class XlsxBook:
    """Minimal xlsx reader (zip + xml, streamed). src is bytes or a path. Old .xls files are refused."""

    def __init__(self, src):
        if isinstance(src, (bytes, bytearray)):
            if bytes(src[:8]) == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
                raise ParseError("legacy .xls workbook; only xlsx is supported")
            src = io.BytesIO(src)
        try:
            self.z = zipfile.ZipFile(src)
        except zipfile.BadZipFile as e:
            raise ParseError(f"not an xlsx file: {e}")
        names = set(self.z.namelist())
        if "xl/workbook.xml" not in names:
            raise ParseError("no xl/workbook.xml in the zip")
        wb = ET.fromstring(self.z.read("xl/workbook.xml"))
        rels = {}
        if "xl/_rels/workbook.xml.rels" in names:
            for r in ET.fromstring(self.z.read("xl/_rels/workbook.xml.rels")):
                t = r.get("Target", "")
                rels[r.get("Id")] = t.lstrip("/") if t.startswith("/") else posixpath.normpath("xl/" + t)
        self.date1904 = False
        self._sheets = []   # (name, member path)
        for el in wb.iter():
            n = _local(el.tag)
            if n == "workbookPr":
                self.date1904 = el.get("date1904") in ("1", "true")
            elif n == "sheet":
                rid = next((v for k, v in el.attrib.items() if _local(k) == "id"), None)
                if rid in rels:
                    self._sheets.append((el.get("name"), rels[rid]))
        self.sheet_names = [n for n, _ in self._sheets]
        self._strings = None

    def _shared(self):
        if self._strings is None:
            self._strings = []
            if "xl/sharedStrings.xml" in self.z.namelist():
                with self.z.open("xl/sharedStrings.xml") as f:
                    for _, el in ET.iterparse(f, events=("end",)):
                        if _local(el.tag) == "si":
                            self._strings.append(_si_text(el))
                            el.clear()
        return self._strings

    def sheet(self, which=None):
        """Sheet by name (exact, then ignoring case and spaces at the ends), by 0-based index, or the first."""
        if which is None:
            which = 0
        if isinstance(which, int):
            if not 0 <= which < len(self._sheets):
                raise ParseError(f"sheet index {which} out of range (have {self.sheet_names})")
            name, path = self._sheets[which]
        else:
            hits = [s for s in self._sheets if s[0] == which] or \
                   [s for s in self._sheets if s[0].strip().casefold() == which.strip().casefold()]
            if not hits:
                raise ParseError(f"sheet not found: {which} (have {self.sheet_names})")
            name, path = hits[0]
        try:
            size = self.z.getinfo(path).file_size
        except KeyError:
            raise ParseError(f"worksheet part {path} is missing from the zip")
        if size > 4 * MAX_MEMBER:
            raise ParseError("worksheet xml is implausibly large")
        cells = {}
        with self.z.open(path) as f:
            for _, el in ET.iterparse(f, events=("end",)):
                n = _local(el.tag)
                if n == "c":
                    v = self._value(el)
                    if v is not None:
                        if not el.get("r"):
                            raise ParseError("cell without a reference")
                        cells[el.get("r")] = v
                    el.clear()
                elif n == "row":
                    el.clear()
        return Sheet(name, cells, self.date1904)

    def _value(self, el):
        t, v, inline = el.get("t"), None, None
        for ch in el:
            n = _local(ch.tag)
            if n == "v":
                v = ch.text
            elif n == "is":
                inline = ch
        if t == "inlineStr":
            return _si_text(inline) if inline is not None else None
        if v is None or t == "e":
            return None
        if t == "s":
            return self._shared()[int(v)]
        if t in ("str", "d"):
            return v
        if t == "b":
            return v.strip() == "1"
        try:
            return float(v)
        except ValueError:
            raise ParseError(f"bad numeric cell {el.get('r')}: {v!r}")


def read_xlsx(src, sheet=None):
    """Read one worksheet of an xlsx (bytes or path) and return a Sheet."""
    return XlsxBook(src).sheet(sheet)


# -------------------------------------------------------------------- zip

def _zip_open(src):
    try:
        return zipfile.ZipFile(io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else src)
    except zipfile.BadZipFile as e:
        raise ParseError(f"not a zip file: {e}")


def zip_members(src):
    with _zip_open(src) as z:
        return [i.filename for i in z.infolist() if not i.is_dir()]


def _pick_member(names, member):
    if member is None:
        hits = names
    elif isinstance(member, re.Pattern):
        hits = [n for n in names if member.search(n)]
    else:
        hits = [n for n in names if n == member]
    if len(hits) != 1:
        raise ParseError(f"zip member {member!r} matched {len(hits)} of {names[:8]}")
    return hits[0]


def zip_read(src, member=None, max_bytes=MAX_MEMBER):
    """Bytes of one member (the only one, a name, or a compiled regex that matches exactly one)."""
    with _zip_open(src) as z:
        info = z.getinfo(_pick_member([i.filename for i in z.infolist() if not i.is_dir()], member))
        if info.file_size > max_bytes:
            raise ParseError(f"zip member {info.filename} is {info.file_size} bytes; stream it with iter_zip_lines")
        return z.read(info)


def iter_zip_lines(src, member=None, encoding="utf-8-sig", keep_newline=False):
    """Yield the lines of one member without loading it whole (the Fed Z.1 csv is over 3 GB)."""
    with _zip_open(src) as z:
        name = _pick_member([i.filename for i in z.infolist() if not i.is_dir()], member)
        with z.open(name) as f:
            for line in io.TextIOWrapper(f, encoding=encoding, newline=""):
                yield line if keep_newline else line.rstrip("\r\n")


def iter_zip_csv(src, member=None, encoding="utf-8-sig", delimiter=",", code_headers=False):
    """Yield dict rows of a csv member, streaming. Header and values are stripped.
    code_headers=True keeps only the code of a "CODE:Label" header (BIS); see code_of for the cells."""
    head = None
    for row in csv.reader(iter_zip_lines(src, member, encoding, True), delimiter=delimiter):
        if head is None:
            head = _unique(row, code_headers)
        elif row:
            yield {h: v.strip() for h, v in zip(head, row + [""] * (len(head) - len(row)))}


# ------------------------------------------------------------ plausible ranges

def _points(sid, data, col):
    if isinstance(data, dict):
        pts = [(str(p), v) for p, v in sorted(data.items()) if v is not None]
    else:
        pts = [(str(r[0]), r[col]) for r in data if len(r) > col and r[col] is not None]
        if any(a[0] >= b[0] for a, b in zip(pts, pts[1:])):
            raise ParseError(f"{sid}: periods are not strictly increasing")
    for p, v in pts:
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ParseError(f"{sid}: value at {p} is not a finite number: {v!r}")
    if not pts:
        raise ParseError(f"{sid}: no observations")
    return pts


def check_plausible(sid, data, *, col=1, last=None, first=None, every=None, min_points=None,
                    newest_after=None, max_ratio=None, max_step=None):
    """Guard one series against unit changes, truncation and stale feeds. Raises ParseError.

    data is {period: value} or rows [[period, value, ...], ...] (value read from column col; null values
    are skipped). Optional tests: last, first, every = (lo, hi) for the latest, earliest and all values;
    min_points; newest_after = the latest period must not be older (e.g. "2024"); max_ratio = largest
    allowed value ratio between neighbours (levels); max_step = largest allowed absolute change between
    neighbours (percent of GDP series). Returns {n, first, last, min, max} for a summary table.
    """
    pts = _points(sid, data, col)

    def inside(what, p, v, lohi):
        if not lohi[0] <= v <= lohi[1]:
            raise ParseError(f"{sid}: {what} value {v:g} ({p}) outside the plausible range {lohi[0]} to {lohi[1]}; "
                             "unit change at source?")

    if min_points and len(pts) < min_points:
        raise ParseError(f"{sid}: only {len(pts)} observations, expected at least {min_points}")
    if first:
        inside("first", *pts[0], first)
    if last:
        inside("latest", *pts[-1], last)
    if every:
        for p, v in pts:
            inside("an observed", p, v, every)
    if newest_after is not None and pts[-1][0] < str(newest_after):
        raise ParseError(f"{sid}: newest period {pts[-1][0]} is older than {newest_after}; stale or truncated source?")
    for (pp, pv), (p, v) in zip(pts, pts[1:]):
        if max_step is not None and abs(v - pv) > max_step:
            raise ParseError(f"{sid}: change of {v - pv:+g} from {pp} to {p} exceeds {max_step}")
        if max_ratio is not None and pv > 0 and v > 0 and max(v / pv, pv / v) > max_ratio:
            raise ParseError(f"{sid}: value ratio between {pp} and {p} exceeds {max_ratio}")
    vals = [v for _, v in pts]
    return dict(n=len(pts), first=pts[0], last=pts[-1], min=min(vals), max=max(vals))


# ----------------------------------------------------------- js output

_FOLD = {0x2013: "-", 0x2014: " - ", 0x2212: "-", 0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"',
         0x00A0: " ", 0x2009: " ", 0x202F: " ", 0x2026: "...", 0x2022: "*", 0x00D7: "x", 0x00DF: "ss",
         0x00F8: "o", 0x00D8: "O", 0x00E6: "ae", 0x00C6: "AE", 0x0153: "oe", 0x0152: "OE", 0x0142: "l",
         0x0141: "L", 0x0111: "d", 0x0110: "D", 0x0131: "i"}


def ascii_fold(s, errors="strict"):
    """ASCII text for a label that came from a source: accents dropped, dashes and quotes simplified.
    An em dash becomes " - ". errors="strict" raises ParseError on anything that has no ASCII form."""
    s = unicodedata.normalize("NFKD", s.translate(_FOLD))
    s = "".join(c for c in s if not unicodedata.combining(c))
    if not s.isascii():
        if errors == "strict":
            bad = next(c for c in s if ord(c) > 127)
            raise ParseError(f"no ASCII form for U+{ord(bad):04X} in {ascii(s[:40])}")
        s = s.encode("ascii", "replace").decode("ascii")
    return re.sub(r" {2,}", " ", s)


def _walk(obj, path="$"):
    """Yield (path, text) for every key and string value; raise on anything JSON cannot hold."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if not isinstance(k, str):
                raise TypeError(f"{path}: object keys must be strings, got {type(k).__name__}")
            yield path + " key", k
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            yield from _walk(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, float):
        if not math.isfinite(obj):
            raise ValueError(f"{path}: NaN or infinity cannot be written")
    elif obj is not None and not isinstance(obj, (bool, int)):
        raise TypeError(f"{path}: {type(obj).__name__} is not JSON data")


def check_clean(obj, strict_ascii=True):
    """Raise ParseError if any key or string holds an em dash (always) or a non-ASCII character (strict_ascii)."""
    for path, s in _walk(obj):
        if EM_DASH in s or "\\u2014" in s.lower():
            raise ParseError(f"{path}: contains an em dash: {ascii(s[:60])}")
        if strict_ascii and not s.isascii():
            bad = next(c for c in s if ord(c) > 127)
            raise ParseError(f"{path}: non-ASCII U+{ord(bad):04X} in {ascii(s[:60])}; run it through ascii_fold()")


def _scalar(v, dp):
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if dp is not None:
            v = round(v, dp)
        return "0" if v == 0 else str(int(v)) if v == int(v) and abs(v) < 1e15 else repr(v)
    return json.dumps(v, ensure_ascii=True)


def _compact(o, dp):
    if isinstance(o, dict):
        return "{" + ",".join(json.dumps(k) + ":" + _compact(v, dp) for k, v in o.items()) + "}"
    if isinstance(o, (list, tuple)):
        return "[" + ",".join(_compact(v, dp) for v in o) + "]"
    return _scalar(o, dp)


def _is_rows(o):
    return (isinstance(o, (list, tuple)) and len(o) > 0 and
            all(isinstance(r, (list, tuple)) and not any(isinstance(x, (list, tuple, dict)) for x in r) for r in o))


def _big(o, chunk):
    if _is_rows(o):
        return len(o) > chunk
    items = o.values() if isinstance(o, dict) else o if isinstance(o, (list, tuple)) else ()
    return any(_big(v, chunk) for v in items)


def _render(o, depth, levels, chunk, dp):
    pad = " " * depth
    if isinstance(o, dict):
        if not o:
            return "{}"
        if depth >= levels and not _big(o, chunk):
            return _compact(o, dp)
        inner = ",\n".join(f"{pad} {json.dumps(k)}:{_render(v, depth + 1, levels, chunk, dp)}" for k, v in o.items())
        return "{\n" + inner + "\n" + pad + "}"
    if isinstance(o, (list, tuple)):
        if not o:
            return "[]"
        if _is_rows(o):
            if len(o) <= chunk:
                return _compact(o, dp)
            lines = [",".join(_compact(r, dp) for r in o[i:i + chunk]) for i in range(0, len(o), chunk)]
            return "[\n" + ",\n".join(f"{pad} {ln}" for ln in lines) + "\n" + pad + "]"
        if depth >= levels and not _big(o, chunk):
            return _compact(o, dp)
        return "[\n" + ",\n".join(f"{pad} {_render(v, depth + 1, levels, chunk, dp)}" for v in o) + "\n" + pad + "]"
    return _scalar(o, dp)


def render_js(name, obj, *, generator, generated, levels=2, chunk=8, float_dp=None, strict_ascii=True):
    """Text of a data file: a header comment and exactly one global, `window.<name> = {...};`.

    Layout is stable: dicts and lists down to `levels` nesting go one entry per line, and lists of flat
    rows ([period, value, ...]) are packed `chunk` rows per line, so a regenerated file diffs cleanly.
    float_dp rounds every float to that many decimals. Raises ParseError on an em dash anywhere (keys and
    strings), and on any non-ASCII character unless strict_ascii=False (the output is ASCII either way).
    """
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        raise ValueError("global name must be upper case letters, digits and _")
    if not isinstance(obj, dict):
        raise TypeError("the global must be an object")
    if not re.fullmatch(r"[A-Za-z0-9_./ -]+", generator) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", generated):
        raise ValueError("generator must be a plain path and generated a YYYY-MM-DD date")
    check_clean(obj, strict_ascii)
    text = (f"// Generated by {generator} on {generated}. Do not edit by hand.\n"
            f"window.{name} = {_render(obj, 0, levels, chunk, float_dp)};\n")
    if not text.isascii() or EM_DASH in text or "\\u2014" in text.lower():
        raise ParseError("internal error: output is not clean ASCII")
    return text


def write_js(path, name, obj, *, generator, generated, max_bytes=None, **layout):
    """Render and write a data file. Returns {path, bytes, changed}. Nothing is written if the text is over
    max_bytes (ParseError) or identical to the file already there (changed=False)."""
    text = render_js(name, obj, generator=generator, generated=generated, **layout)
    data = text.encode("ascii")
    if max_bytes is not None and len(data) > max_bytes:
        raise ParseError(f"{name}: {len(data)} bytes is over the budget of {max_bytes}")
    path = Path(path)
    if path.exists() and path.read_bytes() == data:
        return dict(path=path, bytes=len(data), changed=False)
    tmp = path.with_name(path.name + ".part")
    tmp.write_bytes(data)
    tmp.replace(path)
    return dict(path=path, bytes=len(data), changed=True)


def read_js_global(src):
    """Parse a file (Path) or text written by render_js back into (name, object)."""
    text = src.read_text("utf-8") if isinstance(src, Path) else src
    lines = text.splitlines()
    while lines and lines[0].startswith("//"):
        lines.pop(0)
    m = re.fullmatch(r"\s*window\.([A-Z][A-Z0-9_]*) = (.*);\s*", "\n".join(lines), re.S)
    if not m:
        raise ParseError("not a single window.<NAME> = ...; file")
    return m.group(1), json.loads(m.group(2))


# ------------------------------------------------------- command line and report

def make_parser(doc):
    """ArgumentParser with the flags every fetcher shares: --offline, --only, --contact."""
    ap = argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="use the data/raw cache only, no network")
    ap.add_argument("--only", help="comma separated series ids to refresh from the network; others use the cache")
    ap.add_argument("--contact", help=f"email for the User-Agent of sources that require one (or set {CONTACT_ENV})")
    return ap


def parse_only(ap, args, known):
    """The --only ids as a set (None when absent); exits with code 2 on an unknown id."""
    if not args.only:
        return None
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    bad = only - set(known)
    if bad:
        ap.error("unknown series id: " + ", ".join(sorted(bad)))
    return only


def online_for(offline, only, sid):
    """True when series sid should be downloaded in this run."""
    return not offline and (only is None or sid in only)


class Skipped(dict):
    """Per-series failure log: one bad series must not stop the run.

        skipped = Skipped()
        with skipped.guard("us_cpi"):
            ...
        skipped.report()
    """

    @contextlib.contextmanager
    def guard(self, sid):
        try:
            yield
        except Exception as e:
            self[sid] = f"{type(e).__name__}: {e}"

    def report(self):
        for sid, why in self.items():
            print(f"SKIPPED {sid}: {_ascii(why)}")


def print_table(head, rows, left=1):
    """Plain text table; the first `left` columns are left aligned, the rest right aligned."""
    table = [tuple(head)] + [tuple(str(c) for c in r) for r in rows]
    widths = [max(len(r[i]) for r in table) for i in range(len(head))]
    for i, r in enumerate(table):
        print(_ascii("  ".join(c.ljust(w) if j < left else c.rjust(w) for j, (c, w) in enumerate(zip(r, widths)))))
        if i == 0:
            print("  ".join("-" * w for w in widths))


def remind_stamp(changed):
    """Print the cache-stamp reminder when any data file changed."""
    if changed:
        print("data files changed: bump the ?v= stamp on every page (node tools/stamp.js)")


# ---------------------------------------------------------------- self-test

def _make_xlsx():
    main = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    pkg = "http://schemas.openxmlformats.org/package/2006/relationships"
    parts = {
        "xl/workbook.xml": f'<workbook {main} {rel}><workbookPr/><sheets><sheet name="Data" sheetId="1" r:id="rId1"/>'
                           '<sheet name="Other" sheetId="2" r:id="rId2"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": f'<Relationships xmlns="{pkg}"><Relationship Id="rId1" Type="x" '
                                      'Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" '
                                      'Target="/xl/worksheets/sheet2.xml"/></Relationships>',
        "xl/sharedStrings.xml": f'<sst {main}><si><t>Year</t></si><si><r><t>Rich </t></r><r><t>text</t></r>'
                                '<rPh><t>PHONETIC</t></rPh></si></sst>',
        "xl/worksheets/sheet1.xml": f'<worksheet {main}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c>'
                                    '<c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>1913</v></c>'
                                    '<c r="B2"><v>9.8</v></c><c r="C2" t="inlineStr"><is><t>inline</t></is></c>'
                                    '<c r="D2" t="b"><v>1</v></c><c r="E2" t="e"><v>#N/A</v></c>'
                                    '<c r="F2"><v>44927</v></c></row></sheetData></worksheet>',
        "xl/worksheets/sheet2.xml": f'<worksheet {main}><sheetData><row r="3"><c r="AB3"><v>7</v></c></row>'
                                    '</sheetData></worksheet>',
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for k, v in parts.items():
            z.writestr(k, v)
    return buf.getvalue()


def _make_zip(members):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for k, v in members.items():
            z.writestr(k, v)
    return buf.getvalue()


class SelfTest(unittest.TestCase):
    server = None
    hits = {}

    @classmethod
    def setUpClass(cls):
        import http.server
        import threading
        xlsx = _make_xlsx()
        hits = cls.hits

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                p = self.path.split("?")[0]
                hits[p] = hits.get(p, 0) + 1
                ua = self.headers.get("User-Agent", "")
                code, body, extra = 200, b"", {}
                if p == "/ok.json":
                    body = b'{"a": 1}'
                elif p == "/flaky":
                    code, body = (500, b"oops") if hits[p] == 1 else (200, b'{"a": 2}')
                elif p == "/missing":
                    code, body = 404, b"no"
                elif p == "/html":
                    body = b"<!DOCTYPE html><html><body>Error</body></html>"
                elif p == "/imf":
                    code, body = (403, b"no") if "Mozilla" in ua else (200, b'{"imf": true}')
                elif p == "/jst":
                    code, body = (403, b"no") if ua.startswith("Python-urllib") else (200, b'{"jst": true}')
                elif p == "/bls":
                    code, body = (200, b"series\tvalue\n") if "contact:" in ua else (403, b"no")
                elif p == "/redir":
                    code, extra = 302, {"Location": "/ok.json"}
                elif p == "/xlsx":
                    body = xlsx
                self.send_response(code)
                self.send_header("Content-Length", "100" if p == "/short" else str(len(body)))
                for k, v in extra.items():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(b"0123456789" if p == "/short" else body)

        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def raw(self, tmp, **kw):
        kw.setdefault("retry_delay", 0.01)
        kw.setdefault("today", "2026-10-24")
        kw.setdefault("opener", urllib.request.build_opener(urllib.request.ProxyHandler({})))
        return Raw("t", root=tmp, **kw)

    def test_raw_download_cache_manifest(self):
        import tempfile
        import contextlib as cl
        with tempfile.TemporaryDirectory() as tmp:
            r = self.raw(tmp)
            self.assertEqual(r.download("a.json", self.base + "/ok.json?api_key=SECRET", kind="json"), b'{"a": 1}')
            self.assertEqual(r.manifest["a.json"]["url"], self.base + "/ok.json?api_key=REDACTED")
            self.assertEqual(r.manifest["a.json"]["retrieved"], "2026-10-24")
            self.assertTrue(r.save_manifest())
            self.assertFalse(r.save_manifest())
            self.assertEqual(self.raw(tmp).manifest, r.manifest)
            self.assertEqual(r.download("b.json", self.base + "/flaky"), b'{"a": 2}')        # 500 then 200
            self.hits.pop("/missing", None)
            with self.assertRaises(FetchError) as cm:
                r.download("c", self.base + "/missing")
            self.assertEqual((cm.exception.status, self.hits["/missing"]), (404, 1))          # 404 is not retried
            self.assertEqual(r.download("d.json", self.base + "/redir"), b'{"a": 1}')
            with self.assertRaises(FetchError):
                r.download("e", self.base + "/short", attempts=1)                              # truncated body
            # a bad response never replaces a good cache
            r2 = self.raw(tmp)
            with self.assertRaises(FetchError):
                r2.download("a.json", self.base + "/html", kind="json", attempts=1)
            with cl.redirect_stderr(io.StringIO()):
                got = r2.get("a.json", self.base + "/html", kind="json", attempts=1)
            self.assertEqual((got.value, got.retrieved, got.fell_back), (b'{"a": 1}', "2026-10-24", True))
            # offline reads the cache and never touches the network
            off = self.raw(tmp, offline=True)
            self.hits["/ok.json"] = 0
            self.assertEqual(off.get("a.json", self.base + "/ok.json").fell_back, False)
            self.assertEqual(self.hits["/ok.json"], 0)
            with self.assertRaises(FetchError):
                off.get("never", self.base + "/ok.json")
            # parse gates the download
            r3 = self.raw(tmp)
            self.assertEqual(r3.get_parsed("a.json", self.base + "/ok.json", read_json).value, {"a": 1})
            self.assertEqual(r3.newest_retrieved(), "2026-10-24")

    def test_user_agents(self):
        import tempfile
        from unittest import mock
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ):
            os.environ.pop(CONTACT_ENV, None)
            r = self.raw(tmp)
            self.hits.clear()
            self.assertEqual(r.download("imf.json", self.base + "/imf"), b'{"imf": true}')   # 403 for Mozilla, then python
            self.assertEqual(self.hits["/imf"], 2)
            self.assertEqual(self.raw(tmp, ua=UA_PYTHON).download("jst.json", self.base + "/jst"), b'{"jst": true}')
            self.assertEqual(self.hits["/jst"], 2)
            with self.assertRaises(FetchError) as cm:
                r.download("bls", self.base + "/bls", ua=UA_CONTACT)
            self.assertIn(CONTACT_ENV, str(cm.exception))
            self.assertNotIn("/bls", self.hits)                                                # no request without a contact
            ok = self.raw(tmp, contact="me@example.com")
            self.assertEqual(ok.download("bls", self.base + "/bls", ua=UA_CONTACT), b"series\tvalue\n")
            self.assertNotIn("me@example.com", json.dumps(ok.manifest))

    def test_parsing_helpers(self):
        self.assertEqual([norm_period(x) for x in ("1913", "1913M01", "2020Q1", "2020-q2", "2020-03-31", "202003",
                                                   "2020 MAR", "Mar 2020")],
                         ["1913", "1913-01", "2020-Q1", "2020-Q2", "2020-03", "2020-03", "2020-03", "2020-03"])
        for bad in ("1913M13", "abc", "2020-13"):
            with self.assertRaises(ValueError):
                norm_period(bad)
        self.assertEqual(period_add("2020-11", 3), "2021-02")
        self.assertEqual(period_add("2020-Q4", 1), "2021-Q1")
        self.assertEqual(period_seq("2020-Q3", "2021-Q1"), ["2020-Q3", "2020-Q4", "2021-Q1"])
        self.assertEqual(to_annual({"2020-Q1": 1, "2020-Q2": 2, "2020-Q3": 3, "2020-Q4": 4, "2021-Q1": 9}), {"2020": 2.5})
        self.assertEqual(to_annual({"2020-Q1": 1, "2021-Q1": 9}, "last", complete=False), {"2020": 1, "2021": 9})
        self.assertEqual((to_float("1,234.5"), to_float("."), to_float("(NA)"), to_float(" 3% ")), (1234.5, None, None, 3.0))
        with self.assertRaises(ValueError):
            to_float("12.3(P)")
        self.assertEqual((r_dp(2.0), r_dp(-0.001), r_dp(1.2345, 2), r_sig(123456.789, 6)), (2, 0, 1.23, 123457))
        rows = read_dicts(b"\xef\xbb\xbfseries_id\tyear\tvalue\n CU1   \t1913\t9.8\n\n", "\t")
        self.assertEqual(rows, [{"series_id": "CU1", "year": "1913", "value": "9.8"}])
        self.assertEqual(col_index("AB"), 28)
        self.assertEqual(col_name(28), "AB")

    def test_check_plausible(self):
        rows = [["2020", 10.0], ["2021", None], ["2022", 11.0], ["2023", 12.0]]
        s = check_plausible("x", rows, last=(5, 20), every=(1, 100), min_points=3, newest_after="2023", max_ratio=2)
        self.assertEqual((s["n"], s["last"], s["max"]), (3, ("2023", 12.0), 12.0))
        for kw in (dict(last=(0, 5)), dict(min_points=9), dict(newest_after="2024"), dict(max_step=0.5), dict(max_ratio=1.05)):
            with self.assertRaises(ParseError):
                check_plausible("x", rows, **kw)
        with self.assertRaises(ParseError):
            check_plausible("x", [["2021", 1.0], ["2020", 2.0]])
        with self.assertRaises(ParseError):
            check_plausible("x", {"2020": float("nan")})

    def test_xlsx_and_zip(self):
        book = XlsxBook(_make_xlsx())
        self.assertEqual(book.sheet_names, ["Data", "Other"])
        sh = book.sheet(" data ")
        self.assertEqual((sh.get("A2"), sh.get("B1"), sh.get("C2"), sh.get("D2"), sh.get("E2")),
                         (1913.0, "Rich text", "inline", True, None))
        self.assertEqual(xl_date(sh.get("F2")), dt.date(2023, 1, 1))
        self.assertEqual((sh.find("year"), sh.rows()[1][:2], sh.nrows, sh.ncols), (["A1"], [1913.0, 9.8], 2, 6))
        self.assertEqual(read_xlsx(_make_xlsx(), 1).get("AB3"), 7.0)
        for bad in (lambda: book.sheet("nope"), lambda: XlsxBook(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1xxxx"),
                    lambda: XlsxBook(b"not a zip")):
            with self.assertRaises(ParseError):
                bad()
        z = _make_zip({"a.csv": chr(0xFEFF) + "k:Key,v:Value\r\nx,1\r\ny,2\r\n", "b.txt": "hi"})
        self.assertEqual(zip_members(z), ["a.csv", "b.txt"])
        self.assertEqual(list(iter_zip_csv(z, "a.csv", code_headers=True)), [{"k": "x", "v": "1"}, {"k": "y", "v": "2"}])
        self.assertEqual(list(iter_zip_csv(z, "a.csv"))[0], {"k:Key": "x", "v:Value": "1"})
        self.assertEqual(code_of("Q: Quarterly"), "Q")
        self.assertEqual(zip_read(z, re.compile(r"\.txt$")), b"hi")
        with self.assertRaises(ParseError):
            zip_read(z)                                                                        # two members, none named

    def test_js_output(self):
        import tempfile
        obj = {"generated": "2026-10-24", "notes": ["a", "b"], "countries": {"US": {"name": "United States", "n": None}},
               "series": {"X": {"US": [[1990 + i, 1.0 + i / 3] for i in range(20)], "UK": [[1990, 2.5]]}}, "t": True}
        text = render_js("MACRO_TEST", obj, generator="tools/fetch_test.py", generated="2026-10-24", float_dp=2)
        self.assertTrue(text.isascii())
        self.assertEqual(text.splitlines()[0], "// Generated by tools/fetch_test.py on 2026-10-24. Do not edit by hand.")
        self.assertIn('"UK":[[1990,2.5]]', text)
        self.assertEqual(text.count("window."), 1)
        name, back = read_js_global(text)
        self.assertEqual(name, "MACRO_TEST")
        self.assertEqual(back["series"]["X"]["US"][1], [1991, 1.33])
        self.assertEqual(text, render_js("MACRO_TEST", obj, generator="tools/fetch_test.py", generated="2026-10-24", float_dp=2))
        kw = dict(generator="tools/fetch_test.py", generated="2026-10-24")
        for bad in ({"a": "x" + EM_DASH + "y"}, {"a" + EM_DASH: 1}, {"a": "caf" + chr(0xE9)}, {"a": ["\\u2014"]}):
            with self.assertRaises(ParseError):
                render_js("T", bad, **kw)
        self.assertIn("caf\\u00e9", render_js("T", {"a": "caf" + chr(0xE9)}, strict_ascii=False, **kw))
        with self.assertRaises(ParseError):
            render_js("T", {"a": EM_DASH}, strict_ascii=False, **kw)
        with self.assertRaises(ValueError):
            render_js("T", {"a": float("nan")}, **kw)
        with self.assertRaises(TypeError):
            render_js("T", {1: "a"}, **kw)
        with self.assertRaises(ValueError):
            render_js("bad name", {}, **kw)
        messy = "Cote " + EM_DASH + " d" + chr(0x2019) + "Ivoire, S" + chr(0xE3) + "o Tom" + chr(0xE9)
        self.assertEqual(ascii_fold(messy), "Cote - d'Ivoire, Sao Tome")
        with self.assertRaises(ParseError):
            ascii_fold(chr(0x4E2D))
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "x.js"
            self.assertTrue(write_js(p, "MACRO_TEST", obj, **kw)["changed"])
            self.assertFalse(write_js(p, "MACRO_TEST", obj, **kw)["changed"])
            with self.assertRaises(ParseError):
                write_js(Path(tmp) / "y.js", "MACRO_TEST", obj, max_bytes=100, **kw)
            self.assertFalse((Path(tmp) / "y.js").exists())


def selftest():
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(SelfTest))
    print("fetchlib selftest: " + ("ok" if result.wasSuccessful() else "FAILED") + f" ({result.testsRun} tests)")
    return 0 if result.wasSuccessful() else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selftest", action="store_true", help="run the offline self-test")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
