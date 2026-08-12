"""Build-time Pangram analysis and verified-human badge rendering.

Only compact result metadata is cached. The submitted post text and API key are
never written to the cache or generated site.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import tempfile
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


API_BASE_URL = "https://text.external-api.pangram.com"
CACHE_SCHEMA_VERSION = 1
DEFAULT_MODEL = "default"
TERMINAL_SUCCESS = "STAGE_SUCCESS"
TERMINAL_FAILURE = "STAGE_FAILED"


class PangramError(RuntimeError):
    """Raised when Pangram cannot produce a trustworthy completed result."""


@dataclass(frozen=True)
class PangramResult:
    model: str
    version: str
    headline: str
    prediction_short: str
    fraction_ai: float
    fraction_ai_assisted: float
    fraction_human: float
    dashboard_link: str

    @classmethod
    def from_mapping(cls, value: dict[str, Any], *, model: str) -> "PangramResult":
        try:
            result = cls(
                model=model,
                version=_required_string(value, "version"),
                headline=_required_string(value, "headline"),
                prediction_short=_required_string(value, "prediction_short"),
                fraction_ai=_fraction(value, "fraction_ai"),
                fraction_ai_assisted=_fraction(value, "fraction_ai_assisted"),
                fraction_human=_fraction(value, "fraction_human"),
                dashboard_link=_required_string(value, "dashboard_link"),
            )
        except (TypeError, ValueError) as exc:
            raise PangramError(f"Pangram returned an invalid result: {exc}") from exc

        if not _is_pangram_dashboard_url(result.dashboard_link):
            raise PangramError("Pangram did not return a valid public dashboard link")
        return result

    def to_cache(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_verified_human(self) -> bool:
        return self.prediction_short.casefold() == "human"


def _required_string(value: dict[str, Any], key: str) -> str:
    result = value.get(key)
    if not isinstance(result, str) or not result.strip():
        raise ValueError(f"{key} is missing")
    return result.strip()


def _fraction(value: dict[str, Any], key: str) -> float:
    result = value.get(key)
    if isinstance(result, bool) or not isinstance(result, (int, float)):
        raise ValueError(f"{key} is not a number")
    result = float(result)
    if not 0.0 <= result <= 1.0:
        raise ValueError(f"{key} is outside the 0–1 range")
    return result


def _is_pangram_dashboard_url(value: str) -> bool:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").casefold()
    return (
        parsed.scheme == "https"
        and (hostname == "pangram.com" or hostname.endswith(".pangram.com"))
        and bool(parsed.path)
    )


class PangramClient:
    """Small client for Pangram's asynchronous text-analysis API."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = DEFAULT_MODEL,
        base_url: str = API_BASE_URL,
        timeout_seconds: float = 300,
        poll_interval_seconds: float = 0.5,
        request_timeout_seconds: float = 30,
    ) -> None:
        if not api_key.strip():
            raise ValueError("api_key must not be empty")
        if not model.strip():
            raise ValueError("model must not be empty")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self.request_timeout_seconds = request_timeout_seconds

    def analyze(self, text: str) -> PangramResult:
        created = self._request_json(
            "POST",
            "/task",
            {
                "text": text,
                "model": self.model,
                "public_dashboard_link": True,
            },
        )
        task_id = created.get("task_id")
        if not isinstance(task_id, str) or not task_id.strip():
            raise PangramError("Pangram did not return a task ID")

        deadline = time.monotonic() + self.timeout_seconds
        while True:
            response = self._request_json("GET", f"/task/{quote(task_id, safe='')}")
            stage = response.get("stage")
            if stage == TERMINAL_SUCCESS:
                return PangramResult.from_mapping(response, model=self.model)
            if stage == TERMINAL_FAILURE:
                reason = response.get("headline") or "analysis failed"
                raise PangramError(f"Pangram analysis failed: {reason}")
            if time.monotonic() >= deadline:
                raise PangramError(
                    f"Pangram analysis did not finish within {self.timeout_seconds:g} seconds"
                )
            time.sleep(self.poll_interval_seconds)

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body = None
        headers = {
            "Accept": "application/json",
            "User-Agent": "emilesilvis.com-build/1.0",
            "x-api-key": self.api_key,
        }
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = Request(
            f"{self.base_url}{path}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=self.request_timeout_seconds) as response:
                raw = response.read()
        except HTTPError as exc:
            detail = _response_detail(exc.read())
            suffix = f": {detail}" if detail else ""
            raise PangramError(f"Pangram returned HTTP {exc.code}{suffix}") from None
        except URLError as exc:
            raise PangramError(f"Could not reach Pangram: {exc.reason}") from None

        try:
            value = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise PangramError("Pangram returned malformed JSON") from exc
        if not isinstance(value, dict):
            raise PangramError("Pangram returned an unexpected response")
        return value


def _response_detail(raw: bytes) -> str:
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return ""
    if not isinstance(value, dict):
        return ""
    detail = value.get("detail") or value.get("message") or value.get("error")
    return str(detail)[:240] if detail else ""


class PangramBadgeService:
    """Resolve Pangram results from a content-addressed cache or the API."""

    def __init__(
        self,
        cache_path: Path,
        *,
        model: str = DEFAULT_MODEL,
        api_key: str | None = None,
        required: bool = False,
        client: PangramClient | None = None,
    ) -> None:
        self.cache_path = cache_path
        self.model = model
        self.required = required
        self.client = client or (
            PangramClient(api_key, model=model) if api_key and api_key.strip() else None
        )
        self.entries = self._load_entries()

    @classmethod
    def from_environment(cls, default_cache_path: Path) -> "PangramBadgeService":
        cache_path = Path(os.environ.get("PANGRAM_CACHE_PATH", default_cache_path))
        return cls(
            cache_path,
            model=os.environ.get("PANGRAM_MODEL", DEFAULT_MODEL),
            api_key=os.environ.get("PANGRAM_API_KEY"),
            required=_environment_flag("PANGRAM_REQUIRED"),
        )

    def analyze(self, text: str) -> PangramResult | None:
        normalized = text.strip()
        if not normalized:
            return None

        fingerprint = self._fingerprint(normalized)
        cached = self.entries.get(fingerprint)
        if isinstance(cached, dict):
            try:
                return PangramResult.from_mapping(cached, model=self.model)
            except PangramError:
                # A malformed or old cache entry should be refreshed when possible.
                self.entries.pop(fingerprint, None)

        if self.client is None:
            if self.required:
                raise PangramError(
                    "This post has no cached Pangram result and PANGRAM_API_KEY is not set"
                )
            return None

        result = self.client.analyze(normalized)
        self.entries[fingerprint] = result.to_cache()
        self._save_entries()
        return result

    def _fingerprint(self, text: str) -> str:
        payload = f"{CACHE_SCHEMA_VERSION}\0{self.model}\0{text}".encode("utf-8")
        return sha256(payload).hexdigest()

    def _load_entries(self) -> dict[str, dict[str, Any]]:
        try:
            value = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {}
        if not isinstance(value, dict) or value.get("schema_version") != CACHE_SCHEMA_VERSION:
            return {}
        entries = value.get("entries")
        return entries if isinstance(entries, dict) else {}

    def _save_entries(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        value = {
            "schema_version": CACHE_SCHEMA_VERSION,
            "entries": self.entries,
        }
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=self.cache_path.parent,
            prefix=f".{self.cache_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_path = Path(handle.name)
        temporary_path.replace(self.cache_path)


def _environment_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().casefold() in {"1", "true", "yes", "on"}


class _ProseExtractor(HTMLParser):
    skipped_tags = {"code", "pre", "script", "style", "svg", "video"}
    block_tags = {
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "dd",
        "div",
        "dl",
        "dt",
        "figcaption",
        "figure",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "li",
        "main",
        "nav",
        "ol",
        "p",
        "section",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.skipped_tags:
            self.skip_depth += 1
        elif not self.skip_depth and tag in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.skipped_tags:
            self.skip_depth = max(0, self.skip_depth - 1)
        elif not self.skip_depth and tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def prose_from_html(html_content: str) -> str:
    """Extract readable prose while excluding code and embedded media."""

    parser = _ProseExtractor()
    parser.feed(html_content)
    parser.close()
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return "\n\n".join(line for line in lines if line)


def verified_human_badge(result: PangramResult) -> str:
    """Render a badge only for Pangram's categorical Human result."""

    if not result.is_verified_human:
        return ""

    dashboard_link = escape(result.dashboard_link, quote=True)
    return f'''<aside class="pangram-verification" aria-label="Verified human writing by Pangram">
  <a class="pangram-verification__link" href="{dashboard_link}" target="_blank" rel="noopener noreferrer" title="Open this post's public Pangram analysis">
    <span class="pangram-verification__check" aria-hidden="true">✓</span>
    <strong>Verified human writing</strong> by <span class="pangram-verification__source">Pangram</span>
  </a>
</aside>'''
