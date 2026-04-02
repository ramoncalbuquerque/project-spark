INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

CREATE POLICY "Users with card access can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'attachments'
);

CREATE POLICY "Users with card access can view" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'attachments'
);

CREATE POLICY "Uploader can delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
);