--
-- PostgreSQL database dump
--

\restrict AOUx8sbIN7W4qT9aTzZGPKQcZ81g92pxdxAPYKNaDbpcaIBkM8a2D7sbaqdM4BO

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.12

-- Started on 2026-11-26 02:50:46

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
-- TOC entry 13 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4513 (class 0 OID 0)
-- Dependencies: 13
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 646 (class 1255 OID 19271)
-- Name: admin_assign_str_user_role(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_assign_str_user_role(p_user_id uuid, p_role text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_member_id uuid;
    v_email_confirmed boolean;
BEGIN

    -- 1. Проверка авторизации

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Проверка полномочий Super Admin

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Access denied'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Проверка входных параметров

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_role IS NULL OR p_role NOT IN (
        'admin',
        'manager',
        'coach',
        'parent',
        'student'
    ) THEN
        RAISE EXCEPTION 'Invalid or restricted role'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Запрет изменения собственных ролей

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify your own roles'
            USING ERRCODE = '42501';
    END IF;

    -- 5. Проверка существования пользователя
    -- и подтверждения электронной почты

    SELECT
        u.email_confirmed_at IS NOT NULL
    INTO v_email_confirmed
    FROM auth.users AS u
    WHERE u.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF v_email_confirmed IS NOT TRUE THEN
        RAISE EXCEPTION 'Email is not confirmed';
    END IF;

    -- 6. Проверка существования профиля

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- 7. Защита пользователей других академий

    IF EXISTS (
        SELECT 1
        FROM public.academy_members AS am
        WHERE am.user_id = p_user_id
          AND am.academy_id <> v_academy_id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.academy_members AS am
        WHERE am.user_id = p_user_id
          AND am.academy_id = v_academy_id
    ) THEN
        RAISE EXCEPTION 'User belongs to another academy'
            USING ERRCODE = '42501';
    END IF;

    -- 8. Защита аккаунтов Super Admin

    IF EXISTS (
        SELECT 1
        FROM public.academy_members AS am
        WHERE am.user_id = p_user_id
          AND am.academy_id = v_academy_id
          AND am.role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Cannot modify Super Admin roles'
            USING ERRCODE = '42501';
    END IF;

    -- 9. Назначение новой роли
    -- или восстановление существующей

    INSERT INTO public.academy_members (
        academy_id,
        user_id,
        role,
        is_active
    )
    VALUES (
        v_academy_id,
        p_user_id,
        p_role,
        true
    )
    ON CONFLICT (
        academy_id,
        user_id,
        role
    )
    DO UPDATE SET
        is_active = true

    RETURNING id INTO v_member_id;

    -- Аудит автоматически выполняется триггером

    RETURN v_member_id;

END;
$$;


ALTER FUNCTION public.admin_assign_str_user_role(p_user_id uuid, p_role text) OWNER TO postgres;

--
-- TOC entry 394 (class 1255 OID 19273)
-- Name: admin_get_str_user_memberships(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_get_str_user_memberships() RETURNS TABLE(member_id uuid, user_id uuid, role text, is_active boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
BEGIN

    -- 1. Проверяем авторизацию

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Проверяем полномочия Super Admin

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Access denied'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Возвращаем роли текущей академии

    RETURN QUERY

    SELECT
        am.id,
        am.user_id,
        am.role,
        am.is_active,
        am.created_at
    FROM public.academy_members AS am
    WHERE am.academy_id = v_academy_id
    ORDER BY am.user_id, am.role;

END;
$$;


ALTER FUNCTION public.admin_get_str_user_memberships() OWNER TO postgres;

--
-- TOC entry 551 (class 1255 OID 19260)
-- Name: admin_get_str_users(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_get_str_users() RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, phone text, email_confirmed boolean, registered_at timestamp with time zone, last_sign_in_at timestamp with time zone, roles text[], active_roles text[], account_status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
BEGIN

    -- Проверяем авторизацию

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- Проверяем полномочия Super Admin

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Access denied'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY

    SELECT
        u.id AS user_id,
        u.email::text,
        p.first_name,
        p.last_name,
        p.phone,
        (u.email_confirmed_at IS NOT NULL),
        u.created_at,
        u.last_sign_in_at,

        COALESCE(
            m.all_roles,
            ARRAY[]::text[]
        ),

        COALESCE(
            m.enabled_roles,
            ARRAY[]::text[]
        ),

        CASE
            WHEN u.email_confirmed_at IS NULL
                THEN 'email_unconfirmed'

            WHEN cardinality(m.enabled_roles) > 0
                THEN 'active'

            WHEN cardinality(m.all_roles) > 0
                THEN 'inactive'

            ELSE 'pending'
        END::text

    FROM auth.users AS u

    LEFT JOIN public.profiles AS p
        ON p.id = u.id

    LEFT JOIN LATERAL (
        SELECT
            array_agg(
                DISTINCT am.role
                ORDER BY am.role
            ) AS all_roles,

            array_agg(
                DISTINCT am.role
                ORDER BY am.role
            ) FILTER (
                WHERE am.is_active = true
            ) AS enabled_roles

        FROM public.academy_members AS am

        WHERE am.user_id = u.id
          AND am.academy_id = v_academy_id

    ) AS m ON true

    WHERE
        EXISTS (
            SELECT 1
            FROM public.academy_members AS am
            WHERE am.user_id = u.id
              AND am.academy_id = v_academy_id
        )

        OR NOT EXISTS (
            SELECT 1
            FROM public.academy_members AS am
            WHERE am.user_id = u.id
        )

    ORDER BY
        u.created_at DESC,
        u.id;

END;
$$;


ALTER FUNCTION public.admin_get_str_users() OWNER TO postgres;

--
-- TOC entry 369 (class 1255 OID 19272)
-- Name: admin_set_str_user_role_status(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_str_user_role_status(p_member_id uuid, p_is_active boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_member public.academy_members%ROWTYPE;
BEGIN

    -- 1. Проверка авторизации

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Проверка полномочий Super Admin

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Access denied'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Проверка параметров

    IF p_member_id IS NULL
        OR p_is_active IS NULL
    THEN
        RAISE EXCEPTION 'Invalid parameters'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Получаем роль пользователя
    -- только в текущей академии

    SELECT am.*
    INTO v_member
    FROM public.academy_members AS am
    WHERE am.id = p_member_id
      AND am.academy_id = v_academy_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found';
    END IF;

    -- 5. Запрещаем изменение собственного доступа

    IF v_member.user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify your own access'
            USING ERRCODE = '42501';
    END IF;

    -- 6. Защищаем аккаунты Super Admin

    IF EXISTS (
        SELECT 1
        FROM public.academy_members AS am
        WHERE am.user_id = v_member.user_id
          AND am.academy_id = v_academy_id
          AND am.role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Cannot modify Super Admin access'
            USING ERRCODE = '42501';
    END IF;

    -- 7. При восстановлении доступа
    -- проверяем подтверждение email

    IF p_is_active = true THEN

        IF NOT EXISTS (
            SELECT 1
            FROM auth.users AS u
            WHERE u.id = v_member.user_id
              AND u.email_confirmed_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Email is not confirmed';
        END IF;

    END IF;

    -- 8. Если статус уже установлен,
    -- повторное изменение не требуется

    IF v_member.is_active = p_is_active THEN
        RETURN v_member.id;
    END IF;

    -- 9. Изменяем статус роли

    UPDATE public.academy_members
    SET is_active = p_is_active
    WHERE id = v_member.id
      AND academy_id = v_academy_id;

    -- Аудит выполняется автоматически триггером

    RETURN v_member.id;

END;
$$;


ALTER FUNCTION public.admin_set_str_user_role_status(p_member_id uuid, p_is_active boolean) OWNER TO postgres;

--
-- TOC entry 619 (class 1255 OID 18463)
-- Name: assign_student_subscription(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_student_subscription(p_student_id uuid, p_plan_id uuid, p_start_date date, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
    v_role text;
    v_academy_id uuid;
    v_plan public.subscription_plans%ROWTYPE;
    v_subscription_id uuid;
    v_end_date date;

BEGIN

    -- 1. Authentication

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Необходима авторизация'
            USING ERRCODE = '42501';
    END IF;


    -- 2. Authorization

    v_role := public.get_my_str_role();

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION
            'Недостаточно прав для назначения абонемента'
            USING ERRCODE = '42501';
    END IF;

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Академия не найдена'
            USING ERRCODE = '42501';
    END IF;


    -- 3. Validate input parameters

    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'Укажите ученика'
            USING ERRCODE = '22023';
    END IF;

    IF p_plan_id IS NULL THEN
        RAISE EXCEPTION 'Укажите тариф'
            USING ERRCODE = '22023';
    END IF;

    IF p_start_date IS NULL
       OR NOT isfinite(p_start_date)
    THEN
        RAISE EXCEPTION 'Некорректная дата начала'
            USING ERRCODE = '22023';
    END IF;


    -- 4. Lock student and verify active status

    PERFORM 1
    FROM public.students
    WHERE id = p_student_id
      AND academy_id = v_academy_id
      AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Активный ученик не найден';
    END IF;


    -- 5. Lock and validate subscription plan

    SELECT *
    INTO v_plan
    FROM public.subscription_plans
    WHERE id = p_plan_id
      AND academy_id = v_academy_id
      AND is_active = true
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Тариф не найден или неактивен';
    END IF;

    IF v_plan.duration_days IS NULL
       OR v_plan.duration_days <= 0
    THEN
        RAISE EXCEPTION 'Некорректный срок действия тарифа';
    END IF;

    IF v_plan.price IS NULL
       OR v_plan.price::text IN (
           'NaN', 'Infinity', '-Infinity'
       )
       OR v_plan.price < 0
       OR v_plan.price <> round(v_plan.price, 2)
    THEN
        RAISE EXCEPTION 'Некорректная стоимость тарифа';
    END IF;


    -- 6. Calculate subscription end date

    v_end_date :=
        p_start_date + (v_plan.duration_days - 1);


    -- 7. Prevent overlapping subscriptions

    IF EXISTS (
        SELECT 1
        FROM public.student_subscriptions
        WHERE academy_id = v_academy_id
          AND student_id = p_student_id
          AND status = 'active'
          AND start_date <= v_end_date
          AND end_date >= p_start_date
    ) THEN
        RAISE EXCEPTION
            'У ученика уже есть абонемент на этот период';
    END IF;


    -- 8. Create subscription

    INSERT INTO public.student_subscriptions (
        academy_id,
        student_id,
        plan_id,
        start_date,
        end_date,
        price,
        status,
        notes,
        created_by,
        updated_by
    )
    VALUES (
        v_academy_id,
        p_student_id,
        p_plan_id,
        p_start_date,
        v_end_date,
        v_plan.price,
        'active',
        p_notes,
        auth.uid(),
        auth.uid()
    )
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;

END;
$$;


ALTER FUNCTION public.assign_student_subscription(p_student_id uuid, p_plan_id uuid, p_start_date date, p_notes text) OWNER TO postgres;

--
-- TOC entry 486 (class 1255 OID 18522)
-- Name: audit_str_training_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_str_training_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_changed_fields text[];
    v_academy_id uuid;
    v_record_id uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old := NULL;
        v_new := to_jsonb(NEW);
        v_academy_id := NEW.academy_id;
        v_record_id := NEW.id;

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(v_new) AS fields(key);

    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_academy_id := NEW.academy_id;
        v_record_id := NEW.id;

        SELECT COALESCE(array_agg(n.key ORDER BY n.key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_each(v_new) AS n(key, value)
        WHERE n.value IS DISTINCT FROM v_old -> n.key;

        -- Не записываем обновление без изменений
        IF cardinality(v_changed_fields) = 0 THEN
            RETURN NEW;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_new := NULL;
        v_academy_id := OLD.academy_id;
        v_record_id := OLD.id;

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(v_old) AS fields(key);
    END IF;

    INSERT INTO public.audit_logs (
        academy_id,
        table_name,
        record_id,
        action,
        changed_by,
        old_data,
        new_data,
        changed_fields
    )
    VALUES (
        v_academy_id,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        auth.uid(),
        v_old,
        v_new,
        v_changed_fields
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_str_training_changes() OWNER TO postgres;

--
-- TOC entry 494 (class 1255 OID 18165)
-- Name: audit_student_guardians(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_student_guardians() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_changed_fields text[];
    v_actor uuid;
BEGIN
    -- Идентификатор пользователя, выполнившего операцию.
    v_actor := auth.uid();

    IF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(v_new_data) AS key;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);

        -- Записываем только реальные изменения.
        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(v_new_data) AS key
        WHERE v_old_data -> key IS DISTINCT FROM v_new_data -> key;

    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(v_old_data) AS key;

    END IF;

    INSERT INTO public.audit_logs (
        academy_id,
        table_name,
        record_id,
        action,
        changed_by,
        old_data,
        new_data,
        changed_fields
    )
    VALUES (
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.academy_id
            ELSE NEW.academy_id
        END,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        v_actor,
        v_old_data,
        v_new_data,
        v_changed_fields
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_student_guardians() OWNER TO postgres;

--
-- TOC entry 553 (class 1255 OID 18461)
-- Name: audit_student_subscriptions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_student_subscriptions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'student_subscriptions',
            NEW.id,
            'INSERT',
            auth.uid(),
            NULL,
            to_jsonb(NEW),
            ARRAY[]::text[]
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        SELECT COALESCE(array_agg(key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(to_jsonb(NEW)) AS key
        WHERE to_jsonb(OLD) -> key
              IS DISTINCT FROM
              to_jsonb(NEW) -> key;

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'student_subscriptions',
            NEW.id,
            'UPDATE',
            auth.uid(),
            to_jsonb(OLD),
            to_jsonb(NEW),
            v_changed_fields
        );

        RETURN NEW;

    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_student_subscriptions() OWNER TO postgres;

--
-- TOC entry 525 (class 1255 OID 18167)
-- Name: audit_students(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_students() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);

        -- Не создаём запись, если данные не изменились.
        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    END IF;

    -- Определяем изменённые поля.
    IF TG_OP = 'UPDATE' THEN
        SELECT COALESCE(
            array_agg(field_name ORDER BY field_name),
            ARRAY[]::text[]
        )
        INTO v_changed_fields
        FROM jsonb_object_keys(v_new_data) AS field_name
        WHERE v_old_data -> field_name
              IS DISTINCT FROM v_new_data -> field_name;

    ELSE
        SELECT COALESCE(
            array_agg(field_name ORDER BY field_name),
            ARRAY[]::text[]
        )
        INTO v_changed_fields
        FROM jsonb_object_keys(
            COALESCE(v_new_data, v_old_data)
        ) AS field_name;
    END IF;

    -- Записываем историю в центральный журнал.
    INSERT INTO public.audit_logs (
        academy_id,
        table_name,
        record_id,
        action,
        changed_by,
        old_data,
        new_data,
        changed_fields
    )
    VALUES (
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.academy_id
            ELSE NEW.academy_id
        END,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        auth.uid(),
        v_old_data,
        v_new_data,
        v_changed_fields
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_students() OWNER TO postgres;

--
-- TOC entry 663 (class 1255 OID 18510)
-- Name: audit_subscription_payments(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_subscription_payments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'subscription_payments',
            NEW.id,
            'INSERT',
            auth.uid(),
            NULL,
            to_jsonb(NEW),
            ARRAY[]::text[]
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        IF to_jsonb(OLD) = to_jsonb(NEW) THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(
            array_agg(field_name),
            ARRAY[]::text[]
        )
        INTO v_changed_fields
        FROM jsonb_object_keys(to_jsonb(NEW))
            AS field_name
        WHERE to_jsonb(OLD) -> field_name
              IS DISTINCT FROM
              to_jsonb(NEW) -> field_name;

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'subscription_payments',
            NEW.id,
            'UPDATE',
            auth.uid(),
            to_jsonb(OLD),
            to_jsonb(NEW),
            v_changed_fields
        );

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_subscription_payments() OWNER TO postgres;

--
-- TOC entry 419 (class 1255 OID 18467)
-- Name: audit_subscription_plans(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_subscription_plans() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'subscription_plans',
            NEW.id,
            'INSERT',
            auth.uid(),
            NULL,
            to_jsonb(NEW),
            ARRAY[]::text[]
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        -- Не записываем событие, если данные не изменились.
        IF to_jsonb(OLD) = to_jsonb(NEW) THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(array_agg(field_name), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_object_keys(to_jsonb(NEW)) AS field_name
        WHERE to_jsonb(OLD) -> field_name
              IS DISTINCT FROM
              to_jsonb(NEW) -> field_name;

        INSERT INTO public.audit_logs (
            academy_id,
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            changed_fields
        )
        VALUES (
            NEW.academy_id,
            'subscription_plans',
            NEW.id,
            'UPDATE',
            auth.uid(),
            to_jsonb(OLD),
            to_jsonb(NEW),
            v_changed_fields
        );

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_subscription_plans() OWNER TO postgres;

--
-- TOC entry 426 (class 1255 OID 19334)
-- Name: can_my_str_admin_read_profile(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_my_str_admin_read_profile(p_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$

    SELECT EXISTS (
        SELECT 1
        FROM public.academy_members AS am

        WHERE am.user_id = p_profile_id

          AND am.academy_id = (
              SELECT
                  public.get_my_str_admin_academy_id()
          )
    );

$$;


ALTER FUNCTION public.can_my_str_admin_read_profile(p_profile_id uuid) OWNER TO postgres;

--
-- TOC entry 631 (class 1255 OID 19183)
-- Name: change_str_training_session_status(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.change_str_training_session_status(p_session_id uuid, p_new_status text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_group_id uuid;
    v_current_status text;
    v_is_authorized boolean;
BEGIN
    -- 1. Authentication validation
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Email verification
    IF NOT public.is_my_str_email_confirmed() THEN
        RAISE EXCEPTION 'Email is not confirmed'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Session ID validation
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'Training session ID is required'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Target status validation
    IF p_new_status IS NULL
       OR p_new_status NOT IN (
           'in_progress',
           'completed',
           'cancelled'
       )
    THEN
        RAISE EXCEPTION 'Invalid target status'
            USING ERRCODE = '22023';
    END IF;

    -- 5. Find and lock only an authorized session
    SELECT
        ts.academy_id,
        ts.group_id,
        ts.status
    INTO
        v_academy_id,
        v_group_id,
        v_current_status
    FROM public.training_sessions AS ts
    WHERE ts.id = p_session_id
      AND EXISTS (
          SELECT 1
          FROM public.get_my_str_schedule_access() AS sa
          WHERE sa.academy_id = ts.academy_id
            AND (
                sa.can_manage_all_sessions = true
                OR (
                    sa.member_role = 'coach'
                    AND ts.group_id = ANY(sa.head_group_ids)
                )
            )
      )
    FOR UPDATE OF ts;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    -- 6. Recheck permissions after acquiring the row lock
    SELECT EXISTS (
        SELECT 1
        FROM public.get_my_str_schedule_access() AS sa
        WHERE sa.academy_id = v_academy_id
          AND (
              sa.can_manage_all_sessions = true
              OR (
                  sa.member_role = 'coach'
                  AND v_group_id = ANY(sa.head_group_ids)
              )
          )
    )
    INTO v_is_authorized;

    IF NOT COALESCE(v_is_authorized, false) THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    -- 7. Validate status transition
    IF NOT (
        (
            v_current_status = 'scheduled'
            AND p_new_status IN (
                'in_progress',
                'cancelled'
            )
        )
        OR (
            v_current_status = 'in_progress'
            AND p_new_status = 'completed'
        )
    ) THEN
        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            v_current_status,
            p_new_status
            USING ERRCODE = '22023';
    END IF;

    -- 8. Update training session
    UPDATE public.training_sessions
    SET
        status = p_new_status,
        updated_at = now()
    WHERE id = p_session_id;

    RETURN p_new_status;
END;
$$;


ALTER FUNCTION public.change_str_training_session_status(p_session_id uuid, p_new_status text) OWNER TO postgres;

--
-- TOC entry 432 (class 1255 OID 18136)
-- Name: create_student_guardian(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_student_guardian(p_student_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_student_academy_id uuid;
    v_guardian_id uuid;
    v_has_primary boolean;
BEGIN
    -- Проверяем авторизацию и роль.
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF public.get_my_str_role() <> 'super_admin'
       OR public.get_my_str_admin_academy_id() IS NULL THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;

    v_academy_id := public.get_my_str_admin_academy_id();

    -- Проверяем и блокируем ученика на время операции.
    SELECT s.academy_id
    INTO v_student_academy_id
    FROM public.students AS s
    WHERE s.id = p_student_id
    FOR UPDATE;

    IF NOT FOUND OR v_student_academy_id <> v_academy_id THEN
        RAISE EXCEPTION 'Student not found in academy';
    END IF;

    -- Проверяем входные данные.
    IF p_first_name IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_first_name)) = 0
       OR pg_catalog.length(pg_catalog.btrim(p_first_name)) > 100 THEN
        RAISE EXCEPTION 'Invalid first name';
    END IF;

    IF p_last_name IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_last_name)) = 0
       OR pg_catalog.length(pg_catalog.btrim(p_last_name)) > 100 THEN
        RAISE EXCEPTION 'Invalid last name';
    END IF;

    IF p_phone IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_phone)) < 5
       OR pg_catalog.length(pg_catalog.btrim(p_phone)) > 30 THEN
        RAISE EXCEPTION 'Invalid phone';
    END IF;

    IF p_email IS NOT NULL
       AND pg_catalog.length(pg_catalog.btrim(p_email)) > 254 THEN
        RAISE EXCEPTION 'Invalid email';
    END IF;

    IF p_relationship NOT IN ('parent', 'guardian') THEN
        RAISE EXCEPTION 'Invalid relationship';
    END IF;

    -- Проверяем существующего основного представителя.
    SELECT EXISTS (
        SELECT 1
        FROM public.student_guardians AS g
        WHERE g.academy_id = v_academy_id
          AND g.student_id = p_student_id
          AND g.is_active = true
          AND g.is_primary = true
    )
    INTO v_has_primary;

    -- Создаём запись в рамках текущей транзакции.
    INSERT INTO public.student_guardians (
        academy_id,
        student_id,
        first_name,
        last_name,
        phone,
        email,
        relationship,
        is_primary,
        is_active
    )
    VALUES (
        v_academy_id,
        p_student_id,
        pg_catalog.btrim(p_first_name),
        pg_catalog.btrim(p_last_name),
        pg_catalog.btrim(p_phone),
        NULLIF(pg_catalog.btrim(p_email), ''),
        p_relationship,
        NOT v_has_primary,
        true
    )
    RETURNING id INTO v_guardian_id;

    RETURN v_guardian_id;
END;
$$;


ALTER FUNCTION public.create_student_guardian(p_student_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) OWNER TO postgres;

--
-- TOC entry 464 (class 1255 OID 18187)
-- Name: enroll_student_in_training_group(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enroll_student_in_training_group(p_group_id uuid, p_student_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_group_academy_id uuid;
    v_capacity integer;
    v_is_active boolean;
    v_student_id uuid;
    v_enrollment_id uuid;
    v_active_count integer;
BEGIN
    v_academy_id := public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Доступ запрещён';
    END IF;

    SELECT tg.academy_id, tg.capacity, tg.is_active
    INTO v_group_academy_id, v_capacity, v_is_active
    FROM public.training_groups AS tg
    WHERE tg.id = p_group_id
    FOR UPDATE;

    IF NOT FOUND OR v_group_academy_id <> v_academy_id THEN
        RAISE EXCEPTION 'Группа не найдена';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'Нельзя зачислить ученика в неактивную группу';
    END IF;

    SELECT s.id
    INTO v_student_id
    FROM public.students AS s
    WHERE s.id = p_student_id
      AND s.academy_id = v_academy_id
      AND s.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Активный ученик академии не найден';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.group_enrollments AS ge
        WHERE ge.academy_id = v_academy_id
          AND ge.group_id = p_group_id
          AND ge.student_id = p_student_id
          AND ge.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Ученик уже состоит в этой группе';
    END IF;

    SELECT count(*)::integer
    INTO v_active_count
    FROM public.group_enrollments AS ge
    WHERE ge.academy_id = v_academy_id
      AND ge.group_id = p_group_id
      AND ge.status = 'active';

    IF v_capacity IS NOT NULL AND v_active_count >= v_capacity THEN
        RAISE EXCEPTION 'В группе нет свободных мест';
    END IF;

    INSERT INTO public.group_enrollments (
        academy_id,
        group_id,
        student_id,
        enrolled_at,
        status
    )
    VALUES (
        v_academy_id,
        p_group_id,
        p_student_id,
        CURRENT_DATE,
        'active'
    )
    RETURNING id INTO v_enrollment_id;

    RETURN v_enrollment_id;
END;
$$;


ALTER FUNCTION public.enroll_student_in_training_group(p_group_id uuid, p_student_id uuid) OWNER TO postgres;

--
-- TOC entry 427 (class 1255 OID 19182)
-- Name: generate_str_training_sessions(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_str_training_sessions(p_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_today date;
    v_end_date date;
    v_inserted integer := 0;
BEGIN
    -- 1. Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Email verification
    IF public.is_my_str_email_confirmed()
        IS DISTINCT FROM true
    THEN
        RAISE EXCEPTION 'Email is not confirmed'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Administrative access and academy isolation
    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Input validation
    IF p_days IS NULL
       OR p_days < 1
       OR p_days > 90
    THEN
        RAISE EXCEPTION
            'Generation period must be between 1 and 90 days'
            USING ERRCODE = '22023';
    END IF;

    -- 5. Calculate generation period
    v_today :=
        (now() AT TIME ZONE 'Asia/Almaty')::date;

    v_end_date :=
        v_today + (p_days - 1);

    -- 6. Generate training sessions
    INSERT INTO public.training_sessions (
        academy_id,
        group_id,
        schedule_id,
        starts_at,
        ends_at,
        training_type,
        status
    )
    SELECT
        s.academy_id,
        s.group_id,
        s.id,

        (
            (d.training_date + s.start_time)
            AT TIME ZONE 'Asia/Almaty'
        ),

        (
            (d.training_date + s.end_time)
            AT TIME ZONE 'Asia/Almaty'
        ),

        s.training_type,
        'scheduled'

    FROM public.training_schedules AS s

    JOIN public.training_groups AS tg
        ON tg.id = s.group_id
       AND tg.academy_id = s.academy_id
       AND tg.is_active = true

    CROSS JOIN LATERAL (
        SELECT gs::date AS training_date
        FROM generate_series(
            GREATEST(v_today, s.valid_from),
            LEAST(
                v_end_date,
                COALESCE(s.valid_until, v_end_date)
            ),
            interval '1 day'
        ) AS gs
    ) AS d

    WHERE s.academy_id = v_academy_id
      AND s.is_active = true
      AND EXTRACT(
          ISODOW FROM d.training_date
      )::integer = s.day_of_week

    -- 7. Prevent duplicate sessions
    ON CONFLICT (
        schedule_id,
        starts_at
    )
    WHERE schedule_id IS NOT NULL
    DO NOTHING;

    -- 8. Return number of inserted sessions
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    RETURN v_inserted;
END;
$$;


ALTER FUNCTION public.generate_str_training_sessions(p_days integer) OWNER TO postgres;

--
-- TOC entry 571 (class 1255 OID 19236)
-- Name: generate_str_training_sessions_system(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_str_training_sessions_system(p_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_today date;
    v_end_date date;
    v_inserted integer := 0;
BEGIN
    -- 1. Validate generation period
    IF p_days IS NULL
       OR p_days < 1
       OR p_days > 90
    THEN
        RAISE EXCEPTION
            'Generation period must be between 1 and 90 days'
            USING ERRCODE = '22023';
    END IF;

    -- 2. Calculate generation period
    v_today :=
        (now() AT TIME ZONE 'Asia/Almaty')::date;

    v_end_date := v_today + (p_days - 1);

    -- 3. Generate training sessions
    INSERT INTO public.training_sessions (
        academy_id,
        group_id,
        schedule_id,
        starts_at,
        ends_at,
        training_type,
        status
    )
    SELECT
        s.academy_id,
        s.group_id,
        s.id,

        (
            (d.training_date + s.start_time)
            AT TIME ZONE 'Asia/Almaty'
        ),

        (
            (d.training_date + s.end_time)
            AT TIME ZONE 'Asia/Almaty'
        ),

        s.training_type,
        'scheduled'

    FROM public.training_schedules AS s

    -- 4. Verify group ownership and active status
    INNER JOIN public.training_groups AS tg
        ON tg.id = s.group_id
       AND tg.academy_id = s.academy_id
       AND tg.is_active = true

    -- 5. Generate valid training dates
    CROSS JOIN LATERAL (
        SELECT gs::date AS training_date
        FROM generate_series(
            GREATEST(
                v_today,
                s.valid_from
            ),
            LEAST(
                v_end_date,
                COALESCE(
                    s.valid_until,
                    v_end_date
                )
            ),
            interval '1 day'
        ) AS gs
    ) AS d

    -- 6. Include active schedules only
    WHERE s.is_active = true

      AND EXTRACT(
          ISODOW FROM d.training_date
      )::integer = s.day_of_week

    -- 7. Prevent duplicate training sessions
    ON CONFLICT (
        schedule_id,
        starts_at
    )
    WHERE schedule_id IS NOT NULL
    DO NOTHING;

    -- 8. Return inserted session count
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    RETURN v_inserted;
END;
$$;


ALTER FUNCTION public.generate_str_training_sessions_system(p_days integer) OWNER TO postgres;

--
-- TOC entry 490 (class 1255 OID 19276)
-- Name: get_my_str_account_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_str_account_status() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_email_confirmed boolean;
    v_has_membership boolean;
    v_has_active_membership boolean;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT u.email_confirmed_at IS NOT NULL
    INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF NOT v_email_confirmed THEN
        RETURN 'email_unconfirmed';
    END IF;

    SELECT
        COUNT(*) > 0,
        COUNT(*) FILTER (
            WHERE am.is_active = true
        ) > 0
    INTO
        v_has_membership,
        v_has_active_membership
    FROM public.academy_members am
    JOIN public.academies a
        ON a.id = am.academy_id
    WHERE am.user_id = v_user_id
      AND a.slug = 'str-of-jiu-jitsu';

    IF v_has_active_membership THEN
        RETURN 'active';
    END IF;

    IF v_has_membership THEN
        RETURN 'inactive';
    END IF;

    RETURN 'pending';
END;
$$;


ALTER FUNCTION public.get_my_str_account_status() OWNER TO postgres;

--
-- TOC entry 558 (class 1255 OID 18094)
-- Name: get_my_str_admin_academy_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_str_admin_academy_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$

    SELECT am.academy_id

    FROM public.academy_members AS am

    JOIN public.academies AS a
        ON a.id = am.academy_id

    WHERE am.user_id = (SELECT auth.uid())

      AND am.role = 'super_admin'

      AND am.is_active = true

      AND a.slug = 'str-of-jiu-jitsu'

      AND (SELECT public.is_my_str_email_confirmed()) = true

    LIMIT 1;

$$;


ALTER FUNCTION public.get_my_str_admin_academy_id() OWNER TO postgres;

--
-- TOC entry 413 (class 1255 OID 18062)
-- Name: get_my_str_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_str_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$

    SELECT am.role

    FROM public.academy_members AS am

    JOIN public.academies AS a
        ON a.id = am.academy_id

    WHERE am.user_id = (SELECT auth.uid())

      AND a.slug = 'str-of-jiu-jitsu'

      AND am.is_active = true

      AND (SELECT public.is_my_str_email_confirmed()) = true

    ORDER BY CASE am.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'coach' THEN 4
        WHEN 'parent' THEN 5
        WHEN 'student' THEN 6
        ELSE 7
    END

    LIMIT 1;

$$;


ALTER FUNCTION public.get_my_str_role() OWNER TO postgres;

--
-- TOC entry 677 (class 1255 OID 19247)
-- Name: get_my_str_schedule_access(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_str_schedule_access() RETURNS TABLE(academy_id uuid, member_role text, can_view_schedule boolean, can_edit_schedule boolean, can_manage_all_sessions boolean, head_group_ids uuid[], assistant_group_ids uuid[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$

    SELECT
        am.academy_id,

        am.role::text AS member_role,

        (
            am.role IN ('super_admin', 'admin')
            OR cardinality(groups.head_ids) > 0
            OR cardinality(groups.assistant_ids) > 0
        ) AS can_view_schedule,

        (
            am.role IN ('super_admin', 'admin')
        ) AS can_edit_schedule,

        (
            am.role IN ('super_admin', 'admin')
        ) AS can_manage_all_sessions,

        groups.head_ids AS head_group_ids,

        groups.assistant_ids AS assistant_group_ids

    FROM public.academy_members am

    JOIN public.academies a
        ON a.id = am.academy_id

    CROSS JOIN LATERAL (
        SELECT
            COALESCE(
                array_agg(DISTINCT gc.group_id)
                    FILTER (WHERE gc.role = 'head'),
                ARRAY[]::uuid[]
            ) AS head_ids,

            COALESCE(
                array_agg(DISTINCT gc.group_id)
                    FILTER (WHERE gc.role = 'assistant'),
                ARRAY[]::uuid[]
            ) AS assistant_ids

        FROM public.group_coaches gc

        WHERE gc.member_id = am.id
          AND gc.academy_id = am.academy_id
          AND am.role = 'coach'
          AND gc.assigned_at <=
              (now() AT TIME ZONE 'Asia/Almaty')::date
          AND (
              gc.ended_at IS NULL
              OR gc.ended_at >=
                 (now() AT TIME ZONE 'Asia/Almaty')::date
          )
    ) groups

    WHERE am.user_id = (SELECT auth.uid())
      AND am.is_active = true
      AND a.slug = 'str-of-jiu-jitsu'
      AND (SELECT public.is_my_str_email_confirmed()) = true;

$$;


ALTER FUNCTION public.get_my_str_schedule_access() OWNER TO postgres;

--
-- TOC entry 602 (class 1255 OID 18513)
-- Name: get_str_financial_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_str_financial_summary() RETURNS TABLE(today_income numeric, month_income numeric, total_debt numeric, debtors_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_role text;
    v_today date;
    v_month_start date;
BEGIN
    -- Проверяем авторизацию и роль
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_role := public.get_my_str_role();

    IF v_role IS NULL
       OR v_role NOT IN ('super_admin', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    -- Определяем академию через существующую RPC
    v_academy_id := public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Academy not found';
    END IF;

    -- Локальная дата Казахстана
    v_today := (now() AT TIME ZONE 'Asia/Almaty')::date;
    v_month_start := date_trunc('month', v_today::timestamp)::date;

    RETURN QUERY
    WITH income AS (
        SELECT
            COALESCE(
                SUM(p.amount) FILTER (
                    WHERE p.payment_date = v_today
                ),
                0
            ) AS today_total,

            COALESCE(
                SUM(p.amount),
                0
            ) AS month_total
        FROM public.subscription_payments p
        WHERE p.academy_id = v_academy_id
          AND p.status = 'completed'
          AND p.payment_date >= v_month_start
          AND p.payment_date <= v_today
    ),
    debts AS (
        SELECT
            COALESCE(
                SUM(b.debt_amount),
                0
            ) AS debt_total,

            COUNT(
                DISTINCT b.student_id
            ) AS debtor_total
        FROM public.subscription_balances b
        WHERE b.academy_id = v_academy_id
          AND b.subscription_status <> 'cancelled'
          AND b.debt_amount > 0
    )
    SELECT
        income.today_total,
        income.month_total,
        debts.debt_total,
        debts.debtor_total
    FROM income
    CROSS JOIN debts;
END;
$$;


ALTER FUNCTION public.get_str_financial_summary() OWNER TO postgres;

--
-- TOC entry 377 (class 1255 OID 19257)
-- Name: handle_new_user_profile(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN

    INSERT INTO public.profiles (
        id,
        first_name,
        last_name,
        phone
    )
    VALUES (
        NEW.id,
        NULLIF(
            LEFT(TRIM(NEW.raw_user_meta_data ->> 'first_name'), 80),
            ''
        ),
        NULLIF(
            LEFT(TRIM(NEW.raw_user_meta_data ->> 'last_name'), 80),
            ''
        ),
        NULLIF(
            LEFT(TRIM(NEW.raw_user_meta_data ->> 'phone'), 25),
            ''
        )
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;

END;
$$;


ALTER FUNCTION public.handle_new_user_profile() OWNER TO postgres;

--
-- TOC entry 659 (class 1255 OID 19277)
-- Name: is_my_str_email_confirmed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_my_str_email_confirmed() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$

    SELECT EXISTS (
        SELECT 1
        FROM auth.users AS u
        WHERE u.id = (SELECT auth.uid())
          AND u.email IS NOT NULL
          AND u.email_confirmed_at IS NOT NULL
    );

$$;


ALTER FUNCTION public.is_my_str_email_confirmed() OWNER TO postgres;

--
-- TOC entry 633 (class 1255 OID 18391)
-- Name: log_group_enrollment_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_group_enrollment_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_changed_fields text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_changed_fields := ARRAY[]::text[];

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);

        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM jsonb_each(v_new_data)
        WHERE v_old_data -> key IS DISTINCT FROM value;

        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

    ELSE
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_changed_fields := ARRAY[]::text[];
    END IF;

    INSERT INTO public.audit_logs (
        academy_id,
        table_name,
        record_id,
        action,
        changed_by,
        old_data,
        new_data,
        changed_fields
    )
    VALUES (
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.academy_id
            ELSE NEW.academy_id
        END,
        'group_enrollments',
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        auth.uid(),
        v_old_data,
        v_new_data,
        v_changed_fields
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_group_enrollment_changes() OWNER TO postgres;

--
-- TOC entry 548 (class 1255 OID 18509)
-- Name: record_subscription_payment(uuid, numeric, text, date, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_subscription_payment(p_subscription_id uuid, p_amount numeric, p_payment_method text, p_payment_date date DEFAULT ((now() AT TIME ZONE 'Asia/Almaty'::text))::date, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
    v_role text;
    v_academy_id uuid;
    v_subscription public.student_subscriptions%ROWTYPE;
    v_paid numeric;
    v_remaining numeric;
    v_payment_id uuid;
    v_today date;

BEGIN

    -- 1. Authentication

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Необходима авторизация'
            USING ERRCODE = '42501';
    END IF;


    -- 2. Authorization

    v_role := public.get_my_str_role();

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Недостаточно прав'
            USING ERRCODE = '42501';
    END IF;

    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Академия не найдена'
            USING ERRCODE = '42501';
    END IF;


    -- 3. Validate subscription ID

    IF p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Укажите абонемент'
            USING ERRCODE = '22023';
    END IF;


    -- 4. Validate payment amount

    IF p_amount IS NULL
       OR p_amount::text IN (
           'NaN', 'Infinity', '-Infinity'
       )
       OR p_amount <= 0
       OR p_amount <> round(p_amount, 2)
       OR p_amount > 9999999999.99
    THEN
        RAISE EXCEPTION 'Некорректная сумма платежа'
            USING ERRCODE = '22023';
    END IF;


    -- 5. Validate payment method

    IF p_payment_method IS NULL
       OR p_payment_method NOT IN (
           'kaspi',
           'halyk',
           'cash',
           'bank_transfer',
           'other'
       )
    THEN
        RAISE EXCEPTION 'Некорректный способ оплаты'
            USING ERRCODE = '22023';
    END IF;


    -- 6. Validate payment date

    v_today :=
        (now() AT TIME ZONE 'Asia/Almaty')::date;

    IF p_payment_date IS NULL
       OR NOT isfinite(p_payment_date)
    THEN
        RAISE EXCEPTION 'Некорректная дата оплаты'
            USING ERRCODE = '22023';
    END IF;

    IF p_payment_date > v_today THEN
        RAISE EXCEPTION
            'Дата оплаты не может быть в будущем'
            USING ERRCODE = '22023';
    END IF;


    -- 7. Lock subscription

    SELECT *
    INTO v_subscription
    FROM public.student_subscriptions
    WHERE id = p_subscription_id
      AND academy_id = v_academy_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Абонемент не найден';
    END IF;

    IF v_subscription.status = 'cancelled' THEN
        RAISE EXCEPTION 'Абонемент отменён';
    END IF;


    -- 8. Validate stored subscription price

    IF v_subscription.price IS NULL
       OR v_subscription.price::text IN (
           'NaN', 'Infinity', '-Infinity'
       )
       OR v_subscription.price < 0
    THEN
        RAISE EXCEPTION
            'Некорректная стоимость абонемента';
    END IF;


    -- 9. Calculate completed payments

    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM public.subscription_payments
    WHERE academy_id = v_academy_id
      AND subscription_id = p_subscription_id
      AND status = 'completed';

    IF v_paid::text IN (
        'NaN', 'Infinity', '-Infinity'
    )
       OR v_paid < 0
    THEN
        RAISE EXCEPTION
            'Обнаружены некорректные финансовые данные';
    END IF;

    v_remaining := GREATEST(
        v_subscription.price - v_paid,
        0
    );


    -- 10. Prevent overpayment

    IF p_amount > v_remaining THEN
        RAISE EXCEPTION
            'Сумма превышает задолженность: % ₸',
            v_remaining;
    END IF;


    -- 11. Register payment

    INSERT INTO public.subscription_payments (
        academy_id,
        subscription_id,
        amount,
        payment_date,
        payment_method,
        status,
        notes,
        created_by
    )
    VALUES (
        v_academy_id,
        p_subscription_id,
        p_amount,
        p_payment_date,
        p_payment_method,
        'completed',
        p_notes,
        auth.uid()
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;

END;
$$;


ALTER FUNCTION public.record_subscription_payment(p_subscription_id uuid, p_amount numeric, p_payment_method text, p_payment_date date, p_notes text) OWNER TO postgres;

--
-- TOC entry 604 (class 1255 OID 19261)
-- Name: remove_student_from_training_group(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_enrollment_id uuid;
BEGIN
    -- Проверяем доступ к академии.
    v_academy_id := public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Доступ запрещён';
    END IF;

    -- Блокируем активное зачисление для безопасного изменения.
    SELECT ge.id
    INTO v_enrollment_id
    FROM public.group_enrollments AS ge
    WHERE ge.id = p_enrollment_id
      AND ge.academy_id = v_academy_id
      AND ge.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Активное зачисление не найдено или доступ запрещён';
    END IF;

    -- Сохраняем историю, не удаляя запись.
    UPDATE public.group_enrollments
    SET
        status = 'cancelled',
        ended_at = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_enrollment_id
      AND academy_id = v_academy_id;

    RETURN v_enrollment_id;
END;
$$;


ALTER FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid) OWNER TO postgres;

--
-- TOC entry 524 (class 1255 OID 18394)
-- Name: remove_student_from_training_group(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid, p_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_enrollment_id uuid;
    v_reason text;
BEGIN
    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Доступ запрещён';
    END IF;

    v_reason := btrim(p_reason);

    IF v_reason IS NULL
       OR char_length(v_reason) NOT BETWEEN 3 AND 500
    THEN
        RAISE EXCEPTION
            'Укажите причину исключения от 3 до 500 символов';
    END IF;

    SELECT ge.id
    INTO v_enrollment_id
    FROM public.group_enrollments AS ge
    WHERE ge.id = p_enrollment_id
      AND ge.academy_id = v_academy_id
      AND ge.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Активное зачисление не найдено или доступ запрещён';
    END IF;

    UPDATE public.group_enrollments
    SET
        status = 'cancelled',
        ended_at = CURRENT_DATE,
        removal_reason = v_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_enrollment_id
      AND academy_id = v_academy_id;

    RETURN v_enrollment_id;
END;
$$;


ALTER FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid, p_reason text) OWNER TO postgres;

--
-- TOC entry 379 (class 1255 OID 17604)
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- TOC entry 641 (class 1255 OID 19184)
-- Name: sync_str_training_session_statuses(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_str_training_session_statuses() RETURNS TABLE(started_count integer, completed_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_started integer := 0;
    v_completed integer := 0;
BEGIN
    -- Сначала завершаем занятия,
    -- время окончания которых прошло.
    UPDATE public.training_sessions
    SET
        status = 'completed',
        updated_at = now()
    WHERE status IN ('scheduled', 'in_progress')
      AND ends_at <= now();

    GET DIAGNOSTICS v_completed = ROW_COUNT;

    -- Затем запускаем запланированные занятия,
    -- время начала которых наступило.
    UPDATE public.training_sessions
    SET
        status = 'in_progress',
        updated_at = now()
    WHERE status = 'scheduled'
      AND starts_at <= now()
      AND ends_at > now();

    GET DIAGNOSTICS v_started = ROW_COUNT;

    RETURN QUERY
    SELECT v_started, v_completed;
END;
$$;


ALTER FUNCTION public.sync_str_training_session_statuses() OWNER TO postgres;

--
-- TOC entry 431 (class 1255 OID 18169)
-- Name: update_str_student(uuid, text, text, date, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_str_student(p_student_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_belt text, p_status text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_academy_id uuid;
    v_student_id uuid;
    v_first_name text := btrim(p_first_name);
    v_last_name text := btrim(p_last_name);
    v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
    -- Проверка авторизации и роли администратора.
    IF auth.uid() IS NULL
       OR public.get_my_str_role() IS DISTINCT FROM 'super_admin'
    THEN
        RAISE EXCEPTION 'Insufficient privileges'
            USING ERRCODE = '42501';
    END IF;

    v_academy_id := public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Insufficient privileges'
            USING ERRCODE = '42501';
    END IF;

    -- Проверка имени и фамилии.
    IF v_first_name IS NULL
       OR length(v_first_name) NOT BETWEEN 1 AND 100
       OR v_last_name IS NULL
       OR length(v_last_name) NOT BETWEEN 1 AND 100
    THEN
        RAISE EXCEPTION 'Invalid student name';
    END IF;

    -- Проверка телефона.
    IF v_phone IS NOT NULL AND length(v_phone) > 30 THEN
        RAISE EXCEPTION 'Invalid phone';
    END IF;

    -- Дата рождения не может быть в будущем.
    IF p_date_of_birth IS NOT NULL
       AND p_date_of_birth > CURRENT_DATE
    THEN
        RAISE EXCEPTION 'Invalid date of birth';
    END IF;

    -- Допустимые пояса.
    IF p_belt IS NULL OR p_belt NOT IN (
        'white',
        'grey_white',
        'grey',
        'grey_black',
        'yellow_white',
        'yellow',
        'yellow_black',
        'orange_white',
        'orange',
        'orange_black',
        'green_white',
        'green',
        'green_black',
        'blue',
        'purple',
        'brown',
        'black'
    ) THEN
        RAISE EXCEPTION 'Invalid belt';
    END IF;

    -- Допустимые статусы.
    IF p_status IS NULL OR p_status NOT IN (
        'active',
        'inactive',
        'suspended',
        'archived'
    ) THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    -- Обновляем только разрешённые поля
    -- и только внутри академии администратора.
    UPDATE public.students
    SET
        first_name = v_first_name,
        last_name = v_last_name,
        date_of_birth = p_date_of_birth,
        phone = v_phone,
        belt = p_belt,
        status = p_status,
        updated_at = now()
    WHERE id = p_student_id
      AND academy_id = v_academy_id
    RETURNING id INTO v_student_id;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student not found in academy';
    END IF;

    RETURN v_student_id;
END;
$$;


ALTER FUNCTION public.update_str_student(p_student_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_belt text, p_status text) OWNER TO postgres;

--
-- TOC entry 668 (class 1255 OID 18143)
-- Name: update_student_guardian(uuid, uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_student_guardian(p_student_id uuid, p_guardian_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
    v_academy_id uuid;
    v_guardian_id uuid;
    v_first_name text := btrim(p_first_name);
    v_last_name text := btrim(p_last_name);
    v_phone text := btrim(p_phone);
    v_email text := NULLIF(btrim(p_email), '');
BEGIN
    -- 1. Проверяем авторизацию и роль.
    IF auth.uid() IS NULL
       OR public.get_my_str_role() IS DISTINCT FROM 'super_admin'
    THEN
        RAISE EXCEPTION 'Insufficient privileges'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Получаем академию администратора.
    v_academy_id := public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION 'Insufficient privileges'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Проверяем входные данные.
    IF v_first_name IS NULL
       OR length(v_first_name) NOT BETWEEN 1 AND 100
       OR v_last_name IS NULL
       OR length(v_last_name) NOT BETWEEN 1 AND 100
    THEN
        RAISE EXCEPTION 'Invalid guardian name';
    END IF;

    IF v_phone IS NULL
       OR length(v_phone) NOT BETWEEN 5 AND 30
    THEN
        RAISE EXCEPTION 'Invalid phone';
    END IF;

    IF v_email IS NOT NULL AND (
        length(v_email) > 254
        OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid email';
    END IF;

    IF p_relationship IS NULL
       OR p_relationship NOT IN ('parent', 'guardian')
    THEN
        RAISE EXCEPTION 'Invalid relationship';
    END IF;

    -- 4. Проверяем принадлежность ученика академии.
    PERFORM 1
    FROM public.students
    WHERE id = p_student_id
      AND academy_id = v_academy_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found in academy';
    END IF;

    -- 5. Изменяем только разрешённые поля.
    UPDATE public.student_guardians
    SET
        first_name = v_first_name,
        last_name = v_last_name,
        phone = v_phone,
        email = v_email,
        relationship = p_relationship,
        updated_at = now()
    WHERE id = p_guardian_id
      AND student_id = p_student_id
      AND academy_id = v_academy_id
    RETURNING id INTO v_guardian_id;

    IF v_guardian_id IS NULL THEN
        RAISE EXCEPTION 'Guardian not found in academy';
    END IF;

    RETURN v_guardian_id;
END;
$_$;


ALTER FUNCTION public.update_student_guardian(p_student_id uuid, p_guardian_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) OWNER TO postgres;

--
-- TOC entry 676 (class 1255 OID 18512)
-- Name: void_subscription_payment(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.void_subscription_payment(p_payment_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE

    v_role text;
    v_academy_id uuid;
    v_subscription_id uuid;

    v_payment public.subscription_payments%ROWTYPE;

BEGIN

    -- 1. Authentication

    IF auth.uid() IS NULL THEN

        RAISE EXCEPTION 'Необходима авторизация'
            USING ERRCODE = '42501';

    END IF;


    -- 2. Authorization

    v_role := public.get_my_str_role();

    IF v_role IS DISTINCT FROM 'super_admin' THEN

        RAISE EXCEPTION 'Недостаточно прав'
            USING ERRCODE = '42501';

    END IF;


    v_academy_id :=
        public.get_my_str_admin_academy_id();

    IF v_academy_id IS NULL THEN

        RAISE EXCEPTION 'Академия не найдена'
            USING ERRCODE = '42501';

    END IF;


    -- 3. Validate parameters

    IF p_payment_id IS NULL THEN

        RAISE EXCEPTION 'Укажите платёж'
            USING ERRCODE = '22023';

    END IF;


    IF p_reason IS NULL
       OR length(trim(p_reason)) < 5
    THEN

        RAISE EXCEPTION
            'Укажите причину отмены (минимум 5 символов)'
            USING ERRCODE = '22023';

    END IF;


    -- 4. Identify parent subscription

    SELECT subscription_id
    INTO v_subscription_id

    FROM public.subscription_payments

    WHERE id = p_payment_id
      AND academy_id = v_academy_id;


    IF NOT FOUND THEN

        RAISE EXCEPTION 'Платёж не найден';

    END IF;


    -- 5. Lock parent subscription first

    PERFORM 1

    FROM public.student_subscriptions

    WHERE id = v_subscription_id
      AND academy_id = v_academy_id

    FOR UPDATE;


    IF NOT FOUND THEN

        RAISE EXCEPTION 'Абонемент не найден';

    END IF;


    -- 6. Lock and revalidate payment

    SELECT *
    INTO v_payment

    FROM public.subscription_payments

    WHERE id = p_payment_id
      AND academy_id = v_academy_id
      AND subscription_id = v_subscription_id

    FOR UPDATE;


    IF NOT FOUND THEN

        RAISE EXCEPTION 'Платёж не найден';

    END IF;


    -- 7. Validate current payment status

    IF v_payment.status = 'voided' THEN

        RAISE EXCEPTION 'Платёж уже отменён';

    END IF;


    IF v_payment.status IS DISTINCT FROM 'completed' THEN

        RAISE EXCEPTION
            'Недопустимый статус платежа';

    END IF;


    -- 8. Cancel payment

    UPDATE public.subscription_payments

    SET

        status = 'voided',

        notes = concat_ws(
            E'\n',
            NULLIF(notes, ''),
            'Причина отмены: ' || trim(p_reason)
        )

    WHERE id = p_payment_id
      AND academy_id = v_academy_id
      AND subscription_id = v_subscription_id;


    -- Financial audit trigger records the change.

END;

$$;


ALTER FUNCTION public.void_subscription_payment(p_payment_id uuid, p_reason text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 317 (class 1259 OID 17606)
-- Name: academies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    city text,
    country text DEFAULT 'Kazakhstan'::text NOT NULL,
    timezone text DEFAULT 'Asia/Almaty'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.academies OWNER TO postgres;

--
-- TOC entry 319 (class 1259 OID 17635)
-- Name: academy_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academy_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT academy_members_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'coach'::text, 'parent'::text, 'student'::text])))
);


ALTER TABLE public.academy_members OWNER TO postgres;

--
-- TOC entry 327 (class 1259 OID 17924)
-- Name: academy_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academy_qr_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    public_code uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Основной вход'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT academy_qr_codes_revocation_check CHECK (((is_active = false) OR (revoked_at IS NULL)))
);


ALTER TABLE public.academy_qr_codes OWNER TO postgres;

--
-- TOC entry 329 (class 1259 OID 17979)
-- Name: attendance_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_user_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT attendance_events_event_type_check CHECK ((event_type = ANY (ARRAY['check_in'::text, 'check_out'::text, 'auto_checkout'::text, 'manual_correction'::text])))
);


ALTER TABLE public.attendance_events OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 17885)
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    check_in_method text DEFAULT 'manual'::text NOT NULL,
    marked_by uuid,
    checked_in_at timestamp with time zone,
    correction_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_records_check_in_method_check CHECK ((check_in_method = ANY (ARRAY['manual'::text, 'qr'::text]))),
    CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])))
);


ALTER TABLE public.attendance_records OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 17944)
-- Name: attendance_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    student_id uuid NOT NULL,
    qr_code_id uuid,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_out_at timestamp with time zone,
    checkout_method text,
    status text DEFAULT 'checked_in'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_visits_checkout_method_check CHECK ((checkout_method = ANY (ARRAY['qr'::text, 'automatic'::text, 'admin'::text]))),
    CONSTRAINT attendance_visits_state_check CHECK ((((status = 'checked_in'::text) AND (checked_out_at IS NULL) AND (checkout_method IS NULL)) OR ((status = ANY (ARRAY['checked_out'::text, 'auto_closed'::text])) AND (checked_out_at IS NOT NULL) AND (checkout_method IS NOT NULL)) OR (status = 'needs_review'::text))),
    CONSTRAINT attendance_visits_status_check CHECK ((status = ANY (ARRAY['checked_in'::text, 'checked_out'::text, 'auto_closed'::text, 'needs_review'::text]))),
    CONSTRAINT attendance_visits_time_check CHECK (((checked_out_at IS NULL) OR (checked_out_at >= checked_in_at)))
);


ALTER TABLE public.attendance_visits OWNER TO postgres;

--
-- TOC entry 332 (class 1259 OID 18144)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    changed_by uuid,
    old_data jsonb,
    new_data jsonb,
    changed_fields text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
    CONSTRAINT audit_logs_action_data_check CHECK ((((action = 'INSERT'::text) AND (old_data IS NULL) AND (new_data IS NOT NULL)) OR ((action = 'UPDATE'::text) AND (old_data IS NOT NULL) AND (new_data IS NOT NULL)) OR ((action = 'DELETE'::text) AND (old_data IS NOT NULL) AND (new_data IS NULL))))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 4552 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Защищённый журнал изменений данных STR OF JIU JITSU';


--
-- TOC entry 323 (class 1259 OID 17790)
-- Name: group_coaches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    group_id uuid NOT NULL,
    member_id uuid NOT NULL,
    role text DEFAULT 'assistant'::text NOT NULL,
    assigned_at date DEFAULT CURRENT_DATE NOT NULL,
    ended_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_coaches_dates_valid CHECK (((ended_at IS NULL) OR (ended_at >= assigned_at))),
    CONSTRAINT group_coaches_role_check CHECK ((role = ANY (ARRAY['head'::text, 'assistant'::text])))
);


ALTER TABLE public.group_coaches OWNER TO postgres;

--
-- TOC entry 322 (class 1259 OID 17755)
-- Name: group_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    group_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrolled_at date DEFAULT CURRENT_DATE NOT NULL,
    ended_at date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    removal_reason text,
    CONSTRAINT enrollment_active_dates CHECK (((status <> 'active'::text) OR (ended_at IS NULL))),
    CONSTRAINT enrollment_dates_valid CHECK (((ended_at IS NULL) OR (ended_at >= enrolled_at))),
    CONSTRAINT group_enrollments_removal_reason_length CHECK (((removal_reason IS NULL) OR ((char_length(TRIM(BOTH FROM removal_reason)) >= 3) AND (char_length(TRIM(BOTH FROM removal_reason)) <= 500)))),
    CONSTRAINT group_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.group_enrollments OWNER TO postgres;

--
-- TOC entry 330 (class 1259 OID 18028)
-- Name: parent_student_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parent_student_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    parent_user_id uuid NOT NULL,
    student_id uuid NOT NULL,
    relationship text DEFAULT 'parent'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parent_student_links_relationship_check CHECK ((relationship = ANY (ARRAY['parent'::text, 'guardian'::text])))
);


ALTER TABLE public.parent_student_links OWNER TO postgres;

--
-- TOC entry 318 (class 1259 OID 17621)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    first_name text,
    last_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 331 (class 1259 OID 18098)
-- Name: student_guardians; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    student_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL,
    email text,
    relationship text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guardian_first_name_check CHECK (((length(TRIM(BOTH FROM first_name)) >= 1) AND (length(TRIM(BOTH FROM first_name)) <= 100))),
    CONSTRAINT guardian_last_name_check CHECK (((length(TRIM(BOTH FROM last_name)) >= 1) AND (length(TRIM(BOTH FROM last_name)) <= 100))),
    CONSTRAINT guardian_phone_check CHECK (((length(TRIM(BOTH FROM phone)) >= 5) AND (length(TRIM(BOTH FROM phone)) <= 30))),
    CONSTRAINT student_guardians_relationship_check CHECK ((relationship = ANY (ARRAY['parent'::text, 'guardian'::text])))
);


ALTER TABLE public.student_guardians OWNER TO postgres;

--
-- TOC entry 336 (class 1259 OID 18421)
-- Name: student_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    student_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    price numeric(12,2) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_subscriptions_dates_check CHECK ((end_date >= start_date)),
    CONSTRAINT student_subscriptions_dates_finite_check CHECK (((start_date IS NOT NULL) AND (end_date IS NOT NULL) AND isfinite(start_date) AND isfinite(end_date))),
    CONSTRAINT student_subscriptions_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT student_subscriptions_price_finite_check CHECK (((price IS NOT NULL) AND (price <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric])))),
    CONSTRAINT student_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.student_subscriptions OWNER TO postgres;

--
-- TOC entry 320 (class 1259 OID 17659)
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    user_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date,
    phone text,
    belt text DEFAULT 'white'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_belt_check CHECK ((belt = ANY (ARRAY['white'::text, 'grey_white'::text, 'grey'::text, 'grey_black'::text, 'yellow_white'::text, 'yellow'::text, 'yellow_black'::text, 'orange_white'::text, 'orange'::text, 'orange_black'::text, 'green_white'::text, 'green'::text, 'green_black'::text, 'blue'::text, 'purple'::text, 'brown'::text, 'black'::text]))),
    CONSTRAINT students_name_not_empty CHECK (((length(TRIM(BOTH FROM first_name)) > 0) AND (length(TRIM(BOTH FROM last_name)) > 0))),
    CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'archived'::text])))
);


ALTER TABLE public.students OWNER TO postgres;

--
-- TOC entry 337 (class 1259 OID 18469)
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT subscription_payments_amount_finite_check CHECK (((amount IS NOT NULL) AND (amount <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric])))),
    CONSTRAINT subscription_payments_date_finite_check CHECK (((payment_date IS NOT NULL) AND isfinite(payment_date))),
    CONSTRAINT subscription_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['kaspi'::text, 'halyk'::text, 'cash'::text, 'bank_transfer'::text, 'other'::text]))),
    CONSTRAINT subscription_payments_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'voided'::text])))
);


ALTER TABLE public.subscription_payments OWNER TO postgres;

--
-- TOC entry 338 (class 1259 OID 18503)
-- Name: subscription_balances; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.subscription_balances WITH (security_invoker='true') AS
 SELECT s.id AS subscription_id,
    s.academy_id,
    s.student_id,
    s.plan_id,
    s.start_date,
    s.end_date,
    s.status AS subscription_status,
    s.price AS total_price,
    COALESCE(sum(p.amount) FILTER (WHERE (p.status = 'completed'::text)), (0)::numeric) AS paid_amount,
    GREATEST((s.price - COALESCE(sum(p.amount) FILTER (WHERE (p.status = 'completed'::text)), (0)::numeric)), (0)::numeric) AS debt_amount,
        CASE
            WHEN (s.price = (0)::numeric) THEN 'paid'::text
            WHEN (COALESCE(sum(p.amount) FILTER (WHERE (p.status = 'completed'::text)), (0)::numeric) = (0)::numeric) THEN 'unpaid'::text
            WHEN (COALESCE(sum(p.amount) FILTER (WHERE (p.status = 'completed'::text)), (0)::numeric) < s.price) THEN 'partially_paid'::text
            ELSE 'paid'::text
        END AS payment_status
   FROM (public.student_subscriptions s
     LEFT JOIN public.subscription_payments p ON (((p.subscription_id = s.id) AND (p.academy_id = s.academy_id))))
  GROUP BY s.id, s.academy_id, s.student_id, s.plan_id, s.start_date, s.end_date, s.status, s.price;


ALTER VIEW public.subscription_balances OWNER TO postgres;

--
-- TOC entry 335 (class 1259 OID 18396)
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(12,2) NOT NULL,
    sessions_per_week integer,
    duration_days integer DEFAULT 30 NOT NULL,
    is_unlimited boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_plans_duration_days_check CHECK ((duration_days > 0)),
    CONSTRAINT subscription_plans_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT subscription_plans_price_finite_check CHECK (((price IS NOT NULL) AND (price <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric])))),
    CONSTRAINT subscription_plans_sessions_per_week_check CHECK ((sessions_per_week > 0))
);


ALTER TABLE public.subscription_plans OWNER TO postgres;

--
-- TOC entry 321 (class 1259 OID 17708)
-- Name: training_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    group_type text DEFAULT 'mixed'::text NOT NULL,
    min_age integer,
    max_age integer,
    capacity integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_groups_age_range CHECK (((min_age IS NULL) OR (max_age IS NULL) OR (min_age <= max_age))),
    CONSTRAINT training_groups_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT training_groups_group_type_check CHECK ((group_type = ANY (ARRAY['kids'::text, 'adults'::text, 'mixed'::text, 'competition'::text, 'private'::text]))),
    CONSTRAINT training_groups_max_age_check CHECK ((max_age >= 0)),
    CONSTRAINT training_groups_min_age_check CHECK ((min_age >= 0)),
    CONSTRAINT training_groups_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


ALTER TABLE public.training_groups OWNER TO postgres;

--
-- TOC entry 324 (class 1259 OID 17821)
-- Name: training_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    group_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    training_type text DEFAULT 'gi'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_schedules_dates_valid CHECK (((valid_until IS NULL) OR (valid_until >= valid_from))),
    CONSTRAINT training_schedules_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT training_schedules_time_valid CHECK ((end_time > start_time)),
    CONSTRAINT training_schedules_training_type_check CHECK ((training_type = ANY (ARRAY['gi'::text, 'nogi'::text, 'open_mat'::text, 'competition'::text, 'other'::text])))
);


ALTER TABLE public.training_schedules OWNER TO postgres;

--
-- TOC entry 325 (class 1259 OID 17850)
-- Name: training_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academy_id uuid NOT NULL,
    group_id uuid NOT NULL,
    schedule_id uuid,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    training_type text DEFAULT 'gi'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_sessions_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT training_sessions_time_valid CHECK ((ends_at > starts_at)),
    CONSTRAINT training_sessions_training_type_check CHECK ((training_type = ANY (ARRAY['gi'::text, 'nogi'::text, 'open_mat'::text, 'competition'::text, 'other'::text])))
);


ALTER TABLE public.training_sessions OWNER TO postgres;

--
-- TOC entry 4146 (class 2606 OID 17618)
-- Name: academies academies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academies
    ADD CONSTRAINT academies_pkey PRIMARY KEY (id);


--
-- TOC entry 4148 (class 2606 OID 17620)
-- Name: academies academies_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academies
    ADD CONSTRAINT academies_slug_key UNIQUE (slug);


--
-- TOC entry 4152 (class 2606 OID 17645)
-- Name: academy_members academy_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_members
    ADD CONSTRAINT academy_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4154 (class 2606 OID 17647)
-- Name: academy_members academy_members_unique_role; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_members
    ADD CONSTRAINT academy_members_unique_role UNIQUE (academy_id, user_id, role);


--
-- TOC entry 4204 (class 2606 OID 17936)
-- Name: academy_qr_codes academy_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_qr_codes
    ADD CONSTRAINT academy_qr_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 4206 (class 2606 OID 17938)
-- Name: academy_qr_codes academy_qr_codes_public_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_qr_codes
    ADD CONSTRAINT academy_qr_codes_public_code_key UNIQUE (public_code);


--
-- TOC entry 4214 (class 2606 OID 17989)
-- Name: attendance_events attendance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4197 (class 2606 OID 17898)
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- TOC entry 4199 (class 2606 OID 17900)
-- Name: attendance_records attendance_unique_session_student; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_unique_session_student UNIQUE (session_id, student_id);


--
-- TOC entry 4209 (class 2606 OID 17959)
-- Name: attendance_visits attendance_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_visits
    ADD CONSTRAINT attendance_visits_pkey PRIMARY KEY (id);


--
-- TOC entry 4230 (class 2606 OID 18155)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4178 (class 2606 OID 17802)
-- Name: group_coaches group_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_coaches
    ADD CONSTRAINT group_coaches_pkey PRIMARY KEY (id);


--
-- TOC entry 4172 (class 2606 OID 17769)
-- Name: group_enrollments group_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_enrollments
    ADD CONSTRAINT group_enrollments_pkey PRIMARY KEY (id);


--
-- TOC entry 4219 (class 2606 OID 18041)
-- Name: parent_student_links parent_student_links_academy_id_parent_user_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_academy_id_parent_user_id_student_id_key UNIQUE (academy_id, parent_user_id, student_id);


--
-- TOC entry 4221 (class 2606 OID 18039)
-- Name: parent_student_links parent_student_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_pkey PRIMARY KEY (id);


--
-- TOC entry 4150 (class 2606 OID 17629)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4226 (class 2606 OID 18113)
-- Name: student_guardians student_guardians_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_pkey PRIMARY KEY (id);


--
-- TOC entry 4243 (class 2606 OID 18494)
-- Name: student_subscriptions student_subscriptions_academy_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_academy_id_unique UNIQUE (academy_id, id);


--
-- TOC entry 4245 (class 2606 OID 19361)
-- Name: student_subscriptions student_subscriptions_no_active_overlap; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_no_active_overlap EXCLUDE USING gist (academy_id WITH =, student_id WITH =, daterange(start_date, end_date, '[]'::text) WITH &&) WHERE ((status = 'active'::text));


--
-- TOC entry 4247 (class 2606 OID 18434)
-- Name: student_subscriptions student_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4162 (class 2606 OID 18128)
-- Name: students students_academy_id_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_academy_id_id_unique UNIQUE (academy_id, id);


--
-- TOC entry 4164 (class 2606 OID 17674)
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- TOC entry 4251 (class 2606 OID 18482)
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 4234 (class 2606 OID 18451)
-- Name: subscription_plans subscription_plans_academy_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_academy_id_unique UNIQUE (academy_id, id);


--
-- TOC entry 4236 (class 2606 OID 18411)
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 4238 (class 2606 OID 18413)
-- Name: subscription_plans subscription_plans_unique_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_unique_name UNIQUE (academy_id, name);


--
-- TOC entry 4168 (class 2606 OID 17725)
-- Name: training_groups training_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4170 (class 2606 OID 17727)
-- Name: training_groups training_groups_unique_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_unique_name UNIQUE (academy_id, name);


--
-- TOC entry 4186 (class 2606 OID 19176)
-- Name: training_schedules training_schedules_no_overlap; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_schedules
    ADD CONSTRAINT training_schedules_no_overlap EXCLUDE USING gist (academy_id WITH =, group_id WITH =, day_of_week WITH =, tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time), '[)'::text) WITH &&, daterange(valid_from, valid_until, '[]'::text) WITH &&) WHERE ((is_active = true));


--
-- TOC entry 4188 (class 2606 OID 17837)
-- Name: training_schedules training_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_schedules
    ADD CONSTRAINT training_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 4194 (class 2606 OID 17864)
-- Name: training_sessions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4227 (class 1259 OID 18161)
-- Name: audit_logs_academy_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_academy_created_idx ON public.audit_logs USING btree (academy_id, created_at DESC);


--
-- TOC entry 4228 (class 1259 OID 18163)
-- Name: audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (changed_by, created_at DESC);


--
-- TOC entry 4231 (class 1259 OID 18162)
-- Name: audit_logs_record_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_record_idx ON public.audit_logs USING btree (table_name, record_id, created_at DESC);


--
-- TOC entry 4155 (class 1259 OID 17789)
-- Name: idx_academy_members_id_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_academy_members_id_academy ON public.academy_members USING btree (id, academy_id);


--
-- TOC entry 4156 (class 1259 OID 17658)
-- Name: idx_academy_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_academy_members_user ON public.academy_members USING btree (user_id);


--
-- TOC entry 4207 (class 1259 OID 17970)
-- Name: idx_academy_qr_codes_id_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_academy_qr_codes_id_academy ON public.academy_qr_codes USING btree (id, academy_id);


--
-- TOC entry 4200 (class 1259 OID 17923)
-- Name: idx_attendance_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_academy ON public.attendance_records USING btree (academy_id);


--
-- TOC entry 4215 (class 1259 OID 18000)
-- Name: idx_attendance_events_visit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_events_visit ON public.attendance_events USING btree (visit_id, occurred_at);


--
-- TOC entry 4201 (class 1259 OID 17922)
-- Name: idx_attendance_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_session ON public.attendance_records USING btree (session_id);


--
-- TOC entry 4202 (class 1259 OID 17921)
-- Name: idx_attendance_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_student ON public.attendance_records USING btree (student_id, created_at DESC);


--
-- TOC entry 4210 (class 1259 OID 17976)
-- Name: idx_attendance_visits_one_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_attendance_visits_one_open ON public.attendance_visits USING btree (student_id) WHERE (status = 'checked_in'::text);


--
-- TOC entry 4211 (class 1259 OID 17978)
-- Name: idx_attendance_visits_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_visits_open ON public.attendance_visits USING btree (academy_id, checked_in_at) WHERE (status = 'checked_in'::text);


--
-- TOC entry 4212 (class 1259 OID 17977)
-- Name: idx_attendance_visits_student_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_visits_student_time ON public.attendance_visits USING btree (student_id, checked_in_at DESC);


--
-- TOC entry 4179 (class 1259 OID 17818)
-- Name: idx_group_coaches_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_group_coaches_active_unique ON public.group_coaches USING btree (group_id, member_id) WHERE (ended_at IS NULL);


--
-- TOC entry 4180 (class 1259 OID 17820)
-- Name: idx_group_coaches_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_coaches_member ON public.group_coaches USING btree (member_id);


--
-- TOC entry 4181 (class 1259 OID 17819)
-- Name: idx_group_coaches_one_head; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_group_coaches_one_head ON public.group_coaches USING btree (group_id) WHERE ((role = 'head'::text) AND (ended_at IS NULL));


--
-- TOC entry 4173 (class 1259 OID 17788)
-- Name: idx_group_enrollments_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_enrollments_academy ON public.group_enrollments USING btree (academy_id);


--
-- TOC entry 4174 (class 1259 OID 17785)
-- Name: idx_group_enrollments_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_group_enrollments_active_unique ON public.group_enrollments USING btree (group_id, student_id) WHERE (status = 'active'::text);


--
-- TOC entry 4175 (class 1259 OID 17786)
-- Name: idx_group_enrollments_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_enrollments_group ON public.group_enrollments USING btree (group_id);


--
-- TOC entry 4176 (class 1259 OID 17787)
-- Name: idx_group_enrollments_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_enrollments_student ON public.group_enrollments USING btree (student_id);


--
-- TOC entry 4216 (class 1259 OID 18057)
-- Name: idx_parent_student_links_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parent_student_links_parent ON public.parent_student_links USING btree (parent_user_id);


--
-- TOC entry 4217 (class 1259 OID 18058)
-- Name: idx_parent_student_links_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parent_student_links_student ON public.parent_student_links USING btree (student_id);


--
-- TOC entry 4222 (class 1259 OID 18125)
-- Name: idx_student_guardians_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_guardians_academy ON public.student_guardians USING btree (academy_id);


--
-- TOC entry 4223 (class 1259 OID 18126)
-- Name: idx_student_guardians_one_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_student_guardians_one_primary ON public.student_guardians USING btree (student_id) WHERE ((is_primary = true) AND (is_active = true));


--
-- TOC entry 4224 (class 1259 OID 18124)
-- Name: idx_student_guardians_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_guardians_student ON public.student_guardians USING btree (student_id);


--
-- TOC entry 4239 (class 1259 OID 18459)
-- Name: idx_student_subscriptions_end_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_subscriptions_end_date ON public.student_subscriptions USING btree (academy_id, end_date);


--
-- TOC entry 4240 (class 1259 OID 18458)
-- Name: idx_student_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_subscriptions_status ON public.student_subscriptions USING btree (academy_id, status);


--
-- TOC entry 4241 (class 1259 OID 18457)
-- Name: idx_student_subscriptions_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_subscriptions_student ON public.student_subscriptions USING btree (academy_id, student_id);


--
-- TOC entry 4157 (class 1259 OID 17686)
-- Name: idx_students_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_academy ON public.students USING btree (academy_id);


--
-- TOC entry 4158 (class 1259 OID 17685)
-- Name: idx_students_academy_user_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_students_academy_user_unique ON public.students USING btree (academy_id, user_id) WHERE (user_id IS NOT NULL);


--
-- TOC entry 4159 (class 1259 OID 17754)
-- Name: idx_students_id_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_students_id_academy ON public.students USING btree (id, academy_id);


--
-- TOC entry 4160 (class 1259 OID 17687)
-- Name: idx_students_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_status ON public.students USING btree (academy_id, status);


--
-- TOC entry 4248 (class 1259 OID 18501)
-- Name: idx_subscription_payments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_payments_date ON public.subscription_payments USING btree (academy_id, payment_date);


--
-- TOC entry 4249 (class 1259 OID 18500)
-- Name: idx_subscription_payments_subscription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_payments_subscription ON public.subscription_payments USING btree (academy_id, subscription_id);


--
-- TOC entry 4232 (class 1259 OID 18419)
-- Name: idx_subscription_plans_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_plans_academy ON public.subscription_plans USING btree (academy_id);


--
-- TOC entry 4165 (class 1259 OID 17733)
-- Name: idx_training_groups_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_groups_academy ON public.training_groups USING btree (academy_id);


--
-- TOC entry 4166 (class 1259 OID 17753)
-- Name: idx_training_groups_id_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_training_groups_id_academy ON public.training_groups USING btree (id, academy_id);


--
-- TOC entry 4182 (class 1259 OID 17849)
-- Name: idx_training_schedules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_schedules_active ON public.training_schedules USING btree (academy_id, day_of_week) WHERE (is_active = true);


--
-- TOC entry 4183 (class 1259 OID 17848)
-- Name: idx_training_schedules_group_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_schedules_group_day ON public.training_schedules USING btree (group_id, day_of_week);


--
-- TOC entry 4184 (class 1259 OID 17875)
-- Name: idx_training_schedules_id_academy_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_training_schedules_id_academy_group ON public.training_schedules USING btree (id, academy_id, group_id);


--
-- TOC entry 4189 (class 1259 OID 17881)
-- Name: idx_training_sessions_academy_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_sessions_academy_time ON public.training_sessions USING btree (academy_id, starts_at);


--
-- TOC entry 4190 (class 1259 OID 17882)
-- Name: idx_training_sessions_group_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_sessions_group_time ON public.training_sessions USING btree (group_id, starts_at);


--
-- TOC entry 4191 (class 1259 OID 17884)
-- Name: idx_training_sessions_id_academy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_training_sessions_id_academy ON public.training_sessions USING btree (id, academy_id);


--
-- TOC entry 4192 (class 1259 OID 17883)
-- Name: idx_training_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_sessions_status ON public.training_sessions USING btree (academy_id, status);


--
-- TOC entry 4195 (class 1259 OID 19181)
-- Name: uq_training_sessions_schedule_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_training_sessions_schedule_start ON public.training_sessions USING btree (schedule_id, starts_at) WHERE (schedule_id IS NOT NULL);


--
-- TOC entry 4294 (class 2620 OID 19269)
-- Name: academy_members audit_academy_members_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_academy_members_changes AFTER INSERT OR DELETE OR UPDATE ON public.academy_members FOR EACH ROW EXECUTE FUNCTION public.audit_str_training_changes();


--
-- TOC entry 4297 (class 2620 OID 19270)
-- Name: group_coaches audit_group_coaches_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_group_coaches_changes AFTER INSERT OR DELETE OR UPDATE ON public.group_coaches FOR EACH ROW EXECUTE FUNCTION public.audit_str_training_changes();


--
-- TOC entry 4298 (class 2620 OID 18523)
-- Name: training_schedules audit_training_schedules_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_training_schedules_changes AFTER INSERT OR DELETE OR UPDATE ON public.training_schedules FOR EACH ROW EXECUTE FUNCTION public.audit_str_training_changes();


--
-- TOC entry 4299 (class 2620 OID 18524)
-- Name: training_sessions audit_training_sessions_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_training_sessions_changes AFTER INSERT OR DELETE OR UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.audit_str_training_changes();


--
-- TOC entry 4300 (class 2620 OID 18166)
-- Name: student_guardians trg_audit_student_guardians; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_student_guardians AFTER INSERT OR DELETE OR UPDATE ON public.student_guardians FOR EACH ROW EXECUTE FUNCTION public.audit_student_guardians();


--
-- TOC entry 4302 (class 2620 OID 18462)
-- Name: student_subscriptions trg_audit_student_subscriptions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_student_subscriptions AFTER INSERT OR UPDATE ON public.student_subscriptions FOR EACH ROW EXECUTE FUNCTION public.audit_student_subscriptions();


--
-- TOC entry 4295 (class 2620 OID 18168)
-- Name: students trg_audit_students; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_students AFTER INSERT OR DELETE OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.audit_students();


--
-- TOC entry 4303 (class 2620 OID 18511)
-- Name: subscription_payments trg_audit_subscription_payments; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_subscription_payments AFTER INSERT OR UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_payments();


--
-- TOC entry 4301 (class 2620 OID 18468)
-- Name: subscription_plans trg_audit_subscription_plans; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_subscription_plans AFTER INSERT OR UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_plans();


--
-- TOC entry 4296 (class 2620 OID 18392)
-- Name: group_enrollments trg_group_enrollment_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_group_enrollment_audit AFTER INSERT OR DELETE OR UPDATE ON public.group_enrollments FOR EACH ROW EXECUTE FUNCTION public.log_group_enrollment_changes();


--
-- TOC entry 4253 (class 2606 OID 17648)
-- Name: academy_members academy_members_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_members
    ADD CONSTRAINT academy_members_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4254 (class 2606 OID 17653)
-- Name: academy_members academy_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_members
    ADD CONSTRAINT academy_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- TOC entry 4273 (class 2606 OID 17939)
-- Name: academy_qr_codes academy_qr_codes_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academy_qr_codes
    ADD CONSTRAINT academy_qr_codes_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4277 (class 2606 OID 17995)
-- Name: attendance_events attendance_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4278 (class 2606 OID 17990)
-- Name: attendance_events attendance_events_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.attendance_visits(id) ON DELETE RESTRICT;


--
-- TOC entry 4269 (class 2606 OID 17901)
-- Name: attendance_records attendance_records_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4270 (class 2606 OID 17906)
-- Name: attendance_records attendance_records_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4271 (class 2606 OID 17911)
-- Name: attendance_records attendance_session_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_session_fk FOREIGN KEY (session_id, academy_id) REFERENCES public.training_sessions(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4272 (class 2606 OID 17916)
-- Name: attendance_records attendance_student_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_student_fk FOREIGN KEY (student_id, academy_id) REFERENCES public.students(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4274 (class 2606 OID 17960)
-- Name: attendance_visits attendance_visits_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_visits
    ADD CONSTRAINT attendance_visits_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4275 (class 2606 OID 17971)
-- Name: attendance_visits attendance_visits_qr_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_visits
    ADD CONSTRAINT attendance_visits_qr_fk FOREIGN KEY (qr_code_id, academy_id) REFERENCES public.academy_qr_codes(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4276 (class 2606 OID 17965)
-- Name: attendance_visits attendance_visits_student_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_visits
    ADD CONSTRAINT attendance_visits_student_fk FOREIGN KEY (student_id, academy_id) REFERENCES public.students(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4285 (class 2606 OID 18156)
-- Name: audit_logs audit_logs_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id);


--
-- TOC entry 4258 (class 2606 OID 17775)
-- Name: group_enrollments enrollment_group_academy_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_enrollments
    ADD CONSTRAINT enrollment_group_academy_fk FOREIGN KEY (group_id, academy_id) REFERENCES public.training_groups(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4259 (class 2606 OID 17780)
-- Name: group_enrollments enrollment_student_academy_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_enrollments
    ADD CONSTRAINT enrollment_student_academy_fk FOREIGN KEY (student_id, academy_id) REFERENCES public.students(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4261 (class 2606 OID 17803)
-- Name: group_coaches group_coaches_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_coaches
    ADD CONSTRAINT group_coaches_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4262 (class 2606 OID 17808)
-- Name: group_coaches group_coaches_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_coaches
    ADD CONSTRAINT group_coaches_group_fk FOREIGN KEY (group_id, academy_id) REFERENCES public.training_groups(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4263 (class 2606 OID 17813)
-- Name: group_coaches group_coaches_member_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_coaches
    ADD CONSTRAINT group_coaches_member_fk FOREIGN KEY (member_id, academy_id) REFERENCES public.academy_members(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4260 (class 2606 OID 17770)
-- Name: group_enrollments group_enrollments_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_enrollments
    ADD CONSTRAINT group_enrollments_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4279 (class 2606 OID 18042)
-- Name: parent_student_links parent_student_links_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id);


--
-- TOC entry 4280 (class 2606 OID 18047)
-- Name: parent_student_links parent_student_links_parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.profiles(id);


--
-- TOC entry 4281 (class 2606 OID 18052)
-- Name: parent_student_links parent_student_links_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_student_links
    ADD CONSTRAINT parent_student_links_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4252 (class 2606 OID 17630)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4282 (class 2606 OID 18114)
-- Name: student_guardians student_guardians_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id);


--
-- TOC entry 4283 (class 2606 OID 18129)
-- Name: student_guardians student_guardians_academy_student_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_academy_student_fk FOREIGN KEY (academy_id, student_id) REFERENCES public.students(academy_id, id) ON DELETE RESTRICT;


--
-- TOC entry 4284 (class 2606 OID 18119)
-- Name: student_guardians student_guardians_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- TOC entry 4287 (class 2606 OID 18435)
-- Name: student_subscriptions student_subscriptions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- TOC entry 4288 (class 2606 OID 18452)
-- Name: student_subscriptions student_subscriptions_plan_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_plan_fk FOREIGN KEY (academy_id, plan_id) REFERENCES public.subscription_plans(academy_id, id) ON DELETE RESTRICT;


--
-- TOC entry 4289 (class 2606 OID 18445)
-- Name: student_subscriptions student_subscriptions_student_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_student_fk FOREIGN KEY (academy_id, student_id) REFERENCES public.students(academy_id, id) ON DELETE RESTRICT;


--
-- TOC entry 4290 (class 2606 OID 18440)
-- Name: student_subscriptions student_subscriptions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- TOC entry 4255 (class 2606 OID 17675)
-- Name: students students_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4256 (class 2606 OID 17680)
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4291 (class 2606 OID 18488)
-- Name: subscription_payments subscription_payments_academy_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_academy_fk FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4292 (class 2606 OID 18483)
-- Name: subscription_payments subscription_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- TOC entry 4293 (class 2606 OID 18495)
-- Name: subscription_payments subscription_payments_subscription_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_subscription_fk FOREIGN KEY (academy_id, subscription_id) REFERENCES public.student_subscriptions(academy_id, id) ON DELETE RESTRICT;


--
-- TOC entry 4286 (class 2606 OID 18414)
-- Name: subscription_plans subscription_plans_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id);


--
-- TOC entry 4257 (class 2606 OID 17728)
-- Name: training_groups training_groups_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4264 (class 2606 OID 17838)
-- Name: training_schedules training_schedules_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_schedules
    ADD CONSTRAINT training_schedules_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4265 (class 2606 OID 17843)
-- Name: training_schedules training_schedules_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_schedules
    ADD CONSTRAINT training_schedules_group_fk FOREIGN KEY (group_id, academy_id) REFERENCES public.training_groups(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4266 (class 2606 OID 17865)
-- Name: training_sessions training_sessions_academy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE RESTRICT;


--
-- TOC entry 4267 (class 2606 OID 17870)
-- Name: training_sessions training_sessions_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_group_fk FOREIGN KEY (group_id, academy_id) REFERENCES public.training_groups(id, academy_id) ON DELETE RESTRICT;


--
-- TOC entry 4268 (class 2606 OID 17876)
-- Name: training_sessions training_sessions_schedule_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_schedule_fk FOREIGN KEY (schedule_id, academy_id, group_id) REFERENCES public.training_schedules(id, academy_id, group_id) ON DELETE RESTRICT;


--
-- TOC entry 4453 (class 0 OID 17606)
-- Dependencies: 317
-- Name: academies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4455 (class 0 OID 17635)
-- Dependencies: 319
-- Name: academy_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.academy_members ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4463 (class 0 OID 17924)
-- Dependencies: 327
-- Name: academy_qr_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.academy_qr_codes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4465 (class 0 OID 17979)
-- Dependencies: 329
-- Name: attendance_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4462 (class 0 OID 17885)
-- Dependencies: 326
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4464 (class 0 OID 17944)
-- Dependencies: 328
-- Name: attendance_visits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_visits ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4468 (class 0 OID 18144)
-- Dependencies: 332
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4459 (class 0 OID 17790)
-- Dependencies: 323
-- Name: group_coaches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.group_coaches ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4458 (class 0 OID 17755)
-- Dependencies: 322
-- Name: group_enrollments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.group_enrollments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4466 (class 0 OID 18028)
-- Dependencies: 330
-- Name: parent_student_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4454 (class 0 OID 17621)
-- Dependencies: 318
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4489 (class 3256 OID 18186)
-- Name: group_coaches str_admin_delete_group_coaches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_delete_group_coaches ON public.group_coaches FOR DELETE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4485 (class 3256 OID 18182)
-- Name: group_enrollments str_admin_delete_group_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_delete_group_enrollments ON public.group_enrollments FOR DELETE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4481 (class 3256 OID 18178)
-- Name: training_groups str_admin_delete_training_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_delete_training_groups ON public.training_groups FOR DELETE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4499 (class 3256 OID 18517)
-- Name: training_schedules str_admin_delete_training_schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_delete_training_schedules ON public.training_schedules FOR DELETE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4503 (class 3256 OID 18521)
-- Name: training_sessions str_admin_delete_training_sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_delete_training_sessions ON public.training_sessions FOR DELETE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4487 (class 3256 OID 18184)
-- Name: group_coaches str_admin_insert_group_coaches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_insert_group_coaches ON public.group_coaches FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4483 (class 3256 OID 18180)
-- Name: group_enrollments str_admin_insert_group_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_insert_group_enrollments ON public.group_enrollments FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4479 (class 3256 OID 18176)
-- Name: training_groups str_admin_insert_training_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_insert_training_groups ON public.training_groups FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4497 (class 3256 OID 18515)
-- Name: training_schedules str_admin_insert_training_schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_insert_training_schedules ON public.training_schedules FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4501 (class 3256 OID 18519)
-- Name: training_sessions str_admin_insert_training_sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_insert_training_sessions ON public.training_sessions FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4486 (class 3256 OID 18183)
-- Name: group_coaches str_admin_select_group_coaches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_select_group_coaches ON public.group_coaches FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4482 (class 3256 OID 18179)
-- Name: group_enrollments str_admin_select_group_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_select_group_enrollments ON public.group_enrollments FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4478 (class 3256 OID 18175)
-- Name: training_groups str_admin_select_training_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_select_training_groups ON public.training_groups FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4496 (class 3256 OID 18514)
-- Name: training_schedules str_admin_select_training_schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_select_training_schedules ON public.training_schedules FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4500 (class 3256 OID 18518)
-- Name: training_sessions str_admin_select_training_sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_select_training_sessions ON public.training_sessions FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4488 (class 3256 OID 18185)
-- Name: group_coaches str_admin_update_group_coaches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_update_group_coaches ON public.group_coaches FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4484 (class 3256 OID 18181)
-- Name: group_enrollments str_admin_update_group_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_update_group_enrollments ON public.group_enrollments FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4480 (class 3256 OID 18177)
-- Name: training_groups str_admin_update_training_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_update_training_groups ON public.training_groups FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4498 (class 3256 OID 18516)
-- Name: training_schedules str_admin_update_training_schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_update_training_schedules ON public.training_schedules FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4502 (class 3256 OID 18520)
-- Name: training_sessions str_admin_update_training_sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_admin_update_training_sessions ON public.training_sessions FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4504 (class 3256 OID 19248)
-- Name: training_groups str_coach_select_training_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_coach_select_training_groups ON public.training_groups FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.get_my_str_schedule_access() access(academy_id, member_role, can_view_schedule, can_edit_schedule, can_manage_all_sessions, head_group_ids, assistant_group_ids)
  WHERE ((access.academy_id = training_groups.academy_id) AND (access.can_view_schedule = true) AND ((training_groups.id = ANY (access.head_group_ids)) OR (training_groups.id = ANY (access.assistant_group_ids)))))));


--
-- TOC entry 4505 (class 3256 OID 19249)
-- Name: training_schedules str_coach_select_training_schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_coach_select_training_schedules ON public.training_schedules FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.get_my_str_schedule_access() access(academy_id, member_role, can_view_schedule, can_edit_schedule, can_manage_all_sessions, head_group_ids, assistant_group_ids)
  WHERE ((access.academy_id = training_schedules.academy_id) AND (access.can_view_schedule = true) AND ((training_schedules.group_id = ANY (access.head_group_ids)) OR (training_schedules.group_id = ANY (access.assistant_group_ids)))))));


--
-- TOC entry 4506 (class 3256 OID 19250)
-- Name: training_sessions str_coach_select_training_sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_coach_select_training_sessions ON public.training_sessions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.get_my_str_schedule_access() access(academy_id, member_role, can_view_schedule, can_edit_schedule, can_manage_all_sessions, head_group_ids, assistant_group_ids)
  WHERE ((access.academy_id = training_sessions.academy_id) AND (access.can_view_schedule = true) AND ((training_sessions.group_id = ANY (access.head_group_ids)) OR (training_sessions.group_id = ANY (access.assistant_group_ids)))))));


