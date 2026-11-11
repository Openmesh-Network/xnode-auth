import { p256 } from "@noble/curves/p256";

const CACHE_PREFIX = "xnode-auth:passkey:";
const SPKI_PREFIX = hexToBytes(
    "3059301306072a8648ce3d020106082a8648ce3d03010703420004",
);

export interface CachedPasskey {
    credentialId: string;
    user: string;
}

export function base64url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function fromBase64url(value: string): Uint8Array {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from(hex.match(/../g) ?? [], (byte) =>
        parseInt(byte, 16),
    );
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const length = arrays.reduce((sum, array) => sum + array.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }
    return result;
}

type CredentialId = Uint8Array | ArrayBuffer;

function toArrayBuffer(value: CredentialId): ArrayBuffer {
    if (value instanceof ArrayBuffer) {
        return value;
    }

    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.buffer;
}

function randomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
}

export function randomChallenge(): Uint8Array {
    return randomBytes(32);
}

export function isNotAllowed(error: unknown): boolean {
    return error instanceof DOMException && error.name === "NotAllowedError";
}

export function passkeysSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        window.isSecureContext &&
        typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.credentials !== "undefined"
    );
}

export async function getAssertion({
    challenge,
    allowCredentials = [],
}: {
    challenge: Uint8Array;
    allowCredentials?: { type: "public-key"; id: CredentialId }[];
}): Promise<PublicKeyCredential> {
    const credential = await navigator.credentials.get({
        publicKey: {
            challenge: toArrayBuffer(challenge),
            rpId: window.location.hostname,
            allowCredentials: allowCredentials.map((credential) => ({
                type: "public-key",
                id: toArrayBuffer(credential.id),
            })),
            userVerification: "preferred",
            timeout: 60000,
        },
    });

    if (!credential) {
        throw new Error("Passkey request was cancelled.");
    }

    return credential as PublicKeyCredential;
}

export async function createPasskey(): Promise<{
    credential: PublicKeyCredential;
    credentialId: string;
    user: string;
}> {
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: toArrayBuffer(randomChallenge()),
            rp: {
                id: window.location.hostname,
                name: "Xnode Auth",
            },
            user: {
                id: toArrayBuffer(randomBytes(32)),
                name: "xnode-auth",
                displayName: "Xnode Auth",
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
                residentKey: "required",
                userVerification: "preferred",
            },
            attestation: "none",
            timeout: 60000,
        },
    });

    if (!credential) {
        throw new Error("Passkey creation was cancelled.");
    }

    const publicKeyCredential = credential as PublicKeyCredential;
    const response =
        publicKeyCredential.response as AuthenticatorAttestationResponse;
    const spki = getAttestationSpki(response);

    return {
        credential: publicKeyCredential,
        credentialId: base64url(new Uint8Array(publicKeyCredential.rawId)),
        user: `passkey:${base64url(spki)}`,
    };
}

export async function recoverCandidates(
    assertion: PublicKeyCredential,
): Promise<string[]> {
    const response = assertion.response as AuthenticatorAssertionResponse;
    const authenticatorData = new Uint8Array(response.authenticatorData);
    const clientDataJSON = new Uint8Array(response.clientDataJSON);
    const signature = new Uint8Array(response.signature);

    const clientDataHash = new Uint8Array(
        await crypto.subtle.digest("SHA-256", toArrayBuffer(clientDataJSON)),
    );
    const messageHash = new Uint8Array(
        await crypto.subtle.digest(
            "SHA-256",
            toArrayBuffer(concatBytes(authenticatorData, clientDataHash)),
        ),
    );

    return recoverCandidatesFromSignature(signature, messageHash);
}

export function recoverCandidatesFromSignature(
    signature: Uint8Array,
    messageHash: Uint8Array,
): string[] {
    let parsed;
    try {
        parsed = p256.Signature.fromDER(signature);
    } catch (error) {
        if (signature.length === 64) {
            parsed = p256.Signature.fromCompact(signature);
        } else {
            throw error;
        }
    }

    const candidates = new Set<string>();
    for (let recovery = 0; recovery < 4; recovery++) {
        try {
            const point = parsed
                .addRecoveryBit(recovery)
                .recoverPublicKey(messageHash);
            const raw = point.toRawBytes(false);
            candidates.add(
                base64url(concatBytes(SPKI_PREFIX, raw.subarray(1))),
            );
        } catch {
            // This recovery id is not valid for the signature.
        }
    }

    return [...candidates];
}

export function intersectCandidates(
    first: string[],
    second: string[],
): string[] {
    const secondSet = new Set(second);
    return [
        ...new Set(first.filter((candidate) => secondSet.has(candidate))),
    ];
}

export function assertionToLoginSignature(
    assertion: PublicKeyCredential,
    message: string,
): string {
    const response = assertion.response as AuthenticatorAssertionResponse;
    const clientData = JSON.parse(
        new TextDecoder().decode(response.clientDataJSON),
    ) as {
        challenge?: string;
        type?: string;
    };

    if (clientData.type !== "webauthn.get") {
        throw new Error("Unexpected passkey response.");
    }
    if (clientData.challenge !== base64url(new TextEncoder().encode(message))) {
        throw new Error("Passkey challenge mismatch.");
    }

    return JSON.stringify({
        response: {
            authenticatorData: base64url(
                new Uint8Array(response.authenticatorData),
            ),
            clientDataJSON: base64url(
                new Uint8Array(response.clientDataJSON),
            ),
            signature: base64url(new Uint8Array(response.signature)),
        },
    });
}

function cacheKey(): string {
    return `${CACHE_PREFIX}${window.location.hostname}`;
}

