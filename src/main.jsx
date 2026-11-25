import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownWideNarrow, ArrowRight, Bookmark, Check, ChevronDown, Compass, Crosshair, ExternalLink, Heart, Info, LoaderCircle, MapPin, Navigation, Plus, SlidersHorizontal, Smartphone, Sparkles, Star, Utensils, X } from 'lucide-react';
import { demoPlaces } from './demo';
import './styles.css';

const Icon = ({ as: Component, size = 20, ...props }) => <Component size={size} strokeWidth={1.8} aria-hidden="true" {...props} />;
function PlateArt({ variant = 'grill', small = false }) {
  const tacos = variant === 'tacos';
  return <svg className={`plate-art ${small ? 'small' : ''}`} viewBox="0 0 360 290" role="img" aria-label={tacos ? 'Illustration of a generous taco plate' : 'Illustration of a generous grilled meat and rice plate'}>
    <ellipse cx="181" cy="257" rx="125" ry="14" fill="var(--art-shadow)" />
    <ellipse cx="180" cy="149" rx="148" ry="111" fill="var(--plate-edge)" transform="rotate(-12 180 149)" />
    <ellipse cx="180" cy="141" rx="148" ry="111" fill="var(--plate)" transform="rotate(-12 180 141)" />
    <ellipse cx="180" cy="141" rx="119" ry="87" fill="var(--plate-inset)" transform="rotate(-12 180 141)" />
    <path d="M171 76C137 52 85 94 88 135c2 33 34 59 64 37 28-20 54-72 19-96Z" fill="var(--rice)" />
    {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(n => <path key={n} d={`M${104 + (n % 4) * 15} ${94 + Math.floor(n / 4) * 18}l6 -3`} stroke="var(--rice-line)" strokeWidth="3" strokeLinecap="round" />)}
    <g transform="rotate(-20 220 132)"><path d="M178 90q45-34 88 4l5 62q-33 38-87 6Z" fill={tacos ? 'var(--taco)' : 'var(--meat-edge)'} /><path d="M181 85q44-30 83 8l3 56q-34 31-78 4Z" fill={tacos ? 'var(--taco)' : 'var(--meat)'} />{[0,1,2,3].map(n => <path key={n} d={`M${193+n*18} 91l-3 57`} stroke="var(--grill)" strokeWidth="6" strokeLinecap="round" />)}</g>
    <g fill="var(--greens)"><circle cx="211" cy="193" r="21" /><circle cx="239" cy="177" r="20" /><circle cx="261" cy="192" r="15" /><circle cx="235" cy="203" r="20" /></g>
    <g fill="var(--greens-light)"><circle cx="211" cy="186" r="9" /><circle cx="238" cy="172" r="9" /><circle cx="236" cy="199" r="10" /></g>
    <path d="M109 188q25-26 53-2l-25 25Z" fill="var(--tomato)" /><path d="m138 188 1 15m-12-13 6 11m15-11-5 12" stroke="var(--tomato-light)" strokeWidth="3" />
    <path d="M165 194a23 23 0 0 1 36 12l-24 15Z" fill="var(--lime)" stroke="var(--greens)" strokeWidth="3" /><path d="m177 216 4-21m-4 21 15-12" stroke="var(--plate)" strokeWidth="2" />
    <g fill="var(--greens)"><ellipse cx="182" cy="94" rx="6" ry="3" transform="rotate(-30 182 94)" /><ellipse cx="154" cy="157" rx="6" ry="3" /><ellipse cx="223" cy="117" rx="6" ry="3" transform="rotate(30 223 117)" /></g>
  </svg>;
}

