from contextlib import contextmanager, redirect_stdout
from email.utils import formatdate
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from build import build_post
from pangram_badge import (
    DEFAULT_MODEL, PangramBadgeService, PangramClient, PangramError,
    PangramResult, human_badge, prose_from_html,
)
from scan_pangram import main as scan_main


PROSE = (
    "I spent the afternoon walking beside the river and thinking about the book "
    "I had just finished. The story reminded me of the village where I grew up, "
    "especially the quiet streets and the old bridge. When I returned home, I "
    "wrote down a few observations to share with the friends who had recommended it."
)


def pangram_result(*, model=DEFAULT_MODEL, prediction_short="Human", version="4.0",
                   analyzed_at="2026-09-07T10:00:00+00:00"):
    return PangramResult(
        model=model, version=version, headline="Human Written",
        prediction_short=prediction_short, fraction_ai=0.01,
        fraction_ai_assisted=0.02, fraction_human=0.97,
        dashboard_link="https://www.pangram.com/history/result-123",
        analyzed_at=analyzed_at,
    )


class StubClient:
    def __init__(self, result):
        self.result = result
        self.model = result.model
        self.calls = []

    def analyze(self, text, *, task_id=None, on_submitted=None):
        self.calls.append((text, task_id))
        if task_id is None and on_submitted:
            on_submitted("task-123")
        return self.result


class Clock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


class Response:
    def __init__(self, data):
        self.data = json.dumps(data).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.data


def success():
    return Response(dict(pangram_result().to_cache(), stage="STAGE_SUCCESS"))


def http_error(code, retry_after=None):
    headers = {"Retry-After": retry_after} if retry_after else {}
    return HTTPError("https://text.external-api.pangram.com/task/task-123", code,
                     "error", headers, io.BytesIO(b'{"detail":"temporary failure"}'))


@contextmanager
def requests(replies):
    clock = Clock()
    with patch("pangram_badge.urlopen", side_effect=replies) as request, \
         patch("pangram_badge.time.monotonic", clock.monotonic), \
         patch("pangram_badge.time.sleep", clock.sleep):
        yield request, clock


class OfflineTest(unittest.TestCase):
    def setUp(self):
        # No test may accidentally use a real API key or submit a paid scan.
        self.addCleanup(patch.stopall)
        patch("pangram_badge.urlopen", side_effect=AssertionError("Unexpected network request")).start()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.path = self.root / "data" / "results.json"

    def record(self, result=None, text=PROSE):
        result = result or pangram_result()
        client = StubClient(result)
        service = PangramBadgeService(self.path, client=client, model=result.model)
        service.analyze(text)
        return service, client

    def post(self, prose=PROSE, filename="01-01-2026-test-post.md"):
        path = self.root / filename
        path.write_text(f"# A human post\n\n{prose}\n\n~~~python\nsecret_code()\n~~~\n")
        return path


