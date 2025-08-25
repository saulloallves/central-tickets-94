// src/lib/notification-sounds.ts
export class NotificationSounds {
  private static audioContext: AudioContext | null = null;
  
  // Initialize audio context
  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Generate a notification sound using Web Audio API
  static playNotificationSound(type: 'success' | 'warning' | 'critical' | 'info' = 'info') {
    try {
      const audioContext = this.getAudioContext();
      
      // Resume audio context if it's suspended (required by browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different alert types
      let frequency1: number, frequency2: number, duration: number;
      
      switch (type) {
        case 'critical':
          frequency1 = 880; // A5
          frequency2 = 1108; // C#6
          duration = 0.8;
          break;
        case 'warning':
          frequency1 = 659; // E5
          frequency2 = 784; // G5
          duration = 0.6;
          break;
        case 'success':
          frequency1 = 523; // C5
          frequency2 = 659; // E5
          duration = 0.4;
          break;
        default: // info
          frequency1 = 440; // A4
          frequency2 = 523; // C5
          duration = 0.3;
      }
      
      // Set oscillator properties
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency1, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency2, audioContext.currentTime + duration / 2);
      oscillator.frequency.exponentialRampToValueAtTime(frequency1, audioContext.currentTime + duration);
      
      // Set gain (volume) envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      // Start and stop the sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.warn('Could not play notification sound:', error);
      // Fallback to system notification sound
      this.playSystemSound();
    }
  }

  // Fallback system sound
  private static playSystemSound() {
    try {
      // Create a very short audio data URL for a simple beep
      const audioContext = this.getAudioContext();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 800 * i / audioContext.sampleRate) * 0.1;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
    } catch (error) {
      console.warn('Could not play system sound:', error);
    }
  }

  // Play multiple beeps for critical alerts
  static playCriticalAlert() {
    this.playNotificationSound('critical');
    setTimeout(() => this.playNotificationSound('critical'), 400);
    setTimeout(() => this.playNotificationSound('critical'), 800);
  }

  // Request permission for audio (for autoplay policies)
  static async requestAudioPermission(): Promise<boolean> {
    try {
      const audioContext = this.getAudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      return true;
    } catch (error) {
      console.warn('Audio permission denied:', error);
      return false;
    }
  }
}