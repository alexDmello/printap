-- ============================================================
-- Migration: Add token-based subscription model
-- ============================================================

-- 1. Add token balance and lifetime usage to shops table
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS token_balance INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_used INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shops.token_balance IS 'Current available tokens (1 token = 1 successful print session).';
COMMENT ON COLUMN public.shops.tokens_used IS 'Lifetime consumed tokens.';

-- 2. Create token_transactions audit log table
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('topup', 'deduction')),
  amount          INT NOT NULL,
  balance_after   INT NOT NULL,
  reference       TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_transactions_shop 
  ON public.token_transactions (shop_id, created_at DESC);

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_transactions_select_service_role"
  ON public.token_transactions FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "token_transactions_insert_service_role"
  ON public.token_transactions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- We also allow the desktop app (authenticated as anon) to insert deductions,
-- similar to how it logs print_events.
CREATE POLICY "token_transactions_insert_anon"
  ON public.token_transactions FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.token_transactions IS 'Immutable audit log for token top-ups and deductions.';

-- 3. Atomic RPC for token deduction
CREATE OR REPLACE FUNCTION public.deduct_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  C_WARN_THRESHOLD CONSTANT INT := 10;
BEGIN
  -- Atomic row-level lock to prevent race conditions
  SELECT token_balance
  INTO v_current_balance
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  IF v_current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_tokens', 'balance', 0);
  END IF;

  v_new_balance := v_current_balance - 1;

  -- Deduct
  UPDATE public.shops
  SET token_balance = v_new_balance,
      tokens_used = tokens_used + 1
  WHERE id = p_shop_id;

  -- Audit log
  INSERT INTO public.token_transactions (shop_id, type, amount, balance_after, reference, note)
  VALUES (p_shop_id, 'deduction', 1, v_new_balance, p_session_id, 'Print session completed');

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'alert', v_new_balance <= C_WARN_THRESHOLD
  );
END;
$$;

-- 4. Atomic RPC for token top-up
CREATE OR REPLACE FUNCTION public.credit_shop_tokens(
  p_shop_id UUID,
  p_amount INT,
  p_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Manual top-up'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_must_be_positive');
  END IF;

  -- Atomic row-level lock
  SELECT token_balance
  INTO v_current_balance
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Credit
  UPDATE public.shops
  SET token_balance = v_new_balance
  WHERE id = p_shop_id;

  -- Audit log
  INSERT INTO public.token_transactions (shop_id, type, amount, balance_after, reference, note)
  VALUES (p_shop_id, 'topup', p_amount, v_new_balance, p_reference, p_note);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance
  );
END;
$$;
