import { DispatcherStrategy } from '../mcts/dispatcher';
import {
  type IngestionResult,
  type GoPlusData,
  type RugCheckData,
  ok,
  empty,
  ingestionError,
  notCalled,
} from './types';

// ─────────────────────────────────────────────────────────────
// GoPlus Token Security — EVM chains only
// Returns IngestionResult<GoPlusData> so callers can always
// distinguish "was checked and safe" vs "was never called".
// ─────────────────────────────────────────────────────────────
export async function fetchGoPlusSecurity(
  chainId: string,
  contractAddress: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<GoPlusData>> {
    if (strategy && !strategy.goplus?.endpoints?.['/api/v1/token_security']) {
        console.log('⏭️ [Ingestion] Skipping GoPlus Security fetch (not requested by dispatcher)');
        return notCalled<GoPlusData>();
    }

    const appKey = process.env.GOPLUS_APP_KEY;
    const appSecret = process.env.GOPLUS_APP_SECRET;

    // GoPlus Token Security API
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;

    const headers: Record<string, string> = {
        'Accept': 'application/json'
    };

    if (appKey && appSecret) {
        headers['Authorization'] = `Bearer ${appKey}:${appSecret}`;
    }

    try {
        const response = await fetch(url, { headers });

        if (!response.ok) {
            return ingestionError<GoPlusData>(`GoPlus API responded with status ${response.status}`);
        }

        const data = await response.json();

        // GoPlus returns a map of lowercased contract addresses
        const tokenInfo = data?.result?.[contractAddress.toLowerCase()];
        if (!tokenInfo || Object.keys(tokenInfo).length === 0) {
            return empty<GoPlusData>();
        }

        const requestedFields = strategy?.goplus?.endpoints?.['/api/v1/token_security'];
        const result: GoPlusData = {
            isHoneypot: false,
            isMintable: false,
            isOpenSource: false,
        };

        if (!requestedFields || requestedFields.includes('is_open_source')) {
            result.isOpenSource = tokenInfo.is_open_source === '1';
        }
        if (!requestedFields || requestedFields.includes('is_proxy')) {
            result.isProxy = tokenInfo.is_proxy === '1';
        }
        if (!requestedFields || requestedFields.includes('is_mintable')) {
            result.isMintable = tokenInfo.is_mintable === '1';
        }
        if (!requestedFields || requestedFields.includes('owner_address')) {
            result.ownerAddress = tokenInfo.owner_address || '';
        }
        if (!requestedFields || requestedFields.includes('hidden_owner')) {
            result.hiddenOwner = tokenInfo.hidden_owner === '1';
        }
        if (!requestedFields || requestedFields.includes('is_honeypot')) {
            result.isHoneypot = tokenInfo.is_honeypot === '1';
        }
        if (!requestedFields || requestedFields.includes('buy_tax')) {
            result.buyTax = tokenInfo.buy_tax || '';
        }
        if (!requestedFields || requestedFields.includes('sell_tax')) {
            result.sellTax = tokenInfo.sell_tax || '';
        }
        if (!requestedFields || requestedFields.includes('holder_count')) {
            result.holderCount = tokenInfo.holder_count || '';
        }
        if (!requestedFields || requestedFields.includes('is_anti_whale')) {
            result.isAntiWhale = tokenInfo.is_anti_whale === '1';
        }

        return ok<GoPlusData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchGoPlusSecurity failed for ${contractAddress} on chain ${chainId}:`, msg);
        return ingestionError<GoPlusData>(msg);
    }
}

// ─────────────────────────────────────────────────────────────
// RugCheck — Solana chains only
// Returns IngestionResult<RugCheckData>.
//
// IMPORTANT: The `rugged` flag from RugCheck does NOT by itself
// prove the token is currently rugged. For bonding-curve→DEX
// migration tokens (<7 days old) with healthy current liquidity,
// downstream code MUST significantly downweight this flag.
// ─────────────────────────────────────────────────────────────
export async function fetchRugCheckScore(
  contractAddress: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<RugCheckData>> {
    if (strategy && !strategy.rugcheck?.endpoints?.['/v1/tokens/{mint}/report']) {
        console.log('⏭️ [Ingestion] Skipping RugCheck Security fetch (not requested by dispatcher)');
        return notCalled<RugCheckData>();
    }

    const apiKey = process.env.RUGCHECK_API_KEY;

    const headers: Record<string, string> = {
        'Accept': 'application/json'
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${contractAddress}/report`, {
            headers
        });

        if (!response.ok) {
            return ingestionError<RugCheckData>(`RugCheck API responded with status ${response.status}`);
        }

        const data = await response.json();
        if (!data || typeof data.score === 'undefined') {
            return empty<RugCheckData>();
        }

        const requestedFields = strategy?.rugcheck?.endpoints?.['/v1/tokens/{mint}/report'];
        const result: RugCheckData = {
            score: 0,
            isRug: false,
            risks: [],
        };

        if (!requestedFields || requestedFields.includes('score')) {
            result.score = data?.score ?? 0;
            result.isRug = (data?.score ?? 0) > 500;
        }
        if (!requestedFields || requestedFields.includes('rugged')) {
            result.rugged = data?.rugged ?? false;
        }
        if (!requestedFields || requestedFields.includes('risks')) {
            // risks is an array of risk objects — extract names for readability
            result.risks = (data?.risks ?? []).map((r: any) =>
                typeof r === 'string' ? r : (r.name ?? JSON.stringify(r))
            );
        }
        if (!requestedFields || requestedFields.includes('totalMarketLiquidity')) {
            result.totalMarketLiquidity = data?.totalMarketLiquidity ?? 0;
        }
        if (!requestedFields || requestedFields.includes('topHolders')) {
            result.topHolders = data?.topHolders ?? [];
        }

        return ok<RugCheckData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchRugCheckScore failed for ${contractAddress}:`, msg);
        return ingestionError<RugCheckData>(msg);
    }
}
