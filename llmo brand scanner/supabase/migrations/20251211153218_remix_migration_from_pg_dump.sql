CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: associate_session_analyses(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.associate_session_analyses(_user_id uuid, _session_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update all analysis_queries with matching session_id but no user_id
  UPDATE public.analysis_queries
  SET user_id = _user_id
  WHERE session_id = _session_id
    AND user_id IS NULL;
END;
$$;


--
-- Name: associate_user_analyses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.associate_user_analyses() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update all analysis_queries with matching email but no user_id
  UPDATE public.analysis_queries
  SET user_id = NEW.id
  WHERE user_email = NEW.email
    AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;


--
-- Name: decrement_query_pack(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_query_pack(user_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Decrement the oldest pack with remaining queries
  UPDATE public.query_packs
  SET queries_remaining = queries_remaining - 1
  WHERE id = (
    SELECT id FROM public.query_packs
    WHERE user_id = user_id_param 
    AND payment_status = 'completed'
    AND queries_remaining > 0
    ORDER BY purchased_at ASC
    LIMIT 1
  );
END;
$$;


--
-- Name: get_user_available_queries(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_available_queries(user_id_param uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_queries INTEGER;
  used_queries INTEGER;
  purchased_queries INTEGER;
BEGIN
  -- Count queries used by the user
  SELECT COUNT(*) INTO used_queries
  FROM public.analysis_queries
  WHERE user_id = user_id_param;
  
  -- Sum remaining queries from purchased packs
  SELECT COALESCE(SUM(queries_remaining), 0) INTO purchased_queries
  FROM public.query_packs
  WHERE user_id = user_id_param AND payment_status = 'completed';
  
  -- Free tier: 5 queries + purchased queries - used queries
  total_queries := 5 + purchased_queries - used_queries;
  
  RETURN GREATEST(total_queries, 0);
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert user role with conflict handling
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new;
END;
$$;


--
-- Name: handle_new_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


--
-- Name: trigger_associate_user_analyses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_associate_user_analyses() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update all analysis_queries with matching email but no user_id
  UPDATE public.analysis_queries
  SET user_id = NEW.id
  WHERE user_email = NEW.email
    AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: analysis_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    industry text NOT NULL,
    market text NOT NULL,
    category text,
    user_id uuid,
    user_email text,
    visibility_score integer,
    results jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_name text,
    product_name text,
    session_id text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: query_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    queries_purchased integer DEFAULT 10 NOT NULL,
    queries_remaining integer DEFAULT 10 NOT NULL,
    price_paid numeric(10,2) NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    stripe_session_id text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL
);


--
-- Name: analysis_queries analysis_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_queries
    ADD CONSTRAINT analysis_queries_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: query_packs query_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_packs
    ADD CONSTRAINT query_packs_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_analysis_queries_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_queries_session_id ON public.analysis_queries USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: profiles on_profile_created_assign_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_assign_role AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();


--
-- Name: profiles on_profile_created_associate_analyses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_associate_analyses AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trigger_associate_user_analyses();


--
-- Name: profiles on_user_profile_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_user_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.associate_user_analyses();


--
-- Name: analysis_queries analysis_queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_queries
    ADD CONSTRAINT analysis_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: analysis_queries Admins can view all queries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all queries" ON public.analysis_queries FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: analysis_queries Anyone can insert queries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert queries" ON public.analysis_queries FOR INSERT WITH CHECK (true);


--
-- Name: user_roles Only admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Only admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Only admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: query_packs Users can insert their own query packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own query packs" ON public.query_packs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: analysis_queries Users can view own queries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own queries" ON public.analysis_queries FOR SELECT USING (((auth.uid() = user_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.email = analysis_queries.user_email)))));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: query_packs Users can view their own query packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own query packs" ON public.query_packs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: analysis_queries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analysis_queries ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: query_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.query_packs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


