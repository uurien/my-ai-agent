export default {
    props: ['tabId'],
    async loadTemplate() {
        const response = await fetch('components/terminal/Terminal.html');
        return await response.text();
    },
    setup(props) {
        const { onMounted, onUnmounted, ref } = Vue;

        let term = null;
        const terminalRef = ref(null);
        let resizeObserver = null;
        let resizeHandler = null;
        let cleanupDataListener = null;

        const resizeTerminal = () => {
            const terminalElement = terminalRef.value;
            if (term && terminalElement) {
                // Obtener dimensiones del elemento contenedor
                const width = terminalElement.clientWidth;
                const height = terminalElement.clientHeight;
                
                if (width === 0 || height === 0) {
                    return; // El elemento no tiene dimensiones aún
                }
                
                // Calcular dimensiones basándose en el tamaño de fuente
                const fontSize = term.options?.fontSize || 12;
                
                const charWidth = fontSize * 0.6;
                const charHeight = fontSize == 15 ? 17 : (fontSize * 1.2);
                
                // Calcular columnas y filas basándose en las dimensiones disponibles
                const cols = Math.max(1, Math.floor(width / charWidth));
                const rows = Math.max(1, Math.floor(height / charHeight));
                
                // Redimensionar terminal
                if (cols > 0 && rows > 0) {
                    term.resize(cols, rows);
                    
                    // Notificar al proceso PTY del cambio de tamaño
                    window.electronAPI?.resizeTerminal(props.tabId, cols, rows);
                }
            }
        };

        onMounted(() => {
            const terminalElement = terminalRef.value;
            if (!terminalElement) {
                console.error('Terminal element not found for tab', props.tabId);
                return;
            }

            // Crear instancia de terminal
            term = new Terminal();

            // Abrir terminal en el elemento
            term.open(terminalElement);

            // Configurar eventos de datos
            window.electronAPI?.terminalInitialize(props.tabId).then(() => {
                console.log('Terminal initialized for tab', props.tabId);
                
                // Configurar listener para datos del terminal (filtrado por tabId)
                cleanupDataListener = window.electronAPI?.onDataOnTerminal((tabId, data) => {
                    if (tabId === props.tabId && term) {
                        term.write(data);
                    }
                });

                // Configurar listener para enviar datos al terminal
                term.onData((data) => {
                    window.electronAPI?.writeTerminalData(props.tabId, data);
                });

                // Redimensionar inicial
                resizeTerminal();

                // Redimensionar cuando cambie el tamaño de la ventana
                resizeHandler = () => resizeTerminal();
                window.addEventListener('resize', resizeHandler);

                // Redimensionar cuando cambie el tamaño del contenedor (ResizeObserver)
                resizeObserver = new ResizeObserver(() => {
                    resizeTerminal();
                });
                resizeObserver.observe(terminalElement);
            });

            resizeTerminal();
        });

        onUnmounted(() => {
            if (cleanupDataListener) cleanupDataListener();
            if (resizeObserver) resizeObserver.disconnect();
            if (resizeHandler) window.removeEventListener('resize', resizeHandler);
            if (term) term.dispose();
        });

        return {
            terminalRef
        };
    }
}
