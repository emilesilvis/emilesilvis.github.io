"""Recorded Pangram results, explicit scans, and classification badges.

Only compact result metadata and pending task IDs are stored. API keys and
submitted text are never written to the results file.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import tempfile
import time
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


API_BASE_URL = "https://text.external-api.pangram.com"
CACHE_SCHEMA_VERSION = 1
DEFAULT_MODEL = "pangram-4"
DEFAULT_RESULTS_PATH = Path(__file__).parent / "data" / "pangram" / "results.json"
MIN_WORDS = 50
TERMINAL_SUCCESS = "STAGE_SUCCESS"
TERMINAL_FAILURE = "STAGE_FAILED"


class PangramError(RuntimeError):
    """Raised when Pangram cannot produce a trustworthy completed result."""


class _RetryableError(PangramError):
    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class _FailedTask(PangramError):
    """A terminal failure, rather than a temporarily unavailable result."""


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
    analyzed_at: str | None = None

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
                analyzed_at=_analysis_date(value.get("analyzed_at")),
            )
            if not _is_pangram_dashboard_url(result.dashboard_link):
                raise ValueError("invalid public dashboard link")
        except (TypeError, ValueError) as exc:
            raise PangramError(f"Pangram returned an invalid result: {exc}") from exc

        return result

    def to_cache(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_human(self) -> bool:
        return self.prediction_short.casefold() == "human"


def _analysis_date(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("analyzed_at is not a timestamp")
    date = datetime.fromisoformat(value)
    if date.tzinfo is None:
        raise ValueError("analyzed_at must include a timezone")
    return date.astimezone(timezone.utc).isoformat()


def ineligible_reason(text: str) -> str | None:
    count = len(text.split())
    if count < MIN_WORDS:
        return f"only {count} prose words; at least {MIN_WORDS} are required"
    return None


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
        for value in (timeout_seconds, poll_interval_seconds, request_timeout_seconds):
            if not math.isfinite(value) or value <= 0:
                raise ValueError("timeouts and polling interval must be positive and finite")
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self.request_timeout_seconds = request_timeout_seconds

    def analyze(
        self,
        text: str,
        *,
        task_id: str | None = None,
        on_submitted: Callable[[str], None] | None = None,
    ) -> PangramResult:
        reason = ineligible_reason(text)
        if reason:
            raise PangramError(f"Pangram scan skipped: {reason}")
        deadline = time.monotonic() + self.timeout_seconds
        if task_id is None:
            # Task creation is deliberately not retried: an ambiguous response
            # can represent an accepted, chargeable request.
            created = self._request_json(
                "POST", "/task",
                {"text": text, "model": self.model, "public_dashboard_link": True},
                timeout=min(self.request_timeout_seconds, self._remaining(deadline)),
            )
            task_id = created.get("task_id")
            if not isinstance(task_id, str) or not task_id.strip():
                raise PangramError("Pangram did not return a task ID")
            if on_submitted is not None:
                on_submitted(task_id)

        backoff = max(1.0, self.poll_interval_seconds)
        while True:
            remaining = self._remaining(deadline)
            try:
                response = self._request_json(
                    "GET", f"/task/{quote(task_id, safe='')}",
                    timeout=min(self.request_timeout_seconds, remaining),
                )
            except _RetryableError as exc:
                delay = max(backoff, exc.retry_after or 0)
                time.sleep(min(delay, self._remaining(deadline)))
                backoff = min(backoff * 2, 30)
                continue
            self._remaining(deadline)
            backoff = max(1.0, self.poll_interval_seconds)
            stage = response.get("stage")
            if stage == TERMINAL_SUCCESS:
                return PangramResult.from_mapping(
                    dict(response, analyzed_at=datetime.now(timezone.utc).isoformat()),
                    model=self.model,
                )
            if stage == TERMINAL_FAILURE:
                reason = response.get("headline") or "analysis failed"
                raise _FailedTask(f"Pangram analysis failed: {reason}")
            time.sleep(min(self.poll_interval_seconds, self._remaining(deadline)))

    def _remaining(self, deadline: float) -> float:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise PangramError(
                f"Pangram analysis did not finish within {self.timeout_seconds:g} seconds"
            )
        return remaining

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        *,
        timeout: float,
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
            with urlopen(request, timeout=timeout) as response:
                raw = response.read()
        except HTTPError as exc:
            detail = _response_detail(exc.read())
            suffix = f": {detail}" if detail else ""
            if exc.code in {408, 429, 500, 502, 503, 504}:
                raise _RetryableError(
                    f"Pangram returned HTTP {exc.code}{suffix}",
                    _retry_after(exc.headers.get("Retry-After") if exc.headers else None),
                ) from None
            raise PangramError(f"Pangram returned HTTP {exc.code}{suffix}") from None
        except URLError as exc:
            raise _RetryableError(f"Could not reach Pangram: {exc.reason}") from None
        except (TimeoutError, ConnectionError) as exc:
            raise _RetryableError(f"Could not reach Pangram: {exc}") from None

        try:
            value = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise PangramError("Pangram returned malformed JSON") from exc
        if not isinstance(value, dict):
            raise PangramError("Pangram returned an unexpected response")
        return value


def _retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        delay = float(value)
    except ValueError:
        try:
            delay = parsedate_to_datetime(value).timestamp() - time.time()
        except (TypeError, ValueError, OverflowError):
            return None
    return max(0, delay) if math.isfinite(delay) else None


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
    """Read recorded results; only explicit analyze calls can submit scans."""

    def __init__(
        self,
        results_path: Path = DEFAULT_RESULTS_PATH,
        *,
        model: str = DEFAULT_MODEL,
        client: PangramClient | None = None,
    ) -> None:
        if not model.strip():
            raise ValueError("model must not be empty")
        if client is not None and client.model != model.strip():
            raise ValueError("client and results must use the same model")
        self.results_path = results_path
        self.model = model.strip()
        self.client = client
        self.entries, self.pending_tasks = self._load()

    @classmethod
    def from_environment(cls) -> "PangramBadgeService":
        # Rendering is always offline, even if a developer has an API key set.
        return cls(Path(os.environ.get("PANGRAM_RESULTS_PATH", DEFAULT_RESULTS_PATH)))

    def lookup(self, text: str, *, model: str | None = None) -> PangramResult | None:
        """Return the newest matching report, optionally limited to one model."""
        normalized = text.strip()
        if ineligible_reason(normalized):
            return None
        candidates = []
        for fingerprint, value in self.entries.items():
            recorded_model = value["model"]
            if model is not None and recorded_model != model:
                continue
            if fingerprint == self._fingerprint(normalized, model=recorded_model):
                candidates.append(PangramResult.from_mapping(value, model=recorded_model))
        return max(candidates, key=lambda result: result.analyzed_at or "", default=None)

    def has_pending(self, text: str) -> bool:
        return self._fingerprint(text.strip()) in self.pending_tasks

    def analyze(self, text: str, *, refresh: bool = False) -> PangramResult | None:
        normalized = text.strip()
        if ineligible_reason(normalized):
            return None
        fingerprint = self._fingerprint(normalized)
        pending = self.pending_tasks.get(fingerprint)
        if pending is not None and pending["model"] != self.model:
            raise PangramError("Pending task model does not match the requested model")
        cached = self.lookup(normalized, model=self.model)
        if cached is not None and not refresh and pending is None:
            return cached
        if self.client is None:
            raise PangramError("Set PANGRAM_API_KEY to run an explicit scan")
        # Check that progress can be saved before starting chargeable work.
        self._save()

        def remember_task(task_id: str) -> None:
            self.pending_tasks[fingerprint] = {"task_id": task_id, "model": self.model}
            self._save()

        try:
            result = self.client.analyze(
                normalized,
                task_id=pending["task_id"] if pending else None,
                on_submitted=remember_task,
            )
        except _FailedTask:
            self.pending_tasks.pop(fingerprint, None)
            self._save()
            raise
        self.entries[fingerprint] = result.to_cache()
        self.pending_tasks.pop(fingerprint, None)
        self._save()
        return result

    def _fingerprint(self, text: str, *, model: str | None = None) -> str:
        payload = f"{CACHE_SCHEMA_VERSION}\0{model or self.model}\0{text}".encode("utf-8")
        return sha256(payload).hexdigest()

    def _load(self) -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            value = json.loads(self.results_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}, {}
        except (ValueError, OSError) as exc:
            raise PangramError(f"Cannot read Pangram results at {self.results_path}: {exc}") from exc
        try:
            if not isinstance(value, dict) or value.get("schema_version") != CACHE_SCHEMA_VERSION:
                raise ValueError("unsupported results schema")
            entries = value.get("entries")
            pending = value.get("pending_tasks", {})
            if not isinstance(entries, dict) or not isinstance(pending, dict):
                raise ValueError("entries and pending_tasks must be objects")
            for fingerprint in (*entries, *pending):
                if len(fingerprint) != 64 or any(c not in "0123456789abcdef" for c in fingerprint):
                    raise ValueError("invalid content fingerprint")
            for record in entries.values():
                if not isinstance(record, dict):
                    raise ValueError("invalid result entry")
                PangramResult.from_mapping(record, model=_required_string(record, "model"))
            for task in pending.values():
                if not isinstance(task, dict):
                    raise ValueError("invalid pending task")
                _required_string(task, "task_id")
                _required_string(task, "model")
        except (ValueError, PangramError) as exc:
            # Never discard paid records and silently submit replacement scans.
            raise PangramError(f"Invalid Pangram results at {self.results_path}: {exc}") from exc
        return entries, pending

    def _save(self) -> None:
        self.results_path.parent.mkdir(parents=True, exist_ok=True)
        value = {
            "schema_version": CACHE_SCHEMA_VERSION,
            "entries": self.entries,
            "pending_tasks": self.pending_tasks,
        }
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=self.results_path.parent,
            prefix=f".{self.results_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_path = Path(handle.name)
        temporary_path.replace(self.results_path)


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


def human_badge(result: PangramResult) -> str:
    """Render a badge only for Pangram's categorical Human result."""

    if not result.is_human:
        return ""

    dashboard_link = escape(result.dashboard_link, quote=True)
    details = f"Open this post's public analysis (Pangram {result.version}"
    if result.analyzed_at:
        details += f", {result.analyzed_at[:10]}"
    details = escape(details + ")", quote=True)
    return f'''<aside class="pangram-verification" aria-label="Pangram result: Human">
  <a class="pangram-verification__link" href="{dashboard_link}" target="_blank" rel="noopener noreferrer" title="{details}">
    <span class="pangram-verification__check" aria-hidden="true">✓</span>
    <span class="pangram-verification__source">Pangram</span> result: <strong>Human</strong>
  </a>
</aside>'''