class PangramClientTests(OfflineTest):
    def test_request_uses_pangram_four_public_link_and_authentication(self):
        with requests([Response({"task_id": "task/123"}), success()]) as (request, _):
            result = PangramClient("secret").analyze(PROSE)
        post, poll = request.call_args_list
        self.assertEqual(post.args[0].get_method(), "POST")
        self.assertEqual(post.args[0].full_url, "https://text.external-api.pangram.com/task")
        self.assertEqual(json.loads(post.args[0].data), {
            "text": PROSE, "model": "pangram-4", "public_dashboard_link": True,
        })
        self.assertEqual(post.args[0].get_header("X-api-key"), "secret")
        self.assertTrue(poll.args[0].full_url.endswith("/task/task%2F123"))
        self.assertEqual(result.model, "pangram-4")
        self.assertIsNotNone(result.analyzed_at)

    def test_retryable_poll_errors_resume_the_same_task(self):
        errors = [http_error(429, "2"), http_error(503), URLError("offline"), TimeoutError("timeout")]
        with requests([Response({"task_id": "task-123"}), *errors, success()]) as (request, clock):
            result = PangramClient("secret").analyze(PROSE)
        self.assertTrue(result.is_human)
        self.assertEqual(clock.sleeps, [2, 2, 4, 8])
        self.assertEqual([c.args[0].get_method() for c in request.call_args_list], ["POST"] + ["GET"] * 5)

    def test_retry_after_http_date_is_honored(self):
        error = http_error(429, formatdate(1004, usegmt=True))
        with patch("pangram_badge.time.time", return_value=1000), \
             requests([Response({"task_id": "task-123"}), error, success()]) as (_, clock):
            PangramClient("secret").analyze(PROSE)
        self.assertEqual(clock.sleeps, [4])

    def test_submission_failure_is_not_retried(self):
        with requests([http_error(503)]) as (request, clock):
            with self.assertRaisesRegex(PangramError, "HTTP 503"):
                PangramClient("secret").analyze(PROSE)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(clock.sleeps, [])

    def test_authorization_failure_is_not_retried(self):
        with requests([Response({"task_id": "task-123"}), http_error(401)]) as (request, clock):
            with self.assertRaisesRegex(PangramError, "HTTP 401"):
                PangramClient("secret").analyze(PROSE)
        self.assertEqual(request.call_count, 2)
        self.assertEqual(clock.sleeps, [])

    def test_deadline_includes_submission_and_bounds_requests_and_retry_sleep(self):
        clock = Clock()
        timeouts = []

        def exchange(request, *, timeout):
            timeouts.append(timeout)
            if request.get_method() == "POST":
                clock.now += 2
                return Response({"task_id": "task-123"})
            raise http_error(429, "60")

        with patch("pangram_badge.urlopen", side_effect=exchange), \
             patch("pangram_badge.time.monotonic", clock.monotonic), \
             patch("pangram_badge.time.sleep", clock.sleep):
            with self.assertRaisesRegex(PangramError, "within 3 seconds"):
                PangramClient("secret", timeout_seconds=3).analyze(PROSE)
        self.assertEqual(timeouts, [3, 1])
        self.assertEqual(clock.sleeps, [1])

    def test_processing_stage_is_polled_until_complete(self):
        replies = [Response({"task_id": "task-123"}), Response({"stage": "STAGE_PROCESSING"}), success()]
        with requests(replies) as (_, clock):
            self.assertTrue(PangramClient("secret").analyze(PROSE).is_human)
        self.assertEqual(clock.sleeps, [0.5])

    def test_failed_task_reports_the_reason(self):
        replies = [Response({"task_id": "task-123"}), Response({"stage": "STAGE_FAILED", "headline": "No valid text"})]
        with requests(replies):
            with self.assertRaisesRegex(PangramError, "No valid text"):
                PangramClient("secret").analyze(PROSE)

    def test_short_input_never_reaches_the_api(self):
        with self.assertRaisesRegex(PangramError, "at least 50"):
            PangramClient("secret").analyze("Too short")


