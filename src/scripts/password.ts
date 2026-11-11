export async function hmacSha256Hex(
    key: string,
    message: string,
): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(key),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"],
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            new TextEncoder().encode(message),
        ),
    );

    return [...signature]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
