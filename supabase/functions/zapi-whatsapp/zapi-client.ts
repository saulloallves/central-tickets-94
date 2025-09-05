export class ZAPIClient {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;

  constructor() {
    this.instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || '';
    this.token = Deno.env.get('ZAPI_TOKEN') || '';
    this.clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    this.baseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';
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