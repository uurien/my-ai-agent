import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const shell = '/bin/zsh';

const ptyProcesses: Map<string, any> = new Map();
const PROMPT_READY = '\u001b]999;PROMPT_READY\u0007'
const CWD_EXTRACTOR_REGEX = /\u001b\]7;(.*)\u0007/;

const pwdMap: Map<string, string> = new Map();

export function getPwd(tabId: string): string {
  return pwdMap.get(tabId) || '';
}

// Detectar si hay un programa interactivo activo
function isInteractiveProgramActive(output: string): boolean {
  // Detectar indicadores de programas interactivos
  const interactiveIndicators = [
    /ssh:\s*connection\s*established/i,
    /vim\s*\[/i,
    /^--\s*(INSERT|NORMAL|VISUAL)/i,
    /^\(top\)/i,
    /^less\s*\(/i,
    /^man\s*\(/i,
    /Entering\s*interactive/i,
    /\u001b\[2J/, // Clear screen (común en programas interactivos)
  ];
  
  return interactiveIndicators.some(pattern => pattern.test(output));
}

// Detección híbrida del fin de comando
function detectCommandEnd(output: string, lastActivityTime: number): boolean {
  const now = Date.now();
  const INACTIVITY_TIMEOUT = 2000; // 2 segundos
  
  // 1. Detección del marcador PROMPT_READY (más confiable)
  if (output.includes(PROMPT_READY)) {
    console.log('PROMPT_READY detected');
    return true;
  }
  
  // 2. Detección heurística de prompt
  // Busca patrones comunes: $, #, %, > seguidos de espacio/nueva línea
  // También busca secuencias ANSI de reset + prompt
  const promptPatterns = [
    /[\$#%>]\s*$/,                    // Prompt simple al final
    /[\$#%>]\s*\n/,                   // Prompt seguido de nueva línea
    /\u001b\[0m[\$#%>]\s*$/,          // Reset ANSI + prompt
    /\u001b\[[0-9;]*m[\$#%>]\s*$/,    // Códigos de color + prompt
  ];
  
  for (const pattern of promptPatterns) {
    if (pattern.test(output)) {
      // Verificar que no hay programas interactivos activos
      if (!isInteractiveProgramActive(output)) {
        return true;
      }
    }
  }
  
  // 3. Timeout de inactividad (último recurso)
  if (now - lastActivityTime > INACTIVITY_TIMEOUT) {
    return true;
  }
  
  return false;
}

export function executeCommand(tabId: string, command: string, timeout: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const ptyProcess = ptyProcesses.get(tabId);
    if (!ptyProcess) {
      reject(new Error('Terminal not initialized'));
      return;
    }

    let output = '';
    let lastActivityTime = Date.now();
    let timeoutId: NodeJS.Timeout;
    let cleanup: any;
    let inactivityCheckInterval: NodeJS.Timeout;

    const finish = (result: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (inactivityCheckInterval) clearInterval(inactivityCheckInterval);
      if (cleanup) cleanup.dispose();
      // Limpiar el marcador PROMPT_READY del output
      const cleaned = result.replace(/\u001b\]999;PROMPT_READY\u0007/g, '');
      resolve(cleaned);
    };

    // Timeout máximo para evitar esperas infinitas
    timeoutId = setTimeout(() => {
      finish(output || 'Command timed out');
    }, timeout);

    // Escribir el comando
    ptyProcess.write(command + '\n');
    setTimeout(() => {
      cleanup = ptyProcess.onData((data: any) => {
        const dataStr = data?.toString();
        output += dataStr;
        lastActivityTime = Date.now();

        // Detectar fin de comando
        if (detectCommandEnd(output, lastActivityTime)) {
          console.log('command ended', output);
          finish(output);
        }
      });

    })
    // Verificar periódicamente por inactividad
    inactivityCheckInterval = setInterval(() => {
      if (detectCommandEnd(output, lastActivityTime)) {
        finish(output);
      }
    }, 100); // Verificar cada 100ms

  });
}

export function registerTerminalHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('write-terminal-data', (event, tabId: string, data: string) => {
    const ptyProcess = ptyProcesses.get(tabId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  ipcMain.handle('resize-terminal', (event, tabId: string, cols: number, rows: number) => {
    const ptyProcess = ptyProcesses.get(tabId);
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  ipcMain.handle('terminal-initialize', (event, tabId: string) => {
    if (!ptyProcesses.has(tabId)) {
      const zdotdir = fs.mkdtempSync(path.join(os.tmpdir(), "my-ai-agent-zsh-"));
      const zshrc = `
# Load user's config (optional). Keep their prompt.
if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc"
fi

autoload -Uz add-zsh-hook

__myterm_precmd() {
  # CWD (hidden)
  printf "\\e]7;%s\\a" "$PWD"
  # "prompt ready" marker (hidden, private OSC id 999)
  printf "\\e]999;PROMPT_READY\\a"
}

# add-zsh-hook precmd __myterm_precmd
`;

      fs.writeFileSync(path.join(zdotdir, ".zshrc"), zshrc, "utf8");

      const ptyProcess = pty.spawn(
        shell, [], 
        {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: { 
            ...process.env,
            ZDOTDIR: zdotdir
          }
        });
        let chunk = '';
        ptyProcess.onData((data: any) => {
          chunk += data?.toString();
          if (chunk.includes(PROMPT_READY)) {
            const currentPwd = CWD_EXTRACTOR_REGEX.exec(chunk)?.[1] || pwdMap.get(tabId) || '';
            pwdMap.set(tabId, currentPwd);
            console.log('regex result', CWD_EXTRACTOR_REGEX.exec(chunk));
            chunk = '';
          }

          const mainWindow = getMainWindow();
          mainWindow?.webContents.send('data-on-terminal', tabId, data);
        });

      ptyProcesses.set(tabId, ptyProcess);
    }
  });

  ipcMain.handle('terminal-destroy', (event, tabId: string) => {
    const ptyProcess = ptyProcesses.get(tabId);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcesses.delete(tabId);
      pwdMap.delete(tabId);
    }
  });
}
