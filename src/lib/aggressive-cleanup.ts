// Force clear all localStorage on app start to remove legacy data
const clearAllLegacyData = () => {
  console.log('🧹 AGGRESSIVE CLEANUP: Clearing all potential legacy data...');
  
  // Clear all ticket-related localStorage
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.toLowerCase().includes('ticket') || 
        key.toLowerCase().includes('form') || 
        key.toLowerCase().includes('prioridade')) {
      console.log(`Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Clear session storage too
  const sessionKeys = Object.keys(sessionStorage);
  sessionKeys.forEach(key => {
    if (key.toLowerCase().includes('ticket') || 
        key.toLowerCase().includes('form') || 
        key.toLowerCase().includes('prioridade')) {
      console.log(`Removing sessionStorage key: ${key}`);
      sessionStorage.removeItem(key);
    }
  });
  
  console.log('✅ Aggressive cleanup completed');
};

// Run on import
clearAllLegacyData();

export { clearAllLegacyData };