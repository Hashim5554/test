-- Fix user creation to include all required fields
CREATE OR REPLACE FUNCTION public.create_new_user(
  email TEXT,
  password TEXT,
  role TEXT DEFAULT 'student',
  username TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
  user_username TEXT := username;
  effective_role TEXT := role;
  new_user_id UUID := gen_random_uuid();
  user_instance_id UUID;
  password_hash TEXT;
BEGIN
  -- Generate username if not provided
  IF user_username IS NULL THEN
    user_username := split_part(email, '@', 1);
  END IF;

  -- Get the instance_id from an existing user to ensure consistency
  SELECT u.instance_id INTO user_instance_id FROM auth.users u LIMIT 1;
  
  -- If no instance_id found, use a default
  IF user_instance_id IS NULL THEN
    user_instance_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  -- Generate the password hash using bcrypt
  password_hash := crypt(password, gen_salt('bf', 10));

  -- Insert user into auth.users with all required fields
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_confirm_status,
    invited_at,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change,
    email_change_sent_at,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_super_admin,
    role,
    aud
  ) VALUES (
    new_user_id,
    user_instance_id,
    email,
    password_hash,
    now(), -- email_confirmed_at
    NULL, -- confirmation_sent_at
    NULL, -- recovery_sent_at
    0, -- email_change_confirm_status
    NULL, -- invited_at
    '', -- confirmation_token
    '', -- recovery_token
    '', -- email_change_token_current
    '', -- email_change_token_new
    now(), -- last_sign_in_at
    jsonb_build_object('provider', 'email', 'providers', array['email']), -- raw_app_meta_data
    jsonb_build_object('role', effective_role), -- raw_user_meta_data
    now(), -- created_at
    now(), -- updated_at
    NULL, -- phone
    NULL, -- phone_confirmed_at
    NULL, -- phone_change
    '', -- phone_change_token
    NULL, -- phone_change_sent_at
    NULL, -- email_change
    NULL, -- email_change_sent_at
    NULL, -- banned_until
    '', -- reauthentication_token
    NULL, -- reauthentication_sent_at
    FALSE, -- is_super_admin
    'authenticated', -- role
    'authenticated' -- aud
  );

  -- Create profile with all required fields
  INSERT INTO public.profiles (
    id,
    email,
    username,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    email,
    user_username,
    effective_role,
    now(),
    now()
  );

  -- Refresh schema cache after user creation
  PERFORM public.refresh_schema_cache();

  RETURN jsonb_build_object(
    'id', new_user_id,
    'email', email,
    'username', user_username,
    'role', effective_role
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'details', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to this function
GRANT EXECUTE ON FUNCTION public.create_new_user(TEXT, TEXT, TEXT, TEXT) TO authenticated; 