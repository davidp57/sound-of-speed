/*
 * Service worker.
 *
 * Il répond à un problème très concret : une voiture traverse des zones sans
 * réseau, et une application chargée depuis Internet n'y démarre pas. Une fois
 * ce fichier en place, l'application se lance sans connexion et les échantillons
 * ne se retéléchargent plus — ce qui, accessoirement, dispense d'exposer le NAS
 * en permanence.
 *
 * Il n'y a pas de liste de fichiers à précharger. Les noms produits par Vite
 * portent une empreinte du contenu et changent à chaque build : une liste écrite
 * à la main serait fausse dès la construction suivante. Le cache se remplit donc
 * à l'usage, et la première visite en ligne suffit à rendre les suivantes
 * autonomes.
 */

const VERSION = 'v3'
const SHELL = `speed-shell-${VERSION}`
const ASSETS = `speed-assets-${VERSION}`
// Les échantillons ne dépendent pas de la version du code : les garder dans un
// cache à part évite de retélécharger plusieurs mégaoctets à chaque mise à jour.
const AUDIO = 'speed-audio'

const CACHES = [SHELL, ASSETS, AUDIO]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache.addAll([
          '/',
          '/index.html',
          '/manifest.webmanifest',
          // Le silence qui maintient la session audio du système. Sans lui dans
          // le cache, une application installée perdrait le son en arrière-plan
          // dès qu'elle est hors réseau — c'est-à-dire là où elle sert.
          '/silence.mp3',
          // Les icônes portent des noms fixes, donc énumérables ici. Elles
          // n'apparaissent pas dans le relevé des ressources chargées par la
          // page — le navigateur récupère les favicons hors de ce circuit — et
          // manqueraient donc à la préparation faite depuis l'application.
          '/icons/icon-192.png',
          '/icons/icon-512.png',
          '/icons/icon-maskable-512.png',
          '/icons/apple-touch-icon.png',
          // La réponse d'échappement par défaut du son synthétisé. Sans elle, un
          // profil « généré en direct » sonnerait sans corps hors réseau —
          // c'est-à-dire dans la voiture, là où il sert. Les autres réponses se
          // chargent à la demande : on ne les choisit qu'au bureau.
          '/impulse/smooth_39.wav',
          // Le cœur d'engine-sim, pour la même raison : sans lui le mode
          // synthèse ne démarre pas du tout hors réseau. Cent cinquante-six
          // kilo-octets, à côté des mégaoctets d'une banque d'échantillons.
          '/sonde/probe.mjs',
          '/sonde/probe.wasm',
        ]),
      )
      // Un fichier manquant ne doit pas empêcher l'installation.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !CACHES.includes(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // En développement, les modules sont servis un par un et rechargés à chaud :
  // les mettre en cache figerait le code au premier chargement. On laisse donc
  // passer tout ce qui appartient à l'outillage de développement, ce qui permet
  // d'avoir le service worker actif et vérifiable sans gêner le travail.
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return
  }

  // La page d'entrée doit être cherchée sur le réseau en premier : c'est elle
  // qui référence les ressources empreintes, donc elle seule fait basculer sur
  // une nouvelle version. Hors ligne, la copie en cache prend le relais.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/index.html'))
    return
  }

  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(cacheFirst(request, AUDIO))
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, ASSETS))
    return
  }

  event.respondWith(networkFirst(request, SHELL, null))
})

/**
 * Recherche dans un cache, en ignorant l'en-tête `Vary`.
 *
 * Ce détail décide du fonctionnement hors réseau. Les serveurs répondent
 * volontiers `Vary: Origin` sur les fichiers statiques ; or une réponse
 * enregistrée depuis une requête sans en-tête `Origin` ne correspond alors plus
 * à la même adresse demandée avec — ce qui est précisément le cas du script de
 * l'application, que Vite déclare `crossorigin`. Sans `ignoreVary`, le cache
 * paraît vide au moment exact où il devrait servir, et l'application affiche une
 * page blanche hors réseau alors que tous ses fichiers sont là.
 */
function lookup(cache, request) {
  return cache.match(request, { ignoreVary: true })
}

/** Le cache d'abord : rien ne change sous un nom donné, inutile de demander. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await lookup(cache, request)
  if (hit) return hit

  const response = await fetch(request)
  // Une réponse partielle ou une erreur n'a rien à faire en cache : elle serait
  // resservie telle quelle indéfiniment.
  if (response.ok && response.status === 200) cache.put(request, response.clone())
  return response
}

/** Le réseau d'abord, le cache en filet. */
async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok && response.status === 200) cache.put(request, response.clone())
    return response
  } catch (error) {
    const hit = await lookup(cache, request)
    if (hit) return hit
    if (fallback) {
      const page = await lookup(cache, fallback)
      if (page) return page
    }
    throw error
  }
}

/*
 * Messages venus de la page.
 *
 * `PRECACHE` force la mise en cache d'une liste d'adresses sans attendre qu'on
 * en ait besoin : c'est ce qui permet de préparer un départ hors réseau plutôt
 * que de découvrir sur la route qu'une couche manque.
 *
 * `STATUS` répond ce qui est déjà là, pour pouvoir l'afficher.
 */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'PRECACHE' && Array.isArray(data.urls)) {
    event.waitUntil(precache(data.urls, event.source, data.cache === 'assets' ? ASSETS : AUDIO))
  }

  if (data.type === 'STATUS' && Array.isArray(data.urls)) {
    event.waitUntil(status(data.urls, event.source))
  }
})

async function precache(urls, client, cacheName) {
  const cache = await caches.open(cacheName)
  let done = 0
  let failed = 0

  for (const url of urls) {
    try {
      if (!(await lookup(cache, url))) {
        const response = await fetch(url, { cache: 'reload' })
        if (!response.ok) throw new Error(String(response.status))
        await cache.put(url, response)
      }
      done += 1
    } catch {
      failed += 1
    }
    if (cacheName === AUDIO) {
      client?.postMessage({ type: 'PRECACHE_PROGRESS', done, failed, total: urls.length })
    }
  }

  if (cacheName === AUDIO) {
    client?.postMessage({ type: 'PRECACHE_DONE', done, failed, total: urls.length })
  }
}

async function status(urls, client) {
  const cache = await caches.open(AUDIO)
  let cached = 0
  let bytes = 0

  for (const url of urls) {
    const hit = await lookup(cache, url)
    if (!hit) continue
    cached += 1
    // La taille n'est pas toujours annoncée ; on ne lit le corps que si besoin.
    const length = hit.headers.get('content-length')
    bytes += length ? Number(length) : (await hit.clone().arrayBuffer()).byteLength
  }

  client?.postMessage({ type: 'STATUS_RESULT', cached, total: urls.length, bytes })
}
