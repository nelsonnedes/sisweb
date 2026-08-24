import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set, update } from "firebase/database";

const PROJECT_ID = "demo-sisweb-rbac";
const MEMBER_UID = "member-a";
const VIEWER_UID = "viewer-a";
const NO_FINANCE_UID = "sales-a";
const LEGACY_OWNER_UID = "legacy-owner-a";
const GLOBAL_FINANCE_UID = "global-finance-a";
const OTHER_TENANT_ROLE_UID = "global-finance-b";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const MONTH = "2026-07";
const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST?.trim();

const MEMBER_PROFILE = {
  displayName: "Member A",
  companyId: TENANT_A,
  companyID: TENANT_A,
  tenantId: TENANT_A,
  role: "finance",
  permissions: { finance: true },
  adminPermissions: { reports: true },
  accountStatus: "active",
  status: "active",
  subscriptionStatus: "active",
  subscription: { plan: "standard", status: "active" },
  preferences: { density: "comfortable", theme: "light" },
};

const PROTECTED_PROFILE_CHANGES = {
  companyId: TENANT_B,
  companyID: TENANT_B,
  tenantId: TENANT_B,
  role: "superadmin",
  permissions: { administration: true },
  adminPermissions: { users: true },
  accountStatus: "suspended",
  status: "blocked",
  subscriptionStatus: "canceled",
  subscription: { plan: "enterprise", status: "active" },
};

const SKIP_REASON =
  "Realtime Database Emulator indisponivel; execute npm run test:security:emulator.";

