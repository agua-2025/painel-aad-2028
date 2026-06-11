export type AppRole =
  | "administrador"
  | "presidente"
  | "vice_presidente"
  | "secretaria"
  | "tesoureira"
  | "comissao_fiscal"
  | "associado"
  | "interessado";

export type PermissionAction = "read" | "create" | "update" | "delete" | "approve";

export type DashboardModule =
  | "inicio"
  | "associados"
  | "auditoria"
  | "solicitacoes"
  | "avisos"
  | "comunicacoes"
  | "reunioes"
  | "financeiro"
  | "mensalidades"
  | "contribuicoes_extras"
  | "cobrancas"
  | "pagamentos"
  | "inadimplencia"
  | "movimento_financeiro"
  | "saldos_caixa"
  | "fechamento_mensal"
  | "conferencia_saldos"
  | "receitas_avulsas"
  | "despesas"
  | "prestacao_contas"
  | "relatorios"
  | "backup_exportacao"
  | "assistente"
  | "configuracoes";

const dashboardRoles: AppRole[] = [
  "administrador",
  "presidente",
  "vice_presidente",
  "secretaria",
  "tesoureira",
  "comissao_fiscal",
];

const moduleByPath: { path: string; module: DashboardModule }[] = [
  { path: "/dashboard/associados", module: "associados" },
  { path: "/dashboard/auditoria", module: "auditoria" },
  { path: "/dashboard/solicitacoes", module: "solicitacoes" },
  { path: "/dashboard/avisos", module: "avisos" },
  { path: "/dashboard/comunicacoes", module: "comunicacoes" },
  { path: "/dashboard/reunioes", module: "reunioes" },
  { path: "/dashboard/financeiro", module: "financeiro" },
  { path: "/dashboard/mensalidades", module: "mensalidades" },
  { path: "/dashboard/contribuicoes-extras", module: "contribuicoes_extras" },
  { path: "/dashboard/cobrancas", module: "cobrancas" },
  { path: "/dashboard/pagamentos", module: "pagamentos" },
  { path: "/dashboard/inadimplencia", module: "inadimplencia" },
  { path: "/dashboard/movimento-financeiro", module: "movimento_financeiro" },
  { path: "/dashboard/saldos-caixa", module: "saldos_caixa" },
  { path: "/dashboard/fechamento-mensal", module: "fechamento_mensal" },
  { path: "/dashboard/conferencia-saldos", module: "conferencia_saldos" },
  { path: "/dashboard/receitas-avulsas", module: "receitas_avulsas" },
  { path: "/dashboard/despesas", module: "despesas" },
  { path: "/dashboard/prestacao-contas", module: "prestacao_contas" },
  { path: "/dashboard/relatorios", module: "relatorios" },
  { path: "/dashboard/backup", module: "backup_exportacao" },
  { path: "/dashboard/assistente", module: "assistente" },
  { path: "/dashboard/configuracoes", module: "configuracoes" },
];

const roleModuleAccess: Record<AppRole, DashboardModule[]> = {
    administrador: [
    "inicio",
    "associados",
    "auditoria",
    "solicitacoes",
    "avisos",
    "assistente",
    "comunicacoes",
    "reunioes",
    "financeiro",
    "mensalidades",
    "contribuicoes_extras",
    "cobrancas",
    "pagamentos",
    "inadimplencia",
    "movimento_financeiro",
    "saldos_caixa",
    "fechamento_mensal",
    "conferencia_saldos",
    "receitas_avulsas",
    "despesas",
    "prestacao_contas",
    "relatorios",
    "backup_exportacao",
    "configuracoes",
  ],

  presidente: [
    "inicio",
    "associados",
    "auditoria",
    "solicitacoes",
    "avisos",
    "assistente",
    "comunicacoes",
    "reunioes",
    "financeiro",
    "mensalidades",
    "contribuicoes_extras",
    "cobrancas",
    "pagamentos",
    "inadimplencia",
    "movimento_financeiro",
    "saldos_caixa",
    "fechamento_mensal",
    "conferencia_saldos",
    "receitas_avulsas",
    "despesas",
    "prestacao_contas",
    "relatorios",
    "backup_exportacao",
    "configuracoes",
  ],

  vice_presidente: [
    "inicio",
    "associados",
    "auditoria",
    "solicitacoes",
    "avisos",
    "assistente",
    "comunicacoes",
    "reunioes",
    "financeiro",
    "mensalidades",
    "contribuicoes_extras",
    "cobrancas",
    "pagamentos",
    "inadimplencia",
    "movimento_financeiro",
    "saldos_caixa",
    "conferencia_saldos",
    "receitas_avulsas",
    "despesas",
    "prestacao_contas",
    "relatorios",
  ],

  secretaria: [
    "inicio",
    "auditoria",
    "associados",
    "auditoria",
    "solicitacoes",
    "avisos",
    "assistente",
    "comunicacoes",
    "reunioes",
    "relatorios",
  ],

  tesoureira: [
    "inicio",
    "auditoria",
    "comunicacoes",
    "financeiro",
    "mensalidades",
    "contribuicoes_extras",
    "cobrancas",
    "pagamentos",
    "inadimplencia",
    "movimento_financeiro",
    "saldos_caixa",
    "fechamento_mensal",
    "conferencia_saldos",
    "receitas_avulsas",
    "despesas",
    "prestacao_contas",
    "relatorios",
  ],

  comissao_fiscal: [
    "inicio",
    "financeiro",
    "mensalidades",
    "contribuicoes_extras",
    "cobrancas",
    "pagamentos",
    "inadimplencia",
    "movimento_financeiro",
    "saldos_caixa",
    "conferencia_saldos",
    "receitas_avulsas",
    "despesas",
    "prestacao_contas",
    "relatorios",
  ],

  associado: [],
  interessado: [],
};

