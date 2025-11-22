import ChatComponent from './components/chat/Chat.js';

const { createApp } = Vue;

async function initApp() {
  // Load template
  const template = await ChatComponent.loadTemplate();
  
  // Create component with template and setup
  const Chat = {
    template: template,
    setup: ChatComponent.setup
  };

  createApp({
    components: {
      Chat
    }
  }).mount('#app');
}

initApp();
