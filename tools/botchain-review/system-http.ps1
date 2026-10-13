param([Parameter(Mandatory=$true)][string]$RequestPath)
# Research-only Windows HTTP client; normal TLS and fixed official RPC URLs.
$ErrorActionPreference = 'Stop'
try {
    $reviewRequest = [IO.File]::ReadAllText($RequestPath) | ConvertFrom-Json
    $reviewUrls = @('https://rpc.botchain.ai', 'https://rpc.bohr.life')
    $reviewMethods = @('eth_chainId','web3_clientVersion','eth_blockNumber','eth_getCode','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getTransactionByHash','eth_call','eth_estimateGas','eth_feeHistory','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getLogs')
    if ($reviewRequest.url -cnotin $reviewUrls -or $reviewRequest.body.method -cnotin $reviewMethods) { throw 'Only official read/simulation requests accepted' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $reviewBody = $reviewRequest.body | ConvertTo-Json -Depth 100 -Compress
    $reviewResult = Invoke-RestMethod -Uri $reviewRequest.url -Method Post -ContentType 'application/json' -Body $reviewBody -TimeoutSec 12 -MaximumRedirection 0
    $reviewResult | ConvertTo-Json -Depth 100 -Compress
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
