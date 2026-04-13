import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "hyperliquid-whales",
  slug: "hyperliquid-whales",
  description: "Track top 50 Hyperliquid trader positions by PnL -- direction, size, leverage, entry price, unrealized PnL.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/positions",
      price: "$0.003",
      description: "Get aggregated whale positions on Hyperliquid",
      toolName: "hyperliquid_track_whale_positions",
      toolDescription: `Use this when you need to see what the top Hyperliquid traders are doing. Returns aggregated positions of the top 50 traders ranked by PnL with full position details.

1. positions: array of whale positions across all coins
2. Each position contains: coin, direction (long/short), sizeUsd, entryPrice, markPrice, unrealizedPnl, leverage, traderAddress
3. summary: aggregated stats -- totalLongUsd, totalShortUsd, netBias (bullish/bearish/neutral)
4. topTraderCount: number of traders analyzed
5. timestamp: data freshness timestamp

Example output: {"positions":[{"coin":"BTC","direction":"long","sizeUsd":4500000,"entryPrice":66800,"markPrice":67450,"unrealizedPnl":145000,"leverage":5.2}],"summary":{"totalLongUsd":89000000,"totalShortUsd":42000000,"netBias":"bullish"},"topTraderCount":50}

Use this BEFORE taking directional trades to see whale consensus. Essential for copy-trading signals, sentiment analysis, and contrarian setups on Hyperliquid.

Do NOT use for order book data -- use hyperliquid_get_market_data. Do NOT use for vault performance -- use hyperliquid_get_vault_data. Do NOT use for Solana tokens -- use solana_scan_new_tokens.`,
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