function App() {
  const [tab, setTab] = useState('discover');
  const [config, setConfig] = useState(null);
  const [places, setPlaces] = useState([]);
  const [demo, setDemo] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState(5);
  const [price, setPrice] = useState('any');
  const [portionOnly, setPortionOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState('value');
  const [expanded, setExpanded] = useState(null);
  const [savedIds, setSavedIds] = useState(() => { try { const ids = JSON.parse(localStorage.getItem('platewise-saved') || '[]'); return Array.isArray(ids) ? ids.filter(x => typeof x === 'string' && /^[\w-]{1,255}$/.test(x)).slice(0,12) : []; } catch { return []; } });
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState(null);
  const dialogRef = useRef(null);
  const requestRef = useRef(0);
  const [installEvent, setInstallEvent] = useState(null);
  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(setConfig).catch(() => setConfig({ live: false, unavailable: true })); const handler = e => { e.preventDefault(); setInstallEvent(e); }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler); }, []);
  useEffect(() => { if (dialog) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [dialog]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  async function api(path, body) { const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw Error(data.error || 'Search is unavailable. Please try again.'); return data; }
  function showDemo() { requestRef.current++; setLoading(false); setDemo(true); setPlaces(demoPlaces); setSearched(true); setError(''); setTab('discover'); setExpanded(null); }
  async function search() {
    const request = ++requestRef.current;
    setError(''); setTab('discover');
    if (!config?.live) { setError(config?.unavailable ? 'The search service cannot be reached. Please refresh and try again.' : 'Live search needs a Google Places key. Explore the clearly labeled sample while it’s being connected.'); return; }
    if (!navigator.geolocation) { setError('This browser does not support location. Open Platewise in Chrome on your phone.'); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (request !== requestRef.current) return;
      try { const result = await api('/api/search', { latitude: coords.latitude, longitude: coords.longitude, radius }); if (request !== requestRef.current) return; setPlaces(result.places); setDemo(false); setSearched(true); setExpanded(null); }
      catch (e) { if (request === requestRef.current) setError(e.message); }
      finally { if (request === requestRef.current) setLoading(false); }
    }, e => { if (request !== requestRef.current) return; setLoading(false); setError(e.code === 1 ? 'Location is off. Allow location in Chrome’s site settings, then try again. Your location is only used for this search.' : 'We couldn’t get your location. Check your phone’s location setting and try again.'); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }
  function toggleSave(place) {
    if (place.demo) { setToast('Sample places can’t be saved. Try live search once connected.'); return; }
    if (!savedIds.includes(place.id) && savedIds.length >= 12) { setToast('You can save up to 12 places. Remove one first.'); return; }
    const next = savedIds.includes(place.id) ? savedIds.filter(id => id !== place.id) : [...savedIds, place.id];
    setSavedIds(next); setSavedPlaces(current => current.filter(p => next.includes(p.id)));
    try { localStorage.setItem('platewise-saved', JSON.stringify(next)); } catch { setToast('Storage is unavailable. Saved places will only last this visit.'); }
  }
  async function navigate(next) {
    setTab(next); setError(''); setExpanded(null);
    if (next !== 'saved') return;
    const request = ++requestRef.current;
    setLoading(false); if (!savedIds.length) { setSavedPlaces([]); return; }
    setLoading(true);
    try { const result = await api('/api/saved', { ids: savedIds }); if (request === requestRef.current) setSavedPlaces(result.places); }
    catch (e) { if (request === requestRef.current) setError(e.message); }
    finally { if (request === requestRef.current) setLoading(false); }
  }
  async function install() { if (installEvent) { await installEvent.prompt(); setInstallEvent(null); } else setDialog('install'); }
  const visible = (tab === 'saved' ? savedPlaces : places).filter(p => (price === 'any' || (p.price !== null && p.price <= Number(price))) && (!portionOnly || p.portion) && (!openOnly || p.open === true)).toSorted((a,b) => sort === 'distance' ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : Number(Boolean(b.portion)) - Number(Boolean(a.portion)) || Number(Boolean(b.value)) - Number(Boolean(a.value)) || (a.price ?? 5) - (b.price ?? 5));
  const filterCount = Number(price !== 'any') + Number(portionOnly) + Number(openOnly);

  return <div className="app-shell">
    <header className="header"><a href="/" className="wordmark" aria-label="Platewise home"><span className="logo-mark"><Icon as={Utensils} size={21} /></span>platewise<span className="wordmark-dot">.</span></a><button className="icon-button" aria-label="Add Platewise to your home screen" onClick={install}><Icon as={Smartphone} /></button></header>
    <main>
      {tab === 'discover' && <>
        <section className={`hero ${searched ? 'compact' : ''}`}>
          <div className="eyebrow"><span /> A GOOD MEAL GOES A LONG WAY</div>
          <h1>Big appetite.<br />Better <span>finds.</span></h1>
          <p className="hero-copy">Meat on the menu. More on your plate.<br />Find nearby meals worth going out for.</p>
          {!searched && <div className="hero-visual"><div className="visual-note note-one"><span className="note-icon"><Icon as={Heart} size={17}/></span> Full plate, happy wallet.</div><PlateArt /><span className="hand-note">your next good meal ↗</span><div className="visual-note note-two"><Icon as={Utensils} size={15}/> Made for meat lovers</div></div>}
        </section>
        <section className="search-box" aria-label="Find restaurants">
          <div className="location-row"><span className="location-pin"><Icon as={MapPin} size={18}/></span><div><strong>Good food, close by</strong><small>Use your phone’s current location</small></div><label className="radius-select"><span className="sr-only">Search radius</span><select value={radius} onChange={e => setRadius(Number(e.target.value))}>{[2,5,10,20].map(n => <option key={n} value={n}>{n} km</option>)}</select><Icon as={ChevronDown} size={14}/></label></div>
          <button className="primary-button find-button" onClick={search} disabled={loading || !config}><Icon as={loading ? LoaderCircle : Crosshair} className={loading ? 'spin' : ''}/>{loading ? 'Finding your next meal…' : 'Find food near me'}{!loading && <Icon as={ArrowRight} size={19}/>}</button>
          <p className="privacy-hint">Your location is used for this search, never saved.</p>
        </section>
        {error && <div className="error-box" role="alert"><Icon as={Info}/><div>{error}{!config?.live && <button className="text-button" onClick={showDemo}>Explore sample places <Icon as={ArrowRight} size={14}/></button>}</div></div>}
        {!searched && <>
          <div className="preview-link"><span>Just looking around?</span><button className="text-button" onClick={showDemo}>Try the sample <Icon as={ArrowRight} size={15}/></button></div>
          <section className="promise-section"><div className="section-heading"><h2>A little pickier.<br />A lot more satisfying.</h2><span className="asterisk">✳</span></div><div className="promise-grid"><div><span>01</span><h3>Meat-friendly</h3><p>Cuisine and review clues for your kind of meal.</p></div><div><span>02</span><h3>Value-minded</h3><p>Price levels and real words about generous portions.</p></div></div><button className="method-link" onClick={() => setDialog('method')}>No mystery scores. See how we pick <Icon as={ArrowRight} size={14}/></button></section>
        </>}
      </>}
      {tab === 'saved' && <section className="page-intro"><div className="eyebrow">YOUR NEXT GOOD MEAL</div><h1>Worth keeping.</h1><p>Your shortlist, ready when you’re hungry.</p></section>}
      {(tab === 'saved' || (tab === 'discover' && searched)) && <section className="results" aria-label="Restaurant results">
        {demo && tab === 'discover' && <div className="demo-banner"><Icon as={Sparkles} size={18}/><div><strong>A taste of Platewise</strong><p>Fictional sample places, reviews, and distances. Not live recommendations.</p></div><button className="icon-button" aria-label="Close sample" onClick={() => { setDemo(false); setSearched(false); setPlaces([]); }}><Icon as={X} size={17}/></button></div>}
        <div className="results-title"><div><div className="eyebrow">{tab === 'saved' ? 'SAVED FOR LATER' : demo ? 'THE SAMPLE SHORTLIST' : 'YOUR NEARBY SHORTLIST'}</div><h2>{visible.length} {visible.length === 1 ? 'good find' : 'good finds'}<span className="result-dot">.</span></h2></div><button className={`filter-button ${filterCount ? 'active' : ''}`} onClick={() => setDialog('filters')}><Icon as={SlidersHorizontal} size={17}/> Filters{filterCount > 0 && <span>{filterCount}</span>}</button></div>
        <div className="results-meta"><span><Icon as={Utensils} size={13}/> Meat clues included</span><label><Icon as={ArrowDownWideNarrow} size={14}/><span className="sr-only">Sort restaurants</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="value">Value first</option><option value="distance">Nearest first</option><option value="rating">Top rated</option></select><Icon as={ChevronDown} size={12}/></label></div>
        {tab === 'saved' && error && <div className="error-box" role="alert">{error}</div>}
        {loading && tab === 'saved' ? <div className="empty-state" role="status"><Icon as={LoaderCircle} className="spin"/><h3>Refreshing your saved places…</h3></div> : <div className="card-list">{visible.map((p,index) => <article className="restaurant-card" key={p.id}>
          <div className="card-top"><div className={`food-thumb thumb-${index%4}`}><PlateArt variant={p.art} small/></div><div className="card-title"><span className="card-category">{p.category}{p.distance !== null && p.distance !== undefined && <> <span>·</span> {p.distance.toFixed(1)} km</>}</span><h3>{p.name}</h3><div className="rating-row"><Icon as={Star} size={13}/><strong>{p.rating ?? 'New'}</strong><span>({p.reviewCount.toLocaleString()})</span><span className="meta-divider">·</span><span>{p.price === null ? 'Price unknown' : p.price === 0 ? 'Free' : '$'.repeat(p.price)}</span>{p.open !== null && <span className={p.open ? 'open-status' : 'closed-status'}>{p.open ? 'Open now' : 'Closed now'}</span>}</div></div><button className={`save-button ${savedIds.includes(p.id) ? 'is-saved' : ''}`} aria-label={`${savedIds.includes(p.id) ? 'Unsave' : 'Save'} ${p.name}`} aria-pressed={savedIds.includes(p.id)} onClick={() => toggleSave(p)}><Icon as={Bookmark} size={20}/></button></div>
          <div className="evidence-tags">{p.portion && <span><Icon as={Utensils} size={12}/> Portion mention</span>}{p.value ? <span><Icon as={Check} size={12}/> Value mention</span> : p.price !== null && p.price <= 2 && <span><Icon as={Check} size={12}/> Lower price level</span>}</div>
          {(p.portion || p.value) && <blockquote>“{(p.portion || p.value).text}”<cite>{(p.portion || p.value).authorUrl ? <a href={(p.portion || p.value).authorUrl} target="_blank" rel="noreferrer">{(p.portion || p.value).author}</a> : (p.portion || p.value).author} · {p.demo ? 'Sample review' : 'Google Maps'}{(p.portion || p.value).time && <> · {(p.portion || p.value).time}</>}</cite></blockquote>}
          <div className="card-actions"><button className="text-button why-button" onClick={() => setExpanded(expanded === p.id ? null : p.id)} aria-expanded={expanded === p.id}>Why this find <Icon as={ChevronDown} size={14} className={expanded === p.id ? 'rotate' : ''}/></button>{p.demo ? <span className="sample-label">Sample place</span> : <a className="directions-link" href={p.mapsUrl} target="_blank" rel="noreferrer">Google Maps <Icon as={ExternalLink} size={14}/></a>}</div>
          {expanded === p.id && <div className="why-panel"><p><strong>Meat clue:</strong> {p.meatReason}. Check the current menu before going.</p><p><strong>Value clue:</strong> {p.portion ? 'A positive review mentions portion size.' : p.value ? 'A positive review mentions value.' : 'A lower price level and a rating of at least 4.0. Portion size is not verified.'}</p><p>{p.address}</p>{(p.portion || p.value)?.url && <a href={(p.portion || p.value).url} target="_blank" rel="noreferrer">Read review on Google Maps <Icon as={ExternalLink} size={12}/></a>}{p.attributions?.map((a,i) => <a key={i} href={a.providerUri} target="_blank" rel="noreferrer">{a.provider}</a>)}</div>}
        </article>)}</div>}
        {!visible.length && !loading && <div className="empty-state"><Icon as={tab === 'saved' ? Bookmark : Compass} size={32}/><h3>{tab === 'saved' && !savedIds.length ? 'Keep a good find for later.' : 'No matches in this shortlist.'}</h3><p>{tab === 'saved' && !savedIds.length ? 'Tap the bookmark on a live restaurant to save it here.' : 'Try clearing filters or searching a wider area. We won’t invent a match.'}</p>{filterCount > 0 && <button className="text-button" onClick={() => { setPrice('any'); setPortionOnly(false); setOpenOnly(false); }}>Clear filters</button>}</div>}
        {visible.length > 0 && <p className="results-disclaimer">{demo ? 'Illustrations and all sample content are for preview only.' : <>Restaurant information by <span className="google-attribution" translate="no">Google Maps</span>. Up to 20 search results checked; not every restaurant nearby. Reviews are limited and subjective. Prices and menus may change.</>}</p>}
      </section>}
      {tab === 'about' && <section className="about-page"><div className="eyebrow">GOOD FOOD, NO GUESSWORK</div><h1>A fuller plate.<br />A clearer picture.</h1><PlateArt/><h2>Clues, not promises.</h2><p>Platewise looks for nearby restaurants with meat clues and signs of good value. We show what we found so you can make the call.</p><button className="about-row" onClick={() => setDialog('method')}><Icon as={Info}/><span>How we pick places</span><Icon as={ArrowRight}/></button><button className="about-row" onClick={install}><Icon as={Smartphone}/><span>Add to your home screen</span><Icon as={Plus}/></button><button className="about-row" onClick={() => setDialog('privacy')}><Icon as={Heart}/><span>Privacy & terms</span><Icon as={ArrowRight}/></button><a className="about-row" href="https://app.devin.ai/sessions/af400a3b75ac438080ce7a48f303f637" target="_blank" rel="noreferrer"><Icon as={Sparkles}/><span>Suggest a better Platewise</span><Icon as={ExternalLink}/></a><p className="connection-note"><span className={config?.live ? 'status-dot connected' : 'status-dot'}/>{config?.live ? 'Live Google Places search connected' : config?.unavailable ? 'Search service unreachable' : 'Sample available · live search awaiting setup'}</p></section>}
      <footer className="footer"><span>Eat well. Spend wisely.</span><button onClick={() => setDialog('privacy')}>Privacy & terms</button></footer>
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{[['discover',Compass,'Discover'],['saved',Bookmark,'Saved'],['about',Info,'About']].map(([key,icon,label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => navigate(key)} aria-current={tab === key ? 'page' : undefined}><Icon as={icon} size={21}/><span>{label}</span>{key === 'saved' && savedIds.length > 0 && <i>{savedIds.length}</i>}</button>)}</nav>
    {toast && <div className="toast" role="status">{toast}</div>}
    <dialog ref={dialogRef} onCancel={() => setDialog(null)} onClick={e => { if (e.target === dialogRef.current) setDialog(null); }}><div className="dialog-content"><div className="dialog-header"><span className="eyebrow">PLATEWISE</span><button className="icon-button" aria-label="Close dialog" onClick={() => setDialog(null)}><Icon as={X}/></button></div>
      {dialog === 'install' && <><span className="dialog-illustration"><Icon as={Smartphone} size={36}/></span><h2>A good find.<br />One tap away.</h2><p>Open this page in <strong>Chrome on your Android phone</strong>, then:</p><ol><li>Tap Chrome’s three-dot menu <strong>⋮</strong>.</li><li>Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li><li>Confirm <strong>Platewise</strong>.</li></ol><p className="small-copy">The app needs an internet connection and your Devin sign-in. Home-screen installation varies by browser; offline search is not supported.</p><button className="primary-button" onClick={() => setDialog(null)}>Got it <Icon as={Check} size={18}/></button></>}
      {dialog === 'method' && <><h2>Good clues.<br />No magic score.</h2><h3>First, meat on the menu.</h3><p>We look for meat-specific cuisine types, restaurant names, or positive reviews mentioning meat. This is a clue, not a verified current menu.</p><h3>Then, signs of value.</h3><p>Positive reviews mentioning generous portions or good value come first. We also include places with a lower Google price level and a rating of 4.0 or higher, labeled separately.</p><h3>What we don’t know.</h3><p>There’s no reliable portion-per-dollar database. Google provides only a small review sample, so we can miss great places. We show attributed review text, not a made-up portion score. Dollar symbols are relative price levels, not exact meal prices.</p><p>Distance is straight-line, not walking or driving distance. A search checks up to 20 Google results within your chosen radius.</p></>}
      {dialog === 'privacy' && <><h2>Your location.<br />Just for lunch.</h2><h3>Privacy</h3><p>Location is requested only when you tap “Find food near me.” Coordinates are sent to our server and Google Places to find nearby restaurants. Platewise does not store your coordinates, restaurant content, or reviews. Hosting and Google may process technical request information under their own policies.</p><p>Saved place IDs stay in this browser. They don’t sync across devices. Reopening Saved fetches fresh restaurant information. No analytics or advertising trackers are included.</p><h3>Terms</h3><p>This personal app provides suggestions, not guarantees about availability, prices, portions, dietary suitability, or opening hours. Confirm with the restaurant. Use of Google content is subject to <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Google’s Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p><button className="text-button danger" onClick={() => { setSavedIds([]); setSavedPlaces([]); try { localStorage.removeItem('platewise-saved'); } catch {} setToast('Saved places cleared.'); }}>Clear saved places</button></>}
      {dialog === 'filters' && <><h2>Your kind of find.</h2><p>Filters narrow this shortlist, without another search.</p><fieldset><legend>Price level</legend><div className="price-options">{[['any','Any'],['1','$'],['2','Up to $$']].map(([value,label]) => <button key={value} className={price === value ? 'active' : ''} onClick={() => setPrice(value)} aria-pressed={price === value}>{label}</button>)}</div></fieldset><label className="toggle-row"><span><strong>Portion mentions only</strong><small>A positive review mentions a generous serving.</small></span><input type="checkbox" checked={portionOnly} onChange={e => setPortionOnly(e.target.checked)}/></label><label className="toggle-row"><span><strong>Open now</strong><small>Exclude unknown or closed opening hours.</small></span><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)}/></label><button className="primary-button" onClick={() => setDialog(null)}>Show {visible.length} finds <Icon as={ArrowRight} size={18}/></button></>}
    </div></dialog>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
