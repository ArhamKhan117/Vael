-- Add 'other' to template_type check constraint (for draft campaigns)
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_template_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_template_type_check
  CHECK (template_type IN ('swap', 'deposit', 'borrow', 'stake', 'other'));
