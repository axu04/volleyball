import { useEffect, useState } from 'react'
import Dashboard from './App'
import FilmApp from './film/FilmApp'
import Glossary from './glossary/Glossary'
import Landing from './landing/Landing'
import TaggerApp from './tagger/TaggerApp'

function routeFor(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/tagger' || path.startsWith('/tagger/')) return 'tagger'
  if (path === '/film' || path.startsWith('/film/')) return 'film'
  if (path === '/glossary' || path.startsWith('/glossary/')) return 'glossary'
  if (path === '/stats' || path.startsWith('/stats/') || path === '/dashboard') return 'dashboard'
  return 'landing'
}

export default function Root() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return
      const href = a.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      e.preventDefault()
      window.history.pushState({}, '', href)
      setPath(href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const route = routeFor(path)
  if (route === 'tagger') return <TaggerApp />
  if (route === 'film') return <FilmApp />
  if (route === 'glossary') return <Glossary />
  if (route === 'dashboard') return <Dashboard />
  return <Landing />
}
