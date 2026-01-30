export default {
    async loadTemplate() {
        const response = await fetch('components/main/Main.html');
        return await response.text();
    },
    setup() {
        console.log('Main setup');
    }
}