import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nearbyQuery,
  savedQuery,
  normalizePlace,
  selectPlaces,
} from "./places.mjs";
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'", "https://app.devin.ai"],
        upgradeInsecureRequests: null,
      },
    },
    xFrameOptions: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "4kb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/config", (_req, res) =>
  res.json({ live: true, provider: "OpenStreetMap" }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: {
      error: "A few too many searches. Please try again in 15 minutes.",
    },
  }),
);
let busy = false,
  count = 0,
  day = "",
  coolUntil = 0;
async function overpass(query) {
  const today = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    day = today;
    count = 0;
  }
  if (busy || Date.now() < coolUntil)
    throw Object.assign(
      new Error("The map service is busy. Please wait a moment and try again."),
      { status: 503 },
    );
  if (count >= Number(process.env.OSM_DAILY_REQUEST_LIMIT || 100))
    throw Object.assign(
      new Error(
        "Today’s map search limit has been reached. Please try again tomorrow.",
      ),
      { status: 429 },
    );
  busy = true;
  count++;
  try {
    const response = await fetch(
      process.env.OVERPASS_URL ||
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Platewise/1.0 (personal restaurant finder; https://app.devin.ai/sessions/af400a3b75ac438080ce7a48f303f637)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(32000),
      },
    );
    if (!response.ok) {
      if (response.status === 429 || response.status === 406)
        coolUntil = Date.now() + 30000;
      throw Object.assign(
        new Error(
          "The OpenStreetMap search service is busy. Please try again in a minute.",
        ),
        { status: 503 },
      );
    }
    const data = await response.json();
    if (data.remark)
      throw Object.assign(
        new Error(
          "The map query could not finish. Try a smaller search radius.",
        ),
        { status: 503 },
      );
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(
      new Error(
        "The map service didn’t respond in time. Please try again or choose a smaller radius.",
      ),
      { status: 503 },
    );
  } finally {
    busy = false;
  }
}
app.post("/api/search", async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5 } = req.body || {};
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      ![2, 5, 10, 20].includes(radius)
    )
      return res
        .status(400)
        .json({ error: "Please provide a valid location and search radius." });
    const result = await overpass(nearbyQuery(latitude, longitude, radius));
    res.json({
      places: selectPlaces(
        result.elements || [],
        { latitude, longitude },
        radius,
      ),
      scanned: result.elements?.length || 0,
      updated: result.osm3s?.timestamp_osm_base || null,
    });
  } catch (error) {
    next(error);
  }
});
app.post("/api/saved", async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (
      !Array.isArray(ids) ||
      ids.length > 12 ||
      ids.some(
        (id) =>
          typeof id !== "string" ||
          !/^(node|way|relation)-[1-9]\d{0,15}$/.test(id),
      )
    )
      return res
        .status(400)
        .json({ error: "Please provide up to 12 valid saved places." });
    if (!ids.length) return res.json({ places: [] });
    const result = await overpass(savedQuery([...new Set(ids)]));
    res.json({ places: (result.elements || []).map((e) => normalizePlace(e)) });
  } catch (error) {
    next(error);
  }
});
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.use(
  express.static(root, {
    maxAge: "1h",
    setHeaders(res, file) {
      if (file.endsWith("index.html") || file.endsWith(".webmanifest"))
        res.set("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "index.html")));
app.use((error, _req, res, _next) =>
  res
    .status(error.status || 500)
    .json({
      error: error.status
        ? error.message
        : "Something went wrong. Please try again.",
    }),
);
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(`Platewise listening on port ${port}`),
);