const writePermissions: Partial<Record<DashboardModule, AppRole[]>> = {
  reunioes: ["administrador", "presidente", "vice_presidente", "secretaria"],
  associados: ["administrador", "presidente", "secretaria"],
  solicitacoes: ["administrador", "presidente", "vice_presidente", "secretaria"],
  avisos: ["administrador", "presidente", "vice_presidente", "secretaria"],
  comunicacoes: [
    "administrador",
    "presidente",
    "vice_presidente",
    "secretaria",
    "tesoureira",
  ],

  financeiro: ["administrador", "presidente", "tesoureira"],
  mensalidades: ["administrador", "presidente", "tesoureira"],
  contribuicoes_extras: ["administrador", "presidente", "tesoureira"],
  pagamentos: ["administrador", "presidente", "tesoureira"],
  inadimplencia: ["administrador", "presidente", "tesoureira"],
  movimento_financeiro: ["administrador", "presidente", "tesoureira"],
  saldos_caixa: ["administrador", "presidente", "tesoureira"],
  fechamento_mensal: ["administrador", "presidente", "tesoureira"],
  receitas_avulsas: ["administrador", "presidente", "tesoureira"],
  despesas: ["administrador", "presidente", "tesoureira"],

  backup_exportacao: ["administrador", "presidente"],
  configuracoes: ["administrador", "presidente"],
};

function normalizeRoles(roles: string[]): AppRole[] {
  return roles.filter((role): role is AppRole =>
    [
      "administrador",
      "presidente",
      "vice_presidente",
      "secretaria",
      "tesoureira",
      "comissao_fiscal",
      "associado",
      "interessado",
    ].includes(role)
  );
}

export function hasDashboardAccess(roles: string[]) {
  return normalizeRoles(roles).some((role) => dashboardRoles.includes(role));
}

export function canAccessModule(roles: string[], module: DashboardModule) {
  if (module === "inicio") {
    return hasDashboardAccess(roles);
  }

  return normalizeRoles(roles).some((role) =>
    roleModuleAccess[role]?.includes(module)
  );
}

export function getDashboardModuleFromPath(pathname: string): DashboardModule {
  if (pathname === "/dashboard") {
    return "inicio";
  }

  const match = moduleByPath
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname.startsWith(item.path));

  return match?.module ?? "inicio";
}

export function canAccessDashboardPath(roles: string[], pathname: string) {
  return canAccessModule(roles, getDashboardModuleFromPath(pathname));
}

export function canWriteModule(roles: string[], module: DashboardModule) {
  const allowedRoles = writePermissions[module] ?? ["administrador", "presidente"];

  return normalizeRoles(roles).some((role) => allowedRoles.includes(role));
}

export function canCreate(roles: string[], module: DashboardModule) {
  return canWriteModule(roles, module);
}

export function canUpdate(roles: string[], module: DashboardModule) {
  return canWriteModule(roles, module);
}

export function canDelete(roles: string[], module: DashboardModule) {
  return normalizeRoles(roles).some((role) =>
    ["administrador", "presidente"].includes(role)
  );
}

export function canApprove(roles: string[], module: DashboardModule) {
  return canWriteModule(roles, module);
}

export function getAllowedDashboardHrefs(roles: string[]) {
  const allowedModules = new Set<DashboardModule>();

  normalizeRoles(roles).forEach((role) => {
    roleModuleAccess[role]?.forEach((module) => allowedModules.add(module));
  });

  return moduleByPath
    .filter((item) => allowedModules.has(item.module))
    .map((item) => item.path);
}