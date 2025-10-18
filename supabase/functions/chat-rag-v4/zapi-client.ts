import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

export class ZAPIClient {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    // Default to env vars, will be overridden by loadConfig()
    this.instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || '';
    this.token = Deno.env.get('ZAPI_TOKEN') || '';
    this.clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    this.baseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';
  }

  async loadConfig(): Promise<void> {
    try {
      console.log('🔍 Loading Z-API config from database for zapi_whatsapp...');
      
      // Try to load zapi_whatsapp first, then fallback to 'zapi'
      let { data, error } = await this.supabase
        .from('messaging_providers')
        .select('*')
        .eq('provider_name', 'zapi_whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      // If no zapi_whatsapp found, try 'zapi' (legacy)
      if (!data) {
        console.log('⚠️ No zapi_whatsapp config found, trying legacy "zapi" config...');
        const fallbackResult = await this.supabase
          .from('messaging_providers')
          .select('*')
          .eq('provider_name', 'zapi')
          .eq('is_active', true)
          .maybeSingle();
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('❌ Error querying database for Z-API config:', error);
      }

      console.log('📊 Database query result:', data ? 'Found config' : 'No config found');

      if (data) {
        console.log('✅ Loading Z-API config from database');
        console.log('📋 Database config:', {
          provider_name: data.provider_name,
          instance_id: data.instance_id?.substring(0, 8) + '...',
          has_token: !!data.instance_token,
          has_client_token: !!data.client_token,
          base_url: data.base_url
        });
        
        this.instanceId = data.instance_id || this.instanceId;
        this.token = data.instance_token || this.token;
        this.clientToken = data.client_token || this.clientToken;
        this.baseUrl = data.base_url || this.baseUrl;
        
        console.log('🔧 Final config loaded:', {
          instance_id: this.instanceId?.substring(0, 8) + '...',
          has_token: !!this.token,
          has_client_token: !!this.clientToken,
          base_url: this.baseUrl
        });
      } else {
        console.log('⚠️ No database config found, using environment variables');
        console.log('🌍 Environment config:', {
          instance_id: this.instanceId?.substring(0, 8) + '...',
          has_token: !!this.token,
          has_client_token: !!this.clientToken,
          base_url: this.baseUrl
        });
      }
    } catch (error) {
      console.error('❌ Error loading Z-API config from database:', error);
      console.log('🔄 Falling back to environment variables');
    }
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('Z-API credentials not configured - missing:', {
        instanceId: !!this.instanceId,
        token: !!this.token,
        clientToken: !!this.clientToken
      });
      return false;
    }

    if (!message || message.trim() === '') {
      console.error('Cannot send empty message');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: phone,
          message: message, // Send message exactly as received, without trim()
        }),
      });

      if (!response.ok) {
        console.error('Failed to send Z-API message:', await response.text());
        return false;
      }

      console.log('Message sent successfully via Z-API');
      return true;
    } catch (error) {
      console.error('Error sending Z-API message:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}
