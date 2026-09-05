import https from "https";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type SicrediRequestOptions = {
  method: HttpMethod;
  path: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type SicrediTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
};

type CreateImmediateChargeInput = {
  cpf?: string;
  cnpj?: string;
  nome: string;
  valor: string;
  solicitacaoPagador?: string;
  expiracao?: number;
};

type SicrediCobResponse = {
  calendario?: {
    criacao?: string;
    expiracao?: number;
  };
  txid: string;
  revisao?: number;
  loc?: {
    id?: number;
    location?: string;
    tipoCob?: string;
  };
  location?: string;
  status?: string;
  devedor?: {
    cpf?: string;
    cnpj?: string;
    nome?: string;
  };
  valor?: {
    original?: string;
  };
  chave?: string;
  pixCopiaECola?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente não configurada: ${name}`);
  }

  return value;
}

function getBaseUrl() {
  return getRequiredEnv("SICREDI_BASE_URL").replace(/\/$/, "");
}

function decodeBase64Env(name: string) {
  const value = getRequiredEnv(name);

  return Buffer.from(value, "base64").toString("utf8");
}

function createHttpsAgent() {
  const cert = decodeBase64Env("SICREDI_CERT_BASE64");
  const key = decodeBase64Env("SICREDI_KEY_BASE64");

  return new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
  });
}

function buildUrl(path: string) {
  const baseUrl = getBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(`${baseUrl}${normalizedPath}`);
}

async function sicrediRequest<TResponse>({
  method,
  path,
  token,
  body,
  headers = {},
}: SicrediRequestOptions): Promise<TResponse> {
  const url = buildUrl(path);
  const payload = body === undefined ? undefined : JSON.stringify(body);

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (payload) {
    requestHeaders["Content-Type"] = "application/json";
    requestHeaders["Content-Length"] = Buffer.byteLength(payload).toString();
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const agent = createHttpsAgent();

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        agent,
        headers: requestHeaders,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          const statusCode = response.statusCode ?? 0;

          let parsedBody: unknown = null;

          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
            } catch {
              parsedBody = rawBody;
            }
          }

          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                `Erro Sicredi ${statusCode}: ${
                  typeof parsedBody === "string"
                    ? parsedBody
                    : JSON.stringify(parsedBody)
                }`
              )
            );
            return;
          }

          resolve(parsedBody as TResponse);
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

export async function getSicrediAccessToken() {
  const clientId = getRequiredEnv("SICREDI_CLIENT_ID");
  const clientSecret = getRequiredEnv("SICREDI_CLIENT_SECRET");

  const url = buildUrl("/oauth/token?grant_type=client_credentials");
  const body = "";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const agent = createHttpsAgent();

  return new Promise<SicrediTokenResponse>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        agent,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          const statusCode = response.statusCode ?? 0;

          let parsedBody: unknown = null;

          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
            } catch {
              parsedBody = rawBody;
            }
          }

          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                `Erro ao gerar token Sicredi ${statusCode}: ${
                  typeof parsedBody === "string"
                    ? parsedBody
                    : JSON.stringify(parsedBody)
                }`
              )
            );
            return;
          }

          resolve(parsedBody as SicrediTokenResponse);
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

export async function createImmediatePixCharge(
  token: string,
  input: CreateImmediateChargeInput
) {
  const pixKey = getRequiredEnv("SICREDI_PIX_KEY");

  if (!input.cpf && !input.cnpj) {
    throw new Error("Informe CPF ou CNPJ do devedor para criar a cobrança Pix.");
  }

  const devedor = input.cpf
    ? {
        cpf: input.cpf,
        nome: input.nome,
      }
    : {
        cnpj: input.cnpj,
        nome: input.nome,
      };

  return sicrediRequest<SicrediCobResponse>({
    method: "POST",
    path: "/api/v3/cob",
    token,
    body: {
      calendario: {
        expiracao: input.expiracao ?? 3600,
      },
      devedor,
      valor: {
        original: input.valor,
      },
      chave: pixKey,
      solicitacaoPagador:
        input.solicitacaoPagador ??
        "Pagamento de cobrança da Associação Acadêmica de Direito 2028.",
    },
  });
}

export async function getImmediatePixCharge(token: string, txid: string) {
  return sicrediRequest<SicrediCobResponse>({
    method: "GET",
    path: `/api/v3/cob/${encodeURIComponent(txid)}`,
    token,
  });
}

export async function listReceivedPix(params: {
  token: string;
  inicio: string;
  fim: string;
  txIdPresente?: boolean;
}) {
  const searchParams = new URLSearchParams({
    inicio: params.inicio,
    fim: params.fim,
  });

  if (params.txIdPresente !== undefined) {
    searchParams.set("txIdPresente", String(params.txIdPresente));
  }

  return sicrediRequest<unknown>({
    method: "GET",
    path: `/api/v2/pix?${searchParams.toString()}`,
    token: params.token,
  });
}

export async function registerPixWebhook(input: {
  token: string;
  pixKey: string;
  webhookUrl: string;
}) {
  const path = `/api/v2/webhook/${encodeURIComponent(input.pixKey)}`;

  return sicrediRequest({
    path,
    method: "PUT",
    token: input.token,
    body: {
      webhookUrl: input.webhookUrl,
    },
  });
}

export async function getPixWebhook(input: {
  token: string;
  pixKey: string;
}) {
  const path = `/api/v2/webhook/${encodeURIComponent(input.pixKey)}`;

  return sicrediRequest({
    path,
    method: "GET",
    token: input.token,
  });
}

