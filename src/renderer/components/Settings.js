// Settings Component Logic
export default {
  async loadTemplate() {
    const response = await fetch('components/Settings.html');
    return await response.text();
  },
  setup() {
    const { ref, onMounted } = Vue;
    
    const apiKey = ref('');

    onMounted(async () => {
      try {
        const savedApiKey = await window.electronAPI.getApiKey();
        if (savedApiKey) {
          apiKey.value = savedApiKey;
        }
      } catch (error) {
        console.error('Error loading api-key:', error);
      }
    });

    const saveApiKey = async () => {
      const key = apiKey.value.trim();

      if (!key) {
        alert('Please enter an API Key');
        return;
      }

      try {
        await window.electronAPI.saveApiKey(key);
        alert('API Key saved successfully');
      } catch (error) {
        console.error('Error saving api-key:', error);
        alert('Error saving API Key');
      }
    };

    return {
      apiKey,
      saveApiKey
    };
  }
};

