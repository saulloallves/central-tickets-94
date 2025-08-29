-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-attachments', 'ticket-attachments', true);

-- Create RLS policies for ticket attachments bucket
CREATE POLICY "Anyone can view ticket attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Authenticated users can upload ticket attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own ticket attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own ticket attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);