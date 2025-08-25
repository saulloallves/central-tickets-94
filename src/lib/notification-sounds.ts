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
      
      // Different frequencies for different alert types - som mais moderno
      let frequency1: number, frequency2: number, frequency3: number, duration: number;
      
      switch (type) {
        case 'critical':
          frequency1 = 987; // B5
          frequency2 = 1318; // E6
          frequency3 = 1568; // G6
          duration = 1.2;
          break;
        case 'warning':
          frequency1 = 783; // G5
          frequency2 = 987; // B5
          frequency3 = 1174; // D6
          duration = 0.8;
          break;
        case 'success':
          frequency1 = 659; // E5
          frequency2 = 830; // G#5
          frequency3 = 987; // B5
          duration = 0.6;
          break;
        default: // info
          frequency1 = 523; // C5
          frequency2 = 659; // E5
          frequency3 = 783; // G5
          duration = 0.5;
      }
      
      // Set oscillator properties - som mais rico
      oscillator.type = 'square'; // Mudança para onda quadrada - som mais distintivo
      oscillator.frequency.setValueAtTime(frequency1, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency2, audioContext.currentTime + duration / 3);
      oscillator.frequency.exponentialRampToValueAtTime(frequency3, audioContext.currentTime + duration * 2/3);
      oscillator.frequency.exponentialRampToValueAtTime(frequency1, audioContext.currentTime + duration);
      
      // Set gain (volume) envelope - VOLUME AUMENTADO
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02); // Volume aumentado de 0.1 para 0.3
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + duration);
      
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