class PangramRecordTests(OfflineTest):
    def test_record_survives_fresh_checkout_without_text_key_or_repeat_scan(self):
        service, client = self.record()
        clone_path = self.root / "fresh-checkout" / "results.json"
        clone_path.parent.mkdir()
        shutil.copyfile(self.path, clone_path)
        clone = PangramBadgeService(clone_path)
        self.assertEqual(clone.lookup(PROSE), service.lookup(PROSE))
        self.assertEqual(clone.analyze(PROSE), service.lookup(PROSE))
        self.assertEqual(len(client.calls), 1)
        contents = clone_path.read_text()
        self.assertNotIn(PROSE, contents)
        self.assertNotIn("secret", contents)
        self.assertEqual(json.loads(contents)["pending_tasks"], {})

    def test_prose_change_omits_old_badge_and_requires_a_new_scan(self):
        service, client = self.record()
        changed = PROSE + " I also took photographs."
        self.assertIsNone(service.lookup(changed))
        service.analyze(changed)
        self.assertEqual(len(client.calls), 2)

    def test_model_change_preserves_old_report_until_explicit_new_scan(self):
        old = pangram_result(model="default", version="3.3.2", analyzed_at="2026-09-03T10:00:00+00:00")
        self.record(old)
        client = StubClient(pangram_result(prediction_short="Mixed"))
        service = PangramBadgeService(self.path, client=client)
        self.assertEqual(service.lookup(PROSE), old)
        self.assertIsNone(service.lookup(PROSE, model=DEFAULT_MODEL))
        service.analyze(PROSE)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(service.lookup(PROSE).prediction_short, "Mixed")
        self.assertEqual(human_badge(service.lookup(PROSE)), "")
        self.assertEqual(service.lookup(PROSE, model="default"), old)

    def test_refresh_is_explicit(self):
        service, client = self.record()
        service.analyze(PROSE)
        self.assertEqual(len(client.calls), 1)
        service.analyze(PROSE, refresh=True)
        self.assertEqual(len(client.calls), 2)

    def test_unwritable_results_stop_before_submission(self):
        client = StubClient(pangram_result())
        service = PangramBadgeService(self.path, client=client)
        with patch.object(service, "_save", side_effect=OSError("disk full")):
            with self.assertRaisesRegex(OSError, "disk full"):
                service.analyze(PROSE)
        self.assertEqual(client.calls, [])

    def test_client_model_cannot_be_recorded_under_another_selector(self):
        client = StubClient(pangram_result(model="default", version="3.3.2"))
        with self.assertRaisesRegex(ValueError, "same model"):
            PangramBadgeService(self.path, client=client)

    def test_short_input_cannot_reuse_a_legacy_cached_badge(self):
        service, client = self.record()
        short = "A very short post."
        service.entries[service._fingerprint(short)] = pangram_result().to_cache()
        service._save()
        restored = PangramBadgeService(self.path, client=client)
        self.assertIsNone(restored.lookup(short))
        self.assertIsNone(restored.analyze(short))
        self.assertEqual(len(client.calls), 1)

    def test_exactly_fifty_words_are_eligible(self):
        text = " ".join(["word"] * 50)
        service, client = self.record(text=text)
        self.assertEqual(len(client.calls), 1)
        self.assertIsNotNone(service.lookup(text))

    def test_interrupted_scan_saves_task_before_polling_and_resumes_after_restart(self):
        service = PangramBadgeService(self.path, client=PangramClient("secret", timeout_seconds=1))
        replies = [Response({"task_id": "task-123"}), http_error(503, "5")]
        with requests(replies):
            with self.assertRaises(PangramError):
                service.analyze(PROSE)
        saved = json.loads(self.path.read_text())
        self.assertEqual(saved["entries"], {})
        self.assertEqual(list(saved["pending_tasks"].values()), [{"task_id": "task-123", "model": DEFAULT_MODEL}])

        resumed = PangramBadgeService(self.path, client=PangramClient("secret"))
        with requests([success()]) as (request, _):
            resumed.analyze(PROSE)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(request.call_args.args[0].get_method(), "GET")
        self.assertEqual(json.loads(self.path.read_text())["pending_tasks"], {})
        self.assertIsNotNone(PangramBadgeService(self.path).lookup(PROSE))

    def test_failed_refresh_preserves_completed_result_and_clears_terminal_task(self):
        self.record()
        service = PangramBadgeService(self.path, client=PangramClient("secret"))
        before = service.lookup(PROSE)
        replies = [Response({"task_id": "task-123"}), Response({"stage": "STAGE_FAILED"})]
        with requests(replies):
            with self.assertRaises(PangramError):
                service.analyze(PROSE, refresh=True)
        restored = PangramBadgeService(self.path)
        self.assertEqual(restored.lookup(PROSE), before)
        self.assertFalse(restored.has_pending(PROSE))

    def test_corrupt_records_are_not_discarded(self):
        self.path.parent.mkdir()
        for content in ("broken JSON", '{"schema_version":99,"entries":{}}', '{"schema_version":1,"entries":{"x":{}}}'):
            with self.subTest(content=content):
                self.path.write_text(content)
                with self.assertRaises(PangramError):
                    PangramBadgeService(self.path)
                self.assertEqual(self.path.read_text(), content)


