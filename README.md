# AI Agent

> **Note**: This is a personal project for experimenting with Electron and OpenAI APIs. The code quality is not production-ready as it was heavily developed using Cursor AI, which resulted in some messy code patterns.

## Overview

AI Agent is a desktop chatbot application built with Electron that can execute system commands on your machine. It uses OpenAI's Chat Completions API with Function Calling to intelligently run shell commands when needed, making it useful for system administration tasks.

## Features

- 🤖 Chat interface powered by OpenAI (GPT-4o-mini)
- ⚡ Streaming responses for real-time interaction
- 🛠️ Automatic command execution using OpenAI Function Calling
- 💾 Persistent API key storage using electron-store
- 🎨 Vue.js UI with component-based architecture

## Prerequisites

- Node.js (v18 or higher)
- npm
- OpenAI API key

## Installation

```bash
npm install
```

## Configuration

1. Start the application
2. Go to Settings
3. Enter your OpenAI API key
4. Save

## Running the Application

```bash
# Development mode
npm run dev

# Production build and start
npm start
```

## Building the Application

To create a distributable application:

```bash
npm run build:app
```

This will create platform-specific installers in the `release/` directory:
- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` file

## Project Structure

```
src/
  main/           # Electron main process (TypeScript)
  renderer/       # Vue.js UI implementation
  resources/      # System prompts and resources
```

## How It Works

1. User sends a message through the chat interface
2. Message is sent to OpenAI API with a system prompt for system administration
3. If the AI determines a command needs to be executed, it uses Function Calling to request command execution
4. The command is executed on the system
5. Command output is sent back to the AI
6. AI generates a final response with the results

## Disclaimer

This project was developed primarily using Cursor AI, which means:
- Code quality may be inconsistent
- Some patterns might not follow best practices
- Refactoring is likely needed for production use
- It's a learning/experimentation project

Use at your own risk. Be careful with command execution permissions.

## License

ISC
