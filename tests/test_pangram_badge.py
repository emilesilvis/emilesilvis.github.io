import json
from pathlib import Path
import tempfile
import unittest

from build import build_post
from pangram_badge import (
    PangramBadgeService,
    PangramClient,
    PangramError,
    PangramResult,
    prose_from_html,
    verified_human_badge,
)


def pangram_result(*, prediction_short="Human", fraction_human=0.97):
    return PangramResult(
        model="default",
        version="4.0",
        headline="Human Written",
        prediction_short=prediction_short,
        fraction_ai=0.01,
        fraction_ai_assisted=0.02,
        fraction_human=fraction_human,
        dashboard_link="https://www.pangram.com/history/result-123",
    )


class StubPangramClient:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def analyze(self, text):
        self.calls.append(text)
        return self.result


class PangramClientTests(unittest.TestCase):
    def test_async_request_uses_explicit_model_and_public_dashboard(self):
        class Client(PangramClient):
            def __init__(self):
                super().__init__("secret", model="pangram-4")
                self.calls = []

            def _request_json(self, method, path, payload=None):
                self.calls.append((method, path, payload))
                if method == "POST":
                    return {"task_id": "task-123"}
                return {
                    "stage": "STAGE_SUCCESS",
                    "version": "4.0",
                    "headline": "Human Written",
                    "prediction_short": "Human",
                    "fraction_ai": 0.0,
                    "fraction_ai_assisted": 0.03,
                    "fraction_human": 0.97,
                    "dashboard_link": "https://www.pangram.com/history/result-123",
                }

        client = Client()
        result = client.analyze("Some prose")

        self.assertTrue(result.is_verified_human)
        self.assertEqual(
            client.calls[0],
            (
                "POST",
                "/task",
                {
                    "text": "Some prose",
                    "model": "pangram-4",
                    "public_dashboard_link": True,
                },
            ),
        )
        self.assertEqual(client.calls[1], ("GET", "/task/task-123", None))

    def test_failed_task_is_an_error(self):
        class Client(PangramClient):
            def _request_json(self, method, path, payload=None):
                if method == "POST":
                    return {"task_id": "task-123"}
                return {"stage": "STAGE_FAILED", "headline": "No valid text"}

        with self.assertRaisesRegex(PangramError, "No valid text"):
            Client("secret").analyze("Some prose")


class PangramCacheTests(unittest.TestCase):
    def test_cache_avoids_repeat_api_calls_and_does_not_store_post_text(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "pangram" / "results.json"
            client = StubPangramClient(pangram_result())
            service = PangramBadgeService(cache_path, client=client, required=True)

            first = service.analyze("Words that should never be stored in the cache")
            cached_service = PangramBadgeService(cache_path, required=True)
            second = cached_service.analyze(
                "Words that should never be stored in the cache"
            )

            self.assertEqual(first, second)
            self.assertEqual(len(client.calls), 1)
            cache_contents = cache_path.read_text(encoding="utf-8")
            self.assertNotIn("Words that should never", cache_contents)
            self.assertNotIn("secret", cache_contents)
            self.assertEqual(json.loads(cache_contents)["schema_version"], 1)

    def test_required_result_without_cache_or_key_is_an_error(self):
        with tempfile.TemporaryDirectory() as directory:
            service = PangramBadgeService(
                Path(directory) / "results.json",
                required=True,
            )
            with self.assertRaisesRegex(PangramError, "PANGRAM_API_KEY"):
                service.analyze("An uncached post")


class PangramRenderingTests(unittest.TestCase):
    def test_prose_extraction_omits_code_and_embedded_media(self):
        content = """
        <p>Hello <a href="https://example.com">world</a>.</p>
        <pre><code>do_not_scan()</code></pre>
        <p>After &amp; later.</p>
        <video>video fallback text</video>
        """
        self.assertEqual(prose_from_html(content), "Hello world.\n\nAfter & later.")

    def test_badge_is_rendered_for_human_result(self):
        badge = verified_human_badge(pangram_result(fraction_human=0.974))

        self.assertIn("Verified human writing", badge)
        self.assertIn(
            'class="pangram-verification__link" href="https://www.pangram.com/history/result-123"',
            badge,
        )
        self.assertNotIn("automated analysis", badge)

    def test_badge_is_omitted_for_mixed_result(self):
        self.assertEqual(
            verified_human_badge(pangram_result(prediction_short="Mixed")),
            "",
        )

    def test_non_pangram_dashboard_link_is_rejected(self):
        value = pangram_result().to_cache()
        value["dashboard_link"] = "https://pangram.example/history/fake"

        with self.assertRaisesRegex(PangramError, "dashboard link"):
            PangramResult.from_mapping(value, model="default")

    def test_post_build_includes_badge_and_excludes_code_from_api_text(self):
        with tempfile.TemporaryDirectory() as directory:
            post_path = Path(directory) / "01-01-2026-test-post.md"
            post_path.write_text(
                "# A human post\n\nA paragraph written by a person.\n\n```python\nsecret_code()\n```\n",
                encoding="utf-8",
            )
            client = StubPangramClient(pangram_result())
            service = PangramBadgeService(
                Path(directory) / "cache.json",
                client=client,
            )

            _, generated_html = build_post(post_path, pangram_badges=service)

            self.assertIn("Verified human writing", generated_html)
            self.assertEqual(client.calls, ["A paragraph written by a person."])


if __name__ == "__main__":
    unittest.main()
