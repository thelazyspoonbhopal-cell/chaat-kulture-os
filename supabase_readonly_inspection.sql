-- ==============================================================================
-- CHAAT KULTURE OS — LIVE SUPABASE READ-ONLY INSPECTION SCRIPT
-- ==============================================================================
-- SAFETY NOTICE:
-- This script contains ONLY SELECT statements.
-- It does NOT insert, update, delete, alter, drop, or modify anything in your database.
-- It runs safely in the Supabase SQL Editor and returns a single JSON result.
-- ==============================================================================

WITH 
-- 1. Tables and RLS status
tables_info AS (
    SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
        c.reltuples::bigint AS estimated_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
),

-- 2. Columns details
columns_info AS (
    SELECT 
        table_name,
        column_name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
),

-- 3. Primary keys and Unique constraints
constraints_info AS (
    SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
),

-- 4. Indexes
indexes_info AS (
    SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
),

-- 5. Row Level Security Policies
policies_info AS (
    SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual AS using_expression,
        with_check AS with_check_expression
    FROM pg_policies
    WHERE schemaname = 'public'
),

-- 6. Custom ENUM types
enums_info AS (
    SELECT 
        t.typname AS enum_name,
        e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
),

-- 7. Functions and Triggers
functions_info AS (
    SELECT 
        routine_name,
        routine_type,
        data_type AS return_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
)

-- Combined JSON Output
SELECT json_build_object(
    'inspection_timestamp', NOW(),
    'database_version', version(),
    'tables_count', (SELECT COUNT(*) FROM tables_info),
    'tables', (
        SELECT json_agg(
            json_build_object(
                'table_name', t.table_name,
                'rls_enabled', t.rls_enabled,
                'rls_forced', t.rls_forced,
                'total_size', t.total_size,
                'estimated_rows', t.estimated_rows,
                'columns', (
                    SELECT json_agg(
                        json_build_object(
                            'name', c.column_name,
                            'type', c.data_type,
                            'udt', c.udt_name,
                            'nullable', c.is_nullable,
                            'default', c.column_default
                        ) ORDER BY c.ordinal_position
                    )
                    FROM columns_info c 
                    WHERE c.table_name = t.table_name
                ),
                'constraints', (
                    SELECT json_agg(
                        json_build_object(
                            'name', cn.constraint_name,
                            'type', cn.constraint_type,
                            'column', cn.column_name,
                            'foreign_table', cn.foreign_table_name,
                            'foreign_column', cn.foreign_column_name
                        )
                    )
                    FROM constraints_info cn 
                    WHERE cn.table_name = t.table_name
                ),
                'policies', (
                    SELECT json_agg(
                        json_build_object(
                            'name', p.policyname,
                            'cmd', p.cmd,
                            'roles', p.roles,
                            'using', p.using_expression
                        )
                    )
                    FROM policies_info p 
                    WHERE p.tablename = t.table_name
                )
            )
        )
        FROM tables_info t
    ),
    'custom_enums', (
        SELECT json_agg(
            json_build_object(
                'enum_name', enum_name,
                'enum_value', enum_value
            )
        )
        FROM enums_info
    ),
    'triggers_and_functions', (
        SELECT json_agg(
            json_build_object(
                'name', routine_name,
                'type', routine_type,
                'return_type', return_type
            )
        )
        FROM functions_info
    )
) AS live_supabase_inspection;
