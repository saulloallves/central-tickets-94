// Utility to clean up legacy priority values from localStorage and other places

export const cleanupLegacyPriorityData = () => {
  try {
    // List of localStorage keys that might contain legacy priority data
    const keysToCheck = [
      'createTicket_formData',
      'ticket_filters',
      'dashboard_filters'
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

    console.log('Legacy priority data cleanup completed');
  } catch (error) {
    console.error('Error during legacy cleanup:', error);
  }
};

// Call cleanup on import to ensure it runs early
cleanupLegacyPriorityData();