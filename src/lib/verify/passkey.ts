import { createHash, createPublicKey, verify } from "crypto";

type PasskeyAssertion = {
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  };
};

const bytes = (b64url: string) => Buffer.from(b64url, "base64url");

export async function verifyXnodePasskeyUser({
  user,
  message,
  signature,
}: {
  user: string; // passkey:<base64url SPKI DER public key>
  message: string;
  signature: string; // JSON string of PublicKeyCredential
}): Promise<boolean> {
  try {
    const { response }: PasskeyAssertion = JSON.parse(signature);
    const clientDataJSON = bytes(response.clientDataJSON);

    const { challenge } = JSON.parse(clientDataJSON.toString("utf8"));
    if (challenge !== Buffer.from(message).toString("base64url")) {
      return false;
    }

    const publicKey = createPublicKey({
      key: bytes(user.replace("passkey:", "")),
      format: "der",
      type: "spki",
    });

    return verify(
      publicKey.asymmetricKeyType === "ed25519" ? null : "sha256",
      Buffer.concat([
        bytes(response.authenticatorData),
        createHash("sha256").update(clientDataJSON).digest(),
      ]),
      publicKey,
      bytes(response.signature),
    );
  } catch {
    return false;
  }
}
