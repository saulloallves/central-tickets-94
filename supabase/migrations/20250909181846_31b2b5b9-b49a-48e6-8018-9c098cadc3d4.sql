-- Create knowledge_auto_approvals table
CREATE TABLE public.knowledge_auto_approvals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    original_message TEXT NOT NULL,
    corrected_response TEXT NOT NULL,
    documentation_content TEXT NOT NULL,
    similar_documents JSONB DEFAULT '[]'::jsonb,
    comparative_analysis TEXT,
    ticket_id UUID,
    created_by UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    ai_evaluation JSONB,
    decision_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_auto_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and diretoria manage knowledge_auto_approvals" 
ON public.knowledge_auto_approvals 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_auto_approvals_updated_at
BEFORE UPDATE ON public.knowledge_auto_approvals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();