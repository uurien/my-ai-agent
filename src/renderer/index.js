import ChatComponent from './components/chat/Chat.js';
import MainComponent from './components/main/Main.js';
import TerminalComponent from './components/terminal/Terminal.js';

const { createApp } = Vue;

async function initApp() {
  // Load template
  const chatTemplate = await ChatComponent.loadTemplate();
  const mainTemplate = await MainComponent.loadTemplate();
  const terminalTemplate = await TerminalComponent.loadTemplate();
  // Create component with template and setup
  const Chat = {
    template: chatTemplate,
    setup: ChatComponent.setup
  };
  const Terminal = {
    template: terminalTemplate,
    setup: TerminalComponent.setup
  };

  const Main = {
    template: mainTemplate,
    setup: MainComponent.setup,
    components: {
      Chat, Terminal
    }
  };

  createApp({
    components: {
      Main, Chat, Terminal
    },
    template: '<Main></Main>'
  }).mount('#app');
}

initApp();
