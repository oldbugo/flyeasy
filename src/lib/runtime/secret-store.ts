export type SecretStoreStatus = "not_required" | "planned";

export type SecretStore = {
  deleteSecret(key: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
};

class PlannedSecretStore implements SecretStore {
  async deleteSecret(_key: string) {
    throw new Error("Secret storage is planned but not implemented yet.");
  }

  async getSecret(_key: string): Promise<string | null> {
    throw new Error("Secret storage is planned but not implemented yet.");
  }

  async setSecret(_key: string, _value: string) {
    throw new Error("Secret storage is planned but not implemented yet.");
  }
}

export function createSecretStore(): SecretStore {
  return new PlannedSecretStore();
}

export function getSecretStoreStatus(): SecretStoreStatus {
  return "not_required";
}
