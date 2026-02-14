export default {
    async loadTemplate() {
        const response = await fetch('components/main/Main.html');
        return await response.text();
    },
    setup() {
        const { ref, onMounted } = Vue;

        const tabs = ref([]);
        const activeTabId = ref(null);
        let tabCounter = 0;

        const generateTabId = () => {
            tabCounter++;
            return `tab-${Date.now()}-${tabCounter}`;
        };

        const createTab = () => {
            const id = generateTabId();
            const tab = { id, name: `Tab ${tabs.value.length + 1}` };
            tabs.value.push(tab);
            activeTabId.value = id;
            saveTabs();
            return tab;
        };

        const closeTab = (tabId) => {
            if (tabs.value.length <= 1) return;

            const index = tabs.value.findIndex(t => t.id === tabId);
            if (index === -1) return;

            tabs.value.splice(index, 1);

            // Destroy terminal and history for this tab
            window.electronAPI?.destroyTerminal(tabId);
            window.electronAPI?.deleteTabHistory(tabId);

            // If closing the active tab, switch to another
            if (activeTabId.value === tabId) {
                const newIndex = Math.min(index, tabs.value.length - 1);
                activeTabId.value = tabs.value[newIndex].id;
            }

            saveTabs();
        };

        const switchTab = (tabId) => {
            activeTabId.value = tabId;
            saveTabs();
        };

        const saveTabs = () => {
            window.electronAPI?.saveTabs({
                tabs: JSON.parse(JSON.stringify(tabs.value)),
                activeTabId: activeTabId.value
            });
        };

        // Load saved tabs on mount
        onMounted(async () => {
            const saved = await window.electronAPI?.getTabs();
            if (saved && saved.tabs && saved.tabs.length > 0) {
                tabs.value = saved.tabs;
                activeTabId.value = saved.activeTabId || saved.tabs[0].id;
                tabCounter = saved.tabs.length;
            } else {
                createTab();
            }
        });

        return {
            tabs,
            activeTabId,
            createTab,
            closeTab,
            switchTab
        };
    }
}
