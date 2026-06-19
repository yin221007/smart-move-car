export interface PushPlusInput {
  fetchImpl?: typeof fetch;
  token: string;
  title: string;
  content: string;
}

export interface PushPlusResult {
  ok: boolean;
  statusCode: number;
  responseText: string;
  shortCode: string | null;
}

export async function sendPushPlusMessage(input: PushPlusInput): Promise<PushPlusResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://www.pushplus.plus/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: input.token,
        title: input.title,
        content: input.content,
        template: "markdown",
        channel: "wechat"
      })
    });
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      responseText: error instanceof Error ? error.message : "PushPlus request failed",
      shortCode: null
    };
  }
  const text = await response.text();
  let code = response.status;
  let shortCode: string | null = null;
  try {
    const parsed = JSON.parse(text) as { code?: number; data?: string };
    code = parsed.code ?? code;
    shortCode = parsed.data ?? null;
  } catch {
    shortCode = null;
  }
  return {
    ok: response.ok && code === 200,
    statusCode: code,
    responseText: text,
    shortCode
  };
}
