import type { Hono } from "hono";

// In-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 60 seconds
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

const HL_API = "https://api.hyperliquid.xyz/info";
const TOP_N_WALLETS = 20;

interface LeaderboardEntry {
  ethAddress: string;
  pnl: string;
  roi: string;
  displayName?: string;
}

interface AssetPosition {
  coin: string;
  szi: string; // signed size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  leverage: { type: string; value: number };
}

interface CoinAggregate {
  coin: string;
  longCount: number;
  shortCount: number;
  totalLongSize: number;
  totalShortSize: number;
  netLongShortRatio: number;
  avgEntryLong: number | null;
  avgEntryShort: number | null;
  totalUnrealizedPnl: number;
  sentiment: "bullish" | "bearish" | "neutral";
  topPositions: {
    wallet: string;
    direction: "long" | "short";
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
    leverage: number;
  }[];
}

async function hlPost(body: Record<string, unknown>): Promise<any> {
  const resp = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Hyperliquid API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

async function fetchTopTraders(): Promise<LeaderboardEntry[]> {
  const cacheKey = "hl_leaderboard";
  const cached = getCached<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  // Fetch leaderboard — top traders by all-time PnL
  const data = await hlPost({ type: "leaderboard", timeWindow: "allTime" });

  // The API returns { leaderboardRows: [...] }
  let rows: any[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data?.leaderboardRows) {
    rows = data.leaderboardRows;
  } else if (data?.rows) {
    rows = data.rows;
  }

  const traders: LeaderboardEntry[] = rows
    .slice(0, TOP_N_WALLETS)
    .map((r: any) => ({
      ethAddress: r.ethAddress || r.user || r.address || "",
      pnl: r.pnl || r.accountValue || "0",
      roi: r.roi || "0",
      displayName: r.displayName || r.name || undefined,
    }))
    .filter((t: LeaderboardEntry) => t.ethAddress);

  setCache(cacheKey, traders);
  return traders;
}

async function fetchPositions(wallet: string): Promise<AssetPosition[]> {
  const cacheKey = `hl_pos_${wallet}`;
  const cached = getCached<AssetPosition[]>(cacheKey);
  if (cached) return cached;

  const data = await hlPost({ type: "clearinghouseState", user: wallet });

  const positions: AssetPosition[] = [];
  const assetPositions = data?.assetPositions || [];

  for (const ap of assetPositions) {
    const pos = ap.position || ap;
    if (!pos.coin || !pos.szi || parseFloat(pos.szi) === 0) continue;

    positions.push({
      coin: pos.coin,
      szi: pos.szi,
      entryPx: pos.entryPx || "0",
      positionValue: pos.positionValue || "0",
      unrealizedPnl: pos.unrealizedPnl || "0",
      leverage: pos.leverage || { type: "cross", value: 1 },
    });
  }

  setCache(cacheKey, positions);
  return positions;
}

async function aggregateWhalePositions(coinFilter?: string): Promise<{
  aggregates: CoinAggregate[];
  totalTraders: number;
  tradersWithPositions: number;
  overallSentiment: string;
}> {
  const cacheKey = `hl_aggregate_${coinFilter || "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const traders = await fetchTopTraders();

  // Fetch positions for each trader (with concurrency limit)
  const allPositions: { wallet: string; positions: AssetPosition[] }[] = [];

  // Batch in groups of 5 to avoid rate limits
  for (let i = 0; i < traders.length; i += 5) {
    const batch = traders.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (t) => ({
        wallet: t.ethAddress,
        positions: await fetchPositions(t.ethAddress),
      }))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.positions.length > 0) {
        allPositions.push(r.value);
      }
    }
  }

  // Aggregate by coin
  const coinData = new Map<
    string,
    {
      longs: { wallet: string; size: number; entry: number; pnl: number; leverage: number }[];
      shorts: { wallet: string; size: number; entry: number; pnl: number; leverage: number }[];
    }
  >();

  for (const { wallet, positions } of allPositions) {
    for (const pos of positions) {
      if (coinFilter && pos.coin.toUpperCase() !== coinFilter.toUpperCase()) continue;

      if (!coinData.has(pos.coin)) {
        coinData.set(pos.coin, { longs: [], shorts: [] });
      }

      const size = parseFloat(pos.szi);
      const entry = parseFloat(pos.entryPx);
      const pnl = parseFloat(pos.unrealizedPnl);
      const lev = typeof pos.leverage === "object" ? pos.leverage.value : 1;
      const absSize = Math.abs(size);

      const posData = {
        wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        size: absSize,
        entry,
        pnl,
        leverage: lev,
      };

      if (size > 0) {
        coinData.get(pos.coin)!.longs.push(posData);
      } else {
        coinData.get(pos.coin)!.shorts.push(posData);
      }
    }
  }

  // Build aggregates
  const aggregates: CoinAggregate[] = [];
  let totalLongs = 0;
  let totalShorts = 0;

  for (const [coin, { longs, shorts }] of coinData) {
    const totalLongSize = longs.reduce((s, l) => s + l.size, 0);
    const totalShortSize = shorts.reduce((s, l) => s + l.size, 0);
    const longCount = longs.length;
    const shortCount = shorts.length;

    totalLongs += longCount;
    totalShorts += shortCount;

    const ratio = totalShortSize > 0 ? parseFloat((totalLongSize / totalShortSize).toFixed(2)) : totalLongSize > 0 ? 999 : 0;

    const avgEntryLong = longCount > 0
      ? parseFloat((longs.reduce((s, l) => s + l.entry * l.size, 0) / totalLongSize).toFixed(2))
      : null;
    const avgEntryShort = shortCount > 0
      ? parseFloat((shorts.reduce((s, l) => s + l.entry * l.size, 0) / totalShortSize).toFixed(2))
      : null;

    const totalPnl = parseFloat(
      ([...longs, ...shorts].reduce((s, p) => s + p.pnl, 0)).toFixed(2)
    );

    const sentiment: "bullish" | "bearish" | "neutral" =
      ratio > 1.5 ? "bullish" : ratio < 0.67 ? "bearish" : "neutral";

    // Top positions by absolute size
    const allPos = [
      ...longs.map((l) => ({ ...l, direction: "long" as const })),
      ...shorts.map((s) => ({ ...s, direction: "short" as const })),
    ].sort((a, b) => b.size - a.size).slice(0, 5);

    const topPositions = allPos.map((p) => ({
      wallet: p.wallet,
      direction: p.direction,
      size: parseFloat(p.size.toFixed(4)),
      entryPrice: p.entry,
      unrealizedPnl: parseFloat(p.pnl.toFixed(2)),
      leverage: p.leverage,
    }));

    aggregates.push({
      coin,
      longCount,
      shortCount,
      totalLongSize: parseFloat(totalLongSize.toFixed(4)),
      totalShortSize: parseFloat(totalShortSize.toFixed(4)),
      netLongShortRatio: ratio,
      avgEntryLong,
      avgEntryShort,
      totalUnrealizedPnl: totalPnl,
      sentiment,
      topPositions,
    });
  }

  // Sort by total position count
  aggregates.sort((a, b) => (b.longCount + b.shortCount) - (a.longCount + a.shortCount));

  const overallSentiment =
    totalLongs > totalShorts * 1.5
      ? "Overall bullish — whales are net long"
      : totalShorts > totalLongs * 1.5
        ? "Overall bearish — whales are net short"
        : "Mixed — no strong directional bias";

  const result = {
    aggregates,
    totalTraders: traders.length,
    tradersWithPositions: allPositions.length,
    overallSentiment,
  };

  setCache(cacheKey, result);
  return result;
}

export function registerRoutes(app: Hono) {
  app.get("/api/positions", async (c) => {
    const coin = c.req.query("coin") || undefined;

    try {
      const result = await aggregateWhalePositions(coin);

      if (result.aggregates.length === 0) {
        return c.json({
          chain: "hyperliquid",
          coinFilter: coin || "all",
          results: 0,
          totalTraders: result.totalTraders,
          tradersWithPositions: result.tradersWithPositions,
          aggregates: [],
          message: coin
            ? `No whale positions found for ${coin.toUpperCase()}. Try without a coin filter to see all positions.`
            : "No whale positions found. The leaderboard may be temporarily unavailable.",
        });
      }

      return c.json({
        chain: "hyperliquid",
        coinFilter: coin?.toUpperCase() || "all",
        results: result.aggregates.length,
        totalTraders: result.totalTraders,
        tradersWithPositions: result.tradersWithPositions,
        overallSentiment: result.overallSentiment,
        cachedFor: "60s",
        timestamp: new Date().toISOString(),
        aggregates: result.aggregates,
      });
    } catch (err: any) {
      return c.json({ error: "Failed to fetch whale positions", details: err.message }, 502);
    }
  });
}
