// Chat Component Logic
export default {
  async loadTemplate() {
    const response = await fetch('components/chat/Chat.html');
    return await response.text();
  },
  setup() {
    const { ref, nextTick } = Vue;
    
    const messages = ref([]);
    const messageInput = ref('');
    const isSending = ref(false);
    const messagesContainer = ref(null);
    let currentStreamingMessage = null;
    let currentStreamingContent = '';
    if (!window.electronAPI) {
      messages.value.push({
        message: 'Dummy message without actions'
      })

      messages.value.push({
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      })

      messages.value.push({
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        actions: [
          {
            command: 'ls -la'
          }
        ]
      })
    }

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
        
        await window.electronAPI?.executeCommand(command);
      } catch (error) {
        addMessage('**Error executing command:** ' + error.message);
      } finally {
        isSending.value = false;
      }
    };

    window.electronAPI?.onMessageChunk((chunk) => {
      updateStreamingMessage(chunk);
    });

    window.electronAPI?.onMessageComplete((data) => {
      finalizeStreamingMessage(data.reply, data.actions || []);
    });

    window.electronAPI?.onMessageError((error) => {
      finalizeStreamingMessage('**Error:** ' + error, []);
    });

    

    const sendMessage = async () => {
      const message = messageInput.value.trim();
      
      if (!message || isSending.value) {
        return;
      }

      try {
        isSending.value = true;
        messageInput.value = '';
        addMessage(message);
        
        await window.electronAPI?.sendMessage(message);
      } catch (error) {
        addMessage('Error: ' + error.message);
      } finally {
        isSending.value = false;
      }
    };

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

