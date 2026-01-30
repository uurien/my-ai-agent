export default {
    async loadTemplate() {
        const response = await fetch('components/terminal/Terminal.html');
        return await response.text();
    },
    setup() {
        let term = null;
        let terminalElement = null;

        const resizeTerminal = () => {
            if (term && terminalElement) {
                // Obtener dimensiones del elemento contenedor
                const width = terminalElement.clientWidth;
                const height = terminalElement.clientHeight;
                
                if (width === 0 || height === 0) {
                    return; // El elemento no tiene dimensiones aún
                }
                
                // Calcular dimensiones basándose en el tamaño de fuente
                // xterm usa el font-size para determinar las dimensiones de los caracteres
                const fontSize = term.options?.fontSize || 12;
                
                // Las fuentes monoespaciadas tienen un ancho aproximado de 0.6 veces el font-size
                // y una altura aproximada de 1.2 veces el font-size (incluyendo line-height)
                const charWidth = fontSize * 0.6;
                const charHeight = fontSize == 15 ? 17 : (fontSize * 1.2);
                
                // Calcular columnas y filas basándose en las dimensiones disponibles
                const cols = Math.max(1, Math.floor(width / charWidth));
                const rows = Math.max(1, Math.floor(height / charHeight));
                console.log('height', height, charHeight, rows);
                
                // Redimensionar terminal
                if (cols > 0 && rows > 0) {
                    term.resize(cols, rows);
                    
                    // Notificar al proceso PTY del cambio de tamaño
                    window.electronAPI?.resizeTerminal(cols, rows);
                }
            }
        };

        setTimeout(() => {
            terminalElement = document.getElementById('terminal');
            if (!terminalElement) {
                console.error('Terminal element not found');
                return;
            }

            // Crear instancia de terminal
            term = new Terminal();

            // Abrir terminal en el elemento
            term.open(terminalElement);

            // Configurar eventos de datos
            window.electronAPI?.terminalInitialize().then(() => {
                console.log('Terminal initialized');
                
                // Configurar listener para datos del terminal
                window.electronAPI?.onDataOnTerminal((data) => {
                    if (term) {
                        term.write(data);
                    }
                });

                // Configurar listener para enviar datos al terminal
                term.onData((data) => {
                    window.electronAPI?.writeTerminalData(data);
                });

                // Redimensionar inicial
                console.log('redimensionar inicial');
                resizeTerminal();

                // Redimensionar cuando cambie el tamaño de la ventana
                window.addEventListener('resize', () => {
                    resizeTerminal();
                });

                // Redimensionar cuando cambie el tamaño del contenedor (ResizeObserver)
                const resizeObserver = new ResizeObserver(() => {
                    resizeTerminal();
                });
                resizeObserver.observe(terminalElement);
            });

            resizeTerminal();
        });
    }
}