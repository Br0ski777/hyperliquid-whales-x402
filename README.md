# Hyperliquid Whale Position Tracker API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://hyperliquid-whales.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Track top 50 Hyperliquid trader positions by PnL -- direction, size, leverage, entry price, unrealized PnL. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "hyperliquid-whales": {
      "url": "https://hyperliquid-whales.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://hyperliquid-whales.api.klymax402.com/api/positions"
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `hyperliquid_track_whale_positions` | GET | `/api/positions` | $0.008 | Get aggregated whale positions on Hyperliquid |

### `hyperliquid_track_whale_positions`

Use this when you need to see what the top Hyperliquid traders are doing. Returns aggregated positions of the top 50 traders ranked by PnL with full position details.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `coin` | string | no | Filter by coin symbol (e.g. BTC, ETH, SOL). Optional — returns all coins if omitted. |

**Returns**

- `positions` -- array of whale positions across all coins
- `summary` -- aggregated stats -- totalLongUsd, totalShortUsd, netBias (bullish/bearish/neutral)
- `topTraderCount` -- number of traders analyzed
- `timestamp` -- data freshness timestamp

Example response:

```json
{"positions":[{"coin":"BTC","direction":"long","sizeUsd":4500000,"entryPrice":66800,"markPrice":67450,"unrealizedPnl":145000,"leverage":5.2}],"summary":{"totalLongUsd":89000000,"totalShortUsd":42000000,"netBias":"bullish"},"topTraderCount":50}
```

**When to use**: taking directional trades to see whale consensus. Essential for copy-trading signals, sentiment analysis, and contrarian setups on Hyperliquid.

## Example agent prompts

- "See what the top Hyperliquid traders are doing"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
