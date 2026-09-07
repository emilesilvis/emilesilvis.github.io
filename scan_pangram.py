#!/usr/bin/env python3
"""Explicitly scan posts and persist their results before publishing."""

import argparse
import os
from pathlib import Path
import sys

from build import POSTS, read_post
from pangram_badge import (
    DEFAULT_MODEL,
    DEFAULT_RESULTS_PATH,
    PangramBadgeService,
    PangramClient,
    PangramError,
    ineligible_reason,
    prose_from_html,
)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("posts", nargs="*", type=Path, help="Post paths; defaults to all posts")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model selector (default: {DEFAULT_MODEL})")
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULTS_PATH)
    parser.add_argument("--dry-run", action="store_true", help="List planned scans without using the API")
    parser.add_argument("--refresh", action="store_true", help="Rescan matching completed results (uses credits)")
    args = parser.parse_args(argv)

    try:
        api_key = os.environ.get("PANGRAM_API_KEY", "").strip()
        client = PangramClient(api_key, model=args.model) if api_key and not args.dry_run else None
        service = PangramBadgeService(args.results, model=args.model, client=client)
        posts = args.posts or sorted(POSTS.glob("*.md"))
        # Validate every input before starting any chargeable work.
        inputs = []
        seen = set()
        for post in posts:
            _, rendered, _ = read_post(post)
            prose = prose_from_html(rendered)
            if prose not in seen:
                inputs.append((post, prose))
                seen.add(prose)

        for post, prose in inputs:
            reason = ineligible_reason(prose)
            if reason:
                print(f"Skip {post.name}: {reason}")
                continue
            if service.has_pending(prose):
                action = "Resume"
            elif service.lookup(prose, model=args.model) is not None and not args.refresh:
                print(f"Recorded {post.name}: {args.model}")
                continue
            else:
                action = "Scan"
            print(f"{action} {post.name}: {len(prose.split())} words, {args.model}")
            if not args.dry_run:
                result = service.analyze(prose, refresh=args.refresh)
                print(f"Result: {result.prediction_short}, version {result.version}; {result.dashboard_link}")
        if args.dry_run:
            print("Dry run complete; no API requests made.")
        else:
            print(f"Results saved in {args.results}. Commit this file with your posts.")
        return 0
    except (PangramError, OSError, ValueError) as exc:
        print(f"Pangram scan stopped: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
