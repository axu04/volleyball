import { useEffect, useState } from 'react'
import Dashboard from './App'
import TaggerApp from './tagger/TaggerApp'

function pathIsTagger(pathname: string) {
  return pathname === '/tagger' || pathname.startsWith('/tagger/')
}

export default function Root() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Intercept same-origin <a href="/tagger"> / <a href="/"> without a full reload so drafts
  // and dashboard state stay warm when hopping between tools.
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

  return pathIsTagger(path) ? <TaggerApp /> : <Dashboard />
}
