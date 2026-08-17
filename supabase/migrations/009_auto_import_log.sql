-- Persistent log for automated Procurement imports.
-- source_id: opaque unique identifier for the import source (e.g. email message ID).
-- attachment_hash: SHA-256 hex of the raw file bytes — secondary dedup guard.
-- Either match is sufficient to skip reprocessing.

CREATE TABLE public.auto_import_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        text        NOT NULL,
  attachment_hash  text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('success', 'error')),
  processed_at     timestamptz NOT NULL DEFAULT now(),
  details          jsonb,
  company_id       uuid        NOT NULL REFERENCES public.companies(id)
);

-- Unique on source_id and on attachment_hash independently so either match blocks reprocessing.
CREATE UNIQUE INDEX auto_import_log_source_id_idx  ON public.auto_import_log (source_id);
CREATE UNIQUE INDEX auto_import_log_hash_idx       ON public.auto_import_log (attachment_hash);

-- Only allow the owning company to read its own log rows.
ALTER TABLE public.auto_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_import_log_select_own"
  ON public.auto_import_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = auto_import_log.company_id
        AND company_members.user_id    = auth.uid()
    )
  );