--
-- TOC entry 4495 (class 3256 OID 18502)
-- Name: subscription_payments str_staff_read_subscription_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_staff_read_subscription_payments ON public.subscription_payments FOR SELECT TO authenticated USING (((academy_id = public.get_my_str_admin_academy_id()) AND (public.get_my_str_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))));


--
-- TOC entry 4492 (class 3256 OID 18464)
-- Name: subscription_plans str_staff_read_subscription_plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_staff_read_subscription_plans ON public.subscription_plans FOR SELECT TO authenticated USING (((academy_id = public.get_my_str_admin_academy_id()) AND (public.get_my_str_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))));


--
-- TOC entry 4476 (class 3256 OID 18135)
-- Name: student_guardians str_super_admin_insert_guardians; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_insert_guardians ON public.student_guardians FOR INSERT TO authenticated WITH CHECK (((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)) AND (( SELECT public.get_my_str_role() AS get_my_str_role) = 'super_admin'::text)));


--
-- TOC entry 4473 (class 3256 OID 18096)
-- Name: students str_super_admin_insert_students; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_insert_students ON public.students FOR INSERT TO authenticated WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4493 (class 3256 OID 18465)
-- Name: subscription_plans str_super_admin_insert_subscription_plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_insert_subscription_plans ON public.subscription_plans FOR INSERT TO authenticated WITH CHECK (((academy_id = public.get_my_str_admin_academy_id()) AND (public.get_my_str_role() = 'super_admin'::text)));


