import { ALL_CAUSES } from '../lib/causes'
import { TOUCH_SKILLS } from '../lib/touches'
import './glossary.css'

type Entry = { term: string; def: string }

const MATCH: Entry[] = [
  {
    term: 'Rally',
    def: 'One point — from serve until the ball is dead. Everything we log is per rally.',
  },
  {
    term: 'Side-out',
    def: 'We win the rally while receiving serve. Side-out % is how often we break serve.',
  },
  {
    term: 'Serve point %',
    def: 'How often we win the rally when we are serving.',
  },
  {
    term: 'Rotation',
    def: 'Which lineup position we are in (1–6, plus any extra labels). Changes after we side-out.',
  },
  {
    term: 'Error rate (team)',
    def: 'Share of all rallies that ended as our unforced error.',
  },
  {
    term: 'Error rate when tagged',
    def: 'For a player: their charged errors ÷ rallies they are named on in the cause column. Digging a ball without being the named cause does not count in this denominator.',
  },
  {
    term: 'Net (player)',
    def: 'Earned points credited to you minus your unforced errors. Positive = helping more than hurting.',
  },
  {
    term: 'Forced',
    def: 'Opponent error where you are named — you made them miss.',
  },
  {
    term: 'Beaten',
    def: 'Opponent kill with you named. They earned it, so it is not counted as your error.',
  },
  {
    term: 'Error film',
    def: 'Clips of our unforced errors. Timestamps mark the end of the rally; the player seeks a short window before that.',
  },
]

const TOUCHES: Entry[] = [
  {
    term: 'Touch grade (0–3)',
    def: 'Quality of a contact. 0 = dies / disaster, 1 = kept alive poorly, 2 = playable, 3 = clean.',
  },
  {
    term: 'o (opponent)',
    def: 'Marker in the touch string that the ball came from or went to the other side. Starts a new possession for first-ball stats.',
  },
  {
    term: 'First ball',
    def: 'Our first contact after opponent possession. Usually serve receive or a dig off their attack.',
  },
  {
    term: 'Save',
    def: 'Your emergency dig — a receive graded 0–1. Kept % = share of those that still got a next touch.',
  },
  {
    term: 'Cleanup',
    def: 'Your touch immediately after a teammate’s 0–1. You are fixing their mess, not creating it.',
  },
  {
    term: 'Bailed %',
    def: 'Share of your poor first balls that a teammate converted to a 2+ next contact.',
  },
  {
    term: 'Win after',
    def: 'Rallies we won after your emergency dig was kept alive.',
  },
  {
    term: 'Skills (V R S A B)',
    def: TOUCH_SKILLS.map((s) => `${s.skill.toUpperCase()} = ${s.label}`).join(' · '),
  },
]

const CAUSES: Entry[] = ALL_CAUSES.map((c) => ({
  term: c.label,
  def: `${c.side === 'win' ? 'We score' : 'They score'} · ${c.group.toLowerCase()}`,
}))

function Section({ id, title, hint, entries }: { id: string; title: string; hint?: string; entries: Entry[] }) {
  return (
    <section className="glossary-section" id={id}>
      <header className="glossary-section-head">
        <h2>{title}</h2>
        {hint ? <p className="glossary-hint">{hint}</p> : null}
      </header>
      <dl className="glossary-list">
        {entries.map((e) => (
          <div key={e.term} className="glossary-row">
            <dt>{e.term}</dt>
            <dd>{e.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function Glossary() {
  return (
    <div className="app glossary-app">
      <header className="masthead">
        <div>
          <h1>Glossary</h1>
          <div className="sub">How we talk about rallies, touches, and errors on this sheet.</div>
        </div>
        <div className="badge-row">
          <a className="chip" href="/">
            Home
          </a>
          <a className="chip" href="/stats">
            Dashboard
          </a>
          <a className="chip" href="/film">
            Error film
          </a>
        </div>
      </header>

      <nav className="glossary-jump" aria-label="Glossary sections">
        <a href="#match">Match</a>
        <a href="#touches">Touches</a>
        <a href="#causes">Rally causes</a>
      </nav>

      <Section
        id="match"
        title="Match & box score"
        hint="Core rates and player ledger language"
        entries={MATCH}
      />
      <Section
        id="touches"
        title="Touches"
        hint="Graded contacts from the Touches column"
        entries={TOUCHES}
      />
      <Section
        id="causes"
        title="Rally causes"
        hint="Why the point ended — tags from the sheet"
        entries={CAUSES}
      />
    </div>
  )
}
