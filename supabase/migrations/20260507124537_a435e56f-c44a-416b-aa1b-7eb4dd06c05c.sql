
-- Enums
CREATE TYPE public.lead_stage AS ENUM (
  'base_lead_mapeado',
  'tentando_contato',
  'conexao_iniciada',
  'desqualificado',
  'qualificado',
  'reuniao_agendada'
);

CREATE TYPE public.workspace_role AS ENUM ('owner','admin','member');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  current_workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles self select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Members
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Security definer helper
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

-- Workspace policies
CREATE POLICY "workspaces members select" ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "workspaces owner insert" ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "workspaces owner update" ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id);
CREATE POLICY "workspaces owner delete" ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- Members policies
CREATE POLICY "members self select" ON public.workspace_members FOR SELECT
  USING (auth.uid() = user_id OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members self insert" ON public.workspace_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members self delete" ON public.workspace_members FOR DELETE
  USING (auth.uid() = user_id);

-- Campaigns
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT,
  prompt TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns ws select" ON public.campaigns FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "campaigns ws insert" ON public.campaigns FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);
CREATE POLICY "campaigns ws update" ON public.campaigns FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "campaigns ws delete" ON public.campaigns FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  phone TEXT,
  notes TEXT,
  stage public.lead_stage NOT NULL DEFAULT 'base_lead_mapeado',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads ws select" ON public.leads FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "leads ws insert" ON public.leads FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);
CREATE POLICY "leads ws update" ON public.leads FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "leads ws delete" ON public.leads FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Generated messages
CREATE TABLE public.lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  variant INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs ws select" ON public.lead_messages FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "msgs ws insert" ON public.lead_messages FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);
CREATE POLICY "msgs ws delete" ON public.lead_messages FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + add owner as member on workspace insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  UPDATE public.profiles SET current_workspace_id = NEW.id WHERE id = NEW.owner_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_workspace_created
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

CREATE INDEX idx_leads_ws_stage ON public.leads(workspace_id, stage, position);
CREATE INDEX idx_campaigns_ws ON public.campaigns(workspace_id);
CREATE INDEX idx_members_user ON public.workspace_members(user_id);