class PangramRenderingTests(OfflineTest):
    def test_prose_extraction_omits_code_and_embedded_media(self):
        content = '<p>Hello <a href="https://example.com">world</a>.</p><pre><code>do_not_scan()</code></pre><p>After &amp; later.</p><video>video fallback text</video>'
        self.assertEqual(prose_from_html(content), "Hello world.\n\nAfter & later.")

    def test_badge_reports_category_and_actual_version_and_date(self):
        badge = human_badge(pangram_result())
        self.assertIn('aria-label="Pangram result: Human"', badge)
        self.assertIn('result: <strong>Human</strong>', badge)
        self.assertIn("Pangram 4.0, 2026-09-07", badge)
        self.assertNotIn("Verified", badge)
        self.assertNotIn("97%", badge)

    def test_other_categories_never_render_a_human_badge(self):
        for category in ("Mixed", "AI", "AI-Assisted", "Unexpected"):
            with self.subTest(category=category):
                self.assertEqual(human_badge(pangram_result(prediction_short=category)), "")

    def test_invalid_report_url_is_rejected(self):
        for link in ("https://pangram.example/history/fake", "javascript:alert(1)", "https://[bad"):
            value = dict(pangram_result().to_cache(), dashboard_link=link)
            with self.subTest(link=link), self.assertRaises(PangramError):
                PangramResult.from_mapping(value, model=DEFAULT_MODEL)

    def test_build_is_offline_even_with_api_key_and_omits_badge_after_edit(self):
        self.record()
        post = self.post()
        with patch.dict("os.environ", {"PANGRAM_API_KEY": "secret", "PANGRAM_RESULTS_PATH": str(self.path)}):
            service = PangramBadgeService.from_environment()
        self.assertIsNone(service.client)
        with redirect_stdout(io.StringIO()):
            _, rendered = build_post(post, pangram_badges=service)
        self.assertIn('aria-label="Pangram result: Human"', rendered)
        self.assertNotIn("Verified human writing", rendered)
        post.write_text(post.read_text() + "\nNew prose changes this article.\n")
        with redirect_stdout(io.StringIO()) as log:
            _, changed = build_post(post, pangram_badges=service)
        self.assertNotIn('aria-label="Pangram result: Human"', changed)
        self.assertIn("no matching recorded result", log.getvalue())

    def test_pages_and_short_posts_have_no_badge(self):
        service, _ = self.record()
        with redirect_stdout(io.StringIO()) as log:
            _, page = build_post(self.post(), is_page=True, pangram_badges=service)
            _, short = build_post(self.post("A short announcement."), pangram_badges=service)
        for output in (page, short):
            self.assertNotIn('aria-label="Pangram result: Human"', output)
        self.assertIn("at least 50", log.getvalue())


class PangramCommandTests(OfflineTest):
    def test_dry_run_does_not_construct_client_or_modify_records(self):
        self.record(pangram_result(model="default", version="3.3.2"))
        before = self.path.read_bytes()
        with patch.dict("os.environ", {"PANGRAM_API_KEY": "secret"}), \
             patch("scan_pangram.PangramClient", side_effect=AssertionError("Dry run constructed API client")), \
             redirect_stdout(io.StringIO()) as log:
            status = scan_main([str(self.post()), "--results", str(self.path), "--dry-run"])
        self.assertEqual(status, 0)
        self.assertIn("pangram-4", log.getvalue())
        self.assertIn("no API requests", log.getvalue())
        self.assertEqual(self.path.read_bytes(), before)

    def test_scan_and_build_use_identical_prose_and_repeat_scan_is_free(self):
        client = StubClient(pangram_result())
        post = self.post()
        with patch.dict("os.environ", {"PANGRAM_API_KEY": "secret"}), \
             patch("scan_pangram.PangramClient", return_value=client), \
             redirect_stdout(io.StringIO()):
            for _ in range(2):
                self.assertEqual(scan_main([str(post), "--results", str(self.path)]), 0)
            _, rendered = build_post(post, pangram_badges=PangramBadgeService(self.path))
        self.assertEqual(client.calls, [(PROSE, None)])
        self.assertIn('aria-label="Pangram result: Human"', rendered)

    def test_refresh_scans_duplicate_prose_only_once(self):
        client = StubClient(pangram_result())
        first = self.post()
        second = self.post(filename="02-01-2026-copy.md")
        with patch.dict("os.environ", {"PANGRAM_API_KEY": "secret"}), \
             patch("scan_pangram.PangramClient", return_value=client), \
             redirect_stdout(io.StringIO()):
            status = scan_main([str(first), str(second), "--results", str(self.path), "--refresh"])
        self.assertEqual(status, 0)
        self.assertEqual(len(client.calls), 1)

    def test_all_paths_are_read_before_any_scan_is_submitted(self):
        client = StubClient(pangram_result())
        with patch.dict("os.environ", {"PANGRAM_API_KEY": "secret"}), \
             patch("scan_pangram.PangramClient", return_value=client), \
             patch("sys.stderr", new=io.StringIO()):
            status = scan_main([str(self.post()), str(self.root / "missing.md"), "--results", str(self.path)])
        self.assertEqual(status, 1)
        self.assertEqual(client.calls, [])


if __name__ == "__main__":
    unittest.main()
