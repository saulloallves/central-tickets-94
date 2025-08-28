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

      // Create a gentle notification sound instead of harsh tones
      this.createGentleNotification(audioContext, type);
      
    } catch (error) {
      console.warn('Could not play notification sound:', error);
      // Fallback to system notification sound
      this.playSystemSound();
    }
  }

  // Create a gentle, pleasant notification sound
  private static createGentleNotification(audioContext: AudioContext, type: string) {
    const startTime = audioContext.currentTime;
    
    // Different pleasant tones for different types
    let notes: number[], rhythm: number[], volume: number;
    
    switch (type) {
      case 'critical':
        notes = [880, 1046, 880]; // A5, C6, A5 - urgent but not harsh
        rhythm = [0.15, 0.15, 0.3];
        volume = 0.25;
        break;
      case 'warning':
        notes = [659, 783]; // E5, G5 - pleasant two-tone
        rhythm = [0.2, 0.3];
        volume = 0.2;
        break;
      case 'success':
        notes = [523, 659, 783]; // C5, E5, G5 - pleasant ascending
        rhythm = [0.15, 0.15, 0.25];
        volume = 0.18;
        break;
      default: // info - som mais suave para novo ticket
        notes = [440, 554]; // A4, C#5 - pleasant gentle tone
        rhythm = [0.25, 0.35];
        volume = 0.15;
    }
    
    let currentTime = startTime;
    
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();
      
      // Connect the nodes: oscillator -> filter -> gain -> destination
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Use sine wave for gentle sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, currentTime);
      
      // Add low-pass filter for softer sound
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(frequency * 2, currentTime);
      filterNode.Q.setValueAtTime(1, currentTime);
      
      // Create a smooth envelope
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + rhythm[index]);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + rhythm[index]);
      
      currentTime += rhythm[index] * 0.7; // Slight overlap for smoother transitions
    });
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

  // Play gentle critical alert sequence
  static playCriticalAlert() {
    this.playNotificationSound('critical');
    setTimeout(() => this.playNotificationSound('critical'), 600);
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