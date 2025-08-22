// Utility to clean up legacy priority values from localStorage and other places

export const cleanupLegacyPriorityData = () => {
  try {
    console.log('🧹 Starting legacy priority cleanup...');
    
    // List of localStorage keys that might contain legacy priority data
    const keysToCheck = [
      'createTicket_formData',
      'ticket_filters',
      'dashboard_filters',
      'ticketForm_data',
      'ticket_create_form'
    ];

    keysToCheck.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          let hasLegacyData = false;

          // Check for legacy priority values
          const legacyPriorities = ['urgente', 'alta', 'media', 'baixa', 'hoje_18h', 'padrao_24h'];
          
          if (parsed.prioridade && legacyPriorities.includes(parsed.prioridade)) {
            console.log(`Found legacy priority "${parsed.prioridade}" in ${key}, removing`);
            hasLegacyData = true;
          }

          // Check nested objects
          if (parsed.filters && parsed.filters.prioridade && legacyPriorities.includes(parsed.filters.prioridade)) {
            console.log(`Found legacy priority "${parsed.filters.prioridade}" in ${key}.filters, removing`);
            hasLegacyData = true;
          }

          if (hasLegacyData) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.error(`Error parsing ${key} from localStorage:`, error);
          // Remove corrupted data
          localStorage.removeItem(key);
        }
      }
    });

    // More aggressive cleanup: check all localStorage keys for any that might contain legacy data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const value = localStorage.getItem(key);
          if (value && (value.includes('urgente') || value.includes('alta') || value.includes('padrao_24h'))) {
            console.log(`Found potential legacy data in ${key}, removing`);
            localStorage.removeItem(key);
          }
        } catch (error) {
          // Ignore parsing errors for non-JSON data
        }
      }
    }

    console.log('✅ Legacy priority data cleanup completed');
  } catch (error) {
    console.error('Error during legacy cleanup:', error);
  }
};

// Call cleanup on import to ensure it runs early
cleanupLegacyPriorityData();