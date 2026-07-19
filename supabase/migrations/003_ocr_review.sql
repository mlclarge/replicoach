-- =============================================
-- Migration 003 : Révision OCR
-- Ajoute un flag needs_review sur les répliques
-- pour signaler les zones garbled à corriger
-- =============================================

ALTER TABLE replicas
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- Index pour retrouver rapidement les répliques à réviser par script
CREATE INDEX IF NOT EXISTS idx_replicas_needs_review
  ON replicas(script_id, needs_review)
  WHERE needs_review = TRUE;
