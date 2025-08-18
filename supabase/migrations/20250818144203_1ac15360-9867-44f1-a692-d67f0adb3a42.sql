-- Create enums for colaboradores
CREATE TYPE public.cargo AS ENUM ('caixa', 'avaliador', 'midia', 'rh', 'gerente', 'diretor', 'admin');
CREATE TYPE public.colaborador_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'diretor', 'colaborador');

-- Create profiles table (mirrors auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_completo TEXT,
  email TEXT UNIQUE,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create colaboradores table
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  cargo public.cargo NOT NULL,
  beneficios TEXT[], -- Array of benefits like 'VT', 'VR', 'Plano', etc.
  remuneracao DECIMAL(10,2),
  unidade_id TEXT REFERENCES public.unidades(id),
  status public.colaborador_status NOT NULL DEFAULT 'ativo',
  data_admissao DATE,
  data_nascimento DATE,
  acessos TEXT[], -- Array of access permissions
  senha_sistema TEXT, -- Encrypted password
  aceitou_termos BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to hash passwords
CREATE OR REPLACE FUNCTION public.hash_password()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.senha_sistema IS NOT NULL AND NEW.senha_sistema != OLD.senha_sistema THEN
    NEW.senha_sistema = crypt(NEW.senha_sistema, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for password hashing
CREATE TRIGGER hash_colaborador_password
  BEFORE INSERT OR UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_password();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, user_id)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create profile trigger to auto-create from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email, telefone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome_completo',
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefone'
  );
  RETURN NEW;
END;
$$;

-- Trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for colaboradores
CREATE POLICY "Colaboradores can view their own data" ON public.colaboradores
  FOR SELECT USING (auth.uid()::TEXT IN (
    SELECT p.id::TEXT FROM public.profiles p WHERE p.email = colaboradores.email
  ));

CREATE POLICY "Admins can manage all colaboradores" ON public.colaboradores
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerentes can view colaboradores in their units" ON public.colaboradores
  FOR SELECT USING (
    public.has_role(auth.uid(), 'gerente') AND
    unidade_id IN (
      SELECT u.id FROM public.unidades u
      JOIN public.franqueados f ON f.unit_code ? u.id
      JOIN public.profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
    )
  );

-- RLS Policies for unidades
CREATE POLICY "Admins can manage all unidades" ON public.unidades
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view unidades" ON public.unidades
  FOR SELECT TO authenticated USING (true);

-- RLS Policies for franqueados
CREATE POLICY "Admins can manage all franqueados" ON public.franqueados
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Franqueados can view their own data" ON public.franqueados
  FOR SELECT USING (auth.uid()::TEXT IN (
    SELECT p.id::TEXT FROM public.profiles p WHERE p.email = franqueados.email
  ));

-- RLS Policies for audit_log
CREATE POLICY "Admins can view all audit logs" ON public.audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create audit triggers for all tables
CREATE TRIGGER colaboradores_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER unidades_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER franqueados_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.franqueados
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();