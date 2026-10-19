// Estilos compartidos extraidos del <style> de la antigua index.html.
// Debe ir antes que los componentes para que sus estilos ganen en empates.
import './assets/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
