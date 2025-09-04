-- Function to manually create internal access request (for admin use)
CREATE OR REPLACE FUNCTION create_internal_access_request_manual(
  p_user_id UUID,
  p_equipe_id UUID,
  p_desired_role TEXT DEFAULT 'member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id UUID;
BEGIN
  INSERT INTO internal_access_requests (user_id, equipe_id, desired_role, status)
  VALUES (p_user_id, p_equipe_id, p_desired_role, 'pending')
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$;