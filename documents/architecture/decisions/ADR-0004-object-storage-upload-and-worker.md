# ADR-0004 — Object storage, upload and worker topology

- Status: Accepted; production provider selection deferred
- Date: 2026-08-11
- Owners: Project team
- Related: SOP-SC181-002

## Context

PDF and GLB assets are large, untrusted binary inputs. They must not be stored in PostgreSQL or processed synchronously by Next.js. Development, CI and production also need different storage implementations without changing domain services.

## Decision

### Storage boundary

Use an `ObjectStorage` port owned by the application service layer. The minimum contract supports:

- initiate upload / create time-limited signed upload;
- inspect size, media type, checksum and object existence;
- create time-limited signed download;
- open an internal processing stream;
- delete using an idempotent operation.

Development and CI begin with a filesystem adapter rooted outside the source tree. Production uses an approved S3-compatible service. MinIO is not a default dependency; product maintenance, support and license obligations must be reviewed before selection.

Binary objects use immutable, generated keys containing campus/document IDs and revision IDs. Original filenames are metadata only. A repeated upload never overwrites an existing revision.

### Upload protocol

The API is standardized as:

1. `POST /api/drawings` creates an UPLOADING record and immutable storage key.
2. The service returns an upload instruction or signed URL.
3. Client uploads with declared checksum and media type.
4. `POST /api/drawings/:id/finalize` verifies object metadata/checksum and queues processing.

Next.js does not buffer large PDF/GLB bodies in application memory for production S3 uploads.

### Job and worker boundary

- SP-1 introduces a separate Python worker image and a database-backed job queue.
- Next.js creates job records; it never performs PDF parsing in a request.
- The worker has no public port, runs non-root, uses read-only input, restricted temporary output, resource/time limits, dropped capabilities and no unrestricted Internet egress.
- Database and object storage access use dedicated least-privilege credentials.
- Redis/BullMQ is deferred until database queue limits are measured.

### Security and lifecycle

- Allowed MIME, extension, magic bytes, maximum size and checksum are all validated.
- Virus scanning is a required hook before a document reaches READY.
- PDF JavaScript and external asset execution/loading are disabled.
- Database and object deletion are coordinated through explicit lifecycle states/retry jobs; failed storage deletion never masquerades as success.
- Source PDFs remain immutable for audit unless an authorized retention deletion is executed.

### License gate

PyMuPDF implementation cannot start until the project accepts AGPL obligations or obtains an appropriate commercial license. If neither is acceptable, SP-1 must select and benchmark an alternative through a superseding ADR.

## Alternatives considered

- PostgreSQL binary columns were rejected due to database growth, backup cost and streaming constraints.
- Synchronous multipart processing in a Route Handler was rejected due to request timeout and memory risk.
- Shipping MinIO automatically in M0 was rejected because M1 does not need object storage and provider/license selection is unresolved.

## Consequences

- M0/M1 remain a single application service plus its one-shot migrator and PostgreSQL; no spatial worker is added yet.
- SP-0 implements the storage interface/filesystem adapter; SP-1 adds worker CI and Compose profiles.
- Production readiness later requires object backup/retention monitoring independently from PostgreSQL.

## Rollback / migration impact

Storage keys are opaque to domain consumers, so providers can be replaced by copying objects and updating storage configuration without changing placement/topology records.
