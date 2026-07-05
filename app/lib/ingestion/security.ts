export async function fetchGoPlusSecurity(chainId: string, contractAddress: string) {
    try {
        const appKey = process.env.GOPLUS_APP_KEY;
        const appSecret = process.env.GOPLUS_APP_SECRET;
        
        // GoPlus Token Security API
        const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;
        
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };
        
        // Note: GoPlus typically doesn't strictly require API keys for public endpoints,
        // but if they are provided, we should pass them (e.g. as Authorization or custom headers).
        // Actual implementation might vary based on the specific plan.
        if (appKey && appSecret) {
            headers['Authorization'] = `Bearer ${appKey}:${appSecret}`; // Placeholder auth format
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`GoPlus API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // GoPlus returns a map of lowercased contract addresses
        const tokenInfo = data?.result?.[contractAddress.toLowerCase()] || {};
        
        return {
            isHoneypot: tokenInfo.is_honeypot === "1",
            isMintable: tokenInfo.is_mintable === "1",
            isOpenSource: tokenInfo.is_open_source === "1",
            ownerAddress: tokenInfo.owner_address || "",
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchGoPlusSecurity failed for ${contractAddress} on chain ${chainId}:`, error);
        return { isHoneypot: false, isMintable: false, isOpenSource: false, ownerAddress: "", fallback: true };
    }
}

export async function fetchRugCheckScore(contractAddress: string) {
    try {
        const apiKey = process.env.RUGCHECK_API_KEY;
        
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };
        
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        // Note: rugcheck.xyz API endpoint
        const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${contractAddress}/report`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`RugCheck API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            score: data?.score || 0,
            risks: data?.risks?.length || 0,
            isRug: data?.score > 500, // Example threshold
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchRugCheckScore failed for ${contractAddress}:`, error);
        return { score: 0, risks: 0, isRug: false, fallback: true };
    }
}
