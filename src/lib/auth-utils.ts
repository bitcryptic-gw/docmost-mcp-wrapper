import axios from "axios";

export async function getCollabToken(
  baseUrl: string,
  apiToken: string,
): Promise<string> {
  try {
    const response = await axios.post(
      `${baseUrl}/auth/collab-token`,
      {},
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    // console.error('Collab Token Response:', response.data);
    // Response is wrapped in { data: { token: ... } }
    return response.data.data?.token || response.data.token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Status only. The response body of an auth endpoint can echo back the
      // submitted identity, and this message is surfaced to the MCP client.
      throw new Error(
        `Failed to get collab token: ${error.response?.status} ${error.response?.statusText}`,
      );
    }
    throw error;
  }
}

export async function performLogin(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  try {
    const response = await axios.post(`${baseUrl}/auth/login`, {
      email,
      password,
    });

    // Extract token from Set-Cookie header
    const cookies = response.headers["set-cookie"];
    if (!cookies) {
      throw new Error("No Set-Cookie header found in login response");
    }
    const authCookie = cookies.find((c: string) => c.startsWith("authToken="));
    if (!authCookie) {
      throw new Error("No authToken cookie found in login response");
    }

    const token = authCookie.split(";")[0].split("=")[1];
    return token;
  } catch (error: any) {
    // Log the status, not the response body: Docmost echoes the submitted
    // email back on some auth failures, and this entrypoint's contract is that
    // no credential material reaches the logs.
    console.error(
      "Login failed:",
      axios.isAxiosError(error)
        ? `${error.response?.status ?? "network error"} ${error.response?.statusText ?? ""}`.trim()
        : error.message,
    );
    throw error;
  }
}
