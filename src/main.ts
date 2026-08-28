import { createApp } from 'vue'

import App from './App.vue'
import './style.css'
import * as state from './state'

createApp(App).mount('#app')

// Banc de mise au point : permet d'avancer la simulation à pas fixe depuis la
// console, ce que le ralentissement des minuteurs en arrière-plan rend
// impossible autrement. Absent de la version compilée.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>)['__speed'] = state
}
