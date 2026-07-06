import { DispatcherStrategy } from '../mcts/dispatcher';

export async function fetchGoPlusSecurity(chainId: string, contractAddress: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.goplus?.endpoints?.["/api/v1/token_security"]) {
            console.log("⏭️ [Ingestion] Skipping GoPlus Security fetch (not requested by dispatcher)");
            return { isHoneypot: false, isMintable: false, isOpenSource: false, ownerAddress: "", fallback: false, skipped: true };
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
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`GoPlus API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // GoPlus returns a map of lowercased contract addresses
        const tokenInfo = data?.result?.[contractAddress.toLowerCase()] || {};
        
        const requestedFields = strategy?.goplus?.endpoints?.["/api/v1/token_security"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("is_open_source")) {
            result.isOpenSource = tokenInfo.is_open_source === "1";
        }
        if (!requestedFields || requestedFields.includes("is_proxy")) {
            result.isProxy = tokenInfo.is_proxy === "1";
        }
        if (!requestedFields || requestedFields.includes("is_mintable")) {
            result.isMintable = tokenInfo.is_mintable === "1";
        }
        if (!requestedFields || requestedFields.includes("owner_address")) {
            result.ownerAddress = tokenInfo.owner_address || "";
        }
        if (!requestedFields || requestedFields.includes("hidden_owner")) {
            result.hiddenOwner = tokenInfo.hidden_owner === "1";
        }
        if (!requestedFields || requestedFields.includes("is_honeypot")) {
            result.isHoneypot = tokenInfo.is_honeypot === "1";
        }
        if (!requestedFields || requestedFields.includes("buy_tax")) {
            result.buyTax = tokenInfo.buy_tax || "";
        }
        if (!requestedFields || requestedFields.includes("sell_tax")) {
            result.sellTax = tokenInfo.sell_tax || "";
        }
        if (!requestedFields || requestedFields.includes("holder_count")) {
            result.holderCount = tokenInfo.holder_count || "";
        }
        if (!requestedFields || requestedFields.includes("is_anti_whale")) {
            result.isAntiWhale = tokenInfo.is_anti_whale === "1";
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchGoPlusSecurity failed for ${contractAddress} on chain ${chainId}:`, error);
        return { isHoneypot: false, isMintable: false, isOpenSource: false, ownerAddress: "", fallback: true };
    }
}

export async function fetchRugCheckScore(contractAddress: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.rugcheck?.endpoints?.["/v1/tokens/{mint}/report"]) {
            console.log("⏭️ [Ingestion] Skipping RugCheck Security fetch (not requested by dispatcher)");
            return { score: 0, risks: [], isRug: false, fallback: false, skipped: true };
        }

        const apiKey = process.env.RUGCHECK_API_KEY;
        
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };
        
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${contractAddress}/report`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`RugCheck API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        const requestedFields = strategy?.rugcheck?.endpoints?.["/v1/tokens/{mint}/report"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("score")) {
            result.score = data?.score || 0;
            result.isRug = data?.score > 500;
        }
        if (!requestedFields || requestedFields.includes("rugged")) {
            result.rugged = data?.rugged || false;
        }
        if (!requestedFields || requestedFields.includes("risks")) {
            result.risks = data?.risks || [];
        }
        if (!requestedFields || requestedFields.includes("totalMarketLiquidity")) {
            result.totalMarketLiquidity = data?.totalMarketLiquidity || 0;
        }
        if (!requestedFields || requestedFields.includes("topHolders")) {
            result.topHolders = data?.topHolders || [];
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchRugCheckScore failed for ${contractAddress}:`, error);
        return { score: 0, risks: [], isRug: false, fallback: true };
    }
}
