#!/usr/bin/env python3
"""Inspect saved Pangram results; submit missing prose only with --submit."""

import argparse
import os
from pathlib import Path

from build import POSTS, ROOT, build_values, render
from content import read_document
from pangram_badge import DEFAULT_MODEL, PangramBadgeService, PangramError, prose_from_html


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('posts', nargs='*', type=Path, help='Post files; defaults to all posts')
    parser.add_argument('--submit', action='store_true', help='Send uncached prose to Pangram and save results (uses API credits)')
    parser.add_argument('--model', default=DEFAULT_MODEL, help='Pangram model identifier; must match the build to display badges')
    args = parser.parse_args()
    service = PangramBadgeService(
        ROOT / 'data/pangram/results.json', model=args.model,
        api_key=os.environ.get('PANGRAM_API_KEY') if args.submit else None,
        required=args.submit,
    )
    values = build_values()
    missing = 0
    for path in args.posts or sorted(POSTS.glob('*.md')):
        document = read_document(path, values=values)
        try:
            result = service.analyze(prose_from_html(render(document.body)))
        except PangramError as error:
            parser.exit(1, f'{path.name}: {error}\n')
        if result is None:
            missing += 1
            print(f'Missing: {path.name}')
        else:
            print(f'{path.name}: {result.dashboard_link}')
    if missing:
        print(f'{missing} post(s) have no matching saved result. Use --submit with PANGRAM_API_KEY to analyze them.')


if __name__ == '__main__':
    main()
