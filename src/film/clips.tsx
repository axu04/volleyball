import { useEffect, useRef } from 'react'
import { YouTubePlayer, type YouTubePlayerHandle } from '../tagger/YouTubePlayer'

/** One match film per session; seek between clips instead of remounting the YouTube embed. */
export function SessionFilmPlayer({
  url,
  start,
  end,
  autoplay,
}: {
  url: string
  start: number
  end: number
  autoplay: boolean
}) {
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const endRef = useRef(end)
  endRef.current = end

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const seek = () => {
      player.seekTo(Math.max(0, start))
      if (autoplay) player.play()
      else player.pause()
    }

    seek()
    const boot = window.setTimeout(seek, 400)
    const watch = window.setInterval(() => {
      if (player.getCurrentTime() >= endRef.current - 0.15) player.pause()
    }, 200)

    return () => {
      window.clearTimeout(boot)
      window.clearInterval(watch)
    }
  }, [url, start, end, autoplay])

  return (
    <div className="film-player">
      <YouTubePlayer ref={playerRef} url={url} />
    </div>
  )
}
