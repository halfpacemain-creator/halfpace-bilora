
CREATE POLICY "company_assets_read" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "company_assets_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "company_assets_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "company_assets_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
