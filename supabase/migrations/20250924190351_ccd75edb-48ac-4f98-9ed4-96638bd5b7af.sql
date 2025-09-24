-- Create table for attendance evaluations
CREATE TABLE avaliacoes_atendimento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id uuid NOT NULL REFERENCES chamados(id),
  telefone_destino text NOT NULL,
  rating text CHECK (rating IN ('otimo', 'bom', 'ruim')),
  comentario text,
  respondido_em timestamp with time zone,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE avaliacoes_atendimento ENABLE ROW LEVEL SECURITY;

-- Create policies for avaliacoes_atendimento
CREATE POLICY "Admins and diretoria manage avaliacoes_atendimento" 
ON avaliacoes_atendimento 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Create index for better performance
CREATE INDEX idx_avaliacoes_atendimento_chamado_id ON avaliacoes_atendimento(chamado_id);
CREATE INDEX idx_avaliacoes_atendimento_enviado_em ON avaliacoes_atendimento(enviado_em);
CREATE INDEX idx_avaliacoes_atendimento_rating ON avaliacoes_atendimento(rating);