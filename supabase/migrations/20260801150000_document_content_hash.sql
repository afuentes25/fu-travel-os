-- Historic documents remain valid without a digest. New contract documents use
-- the SHA-256 of their exact private Storage bytes for future acceptance proof.
alter table public.reservation_documents
  add column content_sha256 text;

alter table public.reservation_documents
  add constraint reservation_documents_content_sha256_check
  check (
    content_sha256 is null
    or content_sha256 ~ '^[0-9a-f]{64}$'
  );
