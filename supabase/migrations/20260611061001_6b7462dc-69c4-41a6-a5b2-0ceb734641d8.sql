
-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON public.payments(invoice_id);
CREATE INDEX payments_company_date_idx ON public.payments(company_id, payment_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage payments" ON public.payments
  FOR ALL USING (public.owns_company(company_id))
  WITH CHECK (public.owns_company(company_id));

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice events (activity timeline)
CREATE TABLE public.invoice_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX invoice_events_invoice_idx ON public.invoice_events(invoice_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_events TO authenticated;
GRANT ALL ON public.invoice_events TO service_role;

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage invoice events" ON public.invoice_events
  FOR ALL USING (public.owns_company(company_id))
  WITH CHECK (public.owns_company(company_id));

-- Auto-recalculate invoice status & amount_paid when payments change
CREATE OR REPLACE FUNCTION public.recalc_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id UUID;
  total_paid NUMERIC;
  inv_total NUMERIC;
  inv_status TEXT;
  new_status TEXT;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.payments WHERE invoice_id = inv_id;
  SELECT total, status INTO inv_total, inv_status FROM public.invoices WHERE id = inv_id;
  IF inv_total IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF total_paid <= 0 THEN
    new_status := CASE WHEN inv_status IN ('paid','partial') THEN 'sent' ELSE inv_status END;
  ELSIF total_paid >= inv_total THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;

  UPDATE public.invoices SET amount_paid = total_paid, status = new_status WHERE id = inv_id;

  INSERT INTO public.invoice_events (invoice_id, company_id, event_type, message, metadata, actor_id)
  SELECT inv_id, i.company_id,
         CASE WHEN TG_OP='DELETE' THEN 'payment_removed' ELSE 'payment_added' END,
         CASE WHEN TG_OP='DELETE' THEN 'Payment removed' ELSE 'Payment recorded' END,
         jsonb_build_object('amount', COALESCE(NEW.amount, OLD.amount), 'mode', COALESCE(NEW.mode, OLD.mode)),
         auth.uid()
  FROM public.invoices i WHERE i.id = inv_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER payments_recalc_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_payment_status();

-- Log invoice create/update events
CREATE OR REPLACE FUNCTION public.log_invoice_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_events (invoice_id, company_id, event_type, message, actor_id)
    VALUES (NEW.id, NEW.company_id, 'created', 'Invoice created', auth.uid());
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.invoice_events (invoice_id, company_id, event_type, message, metadata, actor_id)
    VALUES (NEW.id, NEW.company_id, 'status_changed',
            'Status changed to ' || NEW.status,
            jsonb_build_object('from', OLD.status, 'to', NEW.status),
            auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_log_event
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_invoice_event();
