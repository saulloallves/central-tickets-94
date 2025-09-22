/**
 * Sistema de gerenciamento de áudio para notificações
 * Lida com as políticas de autoplay dos navegadores
 */

class AudioManager {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private audioBuffer: ArrayBuffer | null = null;

  constructor() {
    // Tentar inicializar automaticamente quando possível
    this.init();
  }

  async init() {
    try {
      console.log('🔔 🎵 Inicializando AudioManager...');
      
      // Carregar o arquivo de som
      const response = await fetch('/notification-sound.mp3');
      this.audioBuffer = await response.arrayBuffer();
      console.log('🔔 ✅ Arquivo de som carregado');
      
      // Registrar listener para primeiro clique
      this.setupUserInteractionListener();
      
    } catch (error) {
      console.error('🔔 ❌ Erro ao inicializar AudioManager:', error);
    }
  }

  private setupUserInteractionListener() {
    const initializeOnFirstClick = async () => {
      try {
        if (!this.isInitialized) {
          console.log('🔔 🎵 Primeira interação detectada - inicializando AudioContext...');
          
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          // Testar reprodução
          await this.testAudio();
          
          this.isInitialized = true;
          console.log('🔔 ✅ AudioManager inicializado com sucesso!');
          
          // Remover listeners após inicialização
          document.removeEventListener('click', initializeOnFirstClick);
          document.removeEventListener('touchstart', initializeOnFirstClick);
          document.removeEventListener('keydown', initializeOnFirstClick);
        }
      } catch (error) {
        console.error('🔔 ❌ Erro ao inicializar AudioContext:', error);
      }
    };

    // Adicionar listeners para primeira interação
    document.addEventListener('click', initializeOnFirstClick, { once: true });
    document.addEventListener('touchstart', initializeOnFirstClick, { once: true });
    document.addEventListener('keydown', initializeOnFirstClick, { once: true });
  }

  private async testAudio() {
    try {
      console.log('🔔 🧪 Testando reprodução de áudio...');
      
      if (!this.audioContext || !this.audioBuffer) {
        throw new Error('AudioContext ou buffer não disponível');
      }

      const audioBuffer = await this.audioContext.decodeAudioData(this.audioBuffer.slice(0));
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.value = 0.1; // Volume muito baixo para teste
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      source.start(0);
      console.log('🔔 ✅ Teste de áudio bem-sucedido');
      
    } catch (error) {
      console.error('🔔 ❌ Erro no teste de áudio:', error);
    }
  }

  async playNotificationSound(volume: number = 0.8) {
    try {
      console.log('🔔 🔊 Reproduzindo som de notificação...');
      
      if (!this.isInitialized || !this.audioContext || !this.audioBuffer) {
        console.log('🔔 ⚠️ AudioManager não inicializado - tentando método alternativo...');
        return this.playWithHTMLAudio(volume);
      }

      // Método preferido com AudioContext
      const audioBuffer = await this.audioContext.decodeAudioData(this.audioBuffer.slice(0));
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      source.start(0);
      console.log('🔔 ✅ Som reproduzido via AudioContext');
      
    } catch (error) {
      console.error('🔔 ❌ Erro AudioContext - tentando HTML Audio:', error);
      return this.playWithHTMLAudio(volume);
    }
  }

  private async playWithHTMLAudio(volume: number = 0.8) {
    try {
      console.log('🔔 🎵 Tentando HTML Audio...');
      
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = volume;
      audio.preload = 'auto';
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('🔔 ✅ Som reproduzido via HTML Audio');
      }
      
    } catch (error) {
      console.error('🔔 ❌ Erro HTML Audio:', error);
      
      if (error.name === 'NotAllowedError') {
        console.log('🔔 ⚠️ Reprodução bloqueada pelo navegador');
        throw new Error('BLOCKED_BY_BROWSER');
      }
      
      throw error;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasAudioContext: !!this.audioContext,
      hasAudioBuffer: !!this.audioBuffer
    };
  }
}

// Singleton instance
export const audioManager = new AudioManager();

// Função helper para usar nas notificações
export const playNotificationSound = async (volume: number = 0.8) => {
  try {
    await audioManager.playNotificationSound(volume);
  } catch (error) {
    if (error.message === 'BLOCKED_BY_BROWSER') {
      console.log('🔔 ⚠️ Som bloqueado - usuário precisa interagir primeiro');
      return false;
    }
    console.error('🔔 ❌ Erro ao reproduzir som:', error);
    return false;
  }
  return true;
};