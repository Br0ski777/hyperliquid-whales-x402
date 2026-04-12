import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "hyperliquid-whales",
  slug: "hyperliquid-whales",
  description: "Track aggregated top trader positions on Hyperliquid by PnL.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/positions",
      price: "$0.003",
      description: "Get aggregated whale positions on Hyperliquid",
      toolName: "hyperliquid_track_whale_positions",
      toolDescription: "Use this when you need to see what top Hyperliquid traders are doing. Returns aggregated positions of top 50 traders by PnL: coin, direction (long/short), size, entry price, unrealized PnL, leverage. Do NOT use for order book data — use hyperliquid_get_market_data. Do NOT use for funding rates — use perp_get_funding_rates.",
      inputSchema: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description: "Filter by coin symbol (e.g. BTC, ETH, SOL). Optional — returns all coins if omitted.",
          },
        },
        required: [],
      },
    },
  ],
};