if (!EMULATOR_HOST) {
  test(
    "RBAC do Realtime Database requer o Emulator local",
    { skip: SKIP_REASON },
    () => {},
  );
} else {
  let testEnv;

  const memberDatabase = () =>
    testEnv
      .authenticatedContext(MEMBER_UID, {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const claimedWithoutMembershipDatabase = () =>
    testEnv
      .authenticatedContext("member-without-membership", {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const readOnlyMemberDatabase = () =>
    testEnv
      .authenticatedContext(VIEWER_UID, {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const nonFinanceMemberDatabase = () =>
    testEnv
      .authenticatedContext(NO_FINANCE_UID, {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const legacyOwnerDatabase = () =>
    testEnv
      .authenticatedContext(LEGACY_OWNER_UID)
      .database();

  const globalFinanceMemberDatabase = () =>
    testEnv
      .authenticatedContext(GLOBAL_FINANCE_UID, {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const otherTenantRoleDatabase = () =>
    testEnv
      .authenticatedContext(OTHER_TENANT_ROLE_UID, {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();

  const superadminDatabase = () =>
    testEnv
      .authenticatedContext("superadmin-user", { superadmin: true })
      .database();

  const seedDatabase = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database()), {
        users: {
          [MEMBER_UID]: MEMBER_PROFILE,
          [GLOBAL_FINANCE_UID]: {
            companyId: TENANT_A,
            subscriptionStatus: "active",
          },
          [OTHER_TENANT_ROLE_UID]: {
            companyId: TENANT_A,
            subscriptionStatus: "active",
          },
          [LEGACY_OWNER_UID]: {
            companyId: TENANT_A,
            email: "owner@tenant-a.test",
            subscriptionStatus: "active",
          },
        },
        companies: {
          [TENANT_A]: {
            ownerUid: LEGACY_OWNER_UID,
            profile: { displayName: "Tenant A", email: "owner@tenant-a.test" },
            users: {
              [MEMBER_UID]: { role: "finance" },
              [VIEWER_UID]: { role: "viewer", permissions: { finance: { read: true } } },
              [NO_FINANCE_UID]: { role: "sales", permissions: { sales: { read: true } } },
              [GLOBAL_FINANCE_UID]: { role: "viewer", active: true },
              [OTHER_TENANT_ROLE_UID]: { role: "viewer", active: true },
              [LEGACY_OWNER_UID]: { companyId: TENANT_A },
            },
            financas: {
              receber: {
                [MONTH]: {
                  existingAccount: {
                    id: "existingAccount",
                    status: "pendente",
                    valor: 10000,
                    valorOriginal: 10000,
                    valorPago: 0,
                    valorRestante: 10000,
                    dataVencimento: "2026-07-20",
                    revision: 0,
                  },
                  paidAccount: {
                    id: "paidAccount",
                    status: "parcial",
                    valor: 10000,
                    valorOriginal: 10000,
                    valorPago: 1000,
                    valorRestante: 9000,
                    dataVencimento: "2026-07-20",
                    historicosPagamento: [{ data: "2026-07-17", valor: 1000 }],
                    revision: 1,
                  },
                },
              },
            },
          },
          [TENANT_B]: {
            profile: { displayName: "Tenant B" },
          },
        },
        roles: {
          [GLOBAL_FINANCE_UID]: {
            companyId: TENANT_A,
            role: "admin",
            active: true,
          },
          [OTHER_TENANT_ROLE_UID]: {
            companyId: TENANT_B,
            role: "admin",
            active: true,
          },
        },
      });
    });
  };

  before(async () => {
    const rules = await readFile(
      new URL("../database.rules.json", import.meta.url),
      "utf8",
    );

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      database: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearDatabase();
    await seedDatabase();
  });

  after(async () => {
    await testEnv?.cleanup();
  });

  test("usuario nao cria a propria membership em tenant alheio", async () => {
    const database = memberDatabase();

    await assertFails(
      set(ref(database, `companies/${TENANT_B}/users/${MEMBER_UID}`), {
        companyId: TENANT_B,
        role: "admin",
      }),
    );
  });

  test("usuario nao altera nem remove campos protegidos do proprio perfil", async () => {
    const database = memberDatabase();

    for (const [field, changedValue] of Object.entries(
      PROTECTED_PROFILE_CHANGES,
    )) {
      await assertFails(
        set(ref(database, `users/${MEMBER_UID}/${field}`), changedValue),
      );
      await assertFails(remove(ref(database, `users/${MEMBER_UID}/${field}`)));
    }
  });

  test("usuario continua gravando as proprias preferences", async () => {
    const database = memberDatabase();
    const preferencesRef = ref(database, `users/${MEMBER_UID}/preferences`);

    await assertSucceeds(
      update(preferencesRef, {
        density: "compact",
        theme: "dark",
      }),
    );

    const snapshot = await assertSucceeds(get(preferencesRef));
    assert.deepEqual(snapshot.val(), { density: "compact", theme: "dark" });
  });

  test("superadmin continua administrando memberships e perfis", async () => {
    const database = superadminDatabase();

    await assertSucceeds(
      set(ref(database, `companies/${TENANT_B}/users/managed-user`), {
        companyId: TENANT_B,
        role: "admin",
      }),
    );
    await assertSucceeds(
      update(ref(database, `users/${MEMBER_UID}`), {
        companyId: TENANT_B,
        role: "admin",
        status: "suspended",
      }),
    );

    const companies = await assertSucceeds(get(ref(database, "companies")));
    assert.equal(
      companies.child(`${TENANT_B}/users/managed-user/role`).val(),
      "admin",
    );
  });

  test("perfil empresarial so pode ser gravado pelo backend ou superadmin", async () => {
    const profilePath = `companies/${TENANT_A}/profile`;

    await assertFails(update(ref(memberDatabase(), profilePath), { email: "member@tenant-a.test" }));
    await assertFails(update(ref(legacyOwnerDatabase(), profilePath), { email: "owner-changed@tenant-a.test" }));
    await assertSucceeds(update(ref(superadminDatabase(), profilePath), { phone: "5500000000000" }));
  });

  test("tenant operacional le perfil especifico, mas nao o no raiz nem outro tenant", async () => {
    const database = memberDatabase();

    const profile = await assertSucceeds(
      get(ref(database, `companies/${TENANT_A}/profile`)),
    );
    assert.equal(profile.child("displayName").val(), "Tenant A");
    await assertFails(get(ref(database, `companies/${TENANT_A}`)));
    await assertFails(get(ref(database, `companies/${TENANT_B}/profile`)));
  });

  test("leitura financeira exige permissao do modulo e membership ativa", async () => {
    const financePath = `companies/${TENANT_A}/financas/receber/${MONTH}`;
    const financeMember = await assertSucceeds(get(ref(memberDatabase(), financePath)));
    assert.equal(financeMember.child("existingAccount/valor").val(), 10000);

    const readOnly = await assertSucceeds(get(ref(readOnlyMemberDatabase(), financePath)));
    assert.equal(readOnly.child("existingAccount/status").val(), "pendente");

    await assertFails(get(ref(nonFinanceMemberDatabase(), financePath)));
    await assertFails(get(ref(claimedWithoutMembershipDatabase(), financePath)));

    const legacyOwner = await assertSucceeds(get(ref(legacyOwnerDatabase(), financePath)));
    assert.equal(legacyOwner.child("existingAccount/valor").val(), 10000);

    for (const child of ["printPreferences", "finance_snapshots", "sequences"]) {
      await assertSucceeds(get(ref(readOnlyMemberDatabase(), `companies/${TENANT_A}/${child}`)));
      await assertFails(get(ref(nonFinanceMemberDatabase(), `companies/${TENANT_A}/${child}`)));
      await assertSucceeds(get(ref(legacyOwnerDatabase(), `companies/${TENANT_A}/${child}`)));
    }
  });

  test("papel global financeiro so complementa membership ativa do mesmo tenant", async () => {
    const financePath = `companies/${TENANT_A}/financas/receber/${MONTH}`;

    const financeData = await assertSucceeds(
      get(ref(globalFinanceMemberDatabase(), financePath)),
    );
    assert.equal(financeData.child("existingAccount/status").val(), "pendente");

    await assertFails(get(ref(otherTenantRoleDatabase(), financePath)));
    await assertFails(
      update(ref(globalFinanceMemberDatabase(), `roles/${GLOBAL_FINANCE_UID}`), {
        role: "owner",
      }),
    );
  });

  test("preferencias e snapshots financeiros exigem permissao de escrita", async () => {
    const preferencesPath = `companies/${TENANT_A}/printPreferences/receber`;
    const snapshotPath = `companies/${TENANT_A}/finance_snapshots/2026-07`;

    await assertSucceeds(set(ref(memberDatabase(), preferencesPath), { order: ["cliente"] }));
    await assertSucceeds(set(ref(memberDatabase(), snapshotPath), { month: MONTH, updatedAt: 1 }));
    await assertSucceeds(set(ref(legacyOwnerDatabase(), preferencesPath), { order: ["valor"] }));
    await assertSucceeds(set(ref(legacyOwnerDatabase(), snapshotPath), { month: MONTH, updatedAt: 2 }));

    await assertFails(set(ref(readOnlyMemberDatabase(), preferencesPath), { order: ["status"] }));
    await assertFails(set(ref(readOnlyMemberDatabase(), snapshotPath), { month: MONTH, updatedAt: 3 }));
    await assertFails(set(ref(nonFinanceMemberDatabase(), preferencesPath), { order: ["categoria"] }));
    await assertFails(set(ref(nonFinanceMemberDatabase(), snapshotPath), { month: MONTH, updatedAt: 4 }));
  });

  test("criacao financeira direta exige contrato canonico e remocao do no-pai e negada", async () => {
    const database = memberDatabase();
    const accountPath = `companies/${TENANT_A}/financas/receber/${MONTH}/newAccount`;

    await assertSucceeds(
      set(ref(database, accountPath), {
        id: "newAccount",
        status: "pendente",
        valor: 25000,
        valorOriginal: 25000,
        valorRestante: 25000,
        dataVencimento: "2026-07-25",
      }),
    );
    await assertSucceeds(
      set(ref(legacyOwnerDatabase(), `companies/${TENANT_A}/financas/pagar/${MONTH}/legacyOwnerAccount`), {
        id: "legacyOwnerAccount",
        status: "pendente",
        valor: 15000,
        valorOriginal: 15000,
        valorRestante: 15000,
        dataVencimento: "2026-07-26",
      }),
    );
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/financas/receber/${MONTH}/invalidAccount`), {
        id: "invalidAccount",
        status: "pendente",
        valor: 25000,
        valorOriginal: 25000,
        valorRestante: 24000,
        dataVencimento: "2026-07-25",
      }),
    );
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/financas/receber/${MONTH}/unsafeAttachment`), {
        id: "unsafeAttachment",
        status: "pendente",
        valor: 25000,
        valorOriginal: 25000,
        valorRestante: 25000,
        dataVencimento: "2026-07-25",
        anexos: [{ url: "javascript:alert(1)" }],
      }),
    );
    await assertFails(
      remove(ref(database, `companies/${TENANT_A}/financas/receber/${MONTH}`)),
    );
    await assertFails(
      remove(ref(database, `companies/${TENANT_A}/financas/receber`)),
    );

    const account = await assertSucceeds(get(ref(database, accountPath)));
    assert.equal(account.child("valor").val(), 25000);
  });

  test("lote de origem pode substituir ou estornar somente conta sem baixa", async () => {
    const database = memberDatabase();
    const accountPath = `companies/${TENANT_A}/financas/receber/${MONTH}/existingAccount`;

    await assertSucceeds(
      update(ref(database, accountPath), {
        descricao: "Descrição operacional",
        valor: 12000,
        valorOriginal: 12000,
        valorRestante: 12000,
        status: "vencido",
      }),
    );
    await assertFails(
      update(ref(database, accountPath), {
        anexos: [{ url: "https://attacker.invalid/file.pdf" }],
        anexoUrl: "https://attacker.invalid/file.pdf",
      }),
    );
    await assertSucceeds(remove(ref(database, accountPath)));
  });

  test("conta com baixa continua imutavel fora das Cloud Functions", async () => {
    const database = memberDatabase();
    const paidPath = `companies/${TENANT_A}/financas/receber/${MONTH}/paidAccount`;

    await assertFails(update(ref(database, paidPath), { descricao: "Forjada" }));
    await assertFails(remove(ref(database, paidPath)));
    await assertFails(
      update(ref(database, paidPath), {
        status: "pago",
        valorPago: 10000,
        valorRestante: 0,
        historicosPagamento: [{ data: "2026-07-17", valor: 10000 }],
        revision: 2,
      }),
    );
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/financas/receber/${MONTH}/forgedPaidAccount`), {
        id: "forgedPaidAccount",
        status: "pago",
        valor: 10000,
        valorOriginal: 10000,
        valorPago: 10000,
        valorRestante: 0,
        dataVencimento: "2026-07-20",
      }),
    );
    await assertFails(
      update(ref(database, `companies/${TENANT_A}/financas/receber`), {
        [`${MONTH}/paidAccount`]: null,
        "2026-08/existingAccount": {
          id: "existingAccount",
          status: "parcial",
          valor: 10000,
          valorOriginal: 10000,
          valorPago: 1000,
          valorRestante: 9000,
          dataVencimento: "2026-08-20",
          historicosPagamento: [{ data: "2026-07-17", valor: 1000 }],
          revision: 1,
        },
      }),
    );
  });

  test("claim sem membership nao grava conta financeira", async () => {
    const database = claimedWithoutMembershipDatabase();
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/financas/receber/${MONTH}/unlinkedAccount`), {
        status: "pendente",
        valor: 10000,
      }),
    );
  });

  test("membership somente leitura nao grava conta financeira", async () => {
    const database = readOnlyMemberDatabase();
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/financas/pagar/${MONTH}/viewerAccount`), {
        status: "pendente",
        valor: 5000,
      }),
    );
  });

  test("membro de compras sem papel financeiro nao grava conta a pagar direta (regressao Fase 2)", async () => {
    const database = testEnv
      .authenticatedContext(NO_FINANCE_UID)
      .database();
    const contaCompra = {
      id: "CP-PC-1776259657669-0",
      tipo: "pagar",
      categoria: "compras",
      origem: "compras",
      origemId: "PC-1776259657669",
      pedidoNumero: "000052",
      descricao: "Compra 000052 - Cheque-pré",
      valor: 1200,
      valorOriginal: 1200,
      valorRestante: 1200,
      vencimento: "2026-05-15",
      dataVencimento: "2026-05-15",
      status: "pendente",
      tipoPagamento: "cheque",
      observacoes: "",
      created: "2026-05-10T12:00:00.000Z",
      updatedAt: "2026-05-10T12:00:00.000Z",
    };

    await assertFails(
      set(
        ref(database, `companies/${TENANT_A}/financas/pagar/2026-05/CP-PC-1776259657669-0`),
        contaCompra,
      ),
    );

    await assertFails(
      update(ref(database, `companies/${TENANT_A}`), {
        "pedidosCompra/PC-1776259657669": {
          id: "PC-1776259657669",
          numero: "000052",
          status: "aprovado",
        },
        "financas/pagar/2026-05/CP-PC-1776259657669-0": contaCompra,
      }),
    );
  });

  test("membro financeiro grava conta a pagar canonica de compra", async () => {
    const database = memberDatabase();
    await assertSucceeds(
      set(
        ref(database, `companies/${TENANT_A}/financas/pagar/2026-05/CP-PC-1776259657669-0`),
        {
          id: "CP-PC-1776259657669-0",
          tipo: "pagar",
          categoria: "compras",
          origem: "compras",
          origemId: "PC-1776259657669",
          pedidoNumero: "000052",
          descricao: "Compra 000052 - Cheque-pré",
          valor: 1200,
          valorOriginal: 1200,
          valorRestante: 1200,
          vencimento: "2026-05-15",
          dataVencimento: "2026-05-15",
          status: "pendente",
          tipoPagamento: "cheque",
          observacoes: "",
          created: "2026-05-10T12:00:00.000Z",
          updatedAt: "2026-05-10T12:00:00.000Z",
        },
      ),
    );
  });

  test("sequencia financeira nao pode ser redefinida pelo cliente", async () => {
    const database = memberDatabase();
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/sequences/contasReceberManual`), {
        current: 1,
        last: "RX000001",
      }),
    );
  });

  test("claim sem membership nao escreve em modulos operacionais (brecha fechada)", async () => {
    const database = claimedWithoutMembershipDatabase();
    const targets = [
      `companies/${TENANT_A}/clients/teste1`,
      `companies/${TENANT_A}/fornecedores/teste1`,
      `companies/${TENANT_A}/cargos/teste1`,
      `companies/${TENANT_A}/estoqueTorasAtual/teste1`,
      `companies/${TENANT_A}/especies/teste1`,
      `companies/${TENANT_A}/fiscal/teste1`,
      `companies/${TENANT_A}/configuracoes/teste1`,
    ];
    for (const path of targets) {
      await assertFails(set(ref(database, path), { nome: "teste" }));
    }
  });

  test("membro ativo do tenant escreve em modulos operacionais", async () => {
    const database = memberDatabase();
    const targets = [
      `companies/${TENANT_A}/clients/teste1`,
      `companies/${TENANT_A}/fornecedores/teste1`,
      `companies/${TENANT_A}/cargos/teste1`,
      `companies/${TENANT_A}/estoqueTorasAtual/teste1`,
      `companies/${TENANT_A}/especies/teste1`,
      `companies/${TENANT_A}/fiscal/teste1`,
      `companies/${TENANT_A}/configuracoes/teste1`,
    ];
    for (const path of targets) {
      await assertSucceeds(set(ref(database, path), { nome: "teste" }));
    }
  });

  test("membro inativo nao escreve em modulos operacionais", async () => {
    const database = testEnv
      .authenticatedContext("inactive-member", {
        companyId: TENANT_A,
        subscriptionStatus: "active",
      })
      .database();
    // usuario existe mas com active=false
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), `companies/${TENANT_A}/users/inactive-member`), {
        role: "sales",
        active: false,
      });
    });
    await assertFails(
      set(ref(database, `companies/${TENANT_A}/clients/teste1`), { nome: "teste" }),
    );
  });
}
