-- Fix RLS Policy for training_sessions
-- Run this in your Supabase SQL Editor

-- 1. Ensure RLS is enabled (if not already)
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Create permissive policy for development
-- check if policy exists first to avoid error, or just drop and recreate
DROP POLICY IF EXISTS "Enable all access for all users" ON training_sessions;

CREATE POLICY "Enable all access for all users" 
ON training_sessions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Grant permissions to anonymous and authenticated users
GRANT ALL ON training_sessions TO anon, authenticated;
