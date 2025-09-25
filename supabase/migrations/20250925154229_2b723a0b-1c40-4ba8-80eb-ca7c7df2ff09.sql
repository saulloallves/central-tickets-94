-- Update client token for all Z-API providers
UPDATE messaging_providers 
SET client_token = 'Fda2b6e640f784d0d9d590470cc678390S'
WHERE provider_name LIKE '%zapi%';