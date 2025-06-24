export function corsHeaders(requestHeaders: Request["headers"]) {
  return {
    "Access-Control-Allow-Origin": requestHeaders.get("Origin") ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
