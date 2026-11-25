import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Crosshair,
  ExternalLink,
  Heart,
  Info,
  LoaderCircle,
  MapPin,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import "./styles.css";
import "./results.css";
import { searchNearby, fetchSaved } from "./data.mjs";

const Icon = ({ as: Component, size = 20, ...props }) => (
  <Component size={size} strokeWidth={1.8} aria-hidden="true" {...props} />
);
function PlateArt() {
  return (
    <svg
      className="plate-art"
      viewBox="0 0 360 290"
      role="img"
      aria-label="Illustration of a grilled meat and rice plate, not a restaurant photo"
    >
      <ellipse cx="181" cy="257" rx="125" ry="14" fill="var(--art-shadow)" />
      <ellipse
        cx="180"
        cy="149"
        rx="148"
        ry="111"
        fill="var(--plate-edge)"
        transform="rotate(-12 180 149)"
      />
      <ellipse
        cx="180"
        cy="141"
        rx="148"
        ry="111"
        fill="var(--plate)"
        transform="rotate(-12 180 141)"
      />
      <ellipse
        cx="180"
        cy="141"
        rx="119"
        ry="87"
        fill="var(--plate-inset)"
        transform="rotate(-12 180 141)"
      />
      <path
        d="M171 76C137 52 85 94 88 135c2 33 34 59 64 37 28-20 54-72 19-96Z"
        fill="var(--rice)"
      />
      {Array.from({ length: 13 }, (_, n) => (
        <path
          key={n}
          d={`M${104 + (n % 4) * 15} ${94 + Math.floor(n / 4) * 18}l6 -3`}
          stroke="var(--rice-line)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      <g transform="rotate(-20 220 132)">
        <path
          d="M178 90q45-34 88 4l5 62q-33 38-87 6Z"
          fill="var(--meat-edge)"
        />
        <path d="M181 85q44-30 83 8l3 56q-34 31-78 4Z" fill="var(--meat)" />
        {[0, 1, 2, 3].map((n) => (
          <path
            key={n}
            d={`M${193 + n * 18} 91l-3 57`}
            stroke="var(--grill)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </g>
      <g fill="var(--greens)">
        <circle cx="211" cy="193" r="21" />
        <circle cx="239" cy="177" r="20" />
        <circle cx="261" cy="192" r="15" />
        <circle cx="235" cy="203" r="20" />
      </g>
      <g fill="var(--greens-light)">
        <circle cx="211" cy="186" r="9" />
        <circle cx="238" cy="172" r="9" />
        <circle cx="236" cy="199" r="10" />
      </g>
      <path d="M109 188q25-26 53-2l-25 25Z" fill="var(--tomato)" />
      <path
        d="m138 188 1 15m-12-13 6 11m15-11-5 12"
        stroke="var(--tomato-light)"
        strokeWidth="3"
      />
      <path
        d="M165 194a23 23 0 0 1 36 12l-24 15Z"
        fill="var(--lime)"
        stroke="var(--greens)"
        strokeWidth="3"
      />
      <path
        d="m177 216 4-21m-4 21 15-12"
        stroke="var(--plate)"
        strokeWidth="2"
      />
      <g fill="var(--greens)">
        <ellipse
          cx="182"
          cy="94"
          rx="6"
          ry="3"
          transform="rotate(-30 182 94)"
        />
        <ellipse cx="154" cy="157" rx="6" ry="3" />
        <ellipse cx="223" cy="117" rx="6" ry="3" />
      </g>
    </svg>
  );
}

function App() {
  const [tab, setTab] = useState("discover"),
    [places, setPlaces] = useState([]),
    [searched, setSearched] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [radius, setRadius] = useState(2),
    [area, setArea] = useState("Near your location"),
    [sort, setSort] = useState("value");
  const [valueOnly, setValueOnly] = useState(true),
    [meatOnly, setMeatOnly] = useState(false),
    [takeawayOnly, setTakeawayOnly] = useState(false);
  const [expanded, setExpanded] = useState(null),
    [savedPlaces, setSavedPlaces] = useState([]),
    [toast, setToast] = useState("");
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("platewise-osm-saved") || "[]");
      return Array.isArray(v)
        ? v
            .filter(
              (id) =>
                typeof id === "string" &&
                /^(node|way|relation)-[1-9]\d{0,15}$/.test(id),
            )
            .slice(0, 12)
        : [];
    } catch {
      return [];
    }
  });
  const [dialog, setDialog] = useState(
      new URLSearchParams(location.search).get("view") === "privacy"
        ? "privacy"
        : null,
    ),
    [installEvent, setInstallEvent] = useState(null);
  const dialogRef = useRef(null),
    requestRef = useRef(0),
    resultsRef = useRef(null);
  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  async function search(example = false) {
    const request = ++requestRef.current;
    setError("");
    setLoading(true);
    setTab("discover");
    setPlaces([]);
    setSearched(false);
    try {
      let coords;
      if (example) coords = { latitude: 37.7599, longitude: -122.4148 };
      else {
        if (!navigator.geolocation)
          throw Error(
            "Location is unavailable in this browser. Try Chrome on your phone, or explore San Francisco.",
          );
        coords = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p.coords),
            (e) =>
              reject(
                Error(
                  e.code === 1
                    ? "Location is off. Allow location in Chrome’s site settings, then try again. Or explore San Francisco below."
                    : "We couldn’t get your location. Check your phone’s location setting and try again.",
                ),
              ),
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
          ),
        );
      }
      if (request !== requestRef.current) return;
      const data = await searchNearby({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius,
      });
      if (request !== requestRef.current) return;
      setPlaces(data.places);
      setArea(
        example ? "San Francisco · real places" : "Near your current location",
      );
      setSearched(true);
      setExpanded(null);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        }),
      );
    } catch (e) {
      if (request === requestRef.current) setError(e.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }
  function toggleSave(p) {
    if (!savedIds.includes(p.id) && savedIds.length >= 12) {
      setToast("You can save 12 places. Remove one first.");
      return;
    }
    const next = savedIds.includes(p.id)
      ? savedIds.filter((id) => id !== p.id)
      : [...savedIds, p.id];
    setSavedIds(next);
    setSavedPlaces((current) => current.filter((p) => next.includes(p.id)));
    try {
      localStorage.setItem("platewise-osm-saved", JSON.stringify(next));
    } catch {
      setToast("Browser storage is off. Saves will last only this visit.");
    }
  }
  async function navigate(next) {
    const request = ++requestRef.current;
    setTab(next);
    setLoading(false);
    setError("");
    setExpanded(null);
    window.scrollTo(0, 0);
    if (next !== "saved") return;
    if (!savedIds.length) {
      setSavedPlaces([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSaved(savedIds);
      if (request === requestRef.current) setSavedPlaces(data.places);
    } catch (e) {
      if (request === requestRef.current) setError(e.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }
  async function install() {
    if (installEvent) {
      await installEvent.prompt();
      setInstallEvent(null);
    } else setDialog("install");
  }
  function clearSaves() {
    setSavedIds([]);
    setSavedPlaces([]);
    try {
      localStorage.removeItem("platewise-osm-saved");
    } catch {}
    setToast("Saved places cleared.");
  }
  const visible = (tab === "saved" ? savedPlaces : places)
    .filter(
      (p) =>
        (!valueOnly || p.valueHint) &&
        (!meatOnly || p.meatConfidence === "indicated") &&
        (!takeawayOnly || p.takeaway),
    )
    .toSorted((a, b) =>
      sort === "distance"
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
        : Number(b.valueHint) - Number(a.valueHint) ||
          Number(b.casual) - Number(a.casual) ||
          (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
  const filterCount =
    Number(valueOnly) + Number(meatOnly) + Number(takeawayOnly);
  return (
    <div className="app-shell">
      <header className="header">
        <a href="/" className="wordmark" aria-label="Platewise home">
          <span className="logo-mark">
            <Icon as={Utensils} size={21} />
          </span>
          platewise<span className="wordmark-dot">.</span>
        </a>
        <button
          className="icon-button"
          aria-label="Add Platewise to your home screen"
          onClick={install}
        >
          <Icon as={Smartphone} />
        </button>
      </header>
      <main>
        {tab === "discover" && (
          <>
            <section className={`hero ${searched ? "compact" : ""}`}>
              <div className="eyebrow">
                <span /> A GOOD MEAL GOES A LONG WAY
              </div>
              <h1>
                Big appetite.
                <br />
                Better <span>finds.</span>
              </h1>
              <p className="hero-copy">
                Meat-friendly finds. A little more value.
                <br />
                Explore nearby spots with a fuller plate in mind.
              </p>
              {!searched && (
                <div className="hero-visual">
                  <div className="visual-note note-one">
                    <span className="note-icon">
                      <Icon as={Heart} size={17} />
                    </span>
                    Full plate, happy wallet.
                  </div>
                  <PlateArt />
                  <span className="hand-note">your next good meal ↗</span>
                  <div className="visual-note note-two">
                    <Icon as={Utensils} size={15} />
                    Made for meat lovers
                  </div>
                </div>
              )}
            </section>
            <section className="search-box" aria-label="Find restaurants">
              <div className="location-row">
                <span className="location-pin">
                  <Icon as={MapPin} size={18} />
                </span>
                <div>
                  <strong>Good food, close by</strong>
                  <small>Use your phone’s current location</small>
                </div>
                <label className="radius-select">
                  <span className="sr-only">Search radius</span>
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  >
                    {[2, 5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} km
                      </option>
                    ))}
                  </select>
                  <Icon as={ChevronDown} size={14} />
                </label>
              </div>
              <button
                className="primary-button find-button"
                onClick={() => search()}
                disabled={loading}
              >
                <Icon
                  as={loading ? LoaderCircle : Crosshair}
                  className={loading ? "spin" : ""}
                />
                {loading ? "Finding your next meal…" : "Find food near me"}
                {!loading && <Icon as={ArrowRight} size={19} />}
              </button>
              <p className="privacy-hint">
                No API key. Your location is used for this search, never saved.
              </p>
            </section>
            {error && (
              <div className="error-box" role="alert">
                <Icon as={Info} />
                <span>{error}</span>
              </div>
            )}
            <div className="preview-link">
              <span>Not sharing your location?</span>
              <button
                className="text-button"
                onClick={() => search(true)}
                disabled={loading}
              >
                Explore San Francisco <Icon as={ArrowRight} size={15} />
              </button>
            </div>
            {!searched && (
              <section className="promise-section">
                <div className="section-heading">
                  <h2>
                    A little pickier.
                    <br />A lot more satisfying.
                  </h2>
                  <span className="asterisk">✳</span>
                </div>
                <div className="promise-grid">
                  <div>
                    <span>01</span>
                    <h3>Meat-friendly</h3>
                    <p>Cuisine and map tags point to likely meat options.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <h3>Value-minded</h3>
                    <p>
                      Casual-food clues, not verified prices or portion sizes.
                    </p>
                  </div>
                </div>
                <button
                  className="method-link"
                  onClick={() => setDialog("method")}
                >
                  No mystery scores. See how we pick{" "}
                  <Icon as={ArrowRight} size={14} />
                </button>
              </section>
            )}
          </>
        )}
        {tab === "saved" && (
          <section className="page-intro">
            <div className="eyebrow">YOUR NEXT GOOD MEAL</div>
            <h1>Worth keeping.</h1>
            <p>Your shortlist, ready when you’re hungry.</p>
          </section>
        )}
        {(tab === "saved" || (tab === "discover" && searched)) && (
          <section
            className="results"
            aria-label="Restaurant results"
            ref={resultsRef}
          >
            <div className="demo-banner">
              <Icon as={Info} size={18} />
              <div>
                <strong>Value guesses, not reviews.</strong>
                <p>
                  OpenStreetMap has no diner reviews, prices, or portion sizes.
                  Cuisine and casual formats are clues only.
                </p>
              </div>
            </div>
            <div className="results-title">
              <div>
                <div className="eyebrow">
                  {tab === "saved" ? "SAVED FOR LATER" : area.toUpperCase()}
                </div>
                <h2>
                  {visible.length}{" "}
                  {visible.length === 1 ? "possible find" : "possible finds"}
                  <span className="result-dot">.</span>
                </h2>
              </div>
              <button
                className={`filter-button ${filterCount ? "active" : ""}`}
                onClick={() => setDialog("filters")}
              >
                <Icon as={SlidersHorizontal} size={17} />
                Filters{filterCount > 0 && <span>{filterCount}</span>}
              </button>
            </div>
            <div className="results-meta">
              <span>
                <Icon as={Utensils} size={13} /> Meat clues included
              </span>
              <label>
                <Icon as={ArrowDownWideNarrow} size={14} />
                <span className="sr-only">Sort restaurants</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="value">Value clues first</option>
                  <option value="distance">Nearest first</option>
                </select>
                <Icon as={ChevronDown} size={12} />
              </label>
            </div>
            {tab === "saved" && error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            {loading && tab === "saved" ? (
              <div className="empty-state" role="status">
                <Icon as={LoaderCircle} className="spin" />
                <h3>Refreshing saved places…</h3>
              </div>
            ) : (
              <div className="card-list">
                {visible.map((p, i) => (
                  <article className="restaurant-card" key={p.id}>
                    <div className="card-top">
                      <div className={`food-thumb thumb-${i % 4}`}>
                        <PlateArt />
                      </div>
                      <div className="card-title">
                        <span className="card-category">
                          {p.category}
                          {p.distance !== null && (
                            <> · {p.distance.toFixed(1)} km</>
                          )}
                        </span>
                        <h3>{p.name}</h3>
                        <div className="rating-row">
                          <span>
                            {p.takeaway
                              ? "Takeaway indicated"
                              : "Restaurant listing"}
                          </span>
                          {p.hours && (
                            <>
                              <span>·</span>
                              <span>Hours mapped</span>
                            </>
                          )}
                          {p.closed && (
                            <span className="closed-status">May be closed</span>
                          )}
                        </div>
                      </div>
                      <button
                        className={`save-button ${savedIds.includes(p.id) ? "is-saved" : ""}`}
                        aria-label={`${savedIds.includes(p.id) ? "Unsave" : "Save"} ${p.name}`}
                        aria-pressed={savedIds.includes(p.id)}
                        onClick={() => toggleSave(p)}
                      >
                        <Icon as={Bookmark} size={20} />
                      </button>
                    </div>
                    <div className="evidence-tags">
                      <span>
                        <Icon as={Utensils} size={12} />
                        {p.meatConfidence === "indicated"
                          ? "Meat indicated"
                          : "Meat likely"}
                      </span>
                      {p.valueHint ? (
                        <span>
                          <Icon as={Sparkles} size={12} />
                          Value guess
                        </span>
                      ) : (
                        <span>Value unknown</span>
                      )}
                    </div>
                    <p className="value-explanation">{p.valueReason}</p>
                    <p className="unverified-note">
                      Prices & portion sizes unverified.
                    </p>
                    <div className="card-actions">
                      <button
                        className="text-button why-button"
                        aria-expanded={expanded === p.id}
                        onClick={() =>
                          setExpanded(expanded === p.id ? null : p.id)
                        }
                      >
                        Why this find{" "}
                        <Icon
                          as={ChevronDown}
                          size={14}
                          className={expanded === p.id ? "rotate" : ""}
                        />
                      </button>
                      {p.mapsUrl && (
                        <a
                          className="directions-link"
                          href={p.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Directions <Icon as={ExternalLink} size={14} />
                        </a>
                      )}
                    </div>
                    {expanded === p.id && (
                      <div className="why-panel">
                        <p>
                          <strong>Meat clue:</strong> {p.meatReason} Confirm the
                          current menu before going.
                        </p>
                        <p>
                          <strong>Value clue:</strong> {p.valueReason} No diner
                          evidence is available.
                        </p>
                        <p>{p.address}</p>
                        {p.hours && (
                          <p>
                            <strong>Mapped hours:</strong> {p.hours}
                            <br />
                            Not a live open/closed check.
                          </p>
                        )}
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                          View OpenStreetMap listing{" "}
                          <Icon as={ExternalLink} size={12} />
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            {!visible.length && !loading && (
              <div className="empty-state">
                <Icon as={tab === "saved" ? Bookmark : Compass} size={32} />
                <h3>
                  {tab === "saved" && !savedIds.length
                    ? "Keep a good find for later."
                    : "No matches in this shortlist."}
                </h3>
                <p>
                  {tab === "saved" && !savedIds.length
                    ? "Tap a restaurant’s bookmark to save it here."
                    : "Try clearing filters or searching a wider area. Map tags can be incomplete."}
                </p>
                {filterCount > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setValueOnly(false);
                      setMeatOnly(false);
                      setTakeawayOnly(false);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            {tab === "saved" && savedIds.length > 0 && !loading && (
              <button className="text-button" onClick={clearSaves}>
                Clear saved places
              </button>
            )}
            <p className="results-disclaimer">
              Real community map listings, not verified recommendations. Up to
              500 mapped places checked and 40 shortlisted. Distance is
              straight-line. Illustrations are not restaurant photos.
            </p>
          </section>
        )}
        {tab === "about" && (
          <section className="about-page">
            <div className="eyebrow">GOOD FOOD, NO GUESSWORK</div>
            <h1>
              A fuller plate.
              <br />A clearer picture.
            </h1>
            <PlateArt />
            <h2>Clues, not promises.</h2>
            <p>
              Free, no-key OpenStreetMap data. Meat clues and cuisine-based
              value guesses, with no invented reviews, prices, or portion
              scores.
            </p>
            <button className="about-row" onClick={() => setDialog("method")}>
              <Icon as={Info} />
              <span>How we pick places</span>
              <Icon as={ArrowRight} />
            </button>
            <button className="about-row" onClick={install}>
              <Icon as={Smartphone} />
              <span>Add to your home screen</span>
              <Icon as={Plus} />
            </button>
            <button className="about-row" onClick={() => setDialog("privacy")}>
              <Icon as={Heart} />
              <span>Privacy & terms</span>
              <Icon as={ArrowRight} />
            </button>
            <a
              className="about-row"
              href="https://app.devin.ai/sessions/af400a3b75ac438080ce7a48f303f637"
              target="_blank"
              rel="noreferrer"
            >
              <Icon as={Sparkles} />
              <span>Suggest a better Platewise</span>
              <Icon as={ExternalLink} />
            </a>
            <p className="connection-note">
              <span className="status-dot connected" />
              OpenStreetMap · no key required
            </p>
          </section>
        )}
        <footer className="footer">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors · ODbL
          </a>
          <button onClick={() => setDialog("privacy")}>Privacy & terms</button>
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          ["discover", Compass, "Discover"],
          ["saved", Bookmark, "Saved"],
          ["about", Info, "About"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            <Icon as={icon} size={21} />
            <span>{label}</span>
            {key === "saved" && savedIds.length > 0 && <i>{savedIds.length}</i>}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setDialog(null);
        }}
      >
        <div className="dialog-content">
          <div className="dialog-header">
            <span className="eyebrow">PLATEWISE</span>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <Icon as={X} />
            </button>
          </div>
          {dialog === "install" && (
            <>
              <span className="dialog-illustration">
                <Icon as={Smartphone} size={36} />
              </span>
              <h2>
                A good find.
                <br />
                One tap away.
              </h2>
              <p>
                Open this page in <strong>Chrome on your Android phone</strong>,
                then:
              </p>
              <ol>
                <li>
                  Tap Chrome’s three-dot menu <strong>⋮</strong>.
                </li>
                <li>
                  Choose <strong>Add to Home screen</strong> or{" "}
                  <strong>Install app</strong>.
                </li>
                <li>
                  Confirm <strong>Platewise</strong>.
                </li>
              </ol>
              <p className="small-copy">
                Internet is required for search. Installation varies by
                browser; offline search is not supported.
              </p>
              <button
                className="primary-button"
                onClick={() => setDialog(null)}
              >
                Got it <Icon as={Check} size={18} />
              </button>
            </>
          )}
          {dialog === "method" && (
            <>
              <h2>
                Good clues.
                <br />
                No magic score.
              </h2>
              <h3>Meat indicated, or meat likely.</h3>
              <p>
                “Meat indicated” comes from meat-specific cuisine, dietary tags,
                or a restaurant name. “Meat likely” comes from cuisines that
                commonly serve meat. We exclude mapped vegetarian-only and
                vegan-only places. Neither label verifies the current menu.
              </p>
              <h3>Value is a guess.</h3>
              <p>
                Fast food, food courts, buffets, and selected casual cuisines
                get a value clue. They come first; nearer places break ties. A
                value clue says nothing certain about this restaurant’s quality,
                price, or portion size.
              </p>
              <h3>What we don’t know.</h3>
              <p>
                OpenStreetMap has no diner reviews, reliable prices, or portion
                measurements. Tags may be missing or outdated. We do not claim
                these places are known for big portions. Confirm the menu and
                prices before going.
              </p>
              <p>
                A search checks up to 500 mapped food places and shortlists up
                to 40. Distances are straight-line, not travel distances.
                Opening hours, if shown, are raw map data, not a live
                open/closed check. The free map service may occasionally be slow
                or unavailable.
              </p>
            </>
          )}
          {dialog === "privacy" && (
            <>
              <h2>
                Your location.
                <br />
                Just for lunch.
              </h2>
              <h3>Privacy</h3>
              <p>
                Location is requested only when you tap “Find food near me.”
                Coordinates go directly from your browser to the VK Maps Overpass
                service to find nearby OpenStreetMap places. There is no Platewise
                search server. Platewise does not store your search coordinates. Hosting and the map
                service may process request information under their own
                policies.
              </p>
              <p>
                Saved place IDs stay in this browser. They do not sync across
                devices. Opening Saved fetches fresh map listings. No analytics
                or advertising trackers are included.
              </p>
              <h3>Terms & data</h3>
              <p>
                This personal app offers guesses, not guarantees about prices,
                portions, menus, dietary suitability, opening hours, or
                availability. Confirm with the restaurant. Map data is{" "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  © OpenStreetMap contributors, under ODbL
                </a>
                .
              </p>
              <p>
                Search service:{" "}
                <a
                  href="https://maps.mail.ru/osm/tools/overpass/"
                  target="_blank"
                  rel="noreferrer"
                >
                  VK Maps Overpass
                </a>{" "}
                ·{" "}
                <a
                  href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap privacy
                </a>{" "}
                ·{" "}
                <a
                  href="https://help.mail.ru/legal/terms/common/privacy/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Map provider privacy
                </a>
              </p>
              <button className="text-button danger" onClick={clearSaves}>
                Clear saved places
              </button>
            </>
          )}
          {dialog === "filters" && (
            <>
              <h2>Your kind of find.</h2>
              <p>Filters narrow this shortlist, without another search.</p>
              {[
                [
                  valueOnly,
                  setValueOnly,
                  "Value clues only",
                  "Casual cuisines and formats, not verified prices.",
                ],
                [
                  meatOnly,
                  setMeatOnly,
                  "Stronger meat clues",
                  "Meat-specific tags or names, rather than broad cuisine guesses.",
                ],
                [
                  takeawayOnly,
                  setTakeawayOnly,
                  "Takeaway indicated",
                  "Mapped takeaway or fast-food listings.",
                ],
              ].map(([value, setter, title, description]) => (
                <label className="toggle-row" key={title}>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                  />
                </label>
              ))}
              <button
                className="primary-button"
                onClick={() => setDialog(null)}
              >
                Show {visible.length} finds <Icon as={ArrowRight} size={18} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
