// Chat Component Logic
export default {
  props: ['tabId'],
  async loadTemplate() {
    const response = await fetch('components/chat/Chat.html');
    return await response.text();
  },
  setup(props) {
    const { ref, nextTick, onMounted, onUnmounted } = Vue;
    
    const messages = ref([]);
    const messageInput = ref('');
    const isSending = ref(false);
    const messagesContainer = ref(null);
    let currentStreamingMessage = null;
    let currentStreamingContent = '';

    // Cleanup functions for IPC listeners
    let cleanupChunk = null;
    let cleanupComplete = null;
    let cleanupError = null;
    let cleanupConfirmation = null;

    const parsedMessage = (message) => {
      return marked.parse(message || '');
    };

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      });
    };

    const addMessage = (message, actions = []) => {
      messages.value.push({
        message,
        actions,
        streaming: false
      });
      scrollToBottom();
    };

    const addStreamingMessage = () => {
      const streamingMsg = {
        message: ref(''),
        actions: [],
        streaming: true
      };
      messages.value.push(streamingMsg);
      currentStreamingMessage = streamingMsg;
      currentStreamingContent = '';
      scrollToBottom();
      return streamingMsg;
    };

    const updateStreamingMessage = (chunk) => {
      if (!currentStreamingMessage) {
        addStreamingMessage();
      }

      currentStreamingContent += chunk;
      currentStreamingMessage.message.value = currentStreamingContent;
      scrollToBottom();
    };

    const finalizeStreamingMessage = (reply, actions = []) => {
      if (currentStreamingMessage) {
        currentStreamingMessage.message.value = reply;
        currentStreamingMessage.actions = actions;
        currentStreamingMessage.streaming = false;
        currentStreamingMessage = null;
        currentStreamingContent = '';
        scrollToBottom();
      }

      window.electronAPI?.updateMessagesInUI(props.tabId, JSON.parse(JSON.stringify(messages.value)))
        .catch((error) => {
          console.error('Error updating messages in UI:', error);
        });
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    const executeCommand = async (command) => {
      try {
        isSending.value = true;
        
        await window.electronAPI?.executeCommand(props.tabId, command);
      } catch (error) {
        addMessage('**Error executing command:** ' + error.message);
      } finally {
        isSending.value = false;
      }
    };

    const sendMessage = async () => {
      const message = messageInput.value.trim();
      
      if (!message || isSending.value) {
        return;
      }

      try {
        isSending.value = true;
        messageInput.value = '';
        addMessage(message);
        
        await window.electronAPI?.sendMessage(props.tabId, message);
      } catch (error) {
        addMessage('Error: ' + error.message);
      } finally {
        isSending.value = false;
      }
    };

    onMounted(() => {
      // Load history for this tab
      window.electronAPI?.getHistory(props.tabId).then((messagesInTheUI) => {
        if (messagesInTheUI && messagesInTheUI.length > 0) {
          messages.value.splice(0);
          messages.value.push(...messagesInTheUI);
          scrollToBottom();
        }
      });

      // Set up IPC listeners (filtered by tabId)
      cleanupChunk = window.electronAPI?.onMessageChunk((data) => {
        if (data.tabId === props.tabId) {
          updateStreamingMessage(data.chunk);
        }
      });

      cleanupComplete = window.electronAPI?.onMessageComplete((data) => {
        if (data.tabId === props.tabId) {
          finalizeStreamingMessage(data.reply, data.actions || []);
        }
      });

      cleanupError = window.electronAPI?.onMessageError((data) => {
        if (data.tabId === props.tabId) {
          finalizeStreamingMessage('**Error:** ' + data.error, []);
        }
      });

      cleanupConfirmation = window.electronAPI?.onAskConfirmation((data) => {
        if (data.tabId === props.tabId) {
          const confirmed = window.confirm(`Are you sure you want to execute the command ${data.command}? ${data.explanation}`);
          window.electronAPI?.askConfirmationReturn(data.tabId, confirmed);
        }
      });
    });

    onUnmounted(() => {
      if (cleanupChunk) cleanupChunk();
      if (cleanupComplete) cleanupComplete();
      if (cleanupError) cleanupError();
      if (cleanupConfirmation) cleanupConfirmation();
    });

    // Dummy messages for development without Electron
    if (!window.electronAPI) {
      for (let i = 0; i < 10; i++) {
        messages.value.push({
          message: 'Dummy message without actions'
        });
      }
      messages.value.push({
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      });
      messages.value.push({
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        actions: [{ command: 'ls -la' }]
      });
    }

    return {
      messages,
      messageInput,
      isSending,
      messagesContainer,
      parsedMessage,
      handleKeydown,
      sendMessage,
      executeCommand
    };
  }
};
