import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { extractVideoId } from './youtube'

export interface YouTubePlayerHandle {
  getCurrentTime: () => number
  seekTo: (seconds: number) => void
  pause: () => void
  play: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string
          playerVars?: Record<string, number | string>
          events?: {
            onReady?: (e: { target: YTPlayer }) => void
            onError?: (e: { data: number }) => void
          }
        },
      ) => YTPlayer
      PlayerState: Record<string, number>
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  destroy: () => void
  getCurrentTime: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  pauseVideo: () => void
  playVideo: () => void
}

let apiLoading: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoading) return apiLoading
  apiLoading = new Promise((resolve) => {
    const prior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prior?.()
      resolve()
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.ytApi = '1'
      document.head.appendChild(script)
    }
  })
  return apiLoading
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, { url: string; className?: string }>(
  function YouTubePlayer({ url, className }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
    const [error, setError] = useState('')

    const videoId = extractVideoId(url)

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        try {
          return playerRef.current?.getCurrentTime() ?? 0
        } catch {
          return 0
        }
      },
      seekTo: (seconds: number) => {
        try {
          playerRef.current?.seekTo(seconds, true)
        } catch {
          /* player not ready */
        }
      },
      pause: () => {
        try {
          playerRef.current?.pauseVideo()
        } catch {
          /* ignore */
        }
      },
      play: () => {
        try {
          playerRef.current?.playVideo()
        } catch {
          /* ignore */
        }
      },
    }))

    useEffect(() => {
      let cancelled = false
      playerRef.current?.destroy()
      playerRef.current = null

      if (!videoId || !hostRef.current) {
        setStatus(videoId ? 'loading' : 'idle')
        return
      }

      setStatus('loading')
      setError('')

      loadYouTubeApi().then(() => {
        if (cancelled || !hostRef.current || !window.YT) return
        // Replace host contents so a new player mounts cleanly.
        hostRef.current.innerHTML = ''
        const mount = document.createElement('div')
        hostRef.current.appendChild(mount)

        playerRef.current = new window.YT.Player(mount, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!cancelled) setStatus('ready')
            },
            onError: (e) => {
              if (!cancelled) {
                setStatus('error')
                setError(`YouTube player error ${e.data}`)
              }
            },
          },
        })
      })

      return () => {
        cancelled = true
        try {
          playerRef.current?.destroy()
        } catch {
          /* ignore */
        }
        playerRef.current = null
      }
    }, [videoId])

    return (
      <div className={className}>
        <div className="yt-frame">
          <div ref={hostRef} className="yt-host" />
          {!videoId && (
            <div className="yt-placeholder">
              Paste a YouTube URL above to load the match video.
            </div>
          )}
          {videoId && status === 'loading' && <div className="yt-placeholder">Loading player…</div>}
          {status === 'error' && <div className="yt-placeholder">{error || 'Could not load video.'}</div>}
        </div>
      </div>
    )
  },
)
