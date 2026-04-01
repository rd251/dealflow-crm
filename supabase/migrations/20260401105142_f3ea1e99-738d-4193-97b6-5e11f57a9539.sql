
CREATE TABLE public.deleted_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  restored_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deleted items"
  ON public.deleted_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deleted items"
  ON public.deleted_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update deleted items"
  ON public.deleted_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete deleted items"
  ON public.deleted_items FOR DELETE
  TO authenticated
  USING (true);
