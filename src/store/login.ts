import { atom } from "nanostores";

export type LoginMethod = "passkey" | "ethereum" | "password";

export interface LoginState {
    method: LoginMethod;
    busy: boolean;
    status: string | null;
    error: string | null;
}

export const DEFAULT_LOGIN_METHODS: LoginMethod[] = [
    "passkey",
    "ethereum",
    "password",
];

export const loginStore = atom<LoginState>({
    method: DEFAULT_LOGIN_METHODS[0],
    busy: false,
    status: null,
    error: null,
});

export function setLogin(partial: Partial<LoginState>) {
    loginStore.set({ ...loginStore.get(), ...partial });
}
