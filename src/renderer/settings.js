import SettingsComponent from './components/Settings.js';

const { createApp } = Vue;

async function initApp() {
  // Load template
  const template = await SettingsComponent.loadTemplate();
  
  // Create component with template and setup
  const Settings = {
    template: template,
    setup: SettingsComponent.setup
  };

  createApp({
    components: {
      Settings
    }
  }).mount('#app');
}

initApp();

