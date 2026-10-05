-- ============================================================
-- Migration: 014_token_escrow_and_refunds.sql
-- Purpose:
--   1. Allow 'refund' type in token_transactions
--   2. Add escrow_session_id to token_transactions for pre-flight deduction tracking
--   3. Allow 'failed' and 'failed_refunded' in print_orders status
-- ============================================================

-- 1. Update token_transactions type check constraint
ALTER TABLE public.token_transactions DROP CONSTRAINT IF EXISTS token_transactions_type_check;
ALTER TABLE public.token_transactions ADD CONSTRAINT token_transactions_type_check CHECK (type IN ('topup', 'deduction', 'refund'));

-- 2. Add escrow_session_id
ALTER TABLE public.token_transactions ADD COLUMN IF NOT EXISTS escrow_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_token_transactions_escrow ON public.token_transactions (escrow_session_id);

-- 3. Update print_orders status check constraint
ALTER TABLE public.print_orders DROP CONSTRAINT IF EXISTS print_orders_status_check;
ALTER TABLE public.print_orders ADD CONSTRAINT print_orders_status_check 
  CHECK (status IN ('pending_payment', 'queued', 'printing', 'ready_for_pickup', 'picked_up', 'cancelled', 'failed', 'failed_refunded'));

-- 4. Create RPC for secure pre-flight token reservation (Escrow)
CREATE OR REPLACE FUNCTION public.reserve_shop_token(
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
  -- Atomic row-level lock
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

  -- Check if token is already reserved for this session (idempotency)
  IF EXISTS (
    SELECT 1 FROM public.token_transactions 
    WHERE shop_id = p_shop_id AND escrow_session_id = p_session_id AND type = 'deduction'
  ) THEN
    RETURN jsonb_build_object('success', true, 'balance', v_current_balance, 'status', 'already_reserved');
  END IF;

  v_new_balance := v_current_balance - 1;

  -- Deduct
  UPDATE public.shops
  SET token_balance = v_new_balance,
      tokens_used = tokens_used + 1
  WHERE id = p_shop_id;

  -- Audit log for escrow
  INSERT INTO public.token_transactions (shop_id, type, amount, balance_after, reference, note, escrow_session_id)
  VALUES (p_shop_id, 'deduction', 1, v_new_balance, p_session_id, 'Token reserved in escrow before print', p_session_id);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'alert', v_new_balance <= C_WARN_THRESHOLD
  );
END;
$$;

-- 5. Create RPC for refunding token (used when customer confirms failure)
CREATE OR REPLACE FUNCTION public.refund_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  -- Check if a deduction actually exists for this session
  IF NOT EXISTS (
    SELECT 1 FROM public.token_transactions 
    WHERE shop_id = p_shop_id AND escrow_session_id = p_session_id AND type = 'deduction'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_reservation_found');
  END IF;

  -- Check if already refunded
  IF EXISTS (
    SELECT 1 FROM public.token_transactions 
    WHERE shop_id = p_shop_id AND escrow_session_id = p_session_id AND type = 'refund'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_refunded');
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

  v_new_balance := v_current_balance + 1;

  -- Refund
  UPDATE public.shops
  SET token_balance = v_new_balance,
      tokens_used = GREATEST(0, tokens_used - 1)
  WHERE id = p_shop_id;

  -- Audit log for refund
  INSERT INTO public.token_transactions (shop_id, type, amount, balance_after, reference, note, escrow_session_id)
  VALUES (p_shop_id, 'refund', 1, v_new_balance, p_session_id, 'Token refunded due to print failure', p_session_id);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance
  );
END;
$$;
