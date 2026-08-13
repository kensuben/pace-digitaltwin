# ADR-0005 — PDF processing engine

**Status:** Accepted  
**Date:** 2026-08-13  
**Supersedes:** The PyMuPDF implementation choice in ADR-0004

## Context

SP-1 needs to inspect uploaded PDFs, persist page metadata and render web previews. Expected volume is below 100 processing runs, so operational simplicity and permissive licensing matter more than maximum throughput. PyMuPDF requires accepting AGPL obligations or purchasing a commercial license.

## Decision

- Use Mozilla PDF.js through the pinned `pdfjs-dist` package under Apache-2.0.
- Use pinned `@napi-rs/canvas` under MIT for server-side raster output.
- Run parsing and rendering in a separate Node.js worker process with no public port.
- Use the existing PostgreSQL job table; Redis is not introduced.
- Disable PDF JavaScript evaluation and external resource loading. SP-1 performs no OCR or vector extraction.
- Retain Apache PDFBox as a possible future fallback only after representative-file benchmarking and dependency/license review.

## Consequences

The application and worker share TypeScript domain/storage code and require no Python or Java runtime. Source PDFs remain immutable, previews are derived objects, and malformed/password-protected files fail explicitly. Apache-2.0 and MIT license notices must remain available in distributed dependency attribution.

## Rollback

The processing engine is isolated behind the job worker and ObjectStorage keys. A replacement worker can regenerate previews without changing source documents or canonical spatial records.