--
-- TOC entry 4477 (class 3256 OID 18164)
-- Name: audit_logs str_super_admin_read_audit_logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_read_audit_logs ON public.audit_logs FOR SELECT TO authenticated USING (((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)) AND (( SELECT public.get_my_str_role() AS get_my_str_role) = 'super_admin'::text)));


--
-- TOC entry 4475 (class 3256 OID 18134)
-- Name: student_guardians str_super_admin_read_guardians; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_read_guardians ON public.student_guardians FOR SELECT TO authenticated USING (((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)) AND (( SELECT public.get_my_str_role() AS get_my_str_role) = 'super_admin'::text)));


--
-- TOC entry 4491 (class 3256 OID 18395)
-- Name: profiles str_super_admin_read_profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_read_profiles ON public.profiles FOR SELECT TO authenticated USING (public.can_my_str_admin_read_profile(id));


--
-- TOC entry 4490 (class 3256 OID 18460)
-- Name: student_subscriptions str_super_admin_read_student_subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_read_student_subscriptions ON public.student_subscriptions FOR SELECT TO authenticated USING ((academy_id = public.get_my_str_admin_academy_id()));


--
-- TOC entry 4472 (class 3256 OID 18095)
-- Name: students str_super_admin_read_students; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_read_students ON public.students FOR SELECT TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4474 (class 3256 OID 18097)
-- Name: students str_super_admin_update_students; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_update_students ON public.students FOR UPDATE TO authenticated USING ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id))) WITH CHECK ((academy_id = ( SELECT public.get_my_str_admin_academy_id() AS get_my_str_admin_academy_id)));


