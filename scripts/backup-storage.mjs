import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Erro: SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL não definida.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Erro: SUPABASE_SERVICE_ROLE_KEY não definida.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "-").replace(/\..+/, "");
const backupRoot = path.join("backups", "storage", stamp);

const manifest = {
  created_at: now.toISOString(),
  buckets: [],
};

function safePart(value) {
  return String(value).replace(/[<>:"\\|?*\x00-\x1F]/g, "_");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadFile(bucketName, objectPath) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(objectPath);

  if (error) {
    throw new Error(error.message || `Erro ao baixar ${bucketName}/${objectPath}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const destination = path.join(
    backupRoot,
    safePart(bucketName),
    ...objectPath.split("/").map(safePart)
  );

  await ensureDir(path.dirname(destination));
  await fs.writeFile(destination, buffer);

  return {
    path: objectPath,
    size: buffer.length,
    saved_as: destination,
  };
}

async function listAndDownload(bucketName, prefix = "") {
  const downloaded = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, {
        limit,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw new Error(error.message || `Erro ao listar bucket ${bucketName}/${prefix}`);
    }

    const items = data ?? [];

    for (const item of items) {
      const objectPath = prefix ? `${prefix}/${item.name}` : item.name;
      const looksLikeFolder = item.id === null || item.metadata === null;

      if (looksLikeFolder) {
        const nested = await listAndDownload(bucketName, objectPath);
        downloaded.push(...nested);
        continue;
      }

      console.log(`Baixando: ${bucketName}/${objectPath}`);
      const fileInfo = await downloadFile(bucketName, objectPath);
      downloaded.push(fileInfo);
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return downloaded;
}

async function main() {
  await ensureDir(backupRoot);

  console.log("Iniciando backup do Supabase Storage...");
  console.log(`Destino: ${backupRoot}`);

  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();

  if (bucketsError) {
    throw new Error(bucketsError.message || "Erro ao listar buckets.");
  }

  if (!buckets?.length) {
    console.log("Nenhum bucket encontrado.");
  }

  for (const bucket of buckets ?? []) {
    console.log("");
    console.log(`Bucket: ${bucket.name}`);

    const files = await listAndDownload(bucket.name);

    manifest.buckets.push({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      files_count: files.length,
      files,
    });
  }

  await fs.writeFile(
    path.join(backupRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log("");
  console.log("Backup do Storage concluído com sucesso.");
  console.log(`Arquivos salvos em: ${backupRoot}`);
  console.log(`Manifesto: ${path.join(backupRoot, "manifest.json")}`);
}

main().catch((error) => {
  console.error("Falha no backup do Storage:");
  console.error(error);
  process.exit(1);
});
