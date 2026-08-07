import './landing.css'

const ROSTER = [
  { name: 'Alec', tilt: -2 },
  { name: 'Amber', tilt: 1 },
  { name: 'Avy', tilt: -1 },
  { name: 'Ish', tilt: 2 },
  { name: 'Jess', tilt: -1 },
  { name: 'Michelle', tilt: 1 },
  { name: 'Sofia', tilt: -2 },
] as const

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-nav-brand" href="/">
          SDWFU
        </a>
        <nav className="landing-nav-links">
          <a href="/stats">Dashboard</a>
          <a href="/film">Error film</a>
          <a href="/glossary">Glossary</a>
        </nav>
      </header>

      <section className="landing-hero">
        <h1 className="landing-brand">
          Sundays
          <br />
          Didn&apos;t Work
          <br />
          For Us
        </h1>
        <p className="landing-lede">
          Stats and error film for rec volleyball. The numbers are noisy, incomplete, and swing
          wildly game to game — use them to ask better questions, not grade anyone.
        </p>
        <div className="landing-ctas">
          <a className="landing-cta-primary" href="/stats">
            Open dashboard
          </a>
          <a className="landing-cta-ghost" href="/film">
            Error film
          </a>
        </div>
      </section>

      <section className="landing-team">
        <div className="landing-team-head">
          <div className="landing-kicker">Roster</div>
          <h2>Who&apos;s who</h2>
          <p className="landing-team-note">Photo slots open — drop faces in when you have them</p>
        </div>
        <ul className="landing-roster">
          {ROSTER.map(({ name, tilt }) => (
            <li key={name} className="landing-member" style={{ ['--tilt' as string]: `${tilt}deg` }}>
              <div className="landing-photo" role="img" aria-label={`${name} photo placeholder`}>
                <span className="landing-photo-x" aria-hidden>
                  ✕
                </span>
              </div>
              <div className="landing-name">{name}</div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="landing-foot">
        <span>Sunday rec league</span>
        <a href="/stats">Dashboard →</a>
      </footer>
    </div>
  )
}