--
-- TOC entry 4494 (class 3256 OID 18466)
-- Name: subscription_plans str_super_admin_update_subscription_plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY str_super_admin_update_subscription_plans ON public.subscription_plans FOR UPDATE TO authenticated USING (((academy_id = public.get_my_str_admin_academy_id()) AND (public.get_my_str_role() = 'super_admin'::text))) WITH CHECK (((academy_id = public.get_my_str_admin_academy_id()) AND (public.get_my_str_role() = 'super_admin'::text)));


--
-- TOC entry 4467 (class 0 OID 18098)
-- Dependencies: 331
-- Name: student_guardians; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4470 (class 0 OID 18421)
-- Dependencies: 336
-- Name: student_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4456 (class 0 OID 17659)
-- Dependencies: 320
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4471 (class 0 OID 18469)
-- Dependencies: 337
-- Name: subscription_payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4469 (class 0 OID 18396)
-- Dependencies: 335
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4457 (class 0 OID 17708)
-- Dependencies: 321
-- Name: training_groups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4460 (class 0 OID 17821)
-- Dependencies: 324
-- Name: training_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.training_schedules ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4461 (class 0 OID 17850)
-- Dependencies: 325
-- Name: training_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4514 (class 0 OID 0)
-- Dependencies: 13
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4515 (class 0 OID 0)
-- Dependencies: 646
-- Name: FUNCTION admin_assign_str_user_role(p_user_id uuid, p_role text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_assign_str_user_role(p_user_id uuid, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_assign_str_user_role(p_user_id uuid, p_role text) TO authenticated;


--
-- TOC entry 4516 (class 0 OID 0)
-- Dependencies: 394
-- Name: FUNCTION admin_get_str_user_memberships(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_get_str_user_memberships() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_get_str_user_memberships() TO authenticated;


--
-- TOC entry 4517 (class 0 OID 0)
-- Dependencies: 551
-- Name: FUNCTION admin_get_str_users(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_get_str_users() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_get_str_users() TO authenticated;


--
-- TOC entry 4518 (class 0 OID 0)
-- Dependencies: 369
-- Name: FUNCTION admin_set_str_user_role_status(p_member_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_set_str_user_role_status(p_member_id uuid, p_is_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_str_user_role_status(p_member_id uuid, p_is_active boolean) TO authenticated;


--
-- TOC entry 4519 (class 0 OID 0)
-- Dependencies: 619
-- Name: FUNCTION assign_student_subscription(p_student_id uuid, p_plan_id uuid, p_start_date date, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.assign_student_subscription(p_student_id uuid, p_plan_id uuid, p_start_date date, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_student_subscription(p_student_id uuid, p_plan_id uuid, p_start_date date, p_notes text) TO authenticated;


--
-- TOC entry 4520 (class 0 OID 0)
-- Dependencies: 494
-- Name: FUNCTION audit_student_guardians(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_student_guardians() FROM PUBLIC;


--
-- TOC entry 4521 (class 0 OID 0)
-- Dependencies: 553
-- Name: FUNCTION audit_student_subscriptions(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_student_subscriptions() FROM PUBLIC;


--
-- TOC entry 4522 (class 0 OID 0)
-- Dependencies: 525
-- Name: FUNCTION audit_students(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_students() FROM PUBLIC;


--
-- TOC entry 4523 (class 0 OID 0)
-- Dependencies: 663
-- Name: FUNCTION audit_subscription_payments(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_subscription_payments() FROM PUBLIC;


--
-- TOC entry 4524 (class 0 OID 0)
-- Dependencies: 419
-- Name: FUNCTION audit_subscription_plans(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_subscription_plans() FROM PUBLIC;


--
-- TOC entry 4525 (class 0 OID 0)
-- Dependencies: 426
-- Name: FUNCTION can_my_str_admin_read_profile(p_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.can_my_str_admin_read_profile(p_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_my_str_admin_read_profile(p_profile_id uuid) TO authenticated;


--
-- TOC entry 4526 (class 0 OID 0)
-- Dependencies: 631
-- Name: FUNCTION change_str_training_session_status(p_session_id uuid, p_new_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.change_str_training_session_status(p_session_id uuid, p_new_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_str_training_session_status(p_session_id uuid, p_new_status text) TO authenticated;


--
-- TOC entry 4527 (class 0 OID 0)
-- Dependencies: 432
-- Name: FUNCTION create_student_guardian(p_student_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_student_guardian(p_student_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_student_guardian(p_student_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) TO authenticated;


--
-- TOC entry 4528 (class 0 OID 0)
-- Dependencies: 464
-- Name: FUNCTION enroll_student_in_training_group(p_group_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.enroll_student_in_training_group(p_group_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enroll_student_in_training_group(p_group_id uuid, p_student_id uuid) TO authenticated;


--
-- TOC entry 4529 (class 0 OID 0)
-- Dependencies: 427
-- Name: FUNCTION generate_str_training_sessions(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.generate_str_training_sessions(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_str_training_sessions(p_days integer) TO authenticated;


--
-- TOC entry 4530 (class 0 OID 0)
-- Dependencies: 571
-- Name: FUNCTION generate_str_training_sessions_system(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.generate_str_training_sessions_system(p_days integer) FROM PUBLIC;


--
-- TOC entry 4531 (class 0 OID 0)
-- Dependencies: 490
-- Name: FUNCTION get_my_str_account_status(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_my_str_account_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_str_account_status() TO authenticated;


--
-- TOC entry 4532 (class 0 OID 0)
-- Dependencies: 558
-- Name: FUNCTION get_my_str_admin_academy_id(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_my_str_admin_academy_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_str_admin_academy_id() TO authenticated;


--
-- TOC entry 4533 (class 0 OID 0)
-- Dependencies: 413
-- Name: FUNCTION get_my_str_role(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_my_str_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_str_role() TO authenticated;


--
-- TOC entry 4534 (class 0 OID 0)
-- Dependencies: 677
-- Name: FUNCTION get_my_str_schedule_access(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_my_str_schedule_access() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_str_schedule_access() TO authenticated;


--
-- TOC entry 4535 (class 0 OID 0)
-- Dependencies: 602
-- Name: FUNCTION get_str_financial_summary(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_str_financial_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_str_financial_summary() TO authenticated;


--
-- TOC entry 4536 (class 0 OID 0)
-- Dependencies: 377
-- Name: FUNCTION handle_new_user_profile(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;


--
-- TOC entry 4537 (class 0 OID 0)
-- Dependencies: 659
-- Name: FUNCTION is_my_str_email_confirmed(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_my_str_email_confirmed() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_my_str_email_confirmed() TO authenticated;


--
-- TOC entry 4538 (class 0 OID 0)
-- Dependencies: 633
-- Name: FUNCTION log_group_enrollment_changes(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.log_group_enrollment_changes() FROM PUBLIC;


--
-- TOC entry 4539 (class 0 OID 0)
-- Dependencies: 548
-- Name: FUNCTION record_subscription_payment(p_subscription_id uuid, p_amount numeric, p_payment_method text, p_payment_date date, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.record_subscription_payment(p_subscription_id uuid, p_amount numeric, p_payment_method text, p_payment_date date, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_subscription_payment(p_subscription_id uuid, p_amount numeric, p_payment_method text, p_payment_date date, p_notes text) TO authenticated;


--
-- TOC entry 4540 (class 0 OID 0)
-- Dependencies: 604
-- Name: FUNCTION remove_student_from_training_group(p_enrollment_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid) TO authenticated;


--
-- TOC entry 4541 (class 0 OID 0)
-- Dependencies: 524
-- Name: FUNCTION remove_student_from_training_group(p_enrollment_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_student_from_training_group(p_enrollment_id uuid, p_reason text) TO authenticated;


--
-- TOC entry 4542 (class 0 OID 0)
-- Dependencies: 641
-- Name: FUNCTION sync_str_training_session_statuses(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.sync_str_training_session_statuses() FROM PUBLIC;


--
-- TOC entry 4543 (class 0 OID 0)
-- Dependencies: 431
-- Name: FUNCTION update_str_student(p_student_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_belt text, p_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.update_str_student(p_student_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_belt text, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_str_student(p_student_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_belt text, p_status text) TO authenticated;


--
-- TOC entry 4544 (class 0 OID 0)
-- Dependencies: 668
-- Name: FUNCTION update_student_guardian(p_student_id uuid, p_guardian_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.update_student_guardian(p_student_id uuid, p_guardian_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_student_guardian(p_student_id uuid, p_guardian_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_relationship text) TO authenticated;


--
-- TOC entry 4545 (class 0 OID 0)
-- Dependencies: 676
-- Name: FUNCTION void_subscription_payment(p_payment_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.void_subscription_payment(p_payment_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.void_subscription_payment(p_payment_id uuid, p_reason text) TO authenticated;


--
-- TOC entry 4546 (class 0 OID 0)
-- Dependencies: 317
-- Name: TABLE academies; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.academies TO service_role;


--
-- TOC entry 4547 (class 0 OID 0)
-- Dependencies: 319
-- Name: TABLE academy_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.academy_members TO service_role;


--
-- TOC entry 4548 (class 0 OID 0)
-- Dependencies: 327
-- Name: TABLE academy_qr_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.academy_qr_codes TO service_role;


--
-- TOC entry 4549 (class 0 OID 0)
-- Dependencies: 329
-- Name: TABLE attendance_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.attendance_events TO service_role;


--
-- TOC entry 4550 (class 0 OID 0)
-- Dependencies: 326
-- Name: TABLE attendance_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.attendance_records TO service_role;


--
-- TOC entry 4551 (class 0 OID 0)
-- Dependencies: 328
-- Name: TABLE attendance_visits; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.attendance_visits TO service_role;


--
-- TOC entry 4553 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE public.audit_logs TO service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;


--
-- TOC entry 4554 (class 0 OID 0)
-- Dependencies: 323
-- Name: TABLE group_coaches; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_coaches TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.group_coaches TO authenticated;


--
-- TOC entry 4555 (class 0 OID 0)
-- Dependencies: 322
-- Name: TABLE group_enrollments; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_enrollments TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.group_enrollments TO authenticated;


--
-- TOC entry 4556 (class 0 OID 0)
-- Dependencies: 330
-- Name: TABLE parent_student_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.parent_student_links TO service_role;


--
-- TOC entry 4557 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.profiles TO authenticated;


--
-- TOC entry 4558 (class 0 OID 0)
-- Dependencies: 331
-- Name: TABLE student_guardians; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_guardians TO service_role;
GRANT SELECT,INSERT ON TABLE public.student_guardians TO authenticated;


--
-- TOC entry 4559 (class 0 OID 0)
-- Dependencies: 336
-- Name: TABLE student_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT MAINTAIN ON TABLE public.student_subscriptions TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.student_subscriptions TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_subscriptions TO service_role;


--
-- TOC entry 4560 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE students; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.students TO service_role;
GRANT SELECT,INSERT ON TABLE public.students TO authenticated;


--
-- TOC entry 4561 (class 0 OID 0)
-- Dependencies: 337
-- Name: TABLE subscription_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_payments TO service_role;
GRANT SELECT ON TABLE public.subscription_payments TO authenticated;


--
-- TOC entry 4562 (class 0 OID 0)
-- Dependencies: 338
-- Name: TABLE subscription_balances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_balances TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_balances TO service_role;


--
-- TOC entry 4563 (class 0 OID 0)
-- Dependencies: 335
-- Name: TABLE subscription_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT MAINTAIN ON TABLE public.subscription_plans TO anon;
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE public.subscription_plans TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_plans TO service_role;


--
-- TOC entry 4564 (class 0 OID 0)
-- Dependencies: 321
-- Name: TABLE training_groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.training_groups TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.training_groups TO authenticated;


--
-- TOC entry 4565 (class 0 OID 0)
-- Dependencies: 324
-- Name: TABLE training_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.training_schedules TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.training_schedules TO authenticated;


--
-- TOC entry 4566 (class 0 OID 0)
-- Dependencies: 325
-- Name: TABLE training_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.training_sessions TO service_role;
GRANT SELECT ON TABLE public.training_sessions TO authenticated;


--
-- TOC entry 2783 (class 826 OID 16490)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- TOC entry 2761 (class 826 OID 16491)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2784 (class 826 OID 16489)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- TOC entry 2763 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2782 (class 826 OID 16488)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- TOC entry 2762 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-11-26 02:51:28

--
-- PostgreSQL database dump complete
--

\unrestrict AOUx8sbIN7W4qT9aTzZGPKQcZ81g92pxdxAPYKNaDbpcaIBkM8a2D7sbaqdM4BO