export function readCachedPasskey(): CachedPasskey | null {
    try {
        const value = localStorage.getItem(cacheKey());
        if (!value) {
            return null;
        }

        const parsed = JSON.parse(value) as Partial<CachedPasskey>;
        if (
            typeof parsed.credentialId !== "string" ||
            typeof parsed.user !== "string" ||
            !parsed.user.startsWith("passkey:")
        ) {
            return null;
        }

        return {
            credentialId: parsed.credentialId,
            user: parsed.user,
        };
    } catch {
        return null;
    }
}

export function writeCachedPasskey(passkey: CachedPasskey): void {
    try {
        localStorage.setItem(cacheKey(), JSON.stringify(passkey));
    } catch {
        // Ignore storage failures; passkey recovery still works.
    }
}

function getAttestationSpki(
    response: AuthenticatorAttestationResponse,
): Uint8Array {
    if (typeof response.getPublicKey === "function") {
        try {
            const publicKey = response.getPublicKey();
            if (publicKey && publicKey.byteLength > 0) {
                return new Uint8Array(publicKey);
            }
        } catch {
            // Fall back to parsing the attestation object.
        }
    }

    return spkiFromAttestationObject(
        new Uint8Array(response.attestationObject),
    );
}

type CborValue =
    | number
    | string
    | boolean
    | null
    | Uint8Array
    | CborValue[]
    | Map<number | string, CborValue>;

function decodeCbor(
    bytes: Uint8Array,
    offset = 0,
): { value: CborValue; offset: number } {
    const initial = bytes[offset];
    if (initial === undefined) {
        throw new Error("Invalid CBOR data.");
    }

    const major = initial >> 5;
    const additional = initial & 0x1f;
    let cursor = offset + 1;
    let length = additional;

    if (additional === 24) {
        length = bytes[cursor] ?? 0;
        cursor += 1;
    } else if (additional === 25) {
        length = ((bytes[cursor] ?? 0) << 8) | (bytes[cursor + 1] ?? 0);
        cursor += 2;
    } else if (additional === 26) {
        length =
            ((bytes[cursor] ?? 0) << 24) |
            ((bytes[cursor + 1] ?? 0) << 16) |
            ((bytes[cursor + 2] ?? 0) << 8) |
            (bytes[cursor + 3] ?? 0);
        cursor += 4;
    } else if (additional >= 27) {
        throw new Error("Unsupported CBOR length.");
    }

    if (major === 0) {
        return { value: length, offset: cursor };
    }

    if (major === 1) {
        return { value: -1 - length, offset: cursor };
    }

    if (major === 2) {
        if (cursor + length > bytes.length) {
            throw new Error("Invalid CBOR byte string.");
        }
        const value = bytes.slice(cursor, cursor + length);
        return { value, offset: cursor + length };
    }

    if (major === 3) {
        if (cursor + length > bytes.length) {
            throw new Error("Invalid CBOR text string.");
        }
        const value = new TextDecoder().decode(
            bytes.subarray(cursor, cursor + length),
        );
        return { value, offset: cursor + length };
    }

    if (major === 4) {
        const value: CborValue[] = [];
        for (let index = 0; index < length; index++) {
            const item = decodeCbor(bytes, cursor);
            value.push(item.value);
            cursor = item.offset;
        }
        return { value, offset: cursor };
    }

    if (major === 5) {
        const value = new Map<number | string, CborValue>();
        for (let index = 0; index < length; index++) {
            const key = decodeCbor(bytes, cursor);
            cursor = key.offset;
            const item = decodeCbor(bytes, cursor);
            cursor = item.offset;

            if (
                typeof key.value !== "number" &&
                typeof key.value !== "string"
            ) {
                throw new Error("Unsupported CBOR map key.");
            }
            value.set(key.value, item.value);
        }
        return { value, offset: cursor };
    }

    if (major === 6) {
        // Tags are not needed for passkey attestation data.
        return decodeCbor(bytes, cursor);
    }

    if (major === 7) {
        if (additional === 20) {
            return { value: false, offset: cursor };
        }
        if (additional === 21) {
            return { value: true, offset: cursor };
        }
        if (additional === 22) {
            return { value: null, offset: cursor };
        }
    }

    throw new Error("Unsupported CBOR value.");
}

function spkiFromAttestationObject(
    attestationObject: Uint8Array,
): Uint8Array {
    const attestation = decodeCbor(attestationObject).value;
    if (!(attestation instanceof Map)) {
        throw new Error("Invalid passkey attestation.");
    }

    const authData = attestation.get("authData");
    if (!(authData instanceof Uint8Array) || authData.length < 37) {
        throw new Error("Invalid passkey authenticator data.");
    }

    const flags = authData[32] ?? 0;
    if ((flags & 0x40) === 0) {
        throw new Error("Passkey did not include a public key.");
    }

    let offset = 37 + 16;
    if (authData.length < offset + 2) {
        throw new Error("Invalid passkey authenticator data.");
    }

    const credentialIdLength =
        ((authData[offset] ?? 0) << 8) | (authData[offset + 1] ?? 0);
    offset += 2 + credentialIdLength;

    const cose = decodeCbor(authData, offset).value;
    if (!(cose instanceof Map)) {
        throw new Error("Invalid passkey public key.");
    }

    const kty = cose.get(1);
    const alg = cose.get(3);
    const crv = cose.get(-1);
    const x = cose.get(-2);
    const y = cose.get(-3);

    if (
        kty !== 2 ||
        alg !== -7 ||
        crv !== 1 ||
        !(x instanceof Uint8Array) ||
        !(y instanceof Uint8Array) ||
        x.length !== 32 ||
        y.length !== 32
    ) {
        throw new Error(
            "Unsupported passkey key type. Please create an ES256 passkey.",
        );
    }

    return concatBytes(SPKI_PREFIX, x, y);
}
