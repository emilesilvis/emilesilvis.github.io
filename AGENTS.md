# AGENTS.md

## Cursor Cloud specific instructions

This is a minimalist Python static site generator. See `README.md` for the standard build/serve commands.

### Services

| Service | Command | Notes |
|---------|---------|-------|
| Build   | `python build.py` | Generates static HTML in `out/` from Markdown in `posts/` and `pages/` |
| Dev server | `npx serve out` | Serves on port 3000; must rebuild first |

### Development workflow

1. Edit Markdown files in `posts/` or `pages/`, or modify `build.py` / `config.py` / templates.
2. Run `python build.py` to regenerate `out/`.
3. Run `npx serve out` to preview at `http://localhost:3000`.

### Caveats

- The dev server (`npx serve`) serves static files only; there is no hot-reload. After changing source files, re-run `python build.py` and refresh the browser.
- No test suite or linter is configured in this repository.
- The `out/` directory is gitignored and fully regenerated on each build (old contents are deleted).
