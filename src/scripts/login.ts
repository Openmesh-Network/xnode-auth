import { getMessage } from "../lib/message";
import { loginStore, setLogin, type LoginMethod } from "../store/login";

export function getRedirect(): string {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("redirect") ?? window.location.origin;
}

export function loginMessage(): {
    domain: string;
    timestamp: number;
    message: string;
} {
    const domain = window.location.hostname;
    const timestamp = Math.round(Date.now() / 1000);
    return {
        domain,
        timestamp,
        message: getMessage({ domain, timestamp }),
    };
}

export async function submitLogin({
    user,
    signature,
    timestamp,
}: {
    user: string;
    signature: string;
    timestamp: number;
}): Promise<void> {
    const res = await fetch("/xnode-auth/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user,
            signature,
            timestamp: timestamp.toString(),
        }),
    });

    if (res.status !== 200) {
        const body = (await res.json().catch(() => undefined)) as
            | { error?: string }
            | undefined;
        throw new Error(body?.error ?? `Login failed (${res.status}).`);
    }

    window.location.href = getRedirect();
}

export function errorText(error: unknown): string {
    if (typeof error === "string") {
        return error;
    }
    if (error && typeof error === "object") {
        if (
            "shortMessage" in error &&
            typeof error.shortMessage === "string"
        ) {
            return error.shortMessage;
        }
        if ("message" in error && typeof error.message === "string") {
            return error.message;
        }
    }
    return "An unknown error occurred.";
}

export async function runLogin(task: () => Promise<void>): Promise<void> {
    setLogin({ busy: true, error: null, status: null });
    try {
        await task();
    } catch (error) {
        console.error(error);
        setLogin({ error: errorText(error), status: null });
    } finally {
        setLogin({ busy: false });
    }
}

export function initLoginShell(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect") ?? window.location.origin;
    const rejected = urlParams.get("rejected");

    const redirectNode = document.getElementById("redirect");
    if (redirectNode) {
        redirectNode.textContent = redirect;
    }

    const tabs = [
        ...document.querySelectorAll<HTMLButtonElement>("[data-login-tab]"),
    ];
    const panels = [
        ...document.querySelectorAll<HTMLElement>("[data-login-method]"),
    ];
    const statusNode = document.getElementById("login-status");
    const statusTextNode = document.getElementById("login-status-text");
    const errorNode = document.getElementById("login-error");

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            if (loginStore.get().busy) {
                return;
            }

            setLogin({
                method: tab.dataset.loginTab as LoginMethod,
                error: null,
                status: null,
            });
        });
    });

    if (rejected) {
        setLogin({ error: rejected });
    }

    loginStore.subscribe((state) => {
        tabs.forEach((tab) => {
            const active = tab.dataset.loginTab === state.method;
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.classList.toggle("bg-blue-950/80", active);
            tab.classList.toggle("text-gray-100", active);
            tab.classList.toggle("text-gray-400", !active);
            tab.classList.toggle("hover:text-gray-200", !active);
            tab.disabled = state.busy;
        });

        panels.forEach((panel) => {
            panel.style.display =
                panel.dataset.loginMethod === state.method ? "flex" : "none";
        });

        if (statusNode) {
            statusNode.style.display = state.status ? "flex" : "none";
        }
        if (statusTextNode) {
            statusTextNode.textContent = state.status ?? "";
        }
        if (errorNode) {
            errorNode.style.display = state.error ? "block" : "none";
            errorNode.textContent = state.error ?? "";
        }

        document
            .querySelectorAll<HTMLButtonElement>("[data-login-action]")
            .forEach((button) => {
                button.disabled = state.busy;
            });
    });
}
