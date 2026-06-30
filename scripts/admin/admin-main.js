(function() {
            let allUsers = [];
            let lastLoadedAt = 0;
            let activeTab = "dashboard";
            let allowedTabs = [];
            let companyNameById = {};
            let companyCnpjById = {};
            let companyProfilesById = {};
            let companyManagementCurrentId = "";
            let companyManagementLogoPreviewObjectUrl = "";
            let companyDataByUserUid = {};
            let latestRequestsByUid = {};
            let subscriptionRequestsHistory = [];
            let subscriptionPixPaymentsHistory = [];
            let financialRows = [];
            let financialAuditEntries = [];
            let adminDeniedAuditRows = [];
            let supportTickets = [];
            let currentAccessModel = { isSuperAdmin: false, canDashboard: false, canSubscriptions: false, canSettings: false };
            var debugState = {};
            var ADMIN_ASSET_VERSION = "2026-06-11-profile-admin-v1";
            async function resolveAdminFirebaseService(requiredFunction) {
                var required = String(requiredFunction || "").trim();
                var current = window.firebaseService;
                if (current && (!required || typeof current[required] === "function")) {
                    return current;
                }
                try {
                    var imported = await import("/firebaseService.js?v=" + encodeURIComponent(ADMIN_ASSET_VERSION));
                    var merged = Object.assign({}, window.firebaseService || {}, imported || {});
                    if (imported && imported.authService) {
                        merged.authService = imported.authService;
                    }
                    window.firebaseService = merged;
                    if (!required || typeof merged[required] === "function") {
                        return merged;
                    }
                } catch (error) {
                    console.warn("[Admin Sisweb] Falha ao carregar firebaseService atualizado:", error);
                }
                return null;
            }
            function normalizeCompanyName(company) {
                if (!company || typeof company !== "object") return "";
                return String(company.name || company.companyName || company.fantasyName || company.razaoSocial || "").trim();
            }
            function getCompanyLabel(user) {
                if (!user || typeof user !== "object") return "-";
                var direct = String(user.companyName || user.company || "").trim();
                if (direct) return direct;
                var companyId = String(user.companyId || "").trim();
                if (companyId && companyNameById[companyId]) return companyNameById[companyId];
                var mirror = user.uid ? companyDataByUserUid[String(user.uid)] : null;
                if (mirror && mirror.companyName) return mirror.companyName;
                return companyId || "-";
            }
            function setDebugVisible(visible) {
                var panel = document.getElementById("debugPanel");
                if (!panel) return;
                var next = !!visible;
                panel.classList.toggle("is-open", next);
                try { localStorage.setItem("admin_debug_open", next ? "1" : "0"); } catch (_) {}
            }
            function toggleDebugVisible() {
                var panel = document.getElementById("debugPanel");
                if (!panel) return;
                setDebugVisible(!panel.classList.contains("is-open"));
            }
            var responsiveTableHydrateScheduled = false;
            function normalizeAdminTableHeaderLabel(value) {
                return String(value || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/\s+/g, " ")
                    .trim();
            }
            function isAdminActionsHeaderLabel(value) {
                var label = normalizeAdminTableHeaderLabel(value);
                return label === "acao"
                    || label === "acoes"
                    || label === "action"
                    || label === "actions";
            }
            function getAdminActionButtonIconClass(label) {
                var normalized = normalizeAdminTableHeaderLabel(label);
                if (normalized.indexOf("trial") >= 0 || normalized.indexOf("bonus") >= 0) return "fa-gift";
                if (normalized.indexOf("notificar") >= 0 || normalized.indexOf("email") >= 0) return "fa-envelope";
                if (normalized.indexOf("excluir") >= 0 || normalized.indexOf("remover") >= 0) return "fa-trash";
                if (normalized.indexOf("detalhe") >= 0 || normalized.indexOf("visualizar") >= 0 || normalized === "ver") return "fa-circle-info";
                if (normalized.indexOf("editar") >= 0) return "fa-pen";
                if (normalized.indexOf("aprovar") >= 0 || normalized.indexOf("marcar pago") >= 0) return "fa-check";
                if (normalized.indexOf("rejeitar") >= 0 || normalized.indexOf("bloquear") >= 0) return "fa-xmark";
                if (normalized.indexOf("prorrogar") >= 0) return "fa-calendar-plus";
                if (normalized.indexOf("boleto") >= 0) return "fa-barcode";
                if (normalized.indexOf("pix") >= 0 || normalized.indexOf("revalidar") >= 0) return "fa-arrows-rotate";
                if (normalized.indexOf("responder") >= 0) return "fa-reply";
                return "fa-ellipsis";
            }
            function decorateAdminActionCell(td) {
                if (!td) return 0;
                var actionButtons = Array.from(td.querySelectorAll("button.btn, a.btn"));
                actionButtons.forEach(function(btn) {
                    var label = String(btn.textContent || btn.getAttribute("aria-label") || btn.title || "Acao")
                        .replace(/\s+/g, " ")
                        .trim() || "Acao";
                    btn.classList.add("admin-action-btn");
                    btn.setAttribute("data-action-label", label);
                    if (!btn.getAttribute("title")) btn.title = label;
                    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", label);
                    if (btn.getAttribute("data-admin-action-decorated") === "1") return;
                    var icon = document.createElement("i");
                    icon.className = "fas " + getAdminActionButtonIconClass(label);
                    icon.setAttribute("aria-hidden", "true");
                    var text = document.createElement("span");
                    text.className = "admin-action-label";
                    text.textContent = label;
                    btn.textContent = "";
                    btn.appendChild(icon);
                    btn.appendChild(text);
                    btn.setAttribute("data-admin-action-decorated", "1");
                });
                return actionButtons.length;
            }
            function hydrateResponsiveTable(tableEl) {
                if (!tableEl) return;
                var headerCells = Array.from(tableEl.querySelectorAll("thead th"));
                var headers = headerCells.map(function(th) {
                    return String(th.textContent || "").trim();
                });
                if (!headers.length) return;
                var actionIndexes = new Set();
                headerCells.forEach(function(th, index) {
                    var isAction = isAdminActionsHeaderLabel(th.textContent || "");
                    th.classList.toggle("admin-sticky-actions", isAction);
                    th.classList.toggle("admin-actions-col", isAction);
                    if (isAction) actionIndexes.add(index);
                });
                var rows = tableEl.querySelectorAll("tbody tr");
                var maxActionButtons = 0;
                rows.forEach(function(row) {
                    var cells = row.querySelectorAll("td");
                    cells.forEach(function(td, index) {
                        if (td.hasAttribute("colspan")) {
                            td.removeAttribute("data-label");
                            td.classList.remove("admin-sticky-actions", "admin-actions-col");
                            return;
                        }
                        var label = headers[index] || "";
                        if (label) td.setAttribute("data-label", label);
                        var isAction = actionIndexes.has(index);
                        td.classList.toggle("admin-sticky-actions", isAction);
                        td.classList.toggle("admin-actions-col", isAction);
                        if (isAction) {
                            maxActionButtons = Math.max(maxActionButtons, decorateAdminActionCell(td));
                        }
                    });
                });
                tableEl.classList.add("responsive-stack");
                var wrapper = tableEl.closest ? tableEl.closest(".table-wrapper") : null;
                if (wrapper) {
                    wrapper.classList.add("responsive-stack-wrapper");
                    wrapper.classList.toggle("has-sticky-actions", actionIndexes.size > 0);
                    if (actionIndexes.size > 0) {
                        var actionWidth = Math.min(260, Math.max(86, (maxActionButtons || 2) * 38 + 26));
                        wrapper.style.setProperty("--admin-actions-column-width", String(actionWidth) + "px");
                    } else {
                        wrapper.style.removeProperty("--admin-actions-column-width");
                    }
                }
            }
            function scheduleResponsiveTablesHydration() {
                if (responsiveTableHydrateScheduled) return;
                responsiveTableHydrateScheduled = true;
                var scheduleFrame = window.requestAnimationFrame || function(callback) { return setTimeout(callback, 0); };
                scheduleFrame(function() {
                    responsiveTableHydrateScheduled = false;
                    var tables = document.querySelectorAll(".table-wrapper table");
                    tables.forEach(function(tableEl) { hydrateResponsiveTable(tableEl); });
                });
            }
            function isAdminPwaViewport() {
                try {
                    var compact = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
                    var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
                    var coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
                    return !!(compact || (standalone && coarsePointer));
                } catch (_) {
                    return false;
                }
            }
            function syncAdminPwaViewportState() {
                try {
                    var root = document.documentElement;
                    var viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 0;
                    root.classList.toggle("admin-pwa-viewport", isAdminPwaViewport());
                    if (viewportHeight) root.style.setProperty("--admin-viewport-height", Math.round(viewportHeight) + "px");
                } catch (_) {}
            }
            function scrollActiveAdminTabIntoView() {
                try {
                    if (!isAdminPwaViewport()) return;
                    var activeBtn = document.querySelector(".tabs .tab-btn.active");
                    if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
                        activeBtn.scrollIntoView({ block: "nearest", inline: "center" });
                    }
                } catch (_) {}
            }
            function enhanceAdminPwaLayout() {
                syncAdminPwaViewportState();
                scheduleResponsiveTablesHydration();
                setTimeout(scrollActiveAdminTabIntoView, 0);
            }
            function bindAdminPwaViewportListeners() {
                if (window.__siswebAdminPwaViewportBound) return;
                window.__siswebAdminPwaViewportBound = true;
                syncAdminPwaViewportState();
                window.addEventListener("resize", enhanceAdminPwaLayout, { passive: true });
                window.addEventListener("orientationchange", enhanceAdminPwaLayout, { passive: true });
                if (window.visualViewport) {
                    window.visualViewport.addEventListener("resize", enhanceAdminPwaLayout, { passive: true });
                }
            }
            function renderDebugPanel() {
                var panel = document.getElementById("debugPanel");
                var grid = document.getElementById("debugGrid");
                if (!panel || !grid) return;
                var keys = Object.keys(debugState || {});
                if (!keys.length) {
                    grid.innerHTML = '<div class="debug-item"><strong>Inicialização</strong>Sem dados de diagnóstico ainda.</div>';
                    return;
                }
                grid.innerHTML = "";
                keys.forEach(function(key) {
                    var item = debugState[key] || {};
                    var div = document.createElement("div");
                    div.className = "debug-item";
                    var status = item.status || "idle";
                    var msg = item.message || "-";
                    var when = item.at ? new Date(item.at).toLocaleTimeString("pt-BR") : "-";
                    div.innerHTML = "<strong>" + key + "</strong>" + status + " • " + msg + " • " + when;
                    grid.appendChild(div);
                });
            }
            function setDebugStatus(key, status, message) {
                debugState[key] = { status: String(status || "idle"), message: String(message || ""), at: Date.now() };
                renderDebugPanel();
            }
            function notifyAdmin(message, type) {
                if (window.AdminUI && window.AdminUI.toast) {
                    window.AdminUI.toast(message, type);
                } else {
                    var box = document.getElementById("adminNotice");
                    if (box) {
                        box.textContent = String(message || "");
                        box.style.display = "block";
                        setTimeout(function() { if (box.textContent === String(message || "")) box.style.display = "none"; }, 4000);
                    }
                }
            }
            function showActionMessage(message, type) {
                notifyAdmin(message, type);
            }
            async function waitForAuthReady(maxWaitMs, intervalMs) {
                var maxMs = Number(maxWaitMs || 3000);
                var interval = Number(intervalMs || 250);
                var startedAt = Date.now();
                while (Date.now() - startedAt < maxMs) {
                    try {
                        if (window.getCurrentUserDetails && typeof window.getCurrentUserDetails === "function") {
                            var details = await window.getCurrentUserDetails();
                            if (details && (details.uid || details.id || details.userId || details.email)) return true;
                        }
                        if (window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getCurrentUser === "function") {
                            var authUser = await window.firebaseService.authService.getCurrentUser();
                            if (authUser && (authUser.uid || authUser.email)) return true;
                        }
                    } catch (_) {}
                    await new Promise(function(resolve) { setTimeout(resolve, interval); });
                }
                return false;
            }
            function formatCurrencyBRL(value) {
                return Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
            }
            function escapeHtml(value) {
                return String(value == null ? "" : value)
                    .replace(/&/g,"&amp;")
                    .replace(/</g,"&lt;")
                    .replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;")
                    .replace(/'/g,"&#39;");
            }
            function formatPercentBR(value) {
                var n = Number(value || 0);
                if (!Number.isFinite(n)) n = 0;
                return (Math.round(n * 1000) / 10).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:1}) + "%";
            }
            function formatDateBR(value) {
                try {
                    if (!value) return "--";
                    var d = value instanceof Date ? value : new Date(value);
                    if (Number.isNaN(d.getTime())) return "--";
                    return d.toLocaleDateString("pt-BR");
                } catch (_) {
                    return "--";
                }
            }
            function parseAdminDateValue(value) {
                try {
                    if (!value) return null;
                    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
                    if (typeof value === "number" && Number.isFinite(value)) {
                        var numberDate = new Date(value < 10000000000 ? value * 1000 : value);
                        return Number.isNaN(numberDate.getTime()) ? null : numberDate;
                    }
                    if (typeof value === "object") {
                        if (typeof value.toDate === "function") {
                            var fromToDate = value.toDate();
                            return fromToDate instanceof Date && !Number.isNaN(fromToDate.getTime()) ? fromToDate : null;
                        }
                        var seconds = value.seconds || value._seconds;
                        if (seconds) {
                            var fromSeconds = new Date(Number(seconds) * 1000);
                            return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
                        }
                        var dateValue = value.iso || value.date || value.value || value.at || value.createdAt || "";
                        if (dateValue) return parseAdminDateValue(dateValue);
                        return null;
                    }
                    var raw = String(value || "").trim();
                    if (!raw) return null;
                    if (/^\d+$/.test(raw)) return parseAdminDateValue(Number(raw));
                    var parsed = new Date(raw);
                    return Number.isNaN(parsed.getTime()) ? null : parsed;
                } catch (_) {
                    return null;
                }
            }
            function firstAdminDateValue() {
                for (var i = 0; i < arguments.length; i += 1) {
                    var parsed = parseAdminDateValue(arguments[i]);
                    if (parsed) return parsed;
                }
                return null;
            }
            function formatAdminDateValue(value, fallback) {
                var parsed = parseAdminDateValue(value);
                return parsed ? parsed.toLocaleDateString("pt-BR") : (fallback || "-");
            }
            function addMonthsForAdminDate(startDate, months) {
                var start = parseAdminDateValue(startDate);
                if (!start) return null;
                var next = new Date(start.getTime());
                next.setMonth(next.getMonth() + Number(months || 1));
                return next;
            }
            function estimateAdminSubscriptionEnd(startDate, planRaw, statusKey) {
                var plan = String(planRaw || "").toLowerCase().trim();
                if (!startDate) return null;
                if (statusKey === "trial_active" || ["free_trial","trial","trial_active","teste_ativo"].indexOf(plan) >= 0) {
                    var trialEnd = new Date(startDate.getTime());
                    trialEnd.setDate(trialEnd.getDate() + 30);
                    return trialEnd;
                }
                if (plan === "premium") {
                    var annualEnd = new Date(startDate.getTime());
                    annualEnd.setFullYear(annualEnd.getFullYear() + 1);
                    return annualEnd;
                }
                if (["quarterly","trimestral","annual","anual"].indexOf(plan) >= 0) return addMonthsForAdminDate(startDate, 3);
                return addMonthsForAdminDate(startDate, 1);
            }
            function getCompanyProfileForUser(user) {
                var u = user && typeof user === "object" ? user : {};
                var companyId = String(u.companyId || u.tenantId || "").trim();
                if (companyId && companyProfilesById[companyId]) return companyProfilesById[companyId] || {};
                var mirror = u.uid ? companyDataByUserUid[String(u.uid)] : null;
                if (mirror && mirror.companyId && companyProfilesById[String(mirror.companyId)]) return companyProfilesById[String(mirror.companyId)] || {};
                return {};
            }
            function getCompanyCnpjForUser(user) {
                var u = user && typeof user === "object" ? user : {};
                var profile = getCompanyProfileForUser(u);
                var companyId = String(u.companyId || (profile && profile.companyId) || "").trim();
                return String(
                    (companyId && companyCnpjById[companyId] && companyCnpjById[companyId] !== "-" ? companyCnpjById[companyId] : "")
                    || u.cnpj
                    || u.cnpjCpf
                    || u.cpfCnpj
                    || u.documento
                    || profile.cnpj
                    || profile.cnpjCpf
                    || profile.cpfCnpj
                    || profile.documento
                    || ""
                ).trim();
            }
            function getLatestRequestForUser(user) {
                var uid = String(user && (user.uid || user.id || user.userId) || "").trim();
                if (!uid) return null;
                if (latestRequestsByUid[uid]) return latestRequestsByUid[uid];
                var candidates = subscriptionRequestsHistory.filter(function(item) {
                    return String(item && item.uid || "") === uid && item.request;
                }).map(function(item) {
                    return item.request;
                });
                candidates.sort(function(a, b) {
                    var da = firstAdminDateValue(a && (a.reviewedAt || a.updatedAt || a.createdAt || a.date || a.timestamp));
                    var db = firstAdminDateValue(b && (b.reviewedAt || b.updatedAt || b.createdAt || b.date || b.timestamp));
                    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
                });
                return candidates[0] || null;
            }
            function getLatestPixPaymentForUser(user) {
                var uid = String(user && (user.uid || user.id || user.userId) || "").trim();
                if (!uid) return null;
                var candidates = subscriptionPixPaymentsHistory.filter(function(item) {
                    return String(item && item.uid || "") === uid && item.payment;
                }).map(function(item) {
                    return item.payment;
                });
                candidates.sort(function(a, b) {
                    var da = firstAdminDateValue(a && (a.confirmedAt || a.updatedAt || a.createdAt || a.date));
                    var db = firstAdminDateValue(b && (b.confirmedAt || b.updatedAt || b.createdAt || b.date));
                    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
                });
                return candidates[0] || null;
            }
            function getLatestInlinePaymentForUser(user) {
                var payments = Array.isArray(user && user.payments) ? user.payments : [];
                var candidates = payments.filter(function(payment) {
                    return payment && typeof payment === "object";
                });
                candidates.sort(function(a, b) {
                    var da = firstAdminDateValue(a && (a.confirmedAt || a.dateApproved || a.updatedAt || a.createdAt || a.date));
                    var db = firstAdminDateValue(b && (b.confirmedAt || b.dateApproved || b.updatedAt || b.createdAt || b.date));
                    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
                });
                return candidates[0] || null;
            }
            function resolveAdminSubscriptionDates(user) {
                var u = user && typeof user === "object" ? user : {};
                var subscription = u.subscription && typeof u.subscription === "object" ? u.subscription : {};
                var pending = u.pendingPayment && typeof u.pendingPayment === "object" ? u.pendingPayment : {};
                var latestRequest = getLatestRequestForUser(u) || {};
                var latestPix = getLatestPixPaymentForUser(u) || {};
                var latestPayment = getLatestInlinePaymentForUser(u) || {};
                var profile = getCompanyProfileForUser(u);
                var statusKey = computeStatusKey(u);
                var planRaw = (subscription && (subscription.planKey || subscription.key || subscription.type || subscription.plan))
                    || (pending && (pending.planKey || pending.plan))
                    || (latestPayment && (latestPayment.planKey || latestPayment.plan || latestPayment.type))
                    || (latestPix && (latestPix.planKey || latestPix.plan || latestPix.type))
                    || (latestRequest && (latestRequest.planKey || latestRequest.plan || latestRequest.type))
                    || u.planKey || u.plan || u.planType || u.subscriptionType || "";
                var registrationDate = firstAdminDateValue(
                    u.createdAt,
                    u.created_at,
                    u.registeredAt,
                    u.registrationDate,
                    u.dataCadastro,
                    u.cadastroEm,
                    u.created,
                    u.timestamp,
                    profile.createdAt,
                    profile.timestamp,
                    latestRequest.createdAt,
                    latestRequest.date
                );
                var startDate = firstAdminDateValue(
                    subscription.startDate,
                    subscription.subscriptionStart,
                    subscription.createdAt,
                    u.subscriptionStart,
                    u.subscription_start,
                    u.subscriptionStartDate,
                    u.subscriptionCreatedAt,
                    u.trialStart,
                    pending.date,
                    pending.createdAt,
                    latestPayment.confirmedAt,
                    latestPayment.dateApproved,
                    latestPayment.date,
                    latestPix.confirmedAt,
                    latestPix.updatedAt,
                    latestPix.createdAt,
                    latestRequest.reviewedAt,
                    latestRequest.createdAt,
                    latestRequest.date
                );
                var endDate = firstAdminDateValue(
                    subscription.endDate,
                    subscription.subscriptionEnd,
                    subscription.subscriptionEndDate,
                    u.subscriptionEnd,
                    u.subscription_end,
                    u.subscriptionEndDate,
                    u.expiresAt,
                    u.expirationDate,
                    u.validUntil,
                    u.trialEnd,
                    latestPayment.subscriptionEndDate,
                    latestPayment.subscriptionEnd,
                    latestPayment.endDate,
                    latestPix.subscriptionEndDate,
                    latestPix.subscriptionEnd,
                    latestPix.endDate,
                    latestRequest.subscriptionEndDate,
                    latestRequest.subscriptionEnd,
                    latestRequest.endDate,
                    u.readOnlyUntil
                );
                var endEstimated = false;
                if (!endDate && startDate && (statusKey === "active" || statusKey === "trial_active")) {
                    endDate = estimateAdminSubscriptionEnd(startDate, planRaw, statusKey);
                    endEstimated = !!endDate;
                }
                var lastEventDate = firstAdminDateValue(
                    pending.updatedAt,
                    pending.date,
                    pending.createdAt,
                    latestPix.confirmedAt,
                    latestPix.updatedAt,
                    latestPix.createdAt,
                    latestPayment.confirmedAt,
                    latestPayment.dateApproved,
                    latestPayment.updatedAt,
                    latestPayment.createdAt,
                    latestPayment.date,
                    latestRequest.reviewedAt,
                    latestRequest.updatedAt,
                    latestRequest.createdAt,
                    latestRequest.date,
                    u.updatedAt,
                    startDate,
                    registrationDate
                );
                return {
                    registrationDate: registrationDate,
                    startDate: startDate,
                    endDate: endDate,
                    endEstimated: endEstimated,
                    lastEventDate: lastEventDate,
                    planRaw: planRaw
                };
            }
            function formatAdminDueDateLabel(info) {
                if (!info || !info.endDate) return "-";
                var label = formatAdminDateValue(info.endDate, "-");
                var days = Math.ceil((info.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                var suffix = "";
                if (Number.isFinite(days)) {
                    if (days >= 0) suffix = " (" + days + " dias)";
                    else suffix = " (" + Math.abs(days) + " dias venc.)";
                }
                return label + suffix + (info.endEstimated ? " estim." : "");
            }
            var COMPANY_PROFILE_FORM_FIELDS = [
                { key: "name", inputId: "companyEditName", aliases: ["name","nome","razaoSocial","fantasyName","companyName"], requiredLabel: "nome" },
                { key: "cnpj", inputId: "companyEditCnpj", aliases: ["cnpj","cnpjCpf","cpfCnpj","documento"], requiredLabel: "CNPJ" },
                { key: "stateRegistration", inputId: "companyEditStateRegistration", aliases: ["stateRegistration","inscricaoEstadual","ie"], requiredLabel: "IE" },
                { key: "email", inputId: "companyEditEmail", aliases: ["email","emailContato","contactEmail"], requiredLabel: "e-mail", transform: "lower" },
                { key: "responsibleName", inputId: "companyEditResponsible", aliases: ["responsibleName","responsavel","nomeResponsavel","owner"], requiredLabel: "responsável" },
                { key: "zip", inputId: "companyEditZip", aliases: ["zip","cep","postalCode"] },
                { key: "address", inputId: "companyEditAddress", aliases: ["address","endereco","logradouro"], requiredLabel: "endereço" },
                { key: "number", inputId: "companyEditNumber", aliases: ["number","numero"] },
                { key: "neighborhood", inputId: "companyEditNeighborhood", aliases: ["neighborhood","bairro","district"] },
                { key: "city", inputId: "companyEditCity", aliases: ["city","cidade","municipio"], requiredLabel: "cidade" },
                { key: "state", inputId: "companyEditState", aliases: ["state","estado","uf"], requiredLabel: "UF", transform: "upper" },
                { key: "phone", inputId: "companyEditPhone", aliases: ["phone","telefone","celular","whatsapp"], requiredLabel: "telefone" },
                { key: "complement", inputId: "companyEditComplement", aliases: ["complement","complemento"] }
            ];
            function normalizeCompanyProfileFormValue(field, value) {
                var out = String(value == null ? "" : value).trim();
                if (field && field.transform === "lower") return out.toLowerCase();
                if (field && field.transform === "upper") return out.toUpperCase();
                return out;
            }
            function getCompanyProfileFieldValue(company, field) {
                var c = company && typeof company === "object" ? company : {};
                var aliases = field && Array.isArray(field.aliases) ? field.aliases : [];
                for (var i = 0; i < aliases.length; i += 1) {
                    var value = c[aliases[i]];
                    if (value !== undefined && value !== null && String(value).trim() !== "") {
                        return normalizeCompanyProfileFormValue(field, value);
                    }
                }
                return "";
            }
            function getCompanyProfileValueByKey(company, key) {
                var field = COMPANY_PROFILE_FORM_FIELDS.find(function(item) {
                    return item.key === key;
                });
                return field ? getCompanyProfileFieldValue(company, field) : "";
            }
            function setCompanyProfileFormFields(company) {
                COMPANY_PROFILE_FORM_FIELDS.forEach(function(field) {
                    var el = document.getElementById(field.inputId);
                    if (el) el.value = getCompanyProfileFieldValue(company, field);
                });
            }
            function clearCompanyProfileFormFields() {
                COMPANY_PROFILE_FORM_FIELDS.forEach(function(field) {
                    var el = document.getElementById(field.inputId);
                    if (el) el.value = "";
                });
            }
            function readCompanyProfileFormPayload() {
                var payload = {};
                COMPANY_PROFILE_FORM_FIELDS.forEach(function(field) {
                    var el = document.getElementById(field.inputId);
                    payload[field.key] = normalizeCompanyProfileFormValue(field, el ? el.value : "");
                });
                return payload;
            }
            function getCompanyProfileMissingFields(company) {
                return COMPANY_PROFILE_FORM_FIELDS
                    .filter(function(field) {
                        return field.requiredLabel && !getCompanyProfileFieldValue(company, field);
                    })
                    .map(function(field) {
                        return field.requiredLabel;
                    });
            }
            function normalizeCollection(data) {
                if (!data) return [];
                if (Array.isArray(data)) return data.filter(Boolean);
                if (typeof data === "object") {
                    return Object.keys(data).map(function(key) {
                        var value = data[key];
                        if (value && typeof value === "object" && !Array.isArray(value)) {
                            return Object.assign({ id: value.id || key }, value);
                        }
                        return { id: key, value: value };
                    }).filter(Boolean);
                }
                return [];
            }
            function getUserDisplayName(user, fallbackUid) {
                var u = user && typeof user === "object" ? user : {};
                var direct = String(u.username || u.displayName || u.name || "").trim();
                if (direct) return direct;
                var email = String(u.email || "").trim();
                if (email && email.indexOf("@") > 0) return email.split("@")[0];
                var uid = String(u.uid || u.id || u.userId || fallbackUid || "").trim();
                if (uid) return "UID " + uid.slice(0, 8);
                return "Sem nome";
            }
            function canMutateSensitiveData() {
                return !!(currentAccessModel && currentAccessModel.isSuperAdmin === true);
            }
            function isOperationalSuperAdminUser(user) {
                var u = user && typeof user === "object" ? user : {};
                var uid = String(u.uid || u.id || u.userId || "").trim();
                var email = String(u.email || "").trim().toLowerCase();
                if (uid === "HfrQ6ObQq2aSEoeEE4Ng9jpAolB3") return true;
                if (email === "nedes1@hotmail.com") return true;
                if (u.superadmin === true || u.role === "superadmin") return true;
                if (u.claims && u.claims.superadmin === true) return true;
                if (window.isSuperAdminUid && typeof window.isSuperAdminUid === "function") {
                    try {
                        if (window.isSuperAdminUid(uid)) return true;
                    } catch (_) {}
                }
                return false;
            }
            function setAppContentVisible(isVisible) {
                try {
                    var tabs = document.getElementById("tabs");
                    var panel = document.querySelector(".panel");
                    if (tabs) tabs.style.display = isVisible ? "flex" : "none";
                    if (panel) panel.style.display = isVisible ? "" : "none";
                } catch (_) {}
            }
            async function logUnauthorizedAdminAttempt(reason, accessSnapshot) {
                try {
                    var details = null;
                    try {
                        if (typeof window.getCurrentUserDetails === "function") {
                            details = await window.getCurrentUserDetails();
                        }
                    } catch (_) {}
                    var authUser = null;
                    try {
                        if (window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getCurrentUser === "function") {
                            authUser = await window.firebaseService.authService.getCurrentUser();
                        }
                    } catch (_) {}
                    var uid = String((details && (details.uid || details.id || details.userId)) || (authUser && authUser.uid) || "").trim();
                    var email = String((details && details.email) || (authUser && authUser.email) || "").trim();
                    var username = String((details && (details.username || details.displayName || details.name)) || "").trim();
                    var payload = {
                        at: new Date().toISOString(),
                        reason: String(reason || "admin_access_denied"),
                        page: "admin.html",
                        path: String(window.location.pathname || "") + String(window.location.search || ""),
                        uid: uid,
                        email: email,
                        username: username,
                        access: accessSnapshot && typeof accessSnapshot === "object" ? accessSnapshot : {},
                        userAgent: String((navigator && navigator.userAgent) || "").slice(0, 220)
                    };
                    try {
                        var key = "adminAccessDeniedAudit";
                        var list = JSON.parse(localStorage.getItem(key) || "[]");
                        if (!Array.isArray(list)) list = [];
                        list.unshift(payload);
                        localStorage.setItem(key, JSON.stringify(list.slice(0, 80)));
                    } catch (_) {}
                    try {
                        if (window.firebaseService && typeof window.firebaseService.saveData === "function" && uid) {
                            var id = String(Date.now()) + "_" + Math.random().toString(36).slice(2, 8);
                            await window.firebaseService.saveData("users/" + uid + "/securityAudit/adminAccessDenied/" + id, payload);
                        }
                    } catch (_) {}
                } catch (_) {}
            }
            var settingsPreviewPlanKey = "monthly";
            function updatePaymentModalPreview() {
                var titleEl = document.getElementById("settingsPreviewTitle");
                var pixEl = document.getElementById("settingsPreviewPix");
                var amountEl = document.getElementById("settingsPreviewAmount");
                var beneficiaryEl = document.getElementById("settingsPreviewBeneficiary");
                var supportEl = document.getElementById("settingsPreviewSupport");
                var methodsEl = document.getElementById("settingsPreviewMethods");
                if (!titleEl || !pixEl || !amountEl || !beneficiaryEl || !supportEl || !methodsEl) return;
                var planMonthlyEl = document.getElementById("settingsPlanMonthly");
                var planAnnualEl = document.getElementById("settingsPlanAnnual");
                var planPremiumEl = document.getElementById("settingsPlanPremium");
                var pixKeyEl = document.getElementById("settingsPixKey");
                var paymentBeneficiaryEl = document.getElementById("settingsPaymentBeneficiary");
                var paymentSupportEmailEl = document.getElementById("settingsPaymentSupportEmail");
                var methodPixEl = document.getElementById("settingsMethodPix");
                var methodBoletoEl = document.getElementById("settingsMethodBoleto");
                var methodCardEl = document.getElementById("settingsMethodCard");
                var methodTransferEl = document.getElementById("settingsMethodTransfer");
                var monthly = parseFloat(planMonthlyEl && planMonthlyEl.value ? planMonthlyEl.value : "0") || 0;
                var quarterly = parseFloat(planAnnualEl && planAnnualEl.value ? planAnnualEl.value : "0") || 0;
                var premium = parseFloat(planPremiumEl && planPremiumEl.value ? planPremiumEl.value : "0") || 0;
                var chosenLabel = settingsPreviewPlanKey === "premium" ? "Plano Premium" : (settingsPreviewPlanKey === "quarterly" ? "Plano Trimestral" : "Plano Mensal");
                var chosenAmount = settingsPreviewPlanKey === "premium" ? premium : (settingsPreviewPlanKey === "quarterly" ? quarterly : monthly);
                titleEl.textContent = "Pagamento - " + chosenLabel;
                amountEl.textContent = formatCurrencyBRL(chosenAmount);
                pixEl.textContent = String((pixKeyEl && pixKeyEl.value) || "-").trim() || "-";
                beneficiaryEl.textContent = String((paymentBeneficiaryEl && paymentBeneficiaryEl.value) || "-").trim() || "-";
                supportEl.textContent = String((paymentSupportEmailEl && paymentSupportEmailEl.value) || "-").trim() || "-";
                var methods = [];
                if (methodPixEl && methodPixEl.checked) methods.push("PIX");
                if (methodBoletoEl && methodBoletoEl.checked) methods.push("Boleto");
                if (methodCardEl && methodCardEl.checked) methods.push("Cartão");
                if (methodTransferEl && methodTransferEl.checked) methods.push("Transferência");
                methodsEl.textContent = methods.length ? methods.join(" • ") : "Nenhum método habilitado";
            }
            function bindSettingsPreviewListeners() {
                var ids = [
                    "settingsPlanMonthly","settingsPlanAnnual","settingsPlanPremium",
                    "settingsPixKey","settingsPaymentBeneficiary","settingsPaymentSupportEmail",
                    "settingsMethodPix","settingsMethodBoleto","settingsMethodCard","settingsMethodTransfer"
                ];
                ids.forEach(function(id) {
                    var el = document.getElementById(id);
                    if (!el) return;
                    var evt = el.tagName === "INPUT" && el.type === "checkbox" ? "change" : "input";
                    el.addEventListener(evt, updatePaymentModalPreview);
                });
                var monthlyBtn = document.getElementById("settingsPreviewMonthly");
                var quarterlyBtn = document.getElementById("settingsPreviewQuarterly");
                var premiumBtn = document.getElementById("settingsPreviewPremium");
                if (monthlyBtn) monthlyBtn.addEventListener("click", function() { settingsPreviewPlanKey = "monthly"; updatePaymentModalPreview(); });
                if (quarterlyBtn) quarterlyBtn.addEventListener("click", function() { settingsPreviewPlanKey = "quarterly"; updatePaymentModalPreview(); });
                if (premiumBtn) premiumBtn.addEventListener("click", function() { settingsPreviewPlanKey = "premium"; updatePaymentModalPreview(); });
                updatePaymentModalPreview();
            }
            function normalizePlanLabel(rawPlan) {
                var key = String(rawPlan || "").toLowerCase().trim();
                if (!key) return "";
                if (["free_trial","trial","trial_active","teste_ativo"].indexOf(key) >= 0) return "Free Trial";
                if (["monthly","mensal"].indexOf(key) >= 0) return "Mensal";
                if (["quarterly","trimestral","annual","anual"].indexOf(key) >= 0) return "Trimestral";
                if (["premium"].indexOf(key) >= 0) return "Premium";
                return key;
            }
            function planLabelForUser(user) {
                var u = user && typeof user === "object" ? user : {};
                var latestRequest = getLatestRequestForUser(u) || {};
                var latestPix = getLatestPixPaymentForUser(u) || {};
                var latestPayment = getLatestInlinePaymentForUser(u) || {};
                var planRaw = (u.subscription && (u.subscription.planKey || u.subscription.key || u.subscription.type))
                    || (u.pendingPayment && (u.pendingPayment.planKey || u.pendingPayment.plan))
                    || (latestPayment && (latestPayment.planKey || latestPayment.plan || latestPayment.type))
                    || (latestPix && (latestPix.planKey || latestPix.plan || latestPix.type))
                    || (latestRequest && (latestRequest.planKey || latestRequest.plan || latestRequest.type))
                    || u.plan || u.planType || u.subscriptionType || "";
                var normalized = normalizePlanLabel(planRaw);
                if (normalized) return normalized;
                var status = computeStatusKey(u);
                if (status === "trial_active") return "Free Trial";
                if (status === "active") return "Premium";
                return "-";
            }
            function normalizeMethodLabel(rawMethod) {
                var key = String(rawMethod || "").toLowerCase().trim();
                if (!key) return "-";
                if (key.indexOf("pix") >= 0) return "PIX";
                if (key.indexOf("card") >= 0 || key.indexOf("cart") >= 0 || key === "credit_card" || key === "debit_card") return "Cartão";
                if (key.indexOf("boleto") >= 0) return "Boleto";
                if (key.indexOf("transfer") >= 0 || key.indexOf("ted") >= 0 || key.indexOf("doc") >= 0) return "Transferência";
                return key.toUpperCase();
            }
            function requestStatusLabel(rawStatus) {
                var key = String(rawStatus || "").toLowerCase().trim();
                if (key === "approved" || key === "approve") return "Aprovado";
                if (key === "rejected" || key === "reject") return "Rejeitado";
                if (key === "pending" || key === "pending_review" || key === "awaiting_double_confirmation") return "Pendente";
                if (key === "superseded") return "Substituído";
                return key || "-";
            }
            function financialEventLabel(eventType) {
                var key = String(eventType || "").toUpperCase().trim();
                if (key === "REQUEST_SUBMITTED") return "Solicitação enviada";
                if (key === "APPROVAL_PREPARED") return "Aprovação preparada";
                if (key === "APPROVAL_CONFIRMED") return "Pagamento aprovado";
                if (key === "REJECTION_CONFIRMED") return "Pagamento rejeitado";
                if (key === "PIX_PAYMENT_CREATED") return "PIX automático criado";
                if (key === "PIX_AUTO_CONFIRMED") return "PIX confirmado automaticamente";
                if (key === "PIX_AUTO_REJECTED") return "PIX recusado";
                if (key === "REQUEST_SUPERSEDED") return "Solicitação substituída";
                if (key === "BOLETO_ISSUED") return "Boleto emitido";
                if (key === "BOLETO_PAID_MARKED") return "Boleto pago (marcado)";
                if (key === "PAYMENT_RECONCILED") return "Pagamento conciliado";
                if (key === "PAYMENT_NOTE") return "Observação financeira";
                if (key === "PAYMENT_CHARGEBACK") return "Chargeback";
                return key || "Evento";
            }
            function normalizeAutoPixStatus(rawStatus) {
                var key = String(rawStatus || "").toLowerCase().trim();
                if (key === "approved") return "approved";
                if (key === "rejected" || key === "cancelled" || key === "refunded" || key === "charged_back") return "rejected";
                return "pending";
            }
            async function revalidateAutoPixPaymentRow(row) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.revalidatePixPayment !== "function") {
                        showActionMessage("Serviço de revalidação PIX indisponível.", "error");
                        return;
                    }
                    var paymentId = String(row && row.paymentId ? row.paymentId : "");
                    var providerPaymentId = String(row && row.providerPaymentId ? row.providerPaymentId : "");
                    if (!paymentId && !providerPaymentId) {
                        showActionMessage("Pagamento PIX sem identificador para revalidação.", "error");
                        return;
                    }
                    var result = await window.firebaseService.revalidatePixPayment({
                        paymentId: paymentId,
                        providerPaymentId: providerPaymentId
                    });
                    if (!result || result.success === false) {
                        showActionMessage((result && result.error) || "Falha ao revalidar PIX no provedor.", "error");
                        return;
                    }
                    showActionMessage("PIX revalidado com sucesso.", "success");
                    await loadUsersAndDashboard();
                    if (activeTab === "finance") applyFinancialFilter();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao revalidar PIX.", "error");
                }
            }
            function getLateGraceDays() {
                try {
                    var cached = JSON.parse(localStorage.getItem("subscriptionSettingsCache") || "null");
                    var days = parseInt(cached && cached.lateGraceDays, 10);
                    if (Number.isFinite(days) && days >= 0 && days <= 30) return days;
                } catch (_) {}
                return 7;
            }
            function getProofForUser(user) {
                var pending = user && user.pendingPayment ? user.pendingPayment : {};
                var fromPending = pending.proofUrl || pending.receiptUrl || pending.attachmentUrl || "";
                if (fromPending) {
                    return { url: String(fromPending), name: pending.proofFileName || pending.fileName || "Comprovante" };
                }
                var uid = String(user && user.uid ? user.uid : "");
                var latest = uid && latestRequestsByUid[uid] ? latestRequestsByUid[uid] : null;
                if (latest) {
                    var fromLatest = latest.proofUrl || latest.receiptUrl || latest.attachmentUrl || "";
                    if (fromLatest) return { url: String(fromLatest), name: latest.proofFileName || latest.fileName || "Comprovante" };
                }
                return { url: "", name: "" };
            }
            function computeStatusKey(user) {
                if (isOperationalSuperAdminUser(user || {})) return "superadmin";
                if (window.resolveSubscriptionStatus && typeof window.resolveSubscriptionStatus === "function") {
                    return window.resolveSubscriptionStatus(user || {});
                }
                return "expired";
            }
            function buildTabs(access) {
                const tabs = [];
                if (access.canDashboard || access.isSuperAdmin) {
                    tabs.push({key:"dashboard",label:"Painel",icon:"fa-chart-line"});
                }
                if (access.canSubscriptions || access.isSuperAdmin) {
                    tabs.push({key:"subscriptions",label:"Assinaturas",icon:"fa-clipboard-list"});
                }
                if (access.canSettings || access.isSuperAdmin) {
                    tabs.push({key:"settings",label:"Configurações",icon:"fa-sliders-h"});
                    tabs.push({key:"companies",label:"Empresas",icon:"fa-building"});
                    tabs.push({key:"status",label:"Status",icon:"fa-signal"});
                    tabs.push({key:"campaign",label:"Campanhas",icon:"fa-bullhorn"});
                    tabs.push({key:"finance",label:"Financeiro",icon:"fa-wallet"});
                    tabs.push({key:"security",label:"Segurança",icon:"fa-user-shield"});
                }
                if (access.isSuperAdmin) {
                    tabs.push({key:"support",label:"Suporte",icon:"fa-headset"});
                }
                return tabs;
            }
            function renderTabs(tabs) {
                const host = document.getElementById("tabs");
                host.innerHTML = "";
                host.setAttribute("role", "tablist");
                host.setAttribute("aria-label", "Seções do painel administrativo");
                tabs.forEach(function(tab) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "tab-btn" + (tab.key === activeTab ? " active" : "");
                    btn.dataset.tab = tab.key;
                    btn.setAttribute("role", "tab");
                    btn.setAttribute("aria-selected", tab.key === activeTab ? "true" : "false");
                    btn.setAttribute("aria-controls", "tab-" + tab.key);
                    btn.tabIndex = tab.key === activeTab ? 0 : -1;
                    const icon = document.createElement("i");
                    icon.className = "fas " + tab.icon;
                    const text = document.createElement("span");
                    text.textContent = tab.label;
                    btn.appendChild(icon);
                    btn.appendChild(text);
                    btn.addEventListener("click",function() {
                        switchTab(tab.key);
                    });
                    host.appendChild(btn);
                });
                setTimeout(scrollActiveAdminTabIntoView, 0);
            }
            function renderAllowedTabs() {
                const tabs = buildTabs(currentAccessModel || {});
                renderTabs(tabs.filter(function(t){return allowedTabs.includes(t.key);}));
            }
            async function switchTab(tabKey) {
                if (!allowedTabs.includes(tabKey)) return;
                activeTab = tabKey;
                try { document.documentElement.dataset.adminActiveTab = tabKey; } catch (_) {}
                renderAllowedTabs();
                const dashboardPanel = document.getElementById("tab-dashboard");
                const subscriptionsPanel = document.getElementById("tab-subscriptions");
                const settingsPanel = document.getElementById("tab-settings");
                const companiesPanel = document.getElementById("tab-companies");
                const statusPanel = document.getElementById("tab-status");
                const campaignPanel = document.getElementById("tab-campaign");
                const financePanel = document.getElementById("tab-finance");
                const securityPanel = document.getElementById("tab-security");
                const supportPanel = document.getElementById("tab-support");
                if (dashboardPanel) dashboardPanel.style.display = tabKey === "dashboard" ? "" : "none";
                if (subscriptionsPanel) subscriptionsPanel.style.display = tabKey === "subscriptions" ? "" : "none";
                if (financePanel) financePanel.style.display = tabKey === "finance" ? "" : "none";
                if (settingsPanel) settingsPanel.style.display = tabKey === "settings" ? "" : "none";
                if (companiesPanel) companiesPanel.style.display = tabKey === "companies" ? "" : "none";
                if (statusPanel) statusPanel.style.display = tabKey === "status" ? "" : "none";
                if (campaignPanel) campaignPanel.style.display = tabKey === "campaign" ? "" : "none";
                if (securityPanel) securityPanel.style.display = tabKey === "security" ? "" : "none";
                if (supportPanel) supportPanel.style.display = tabKey === "support" ? "" : "none";
                const title = document.getElementById("panelTitle");
                const subtitle = document.getElementById("panelSubtitle");
                if (tabKey === "dashboard") {
                    title.textContent = "Visão geral de assinaturas";
                    subtitle.textContent = "Resumo executivo e últimas movimentações da base de assinaturas.";
                    await loadUsersAndDashboard();
                    await loadExecutiveSummary();
                    await loadGoogleCloudBillingSummary();
                } else if (tabKey === "subscriptions") {
                    title.textContent = "Gerenciamento de assinaturas";
                    subtitle.textContent = "Lista filtrável de usuários, planos e status para decisões cirúrgicas.";
                    if (!allUsers.length) {
                        await loadUsersAndDashboard();
                    } else {
                        applyDataToUi();
                    }
                    applySubscriptionsFilter();
                } else if (tabKey === "settings") {
                    title.textContent = "Configuração comercial";
                    subtitle.textContent = "Parâmetros globais de planos, teste e carência.";
                    await loadSubscriptionSettings();
                } else if (tabKey === "companies") {
                    title.textContent = "Gestão de empresas";
                    subtitle.textContent = "Edição segura de companies/{companyId}/profile para correções pós-migração.";
                    await loadCompanyProfiles();
                    renderCompanyManagementTable();
                } else if (tabKey === "status") {
                    title.textContent = "Status e auditoria";
                    subtitle.textContent = "Acompanhamento de prorrogações e integridade administrativa.";
                    await loadOpenExtensionRequests();
                } else if (tabKey === "campaign") {
                    title.textContent = "Campanhas comerciais";
                    subtitle.textContent = "Impacto financeiro, pendências e histórico de ajustes de campanha.";
                    await loadCampaignPanel();
                } else if (tabKey === "finance") {
                    title.textContent = "Financeiro de assinaturas";
                    subtitle.textContent = "Histórico de pagamentos, atrasos e comprovantes por método.";
                    if (!allUsers.length) await loadUsersAndDashboard();
                    else applyFinancialFilter();
                } else if (tabKey === "security") {
                    title.textContent = "Auditoria de acesso administrativo";
                    subtitle.textContent = "Tentativas de acesso indevido ao admin com filtro por período e usuário.";
                    if (!allUsers.length) await loadUsersAndDashboard();
                    applyAdminAccessAuditFilter();
                } else if (tabKey === "support") {
                    title.textContent = "Fila de suporte";
                    subtitle.textContent = "Tickets multi-tenant enviados pela Central de Suporte global.";
                    await loadSupportTicketsPanel();
                }
                scheduleResponsiveTablesHydration();
                renderAllowedTabs();
                enhanceAdminPwaLayout();
            }
            function normalizeUsersFromMap(map) {
                if (!map || typeof map !== "object") return [];
                return Object.keys(map).map(function(key) {
                    const value = map[key] || {};
                    if (!value.uid && key) value.uid = key;
                    return value;
                });
            }
            function setDashboardStats(users) {
                const relevant = users.filter(function(user) {
                    const k = computeStatusKey(user);
                    return isAdminSubscriptionOverviewStatus(k);
                });
                const statusOf = function(user) {return computeStatusKey(user);};
                const totalUsersEl = document.getElementById("statTotalUsers");
                const activeEl = document.getElementById("statActiveSubscriptions");
                const trialEl = document.getElementById("statTrialUsers");
                const pendingEl = document.getElementById("statPendingPayments");
                if (totalUsersEl) { totalUsersEl.classList.remove("skeleton", "skeleton-text"); totalUsersEl.textContent = String(relevant.length); }
                if (activeEl) { activeEl.classList.remove("skeleton", "skeleton-text"); activeEl.textContent = String(relevant.filter(function(u){return statusOf(u) === "active";}).length); }
                if (trialEl) { trialEl.classList.remove("skeleton", "skeleton-text"); trialEl.textContent = String(relevant.filter(function(u){return statusOf(u) === "trial_active";}).length); }
                if (pendingEl) { pendingEl.classList.remove("skeleton", "skeleton-text"); pendingEl.textContent = String(relevant.filter(function(u){var s=statusOf(u);return s === "pending" || s === "pending_grace";}).length); }
            }
            function setExecutiveSummary(summary) {
                var defaults = {totalPaidThisMonth:0,pendingPaymentsCount:0,dueInSevenDays:0,overdueCount:0,newClientsMonth:0,campaignGoal:0};
                var s = summary && typeof summary === "object" ? summary : {};
                var merged = {};
                Object.assign(merged,defaults,s);
                var paidEl = document.getElementById("execPaidMonth");
                var pendingEl = document.getElementById("execPendingCount");
                var dueEl = document.getElementById("execDue7");
                var newClientsEl = document.getElementById("execNewClients");
                if (paidEl) { paidEl.classList.remove("skeleton", "skeleton-text"); paidEl.textContent = formatCurrencyBRL(merged.totalPaidThisMonth); }
                if (pendingEl) { pendingEl.classList.remove("skeleton", "skeleton-text"); pendingEl.textContent = String(merged.pendingPaymentsCount || 0); }
                if (dueEl) { dueEl.classList.remove("skeleton", "skeleton-text"); dueEl.textContent = String(merged.dueInSevenDays || 0); }
                if (newClientsEl) { newClientsEl.classList.remove("skeleton", "skeleton-text"); newClientsEl.textContent = String(merged.newClientsMonth || 0); }
            }
            function renderGoogleCloudBillingDashboard(data) {
                var root = data && typeof data === "object" ? data : {};
                var summary = root.summary && typeof root.summary === "object" ? root.summary : {};
                var invoices = normalizeCollection(root.invoices || root.faturas || root.documents || []);
                var usageSeries = normalizeCollection(root.costSeries || root.usageSeries || root.bigQueryCostSeries || []);
                var serviceCosts = normalizeCollection(root.serviceCosts || root.costByService || root.bigQueryServiceCosts || []);
                var companyUsageAllocation = root.companyUsageCostAllocation && typeof root.companyUsageCostAllocation === "object" ? root.companyUsageCostAllocation : {};
                var companyUsageSummary = companyUsageAllocation.summary && typeof companyUsageAllocation.summary === "object" ? companyUsageAllocation.summary : {};
                var companyUsageRows = normalizeCollection(companyUsageAllocation.rows || root.companyUsageCosts || []);
                var notifications = normalizeCollection(root.budgetNotifications || []);
                notifications.sort(function(a,b) {
                    return new Date(b.receivedAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.updatedAt || a.createdAt || 0).getTime();
                });

                var usagePercent = Number(summary.usagePercent || summary.costRatio || 0);
                if (!usagePercent && Number(summary.budgetAmount || 0) > 0) {
                    usagePercent = Number(summary.costAmount || 0) / Number(summary.budgetAmount || 1);
                }
                if (!Number.isFinite(usagePercent)) usagePercent = 0;
                var statusEl = document.getElementById("gcpBillingStatus");
                var sevEl = document.getElementById("gcpBillingSeverity");
                var updatedEl = document.getElementById("gcpBillingUpdatedAt");
                var costEl = document.getElementById("gcpBillingCost");
                var budgetEl = document.getElementById("gcpBillingBudget");
                var usageTag = document.getElementById("gcpBillingUsageTag");
                var usageBar = document.getElementById("gcpBillingUsageBar");
                var budgetNameEl = document.getElementById("gcpBillingBudgetName");
                var lastOperationalAt = summary.lastBigQuerySyncAt || summary.lastNotificationAt || summary.updatedAt || "";
                var hasOperationalData = !!lastOperationalAt;
                var severity = String(summary.severity || "").toLowerCase();
                if (!severity) severity = usagePercent >= 1 ? "error" : (usagePercent >= 0.8 ? "warning" : "ok");
                var statusLabel = severity === "error" ? "Atenção" : (severity === "warning" ? "Monitorar" : (hasOperationalData ? "Normal" : "Sem dados"));
                if (statusEl) statusEl.textContent = statusLabel;
                if (sevEl) {
                    sevEl.className = "tag " + (severity === "error" ? "red" : (severity === "warning" ? "yellow" : (hasOperationalData ? "green" : "gray")));
                    sevEl.textContent = severity === "error" ? "Crítico" : (severity === "warning" ? "Alerta" : (hasOperationalData ? "OK" : "Sem alerta"));
                }
                if (updatedEl) {
                    if (summary.lastBigQuerySyncAt) updatedEl.textContent = "BigQuery sincronizado em " + formatDateBR(summary.lastBigQuerySyncAt);
                    else if (summary.lastNotificationAt) updatedEl.textContent = "Atualizado em " + formatDateBR(summary.lastNotificationAt);
                    else updatedEl.textContent = "Aguardando Budget Pub/Sub";
                }
                if (costEl) costEl.textContent = formatCurrencyBRL(summary.costAmount || 0);
                if (budgetEl) {
                    var budgetAmount = Number(summary.budgetAmount || 0);
                    budgetEl.textContent = budgetAmount ? ("Orçamento: " + formatCurrencyBRL(budgetAmount)) : "Orçamento não sincronizado";
                }
                if (usageTag) {
                    usageTag.className = "tag " + (usagePercent >= 1 ? "red" : (usagePercent >= 0.8 ? "yellow" : "gray"));
                    usageTag.textContent = formatPercentBR(usagePercent);
                }
                if (usageBar) {
                    usageBar.className = usagePercent >= 1 ? "danger" : (usagePercent >= 0.8 ? "warn" : "");
                    usageBar.style.width = String(Math.max(0, Math.min(100, usagePercent * 100))) + "%";
                }
                if (budgetNameEl) budgetNameEl.textContent = summary.budgetDisplayName || "Sem orçamento recebido via Pub/Sub";

                var nextDueEl = document.getElementById("gcpBillingNextDue");
                var nextDueMetaEl = document.getElementById("gcpBillingNextDueMeta");
                var openInvoices = invoices.filter(function(invoice) {
                    var status = String(invoice.status || invoice.situacao || "").toLowerCase();
                    return status !== "paid" && status !== "pago" && status !== "quitado" && status !== "closed";
                });
                openInvoices.sort(function(a,b) {
                    return new Date(a.dueDate || a.vencimento || a.due || 8640000000000000).getTime() - new Date(b.dueDate || b.vencimento || b.due || 8640000000000000).getTime();
                });
                var nextInvoice = openInvoices[0] || null;
                if (nextDueEl) nextDueEl.textContent = nextInvoice ? formatDateBR(nextInvoice.dueDate || nextInvoice.vencimento || nextInvoice.due) : "--";
                if (nextDueMetaEl) nextDueMetaEl.textContent = nextInvoice ? ((nextInvoice.number || nextInvoice.invoiceNumber || nextInvoice.id || "Fatura") + " • " + formatCurrencyBRL(nextInvoice.amount || nextInvoice.valor || nextInvoice.total || 0)) : "Sem fatura cadastrada";

                var notificationEl = document.getElementById("gcpBillingLastNotification");
                if (notificationEl) {
                    var last = notifications[0] || null;
                    if (last) {
                        var pct = Math.max(Number(last.usagePercent || 0), Number(last.alertThresholdExceeded || 0), Number(last.forecastThresholdExceeded || 0));
                        notificationEl.textContent = (last.budgetDisplayName || "Budget") + "\n" + formatPercentBR(pct) + " • " + formatCurrencyBRL(last.costAmount || 0) + " de " + formatCurrencyBRL(last.budgetAmount || 0) + "\n" + formatDateBR(last.receivedAt || last.updatedAt);
                    } else {
                        notificationEl.textContent = "Nenhuma notificação recebida.";
                    }
                }

                renderGoogleCloudBillingUsageChart(usageSeries, summary);
                renderGoogleCloudBillingServiceCosts(serviceCosts);
                renderGoogleCloudBillingCompanyCosts(companyUsageRows, companyUsageSummary);
                renderGoogleCloudBillingInvoices(invoices);
            }
            function renderGoogleCloudBillingUsageChart(series, summary) {
                var chart = document.getElementById("gcpBillingUsageChart");
                if (!chart) return;
                var rows = (series || []).map(function(item) {
                    return {
                        label: String(item.label || item.month || item.period || item.date || item.id || "").slice(0, 18),
                        amount: Number(item.amount || item.cost || item.total || item.valor || item.value || 0)
                    };
                }).filter(function(item) { return item.label || item.amount; });
                if (!rows.length && summary && (summary.costAmount || summary.costIntervalStart)) {
                    rows = [{ label: summary.costIntervalStart ? formatDateBR(summary.costIntervalStart) : "Atual", amount: Number(summary.costAmount || 0) }];
                }
                if (!rows.length) {
                    chart.innerHTML = '<div class="empty-state">Aguardando exportação de custos.</div>';
                    return;
                }
                rows = rows.slice(-8);
                var max = rows.reduce(function(acc,item) { return Math.max(acc, item.amount); }, 0) || 1;
                chart.innerHTML = rows.map(function(item) {
                    var width = Math.max(4, Math.min(100, (item.amount / max) * 100));
                    return '<div class="billing-usage-row"><span>' + escapeHtml(item.label) + '</span><div class="billing-usage-bar"><span style="width:' + width + '%"></span></div><strong>' + escapeHtml(formatCurrencyBRL(item.amount)) + '</strong></div>';
                }).join("");
            }
            function renderGoogleCloudBillingServiceCosts(rows) {
                var tbody = document.getElementById("gcpBillingServiceCostsBody");
                if (!tbody) return;
                var list = (rows || []).slice().sort(function(a,b) {
                    return Number(b.netCost || b.amount || b.cost || 0) - Number(a.netCost || a.amount || a.cost || 0);
                }).slice(0, 12);
                if (!list.length) {
                    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Aguardando custos por serviço/SKU.</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(function(item) {
                    var service = String(item.service || item.servico || "-");
                    var sku = String(item.sku || item.description || "-");
                    var region = String(item.region || item.regiao || "-");
                    var gross = formatCurrencyBRL(item.grossCost || item.gross || 0);
                    var credits = formatCurrencyBRL(item.credits || item.creditos || 0);
                    var net = formatCurrencyBRL(item.netCost || item.amount || item.cost || 0);
                    return '<tr><td>' + escapeHtml(service) + '</td><td>' + escapeHtml(sku) + '</td><td>' + escapeHtml(region) + '</td><td>' + escapeHtml(gross) + '</td><td>' + escapeHtml(credits) + '</td><td>' + escapeHtml(net) + '</td></tr>';
                }).join("");
                scheduleResponsiveTablesHydration();
            }
            function renderGoogleCloudBillingCompanyCosts(rows, allocationSummary) {
                var tbody = document.getElementById("gcpBillingCompanyCostsBody");
                var meta = document.getElementById("gcpBillingCompanyCostsMeta");
                if (!tbody) return;
                var summary = allocationSummary && typeof allocationSummary === "object" ? allocationSummary : {};
                var sourceCost = Number(summary.sourceCostAmount || 0);
                if (meta) {
                    var sourceLabel = summary.source === "bigquery-billing-export" ? "BigQuery" : (summary.source === "cloud-billing-budget-pubsub" ? "Budget" : "Volume");
                    var when = summary.lastCalculatedAt ? formatDateBR(summary.lastCalculatedAt) : "--";
                    meta.textContent = (summary.companiesCount || 0) + " empresa(s) • Base " + sourceLabel + ": " + formatCurrencyBRL(sourceCost) + " • " + when;
                }
                var list = (rows || []).slice().sort(function(a,b) {
                    return Number(b.estimatedCostAmount || 0) - Number(a.estimatedCostAmount || 0);
                }).slice(0, 20);
                if (!list.length) {
                    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Aguardando rateio por volume de uso.</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(function(item) {
                    var share = Number(item.usageShare || 0);
                    var width = Math.max(3, Math.min(100, share * 100));
                    var records = Number(item.totalRecords || 0).toLocaleString("pt-BR");
                    var transactions = Number(item.transactions || 0).toLocaleString("pt-BR");
                    var inventory = Number(item.inventory || 0).toLocaleString("pt-BR");
                    var payroll = Number(item.payroll || 0).toLocaleString("pt-BR");
                    var units = Number(item.weightedUsageUnits || 0).toLocaleString("pt-BR");
                    return '<tr>'
                        + '<td>' + escapeHtml(item.companyName || "-") + '</td>'
                        + '<td><code>' + escapeHtml(item.companyId || item.id || "-") + '</code></td>'
                        + '<td><div class="billing-company-share"><span style="width:' + width + '%"></span></div><small>' + escapeHtml(formatPercentBR(share)) + ' • ' + escapeHtml(units) + ' un.</small></td>'
                        + '<td>' + escapeHtml(records) + '</td>'
                        + '<td>' + escapeHtml(transactions) + '</td>'
                        + '<td>' + escapeHtml(inventory) + '</td>'
                        + '<td>' + escapeHtml(payroll) + '</td>'
                        + '<td><strong>' + escapeHtml(formatCurrencyBRL(item.estimatedCostAmount || 0)) + '</strong></td>'
                        + '</tr>';
                }).join("");
                scheduleResponsiveTablesHydration();
            }
            function renderGoogleCloudBillingInvoices(invoices) {
                var tbody = document.getElementById("gcpBillingInvoicesBody");
                if (!tbody) return;
                var rows = (invoices || []).slice().sort(function(a,b) {
                    return new Date(b.issueDate || b.createdAt || b.period || 0).getTime() - new Date(a.issueDate || a.createdAt || a.period || 0).getTime();
                }).slice(0, 8);
                if (!rows.length) {
                    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma fatura sincronizada.</td></tr>';
                    return;
                }
                tbody.innerHTML = rows.map(function(invoice) {
                    var number = String(invoice.number || invoice.invoiceNumber || invoice.id || "-");
                    var period = String(invoice.period || invoice.month || invoice.referenceMonth || "-");
                    var due = formatDateBR(invoice.dueDate || invoice.vencimento || invoice.due);
                    var amount = formatCurrencyBRL(invoice.amount || invoice.valor || invoice.total || 0);
                    var status = String(invoice.status || invoice.situacao || "-");
                    var url = String(invoice.documentUrl || invoice.url || invoice.href || "");
                    var doc = /^https?:\/\//i.test(url) ? '<a class="link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' : "-";
                    return '<tr><td>' + escapeHtml(number) + '</td><td>' + escapeHtml(period) + '</td><td>' + escapeHtml(due) + '</td><td>' + escapeHtml(amount) + '</td><td>' + escapeHtml(status) + '</td><td>' + doc + '</td></tr>';
                }).join("");
                scheduleResponsiveTablesHydration();
            }
            async function loadGoogleCloudBillingSummary() {
                setDebugStatus("loadGoogleCloudBilling", "loading", "Consultando system/googleCloudBilling");
                try {
                    var svc = await resolveAdminFirebaseService("loadFromFirebase");
                    if (!svc || typeof svc.loadFromFirebase !== "function") {
                        renderGoogleCloudBillingDashboard(null);
                        setDebugStatus("loadGoogleCloudBilling", "error", "Serviço indisponível");
                        return;
                    }
                    var result = await svc.loadFromFirebase("system/googleCloudBilling");
                    var data = result && result.success !== false ? (result.data || null) : null;
                    renderGoogleCloudBillingDashboard(data);
                    setDebugStatus("loadGoogleCloudBilling", data ? "ok" : "idle", data ? "Dados carregados" : "Sem dados");
                } catch (error) {
                    renderGoogleCloudBillingDashboard(null);
                    setDebugStatus("loadGoogleCloudBilling", "error", error && error.message ? error.message : "Falha");
                }
            }
            async function syncGoogleCloudBillingCostExportFromAdmin() {
                var btn = document.getElementById("gcpBillingSyncBigQuery");
                if (btn) btn.disabled = true;
                setDebugStatus("syncGoogleCloudBillingCostExport", "loading", "Consultando BigQuery Billing Export");
                try {
                    var svc = await resolveAdminFirebaseService("callFunction");
                    if (!svc || typeof svc.callFunction !== "function") {
                        setDebugStatus("syncGoogleCloudBillingCostExport", "error", "Serviço indisponível");
                        notifyAdmin("Serviço Firebase indisponível para sincronizar BigQuery.", "error");
                        return;
                    }
                    var result = await svc.callFunction("syncGoogleCloudBillingCostExport", { days: 30 });
                    if (result && result.noCostData) {
                        setDebugStatus("syncGoogleCloudBillingCostExport", "idle", "Tabela pronta, mas sem linhas de custo");
                        notifyAdmin("BigQuery export já está acessível, mas ainda não trouxe linhas de custo. Mantive o valor do Budget.", "warning");
                    } else if (result && result.waiting) {
                        setDebugStatus("syncGoogleCloudBillingCostExport", "idle", "Aguardando tabela padrão do Billing Export");
                        notifyAdmin("BigQuery export ativado, mas a tabela de custo padrão ainda não apareceu.", "warning");
                    } else {
                        var serviceCount = result && result.serviceCostsCount ? result.serviceCostsCount : 0;
                        setDebugStatus("syncGoogleCloudBillingCostExport", "ok", serviceCount + " serviços/SKUs sincronizados");
                        notifyAdmin("Custos do Google Cloud Billing sincronizados.", "success");
                    }
                    await loadGoogleCloudBillingSummary();
                } catch (error) {
                    var message = error && error.message ? error.message : "Falha ao sincronizar BigQuery.";
                    setDebugStatus("syncGoogleCloudBillingCostExport", "error", message);
                    notifyAdmin(message, "error");
                } finally {
                    if (btn) btn.disabled = false;
                }
            }
            async function syncGoogleCloudBillingCompanyUsageCostsFromAdmin() {
                var btn = document.getElementById("gcpBillingSyncCompanyUsageCosts");
                if (btn) btn.disabled = true;
                setDebugStatus("estimateGoogleCloudBillingCompanyUsageCosts", "loading", "Calculando uso por companyId");
                try {
                    var svc = await resolveAdminFirebaseService("callFunction");
                    if (!svc || typeof svc.callFunction !== "function") {
                        setDebugStatus("estimateGoogleCloudBillingCompanyUsageCosts", "error", "Serviço indisponível");
                        notifyAdmin("Serviço Firebase indisponível para calcular custo por empresa.", "error");
                        return;
                    }
                    var result = await svc.callFunction("estimateGoogleCloudBillingCompanyUsageCosts", {});
                    var count = result && result.summary ? Number(result.summary.companiesCount || 0) : 0;
                    setDebugStatus("estimateGoogleCloudBillingCompanyUsageCosts", "ok", count + " empresa(s) calculadas");
                    notifyAdmin("Rateio por companyId recalculado.", "success");
                    await loadGoogleCloudBillingSummary();
                } catch (error) {
                    var message = error && error.message ? error.message : "Falha ao calcular custo por empresa.";
                    setDebugStatus("estimateGoogleCloudBillingCompanyUsageCosts", "error", message);
                    notifyAdmin(message, "error");
                } finally {
                    if (btn) btn.disabled = false;
                }
            }
            function setRecentSubscriptions(users) {
                var tbody = document.getElementById("recentSubscriptionsBody");
                if (!tbody) return;
                tbody.innerHTML = "";
                var relevant = users.filter(function(user) {
                    var k = computeStatusKey(user);
                    return isAdminSubscriptionOverviewStatus(k);
                });
                relevant.sort(function(a,b) {
                    var aInfo = resolveAdminSubscriptionDates(a);
                    var bInfo = resolveAdminSubscriptionDates(b);
                    var aDate = aInfo.lastEventDate || aInfo.registrationDate || aInfo.startDate || new Date(0);
                    var bDate = bInfo.lastEventDate || bInfo.registrationDate || bInfo.startDate || new Date(0);
                    return bDate.getTime() - aDate.getTime();
                });
                var top = relevant.slice(0,8);
                if (!top.length) {
                    var trEmpty = document.createElement("tr");
                    var tdEmpty = document.createElement("td");
                    tdEmpty.colSpan = 5;
                    tdEmpty.className = "empty-state";
                    tdEmpty.textContent = "Nenhuma assinatura relevante encontrada.";
                    trEmpty.appendChild(tdEmpty);
                    tbody.appendChild(trEmpty);
                    return;
                }
                top.forEach(function(user) {
                    var tr = document.createElement("tr");
                    tr.className = "hoverable";
                    var uName = getUserDisplayName(user);
                    var email = user.email || "";
                    var statusKey = computeStatusKey(user);
                    var plan = planLabelForUser(user);
                    var dateInfo = resolveAdminSubscriptionDates(user);
                    var tdName = document.createElement("td");
                    tdName.textContent = uName;
                    var tdEmail = document.createElement("td");
                    tdEmail.textContent = email;
                    var tdPlan = document.createElement("td");
                    tdPlan.textContent = plan || "-";
                    var tdStatus = document.createElement("td");
                    var spanStatus = document.createElement("span");
                    spanStatus.className = "status-pill " + statusClassForKey(statusKey);
                    spanStatus.textContent = statusLabelForKey(statusKey);
                    tdStatus.appendChild(spanStatus);
                    var tdDate = document.createElement("td");
                    tdDate.textContent = formatAdminDateValue(dateInfo.registrationDate || dateInfo.startDate || dateInfo.lastEventDate, "-");
                    tr.appendChild(tdName);
                    tr.appendChild(tdEmail);
                    tr.appendChild(tdPlan);
                    tr.appendChild(tdStatus);
                    tr.appendChild(tdDate);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            function statusClassForKey(key) {
                if (key === "superadmin") return "status-active";
                if (key === "active") return "status-active";
                if (key === "trial_active") return "status-trial";
                if (key === "pending" || key === "pending_grace") return "status-pending";
                if (key === "blocked") return "status-blocked";
                return "status-expired";
            }
            function isNoSubscriptionStatus(statusKey) {
                var key = String(statusKey || "").toLowerCase().trim();
                return key === "unknown" || key === "no_subscription" || key === "not_started" || key === "sem_assinatura";
            }
            function isAdminSubscriptionOverviewStatus(statusKey) {
                var key = String(statusKey || "").toLowerCase().trim();
                return isNoSubscriptionStatus(key) || ["superadmin","trial_active","pending","pending_grace","active","expired","blocked"].indexOf(key) >= 0;
            }
            function statusLabelForKey(key) {
                if (key === "superadmin") return "SuperAdmin";
                if (key === "active") return "Ativa";
                if (key === "trial_active") return "Trial ativo";
                if (key === "pending" || key === "pending_grace") return "Pendente";
                if (key === "blocked") return "Bloqueada";
                if (isNoSubscriptionStatus(key)) return "Sem assinatura";
                return "Expirada";
            }
            function canGrantAdminTrialForStatus(statusKey) {
                return isNoSubscriptionStatus(statusKey) || ["expired", "blocked", "pending", "pending_grace"].indexOf(String(statusKey || "")) >= 0;
            }
            function supportStatusLabel(status) {
                var key = String(status || "").trim().toLowerCase();
                if (key === "waiting_support") return "Aguardando suporte";
                if (key === "waiting_customer") return "Aguardando cliente";
                if (key === "resolved") return "Resolvido";
                if (key === "closed") return "Fechado";
                if (key === "open") return "Aberto";
                return key || "-";
            }
            function supportStatusClass(status) {
                var key = String(status || "").trim().toLowerCase();
                if (key === "waiting_support" || key === "open") return "status-pending";
                if (key === "waiting_customer") return "status-trial";
                if (key === "resolved" || key === "closed") return "status-active";
                return "status-expired";
            }
            function supportPriorityLabel(priority) {
                var key = String(priority || "").trim().toLowerCase();
                if (key === "critical") return "Crítica";
                if (key === "high") return "Alta";
                if (key === "low") return "Baixa";
                return "Normal";
            }
            function supportPriorityClass(priority) {
                var key = String(priority || "").trim().toLowerCase();
                if (key === "critical" || key === "high") return "status-blocked";
                if (key === "low") return "status-trial";
                return "status-expired";
            }
            function supportDateLabel(value) {
                if (!value) return "-";
                var date = new Date(value);
                if (Number.isNaN(date.getTime())) return "-";
                return date.toLocaleString("pt-BR");
            }
            function getSupportFilterPayload() {
                var statusEl = document.getElementById("supportStatusFilter");
                var priorityEl = document.getElementById("supportPriorityFilter");
                var moduleEl = document.getElementById("supportModuleFilter");
                return {
                    status: String((statusEl && statusEl.value) || "").trim(),
                    priority: String((priorityEl && priorityEl.value) || "").trim(),
                    module: String((moduleEl && moduleEl.value) || "").trim(),
                    limit: 100
                };
            }
            function supportResultData(result) {
                if (!result) return {};
                return result.data && typeof result.data === "object" ? result.data : result;
            }
            function updateSupportStats(items) {
                var list = Array.isArray(items) ? items : [];
                var waiting = list.filter(function(item) { return String(item.status || "") === "waiting_support" || String(item.status || "") === "open"; }).length;
                var customer = list.filter(function(item) { return String(item.status || "") === "waiting_customer"; }).length;
                var high = list.filter(function(item) {
                    var p = String(item.priority || "").toLowerCase();
                    return p === "critical" || p === "high";
                }).length;
                var closed = list.filter(function(item) {
                    var s = String(item.status || "").toLowerCase();
                    return s === "closed" || s === "resolved";
                }).length;
                var waitingEl = document.getElementById("supportStatWaiting");
                var customerEl = document.getElementById("supportStatCustomer");
                var highEl = document.getElementById("supportStatHigh");
                var closedEl = document.getElementById("supportStatClosed");
                if (waitingEl) waitingEl.textContent = String(waiting);
                if (customerEl) customerEl.textContent = String(customer);
                if (highEl) highEl.textContent = String(high);
                if (closedEl) closedEl.textContent = String(closed);
            }
            function filterSupportTicketsLocally(items) {
                var searchEl = document.getElementById("supportSearch");
                var term = String((searchEl && searchEl.value) || "").trim().toLowerCase();
                var list = Array.isArray(items) ? items.slice() : [];
                if (!term) return list;
                return list.filter(function(item) {
                    var haystack = [
                        item.subject,
                        item.companyName,
                        item.companyId,
                        item.createdByEmail,
                        item.module,
                        item.lastMessagePreview
                    ].join(" ").toLowerCase();
                    return haystack.indexOf(term) >= 0;
                });
            }
            function renderSupportTicketsTable(items) {
                var tbody = document.getElementById("supportTicketsBody");
                var meta = document.getElementById("supportTicketsMeta");
                if (!tbody) return;
                var list = filterSupportTicketsLocally(items);
                tbody.innerHTML = "";
                if (meta) meta.textContent = String(list.length) + " ticket" + (list.length === 1 ? "" : "s");
                updateSupportStats(list);
                if (!list.length) {
                    var emptyTr = document.createElement("tr");
                    var emptyTd = document.createElement("td");
                    emptyTd.colSpan = 8;
                    emptyTd.className = "empty-state";
                    emptyTd.textContent = "Nenhum ticket encontrado para os filtros atuais.";
                    emptyTr.appendChild(emptyTd);
                    tbody.appendChild(emptyTr);
                    scheduleResponsiveTablesHydration();
                    return;
                }
                list.forEach(function(ticket) {
                    var tr = document.createElement("tr");
                    tr.className = "hoverable";

                    var statusTd = document.createElement("td");
                    var statusPill = document.createElement("span");
                    statusPill.className = "status-pill " + supportStatusClass(ticket.status);
                    statusPill.textContent = supportStatusLabel(ticket.status);
                    statusTd.appendChild(statusPill);

                    var priorityTd = document.createElement("td");
                    var priorityPill = document.createElement("span");
                    priorityPill.className = "status-pill " + supportPriorityClass(ticket.priority);
                    priorityPill.textContent = supportPriorityLabel(ticket.priority);
                    priorityTd.appendChild(priorityPill);

                    var companyTd = document.createElement("td");
                    companyTd.textContent = ticket.companyName || ticket.companyId || "-";
                    companyTd.title = ticket.companyId || "";

                    var moduleTd = document.createElement("td");
                    moduleTd.textContent = ticket.module || "-";

                    var subjectTd = document.createElement("td");
                    var subject = document.createElement("div");
                    subject.className = "support-ticket-subject";
                    subject.textContent = ticket.subject || "Suporte Sisweb";
                    var preview = document.createElement("div");
                    preview.className = "support-ticket-preview";
                    preview.textContent = ticket.lastMessagePreview || "";
                    subjectTd.appendChild(subject);
                    subjectTd.appendChild(preview);

                    var userTd = document.createElement("td");
                    userTd.textContent = ticket.createdByEmail || ticket.createdByUid || "-";

                    var updatedTd = document.createElement("td");
                    updatedTd.textContent = supportDateLabel(ticket.updatedAt || ticket.createdAt);

                    var actionsTd = document.createElement("td");
                    var actions = document.createElement("div");
                    actions.className = "support-admin-actions";
                    var btnOpen = document.createElement("button");
                    btnOpen.type = "button";
                    btnOpen.className = "btn small primary";
                    btnOpen.innerHTML = '<i class="fas fa-eye"></i><span>Abrir</span>';
                    btnOpen.addEventListener("click", function() { openSupportTicketDetails(ticket.id); });
                    actions.appendChild(btnOpen);
                    var btnWaiting = document.createElement("button");
                    btnWaiting.type = "button";
                    btnWaiting.className = "btn small";
                    btnWaiting.textContent = "Em atendimento";
                    btnWaiting.addEventListener("click", function() { updateSupportTicketQuick(ticket.id, { status: "waiting_customer" }); });
                    actions.appendChild(btnWaiting);
                    var btnClose = document.createElement("button");
                    btnClose.type = "button";
                    btnClose.className = "btn small danger";
                    btnClose.textContent = "Fechar";
                    btnClose.addEventListener("click", function() { updateSupportTicketQuick(ticket.id, { status: "closed" }); });
                    actions.appendChild(btnClose);
                    actionsTd.appendChild(actions);

                    tr.appendChild(statusTd);
                    tr.appendChild(priorityTd);
                    tr.appendChild(companyTd);
                    tr.appendChild(moduleTd);
                    tr.appendChild(subjectTd);
                    tr.appendChild(userTd);
                    tr.appendChild(updatedTd);
                    tr.appendChild(actionsTd);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            async function loadSupportTicketsPanel() {
                var tbody = document.getElementById("supportTicketsBody");
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando tickets de suporte...</td></tr>';
                setDebugStatus("listSupportTicketsAdmin", "loading", "Iniciando");
                try {
                    var supportService = await resolveAdminFirebaseService("listSupportTicketsAdmin");
                    if (!supportService || typeof supportService.listSupportTicketsAdmin !== "function") {
                        throw new Error("Serviço listSupportTicketsAdmin indisponível.");
                    }
                    var result = await supportService.listSupportTicketsAdmin(getSupportFilterPayload());
                    var data = supportResultData(result);
                    if (!result || result.success === false || data.success === false) {
                        throw new Error((result && result.error) || (data && data.error) || "Falha ao listar tickets.");
                    }
                    supportTickets = Array.isArray(data.items) ? data.items : [];
                    renderSupportTicketsTable(supportTickets);
                    setDebugStatus("listSupportTicketsAdmin", "ok", supportTickets.length + " ticket(s)");
                } catch (err) {
                    supportTickets = [];
                    renderSupportTicketsTable([]);
                    notifyAdmin((err && err.message) || "Erro ao carregar tickets de suporte.", "error");
                    setDebugStatus("listSupportTicketsAdmin", "error", (err && err.message) || "Falha");
                }
            }
            function applySupportFilter() {
                renderSupportTicketsTable(supportTickets);
            }
            async function updateSupportTicketQuick(ticketId, payload) {
                try {
                    if (!ticketId) return;
                    var supportService = await resolveAdminFirebaseService("updateSupportTicketStatus");
                    if (!supportService || typeof supportService.updateSupportTicketStatus !== "function") {
                        throw new Error("Serviço updateSupportTicketStatus indisponível.");
                    }
                    var result = await supportService.updateSupportTicketStatus(ticketId, payload || {});
                    var data = supportResultData(result);
                    if (!result || result.success === false || data.success === false) {
                        throw new Error((result && result.error) || (data && data.error) || "Falha ao atualizar ticket.");
                    }
                    notifyAdmin("Ticket atualizado.", "success");
                    await loadSupportTicketsPanel();
                } catch (err) {
                    notifyAdmin((err && err.message) || "Erro ao atualizar ticket.", "error");
                }
            }
            function appendSupportDetailField(container, label, value) {
                var field = document.createElement("div");
                field.className = "support-detail-field";
                var strong = document.createElement("strong");
                strong.textContent = label;
                var div = document.createElement("div");
                div.textContent = value || "-";
                field.appendChild(strong);
                field.appendChild(div);
                container.appendChild(field);
            }
            var adminStorageServiceLoadPromise = null;
            var SUPPORT_ATTACHMENT_MAX_FILES = 3;
            var SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
            var SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
            var SUPPORT_ATTACHMENT_ALLOWED_TYPES = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;
            function formatSupportAttachmentBytes(bytes) {
                var value = Number(bytes || 0);
                if (!isFinite(value) || value <= 0) return "";
                if (value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + " MB";
                return Math.max(1, Math.round(value / 1024)) + " KB";
            }
            function loadAdminScriptOnce(src, id) {
                return new Promise(function(resolve, reject) {
                    var existing = document.getElementById(id);
                    if (existing && existing.dataset.loaded === "true") {
                        resolve();
                        return;
                    }
                    if (existing) {
                        existing.addEventListener("load", function() { resolve(); }, { once: true });
                        existing.addEventListener("error", function() { reject(new Error("Falha ao carregar " + src)); }, { once: true });
                        return;
                    }
                    var script = document.createElement("script");
                    script.id = id;
                    script.src = src;
                    script.defer = true;
                    script.onload = function() {
                        script.dataset.loaded = "true";
                        resolve();
                    };
                    script.onerror = function() { reject(new Error("Falha ao carregar " + src)); };
                    document.head.appendChild(script);
                });
            }
            async function resolveAdminStorageService(service) {
                if (!window.firebaseService && service) window.firebaseService = service;
                if (window.storageService && typeof window.storageService.uploadSupportAttachment === "function") {
                    return window.storageService;
                }
                if (!adminStorageServiceLoadPromise) {
                    adminStorageServiceLoadPromise = loadAdminScriptOnce("/storageService.js?v=" + encodeURIComponent(ADMIN_ASSET_VERSION), "sisweb-admin-storage-service-script")
                        .then(function() { return window.storageService || null; })
                        .catch(function(error) {
                            adminStorageServiceLoadPromise = null;
                            throw error;
                        });
                }
                var storageService = await adminStorageServiceLoadPromise;
                if (!storageService || typeof storageService.uploadSupportAttachment !== "function") {
                    throw new Error("Serviço de anexos de suporte indisponível.");
                }
                return storageService;
            }
            async function getAdminAuthUser(service) {
                try {
                    var authService = service && service.authService ? service.authService : null;
                    if (authService && typeof authService.getCurrentUser === "function") {
                        return await authService.getCurrentUser();
                    }
                } catch (_) {}
                try {
                    if (window.firebaseService && typeof window.firebaseService.getCurrentUid === "function") {
                        var uid = window.firebaseService.getCurrentUid();
                        if (uid) return { uid: uid };
                    }
                } catch (_) {}
                return null;
            }
            function validateSupportAttachmentFile(file) {
                if (!file) throw new Error("Arquivo de suporte não informado.");
                var type = String(file.type || "").toLowerCase();
                var size = Number(file.size || 0);
                if (!SUPPORT_ATTACHMENT_ALLOWED_TYPES.test(type)) {
                    throw new Error("Anexo inválido. Use PNG, JPG, WEBP, GIF ou PDF.");
                }
                if (type === "application/pdf" && size > SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES) {
                    throw new Error("PDF acima de 6MB.");
                }
                if (type.indexOf("image/") === 0 && size > SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES) {
                    throw new Error("Imagem acima de 12MB.");
                }
            }
            function renderSelectedSupportAttachments(input, listEl) {
                if (!listEl) return;
                var files = input && input.files ? Array.from(input.files) : [];
                if (!files.length) {
                    listEl.classList.remove("has-files");
                    listEl.textContent = "Opcional: ate 3 prints ou PDF. Imagens passam por compressao antes do upload.";
                    return;
                }
                listEl.classList.add("has-files");
                listEl.innerHTML = "";
                files.forEach(function(file) {
                    var chip = document.createElement("span");
                    var icon = document.createElement("i");
                    icon.className = String(file.type || "").toLowerCase() === "application/pdf" ? "fas fa-file-pdf" : "fas fa-image";
                    chip.appendChild(icon);
                    chip.appendChild(document.createTextNode((file.name || "anexo") + " "));
                    var small = document.createElement("small");
                    small.textContent = formatSupportAttachmentBytes(file.size);
                    chip.appendChild(small);
                    listEl.appendChild(chip);
                });
            }
            function createSupportAttachmentField(inputId) {
                var field = document.createElement("div");
                field.className = "support-attachment-field";
                var label = document.createElement("label");
                label.className = "support-attachment-label";
                label.setAttribute("for", inputId);
                label.innerHTML = '<i class="fas fa-paperclip"></i><span>Anexar print ou PDF</span>';
                var input = document.createElement("input");
                input.type = "file";
                input.id = inputId;
                input.accept = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
                input.multiple = true;
                var list = document.createElement("div");
                list.className = "support-attachment-list";
                field.appendChild(label);
                field.appendChild(input);
                field.appendChild(list);
                input.addEventListener("change", function() {
                    var files = input.files ? Array.from(input.files) : [];
                    try {
                        if (files.length > SUPPORT_ATTACHMENT_MAX_FILES) {
                            throw new Error("Selecione no máximo " + SUPPORT_ATTACHMENT_MAX_FILES + " anexos por mensagem.");
                        }
                        files.forEach(validateSupportAttachmentFile);
                        renderSelectedSupportAttachments(input, list);
                    } catch (err) {
                        input.value = "";
                        renderSelectedSupportAttachments(input, list);
                        notifyAdmin((err && err.message) || "Anexo inválido.", "error");
                    }
                });
                renderSelectedSupportAttachments(input, list);
                return { field: field, input: input, list: list };
            }
            async function uploadAdminSupportAttachments(input, ticket) {
                var files = input && input.files ? Array.from(input.files) : [];
                if (!files.length) return [];
                if (files.length > SUPPORT_ATTACHMENT_MAX_FILES) {
                    throw new Error("Selecione no máximo " + SUPPORT_ATTACHMENT_MAX_FILES + " anexos por mensagem.");
                }
                files.forEach(validateSupportAttachmentFile);
                var service = await resolveAdminFirebaseService("addSupportTicketMessage");
                var storageService = await resolveAdminStorageService(service);
                var authUser = await getAdminAuthUser(service);
                var attachments = [];
                for (var i = 0; i < files.length; i += 1) {
                    notifyAdmin("Tratando e enviando anexo " + (i + 1) + "/" + files.length + "...", "info");
                    var meta = await storageService.uploadSupportAttachment(files[i], {
                        companyId: ticket.companyId || "",
                        uid: authUser && authUser.uid ? authUser.uid : "",
                        ticketId: ticket.id || "",
                        role: "superadmin"
                    });
                    attachments.push({
                        name: meta.name || meta.fileName || files[i].name || ("anexo-" + (i + 1)),
                        fileName: meta.fileName || meta.name || files[i].name || ("anexo-" + (i + 1)),
                        url: meta.url || meta.downloadURL || "",
                        downloadURL: meta.downloadURL || meta.url || "",
                        storagePath: meta.storagePath || meta.path || "",
                        contentType: meta.contentType || files[i].type || "",
                        size: Number(meta.size || files[i].size || 0),
                        originalSize: Number(meta.originalSize || files[i].size || 0),
                        compressed: meta.compressed === true,
                        uploadedAt: meta.uploadedAt || new Date().toISOString()
                    });
                }
                return attachments;
            }
            function appendSupportMessageAttachments(node, attachments) {
                var list = Array.isArray(attachments) ? attachments : [];
                var valid = list.filter(function(item) { return item && (item.url || item.downloadURL); });
                if (!valid.length) return;
                var wrap = document.createElement("div");
                wrap.className = "support-message-attachments";
                valid.forEach(function(item, index) {
                    var link = document.createElement("a");
                    link.className = "support-attachment-link";
                    link.href = item.url || item.downloadURL || "#";
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    var icon = document.createElement("i");
                    icon.className = String(item.contentType || "").toLowerCase() === "application/pdf" ? "fas fa-file-pdf" : "fas fa-image";
                    var label = document.createElement("span");
                    label.textContent = item.name || item.fileName || ("Anexo " + (index + 1));
                    link.appendChild(icon);
                    link.appendChild(label);
                    var sizeLabel = formatSupportAttachmentBytes(item.size);
                    if (sizeLabel) {
                        var small = document.createElement("small");
                        small.textContent = sizeLabel;
                        link.appendChild(small);
                    }
                    wrap.appendChild(link);
                });
                node.appendChild(wrap);
            }
            function buildSupportMessageNode(message) {
                var node = document.createElement("div");
                var isInternal = String(message.visibility || "") === "internal";
                var isSupport = String(message.authorRole || "") === "superadmin" || String(message.authorRole || "") === "support";
                node.className = "support-message" + (isInternal ? " internal" : (isSupport ? " support" : ""));
                var meta = document.createElement("div");
                meta.className = "support-message-meta";
                var left = document.createElement("span");
                left.textContent = (message.authorName || message.authorEmail || message.authorRole || "Usuário") + (isInternal ? " • nota interna" : "");
                var right = document.createElement("span");
                right.textContent = supportDateLabel(message.createdAt);
                var body = document.createElement("div");
                body.className = "support-message-text";
                body.textContent = message.message || "";
                meta.appendChild(left);
                meta.appendChild(right);
                node.appendChild(meta);
                node.appendChild(body);
                appendSupportMessageAttachments(node, message.attachments);
                return node;
            }
            async function openSupportTicketDetails(ticketId) {
                try {
                    if (!ticketId) return;
                    if (!window.firebaseService || typeof window.firebaseService.getSupportTicket !== "function") {
                        throw new Error("Serviço getSupportTicket indisponível.");
                    }
                    var result = await window.firebaseService.getSupportTicket(ticketId);
                    var data = supportResultData(result);
                    if (!result || result.success === false || data.success === false || !data.ticket) {
                        throw new Error((result && result.error) || (data && data.error) || "Falha ao carregar ticket.");
                    }
                    var ticket = data.ticket || {};
                    var messages = Array.isArray(data.messages) ? data.messages : [];
                    var wrapper = document.createElement("div");
                    var grid = document.createElement("div");
                    grid.className = "support-detail-grid";
                    appendSupportDetailField(grid, "Status", supportStatusLabel(ticket.status));
                    appendSupportDetailField(grid, "Prioridade", supportPriorityLabel(ticket.priority));
                    appendSupportDetailField(grid, "Empresa/Tenant", (ticket.companyName || ticket.companyId || "-"));
                    appendSupportDetailField(grid, "Solicitante", (ticket.createdByName || ticket.createdByEmail || ticket.createdByUid || "-"));
                    appendSupportDetailField(grid, "Módulo", ticket.module || "-");
                    appendSupportDetailField(grid, "Tela", ticket.path || ticket.urlHost || "-");
                    wrapper.appendChild(grid);

                    var threadTitle = document.createElement("div");
                    threadTitle.className = "section-title";
                    threadTitle.textContent = "Histórico do chamado";
                    wrapper.appendChild(threadTitle);
                    var thread = document.createElement("div");
                    thread.className = "support-thread";
                    if (!messages.length) {
                        var empty = document.createElement("div");
                        empty.className = "empty-state";
                        empty.textContent = "Nenhuma mensagem encontrada.";
                        thread.appendChild(empty);
                    } else {
                        messages.forEach(function(message) { thread.appendChild(buildSupportMessageNode(message)); });
                    }
                    wrapper.appendChild(thread);

                    var replyBox = document.createElement("div");
                    replyBox.className = "support-reply-box";
                    var textarea = document.createElement("textarea");
                    textarea.placeholder = "Digite a resposta ao cliente ou uma nota interna...";
                    var attachmentUi = createSupportAttachmentField("adminSupportReplyAttachments_" + String(ticketId).replace(/[^\w-]+/g, "_"));
                    var controls = document.createElement("div");
                    controls.className = "support-reply-controls";
                    var internalLabel = document.createElement("label");
                    var internalCheck = document.createElement("input");
                    internalCheck.type = "checkbox";
                    internalLabel.appendChild(internalCheck);
                    internalLabel.appendChild(document.createTextNode("Nota interna"));
                    var buttons = document.createElement("div");
                    buttons.className = "support-admin-actions";
                    var sendBtn = document.createElement("button");
                    sendBtn.type = "button";
                    sendBtn.className = "btn primary";
                    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar resposta</span>';
                    sendBtn.addEventListener("click", async function() {
                        var message = String(textarea.value || "").trim();
                        var files = attachmentUi.input && attachmentUi.input.files ? Array.from(attachmentUi.input.files) : [];
                        if (!message && !files.length) {
                            notifyAdmin("Escreva uma mensagem ou anexe um print antes de enviar.", "error");
                            textarea.focus();
                            return;
                        }
                        sendBtn.disabled = true;
                        try {
                            var supportService = await resolveAdminFirebaseService("addSupportTicketMessage");
                            if (!supportService || typeof supportService.addSupportTicketMessage !== "function") {
                                throw new Error("Serviço addSupportTicketMessage indisponível.");
                            }
                            var attachments = await uploadAdminSupportAttachments(attachmentUi.input, ticket);
                            var res = await supportService.addSupportTicketMessage(ticketId, message || "Anexo enviado pelo suporte.", {
                                visibility: internalCheck.checked ? "internal" : "customer",
                                attachments: attachments
                            });
                            var resData = supportResultData(res);
                            if (!res || res.success === false || resData.success === false) {
                                throw new Error((res && res.error) || (resData && resData.error) || "Falha ao enviar resposta.");
                            }
                            notifyAdmin("Resposta registrada.", "success");
                            textarea.value = "";
                            if (attachmentUi.input) attachmentUi.input.value = "";
                            renderSelectedSupportAttachments(attachmentUi.input, attachmentUi.list);
                            if (resData && resData.message) {
                                var existingEmpty = thread.querySelector(".empty-state");
                                if (existingEmpty) existingEmpty.remove();
                                thread.appendChild(buildSupportMessageNode(resData.message));
                                thread.scrollTop = thread.scrollHeight;
                            }
                            await loadSupportTicketsPanel();
                        } catch (err) {
                            notifyAdmin((err && err.message) || "Erro ao enviar resposta.", "error");
                        } finally {
                            sendBtn.disabled = false;
                        }
                    });
                    var closeBtn = document.createElement("button");
                    closeBtn.type = "button";
                    closeBtn.className = "btn danger";
                    closeBtn.innerHTML = '<i class="fas fa-check"></i><span>Fechar ticket</span>';
                    closeBtn.addEventListener("click", function() { updateSupportTicketQuick(ticketId, { status: "closed" }); });
                    buttons.appendChild(sendBtn);
                    buttons.appendChild(closeBtn);
                    controls.appendChild(internalLabel);
                    controls.appendChild(buttons);
                    replyBox.appendChild(textarea);
                    replyBox.appendChild(attachmentUi.field);
                    replyBox.appendChild(controls);
                    wrapper.appendChild(replyBox);

                    if (window.AdminUI && typeof window.AdminUI.modal === "function") {
                        window.AdminUI.modal({
                            title: "Ticket: " + (ticket.subject || ticket.id || "Suporte"),
                            width: "860px",
                            body: wrapper,
                            actions: [{ label: "Fechar", action: "close", className: "btn" }]
                        });
                    } else {
                        notifyAdmin("AdminUI indisponível para abrir detalhes.", "error");
                    }
                } catch (err) {
                    notifyAdmin((err && err.message) || "Erro ao abrir ticket.", "error");
                }
            }
            function requestStateLabel(user) {
                var raw = String((user && (user.requestState || user.latestRequestStatus || user.approvalState)) || "").toLowerCase().trim();
                if (!raw) return "-";
                if (raw === "pending" || raw === "pending_review" || raw === "awaiting_double_confirmation") return "Pendente";
                if (raw === "approved" || raw === "approve") return "Aprovada";
                if (raw === "rejected" || raw === "reject") return "Rejeitada";
                if (raw === "superseded") return "Substituída";
                return raw;
            }
            function requestStateKey(user) {
                var raw = String((user && (user.requestState || user.latestRequestStatus || user.approvalState)) || "").toLowerCase().trim();
                if (!raw) return "none";
                if (raw === "pending" || raw === "pending_review" || raw === "awaiting_double_confirmation") return "pending";
                if (raw === "approved" || raw === "approve") return "approved";
                if (raw === "rejected" || raw === "reject") return "rejected";
                if (raw === "superseded") return "superseded";
                return raw;
            }
            function filterUsersForSubscriptions(users, filter, requestFilter, search) {
                var normalizedFilter = String(filter || "all");
                var normalizedRequestFilter = String(requestFilter || "all");
                var term = String(search || "").toLowerCase();
                var base = users.slice(0);
                if (term) {
                    base = base.filter(function(user) {
                        var email = String(user.email || "").toLowerCase();
                        var name = String(user.username || user.displayName || "").toLowerCase();
                        var company = String(getCompanyLabel(user) || "").toLowerCase();
                        return email.indexOf(term) >= 0 || name.indexOf(term) >= 0 || company.indexOf(term) >= 0;
                    });
                }
                var byStatus = normalizedFilter === "all" ? base : base.filter(function(user) {
                    var k = computeStatusKey(user);
                    if (normalizedFilter === "active") return k === "active";
                    if (normalizedFilter === "trial_active") return k === "trial_active";
                    if (normalizedFilter === "pending") return k === "pending" || k === "pending_grace";
                    if (normalizedFilter === "blocked") return k === "blocked";
                    if (normalizedFilter === "expired") return k === "expired";
                    return true;
                });
                if (normalizedRequestFilter === "all") return byStatus;
                return byStatus.filter(function(user) {
                    return requestStateKey(user) === normalizedRequestFilter;
                });
            }
            function renderSubscriptionsTable(users) {
                var tbody = document.getElementById("subscriptionsTableBody");
                var meta = document.getElementById("subscriptionsMeta");
                if (!tbody) return;
                tbody.innerHTML = "";
                if (meta) meta.textContent = String(users.length) + " registros";
                if (!users.length) {
                    var trEmpty = document.createElement("tr");
                    var tdEmpty = document.createElement("td");
                    tdEmpty.colSpan = 10;
                    tdEmpty.className = "empty-state";
                    tdEmpty.textContent = "Nenhuma assinatura encontrada para o filtro atual.";
                    trEmpty.appendChild(tdEmpty);
                    tbody.appendChild(trEmpty);
                    return;
                }
                users.forEach(function(user) {
                    var tr = document.createElement("tr");
                    tr.className = "hoverable";
                    var uName = getUserDisplayName(user);
                    var email = user.email || "";
                    var statusKey = computeStatusKey(user);
                    var isOperationalAdmin = statusKey === "superadmin" || isOperationalSuperAdminUser(user);
                    var plan = planLabelForUser(user);
                    var dateInfo = resolveAdminSubscriptionDates(user);
                    var companyCnpj = getCompanyCnpjForUser(user);
                    var tdName = document.createElement("td");
                    tdName.innerHTML = "<strong>" + escapeHtml(uName) + "</strong>";
                    var uidValue = String(user.uid || user.id || user.userId || "").trim();
                    if (uidValue) {
                        var uidSmall = document.createElement("div");
                        uidSmall.style.fontSize = "11px";
                        uidSmall.style.color = "#64748b";
                        uidSmall.textContent = "UID: " + uidValue.slice(0, 12);
                        uidSmall.title = uidValue;
                        tdName.appendChild(uidSmall);
                    }
                    var tdEmail = document.createElement("td");
                    tdEmail.textContent = email;
                    var tdCompany = document.createElement("td");
                    tdCompany.innerHTML = "<strong>" + escapeHtml(getCompanyLabel(user)) + "</strong>" + (companyCnpj ? "<br><span style=\"font-size:11px;color:#64748b;\">CNPJ: " + escapeHtml(companyCnpj) + "</span>" : "");
                    var tdRegistered = document.createElement("td");
                    tdRegistered.textContent = formatAdminDateValue(dateInfo.registrationDate, "-");
                    var tdStatus = document.createElement("td");
                    var pill = document.createElement("span");
                    pill.className = "status-pill " + statusClassForKey(statusKey);
                    pill.textContent = statusLabelForKey(statusKey);
                    tdStatus.appendChild(pill);
                    var tdPlan = document.createElement("td");
                    tdPlan.textContent = plan || "-";
                    var tdDue = document.createElement("td");
                    tdDue.textContent = formatAdminDueDateLabel(dateInfo);
                    if (dateInfo.endEstimated) tdDue.title = "Vencimento estimado porque o registro antigo não possui data final gravada.";
                    var tdRequestState = document.createElement("td");
                    var requestLabel = requestStateLabel(user);
                    tdRequestState.innerHTML = "<strong>" + escapeHtml(requestLabel) + "</strong><br><span style=\"font-size:11px;color:#64748b;\">Evento: " + escapeHtml(formatAdminDateValue(dateInfo.lastEventDate, "-")) + "</span>";
                    var tdProof = document.createElement("td");
                    var proof = getProofForUser(user);
                    if (proof.url) {
                        var proofLink = document.createElement("a");
                        proofLink.href = proof.url;
                        proofLink.target = "_blank";
                        proofLink.rel = "noopener noreferrer";
                        proofLink.textContent = "Ver anexo";
                        proofLink.className = "link";
                        tdProof.appendChild(proofLink);
                    } else {
                        tdProof.textContent = "-";
                    }
                    var tdActions = document.createElement("td");
                    var btnDetails = document.createElement("button");
                    btnDetails.type = "button";
                    btnDetails.className = "btn small";
                    btnDetails.textContent = "Detalhes";
                    btnDetails.addEventListener("click",function() {
                        openUserDetails(user);
                    });
                    tdActions.appendChild(btnDetails);
                    
                    var btnNotify = document.createElement("button");
                    btnNotify.type = "button";
                    btnNotify.className = "btn small primary";
                    btnNotify.innerHTML = '<i class="fas fa-envelope"></i><span> Notificar</span>';
                    btnNotify.style.marginLeft = "4px";
                    btnNotify.title = "Enviar e-mail para o cliente via sistema com instruções sobre prorrogação ou planos.";
                    btnNotify.addEventListener("click", async function() {
                        if (!email) {
                            showActionMessage("Este usuário não possui um endereço de e-mail cadastrado.", "error");
                            return;
                        }
                        
                        var nomeCliente = uName || "Cliente";
                        var targetUid = String(user.uid || user.id || user.userId || "").trim();
                        var subject = "Sua experiência com a plataforma Sisweb";
                        var internalMessage = "Enviamos orientações sobre prorrogação, renovação e suporte. Abra seu e-mail cadastrado para conferir os próximos passos.";
                        var body = "Olá " + nomeCliente + ",\n\n" +
                            "Esperamos que esteja aproveitando ao máximo a plataforma Sisweb! 🚀\n\n" +
                            "Gostaríamos de saber como tem sido a sua experiência. O Sisweb foi desenvolvido para impulsionar a gestão da sua empresa com ferramentas modernas e eficientes.\n\n" +
                            "=====================================\n" +
                            "PRECISA DE MAIS TEMPO PARA TESTAR?\n" +
                            "=====================================\n" +
                            "Se você sentir que precisa de mais alguns dias para avaliar todas as funcionalidades, nós podemos ajudar!\n" +
                            "👉 Acesse o sistema em: https://sisweb-7ce82.web.app/\n" +
                            "Vá na aba 'Status da Assinatura' e clique no botão 'Solicitar Prorrogação'. Faremos uma análise rápida para liberar mais dias para você.\n\n" +
                            "=====================================\n" +
                            "QUER EFETIVAR SUA ASSINATURA?\n" +
                            "=====================================\n" +
                            "Caso já tenha tomado a sua decisão e queira garantir o acesso contínuo a todas as nossas ferramentas de gestão e emissão fiscal:\n" +
                            "👉 Acesse o sistema em: https://sisweb-7ce82.web.app/\n" +
                            "Vá na aba 'Status da Assinatura' e escolha o plano que melhor se adequa ao momento do seu negócio.\n\n" +
                            "Se tiver qualquer dúvida, dificuldade técnica ou precisar de auxílio para escolher um plano, nossa equipe está à sua disposição!\n\n" +
                            "📞 Contatos para Suporte:\n" +
                            "E-mail: nelsonnedesbrito@gmail.com\n" +
                            "WhatsApp: (91) 99131-1049\n\n" +
                            "Atenciosamente,\n" +
                            "Equipe Sisweb";

                        if (window.AdminUI && typeof window.AdminUI.toast === "function") {
                            window.AdminUI.toast("Enviando e-mail para " + email + "...", "info");
                        } else {
                            showActionMessage("Enviando e-mail para " + email + "...", "info");
                        }

                        btnNotify.disabled = true;
                        var originalHtml = btnNotify.innerHTML;
                        btnNotify.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span> Enviando...</span>';

                        try {
                            if (!window.firebaseService || typeof window.firebaseService.sendSubscriptionEmail !== "function") {
                                throw new Error("Serviço de e-mail (sendSubscriptionEmail) indisponível no cliente.");
                            }

                            var result = await window.firebaseService.sendSubscriptionEmail({
                                targetUid: targetUid,
                                email: email,
                                subject: subject,
                                body: body,
                                notificationMessage: internalMessage
                            });

                            if (result && result.success) {
                                if (window.AdminUI && typeof window.AdminUI.toast === "function") {
                                    window.AdminUI.toast("E-mail enviado com sucesso para " + email, "success");
                                } else {
                                    showActionMessage("E-mail enviado com sucesso para " + email, "success");
                                }
                            } else {
                                throw new Error((result && result.error) || "Falha desconhecida no envio.");
                            }
                        } catch (err) {
                            console.error("[sendSubscriptionEmail]", err);
                            if (window.AdminUI && typeof window.AdminUI.toast === "function") {
                                window.AdminUI.toast("Erro ao enviar e-mail: " + (err.message || String(err)), "error");
                            } else {
                                showActionMessage("Erro ao enviar e-mail: " + (err.message || String(err)), "error");
                            }
                        } finally {
                            btnNotify.disabled = false;
                            btnNotify.innerHTML = originalHtml;
                        }
                    });
                    tdActions.appendChild(btnNotify);
                    if (canMutateSensitiveData()) {
                        if (isOperationalAdmin) {
                            var operationalBadge = document.createElement("span");
                            operationalBadge.className = "badge pill";
                            operationalBadge.textContent = "Conta operacional";
                            operationalBadge.title = "Acoes comerciais de assinatura nao se aplicam ao SuperAdmin.";
                            operationalBadge.style.marginLeft = "6px";
                            tdActions.appendChild(operationalBadge);
                        } else if (statusKey === "pending" || statusKey === "pending_grace") {
                            var btnApprove = document.createElement("button");
                            btnApprove.type = "button";
                            btnApprove.className = "btn small primary";
                            btnApprove.textContent = "Aprovar";
                            btnApprove.style.marginLeft = "4px";
                            btnApprove.addEventListener("click",function() {
                                approvePendingPayment(user);
                            });
                            var btnReject = document.createElement("button");
                            btnReject.type = "button";
                            btnReject.className = "btn small danger";
                            btnReject.textContent = "Rejeitar";
                            btnReject.style.marginLeft = "4px";
                            btnReject.addEventListener("click",function() {
                                rejectPendingPayment(user);
                            });
                            tdActions.appendChild(btnApprove);
                            tdActions.appendChild(btnReject);
                        } else if (statusKey === "active") {
                            var btnExtend = document.createElement("button");
                            btnExtend.type = "button";
                            btnExtend.className = "btn small";
                            btnExtend.textContent = "Prorrogar";
                            btnExtend.style.marginLeft = "4px";
                            btnExtend.addEventListener("click",function() {
                                extendSubscriptionDialog(user);
                            });
                            tdActions.appendChild(btnExtend);
                        }
                        if (!isOperationalAdmin && canGrantAdminTrialForStatus(statusKey)) {
                            var btnTrial = document.createElement("button");
                            btnTrial.type = "button";
                            btnTrial.className = "btn small";
                            btnTrial.innerHTML = '<i class="fas fa-gift"></i><span> Trial 30d</span>';
                            btnTrial.style.marginLeft = "4px";
                            btnTrial.title = "Conceder bônus de 30 dias e avisar automaticamente no sininho e por e-mail.";
                            btnTrial.addEventListener("click",function() {
                                grantAdminFreeTrialDialog(user);
                            });
                            tdActions.appendChild(btnTrial);
                        }
                        if (!isOperationalAdmin) {
                            var btnDelete = document.createElement("button");
                            btnDelete.type = "button";
                            btnDelete.className = "btn small danger";
                            btnDelete.textContent = "Excluir";
                            btnDelete.style.marginLeft = "4px";
                            btnDelete.title = "Remove dados de assinatura, requests, auditorias e financeiro do usuário.";
                            btnDelete.addEventListener("click",function() {
                                deleteSubscriptionDataFlow(user);
                            });
                            tdActions.appendChild(btnDelete);
                        }
                    } else {
                        var ro = document.createElement("span");
                        ro.className = "badge";
                        ro.textContent = "Somente visualização";
                        ro.title = "Ações sensíveis disponíveis apenas para super-admin.";
                        ro.style.marginLeft = "6px";
                        tdActions.appendChild(ro);
                    }
                    tr.appendChild(tdName);
                    tr.appendChild(tdEmail);
                    tr.appendChild(tdCompany);
                    tr.appendChild(tdRegistered);
                    tr.appendChild(tdStatus);
                    tr.appendChild(tdPlan);
                    tr.appendChild(tdDue);
                    tr.appendChild(tdRequestState);
                    tr.appendChild(tdProof);
                    tr.appendChild(tdActions);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            function buildFinancialRows() {
                var graceDays = getLateGraceDays();
                var usersByUid = {};
                allUsers.forEach(function(u) {
                    var uid = String(u && u.uid ? u.uid : "");
                    if (uid) usersByUid[uid] = u;
                });
                var rows = [];
                var auditEntries = [];
                subscriptionRequestsHistory.forEach(function(item) {
                    var req = item && item.request ? item.request : {};
                    var uid = String(item && item.uid ? item.uid : "");
                    var requestId = String(item && item.requestId ? item.requestId : (req.requestId || ""));
                    var user = uid && usersByUid[uid] ? usersByUid[uid] : {};
                    var companyId = String((user && user.companyId) || (req && req.companyId) || "");
                    var companyName = getCompanyLabel(user);
                    var cnpj = companyId && companyCnpjById[companyId] ? String(companyCnpjById[companyId]) : "";
                    var eventAt = req.createdAt || req.date || req.timestamp || null;
                    var eventDate = eventAt ? new Date(eventAt) : null;
                    var statusRaw = String(req.status || "").toLowerCase().trim();
                    var methodRaw = String(req.method || (user.pendingPayment && user.pendingPayment.method) || "").toLowerCase();
                    var amount = Number(req.amount || 0);
                    var overdueDays = 0;
                    if (statusRaw === "pending" && eventDate && !Number.isNaN(eventDate.getTime())) {
                        var ageDays = Math.max(0, Math.ceil((new Date() - eventDate) / (1000 * 60 * 60 * 24)));
                        overdueDays = Math.max(0, ageDays - graceDays);
                    }
                    rows.push({
                        uid: uid,
                        requestId: requestId,
                        email: user.email || req.email || "",
                        userName: getUserDisplayName({ ...(user || {}), username: (user && user.username) || req.username, email: (user && user.email) || req.email }, uid),
                        companyName: companyName || "-",
                        cnpj: cnpj || "-",
                        plan: normalizePlanLabel(req.plan || req.planKey || (user.subscription && user.subscription.type) || "") || planLabelForUser(user),
                        method: normalizeMethodLabel(methodRaw),
                        methodKey: methodRaw,
                        amount: amount,
                        startDate: user.subscription && user.subscription.startDate ? user.subscription.startDate : (user.trialStart || ""),
                        eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
                        status: statusRaw || "pending",
                        statusLabel: requestStatusLabel(statusRaw),
                        overdueDays: overdueDays,
                        proofUrl: req.proofUrl || req.receiptUrl || req.attachmentUrl || "",
                        proofName: req.proofFileName || req.fileName || "",
                        rawRequest: req,
                        searchBlob: [user.username,user.displayName,user.email,companyName,cnpj].filter(Boolean).join(" ").toLowerCase()
                    });
                    var timeline = [];
                    if (Array.isArray(req && req.financial && req.financial.timeline)) {
                        timeline = req.financial.timeline.slice(0);
                    }
                    timeline.forEach(function(evt) {
                        if (!evt || typeof evt !== "object") return;
                        var at = evt.at ? new Date(evt.at) : null;
                        auditEntries.push({
                            uid: uid,
                            requestId: requestId,
                            userName: getUserDisplayName({ ...(user || {}), username: (user && user.username) || req.username, email: (user && user.email) || req.email }, uid),
                            eventType: String(evt.eventType || ""),
                            details: evt.details && typeof evt.details === "object" ? evt.details : {},
                            actorUid: evt.actorUid || "",
                            at: at && !Number.isNaN(at.getTime()) ? at : null
                        });
                    });
                    var coreAudit = [
                        { eventType: "REQUEST_SUBMITTED", at: req.createdAt, actorUid: uid, details: { method: req.method || "", amount: Number(req.amount || 0) } },
                        { eventType: "APPROVAL_PREPARED", at: req.approvalChallenge && req.approvalChallenge.createdAt ? req.approvalChallenge.createdAt : null, actorUid: req.approvalChallenge && req.approvalChallenge.createdBy ? req.approvalChallenge.createdBy : "", details: { action: req.approvalChallenge && req.approvalChallenge.action ? req.approvalChallenge.action : "" } },
                        { eventType: req.status === "approved" ? "APPROVAL_CONFIRMED" : (req.status === "rejected" ? "REJECTION_CONFIRMED" : ""), at: req.reviewedAt || null, actorUid: req.reviewedBy || "", details: { reviewNote: req.reviewNote || "" } }
                    ];
                    coreAudit.forEach(function(evt) {
                        if (!evt.eventType || !evt.at) return;
                        var at = new Date(evt.at);
                        if (Number.isNaN(at.getTime())) return;
                        auditEntries.push({
                            uid: uid,
                            requestId: requestId,
                            userName: getUserDisplayName({ ...(user || {}), username: (user && user.username) || req.username, email: (user && user.email) || req.email }, uid),
                            eventType: String(evt.eventType || ""),
                            details: evt.details || {},
                            actorUid: evt.actorUid || "",
                            at: at
                        });
                    });
                });
                subscriptionPixPaymentsHistory.forEach(function(item) {
                    var pay = item && item.payment ? item.payment : {};
                    if (!pay || typeof pay !== "object") return;
                    var uid = String(item && item.uid ? item.uid : (pay.uid || ""));
                    var paymentId = String(item && item.paymentId ? item.paymentId : (pay.paymentId || ""));
                    var user = uid && usersByUid[uid] ? usersByUid[uid] : {};
                    var companyId = String((user && user.companyId) || (pay && pay.companyId) || "");
                    var companyName = getCompanyLabel(user);
                    var cnpj = companyId && companyCnpjById[companyId] ? String(companyCnpjById[companyId]) : "";
                    var eventAt = pay.confirmedAt || pay.updatedAt || pay.createdAt || null;
                    var createdAtDate = pay.createdAt ? new Date(pay.createdAt) : null;
                    var eventDate = eventAt ? new Date(eventAt) : null;
                    var statusRaw = normalizeAutoPixStatus(pay.status || pay.providerStatus);
                    var methodRaw = "pix_auto";
                    var amount = Number(pay.paidAmount != null ? pay.paidAmount : pay.amount || 0);
                    var overdueDays = 0;
                    if (statusRaw === "pending" && createdAtDate && !Number.isNaN(createdAtDate.getTime())) {
                        var ageDays = Math.max(0, Math.ceil((new Date() - createdAtDate) / (1000 * 60 * 60 * 24)));
                        overdueDays = Math.max(0, ageDays - graceDays);
                    }
                    rows.push({
                        uid: uid,
                        requestId: paymentId,
                        paymentId: paymentId,
                        providerPaymentId: String(pay.providerPaymentId || ""),
                        sourceType: "pix_auto",
                        email: user.email || pay.email || "",
                        userName: getUserDisplayName({ ...(user || {}), username: (user && user.username) || pay.username, email: (user && user.email) || pay.email }, uid),
                        companyName: companyName || "-",
                        cnpj: cnpj || "-",
                        plan: normalizePlanLabel(pay.plan || pay.planKey || "") || planLabelForUser(user),
                        method: "PIX (Auto)",
                        methodKey: methodRaw,
                        amount: amount,
                        startDate: user.subscription && user.subscription.startDate ? user.subscription.startDate : "",
                        eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
                        status: statusRaw,
                        statusLabel: requestStatusLabel(statusRaw),
                        overdueDays: overdueDays,
                        proofUrl: "",
                        proofName: "",
                        rawRequest: pay,
                        searchBlob: [user.username,user.displayName,user.email,companyName,cnpj,paymentId,pay.providerPaymentId].filter(Boolean).join(" ").toLowerCase()
                    });
                    var coreAutoAudit = [
                        { eventType: "PIX_PAYMENT_CREATED", at: pay.createdAt || null, actorUid: uid, details: { paymentId: paymentId, providerPaymentId: String(pay.providerPaymentId || ""), amount: amount } },
                        { eventType: statusRaw === "approved" ? "PIX_AUTO_CONFIRMED" : (statusRaw === "rejected" ? "PIX_AUTO_REJECTED" : ""), at: pay.confirmedAt || pay.updatedAt || null, actorUid: "system:auto_pix", details: { paymentId: paymentId, providerStatus: String(pay.providerStatus || "") } }
                    ];
                    coreAutoAudit.forEach(function(evt) {
                        if (!evt.eventType || !evt.at) return;
                        var at = new Date(evt.at);
                        if (Number.isNaN(at.getTime())) return;
                        auditEntries.push({
                            uid: uid,
                            requestId: paymentId,
                            userName: getUserDisplayName({ ...(user || {}), username: (user && user.username) || pay.username, email: (user && user.email) || pay.email }, uid),
                            eventType: String(evt.eventType || ""),
                            details: evt.details || {},
                            actorUid: evt.actorUid || "",
                            at: at
                        });
                    });
                });
                rows.sort(function(a,b) {
                    var aTs = a.eventDate ? a.eventDate.getTime() : 0;
                    var bTs = b.eventDate ? b.eventDate.getTime() : 0;
                    return bTs - aTs;
                });
                financialRows = rows;
                auditEntries.sort(function(a,b) {
                    var aTs = a.at ? a.at.getTime() : 0;
                    var bTs = b.at ? b.at.getTime() : 0;
                    return bTs - aTs;
                });
                financialAuditEntries = auditEntries;
                var now = new Date();
                var currentMonth = now.getMonth();
                var currentYear = now.getFullYear();

                // ── KPIs básicos ──────────────────────────────────────
                var approvedThisMonth = rows.filter(function(r){
                    return r.status === "approved" && r.eventDate &&
                           r.eventDate.getMonth() === currentMonth &&
                           r.eventDate.getFullYear() === currentYear;
                });
                var totalPaidMonth = approvedThisMonth.reduce(function(acc,r){return acc + Number(r.amount || 0);},0);
                var pendingAmount = rows.filter(function(r){return r.status === "pending";}).reduce(function(acc,r){return acc + Number(r.amount || 0);},0);
                var overdueCount = rows.filter(function(r){return r.status === "pending" && r.overdueDays > 0;}).length;
                var boletoPending = rows.filter(function(r){return r.status === "pending" && r.methodKey.indexOf("boleto") >= 0;}).length;

                // ── KPIs SaaS ─────────────────────────────────────────
                var mrr = totalPaidMonth;
                var avgTicket = approvedThisMonth.length > 0 ? (totalPaidMonth / approvedThisMonth.length) : 0;

                // Conversão: usuários que tinham trial e agora têm status "active"
                var totalTrialEver = allUsers.filter(function(u){ return u.trialStart; }).length;
                var convertedFromTrial = allUsers.filter(function(u){
                    var k = computeStatusKey(u);
                    return u.trialStart && k === "active";
                }).length;
                var conversionRate = totalTrialEver > 0 ? Math.round((convertedFromTrial / totalTrialEver) * 100) : 0;

                // Inadimplência: pagamentos em atraso / total pendentes
                var totalPending = rows.filter(function(r){return r.status === "pending";}).length;
                var churnRate = totalPending > 0 ? Math.round((overdueCount / totalPending) * 100) : 0;

                // ── Atualizar DOM ────────────────────────────────────
                var paidEl = document.getElementById("finTotalRevenue");
                var pendingEl = document.getElementById("finPendingAmount");
                var overdueEl = document.getElementById("finOverdueCount");
                var boletoEl = document.getElementById("finBoletoPending");
                var mrrEl = document.getElementById("finMrr");
                var avgTicketEl = document.getElementById("finAvgTicket");
                var convEl = document.getElementById("finConversionRate");
                var churnEl = document.getElementById("finChurnRate");

                if (paidEl) paidEl.textContent = formatCurrencyBRL(totalPaidMonth);
                if (pendingEl) pendingEl.textContent = formatCurrencyBRL(pendingAmount);
                if (overdueEl) overdueEl.textContent = String(overdueCount);
                if (boletoEl) boletoEl.textContent = String(boletoPending);
                if (mrrEl) mrrEl.textContent = formatCurrencyBRL(mrr);
                if (avgTicketEl) avgTicketEl.textContent = formatCurrencyBRL(avgTicket);
                if (convEl) convEl.textContent = conversionRate + "%";
                if (churnEl) {
                    churnEl.textContent = churnRate + "%";
                    churnEl.style.color = churnRate > 30 ? "#dc2626" : (churnRate > 10 ? "#d97706" : "#16a34a");
                }

                // ── Gráfico de barras — últimos 6 meses ──────────────
                (function drawRevenueChart() {
                    var canvas = document.getElementById("finRevenueChart");
                    if (!canvas || !canvas.getContext) return;
                    var legendEl = document.getElementById("finChartLegend");

                    // Montar array de 6 meses retroativos
                    var months = [];
                    for (var i = 5; i >= 0; i--) {
                        var d = new Date(currentYear, currentMonth - i, 1);
                        months.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString("pt-BR", {month:"short", year:"2-digit"}), approved: 0, pending: 0 });
                    }
                    rows.forEach(function(r) {
                        if (!r.eventDate) return;
                        var rm = r.eventDate.getMonth(), ry = r.eventDate.getFullYear();
                        var slot = months.find(function(m){ return m.month === rm && m.year === ry; });
                        if (!slot) return;
                        if (r.status === "approved") slot.approved += Number(r.amount || 0);
                        else if (r.status === "pending") slot.pending += Number(r.amount || 0);
                    });

                    var dpr = window.devicePixelRatio || 1;
                    var cssW = canvas.parentElement ? canvas.parentElement.clientWidth - 32 : 600;
                    var cssH = 140;
                    canvas.width = cssW * dpr;
                    canvas.height = cssH * dpr;
                    canvas.style.width = cssW + "px";
                    canvas.style.height = cssH + "px";

                    var ctx = canvas.getContext("2d");
                    ctx.scale(dpr, dpr);

                    var W = cssW, H = cssH;
                    var padL = 56, padR = 16, padT = 16, padB = 32;
                    var chartW = W - padL - padR;
                    var chartH = H - padT - padB;
                    var maxVal = Math.max(1, Math.max.apply(null, months.map(function(m){ return m.approved + m.pending; })));
                    var barGroupW = chartW / months.length;
                    var barW = Math.max(8, barGroupW * 0.28);

                    ctx.clearRect(0, 0, W, H);

                    // Grid lines
                    ctx.strokeStyle = "#e2e8f0";
                    ctx.lineWidth = 1;
                    for (var g = 0; g <= 4; g++) {
                        var yg = padT + chartH - (g / 4) * chartH;
                        ctx.beginPath(); ctx.moveTo(padL, yg); ctx.lineTo(W - padR, yg); ctx.stroke();
                        ctx.fillStyle = "#94a3b8";
                        ctx.font = "10px Arial";
                        ctx.textAlign = "right";
                        ctx.fillText(formatCurrencyBRL((maxVal * g / 4)).replace("R$","R$").slice(0,9), padL - 4, yg + 3);
                    }

                    // Bars
                    months.forEach(function(m, idx) {
                        var x = padL + idx * barGroupW + (barGroupW - barW * 2 - 4) / 2;
                        var hApproved = (m.approved / maxVal) * chartH;
                        var hPending = (m.pending / maxVal) * chartH;

                        // Approved bar (green)
                        ctx.fillStyle = "#22c55e";
                        ctx.beginPath();
                        ctx.roundRect(x, padT + chartH - hApproved, barW, hApproved, [3, 3, 0, 0]);
                        ctx.fill();

                        // Pending bar (amber)
                        ctx.fillStyle = "#f59e0b";
                        ctx.beginPath();
                        ctx.roundRect(x + barW + 3, padT + chartH - hPending, barW, hPending, [3, 3, 0, 0]);
                        ctx.fill();

                        // Month label
                        ctx.fillStyle = "#64748b";
                        ctx.font = "10px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText(m.label, x + barW, padT + chartH + 16);
                    });

                    // Legend
                    if (legendEl) {
                        legendEl.innerHTML =
                            '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;"></span>Aprovado</span>' +
                            '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;"></span>Pendente</span>';
                    }
                })();

                // ── Botão Exportar CSV ───────────────────────────────
                var exportBtn = document.getElementById("finExportCsvBtn");
                if (exportBtn && !exportBtn._csvBound) {
                    exportBtn._csvBound = true;
                    exportBtn.addEventListener("click", function() {
                        try {
                            var headers = ["Cliente","Empresa","CNPJ","Plano","Método","Valor","Data Evento","Dias Atraso","Status"];
                            var csvRows = [headers.join(";")];
                            financialRows.forEach(function(r) {
                                csvRows.push([
                                    '"' + (r.userName || "").replace(/"/g,'""') + '"',
                                    '"' + (r.companyName || "").replace(/"/g,'""') + '"',
                                    '"' + (r.cnpj || "").replace(/"/g,'""') + '"',
                                    '"' + (r.plan || "").replace(/"/g,'""') + '"',
                                    '"' + (r.method || "").replace(/"/g,'""') + '"',
                                    String(r.amount || 0).replace(".",","),
                                    r.eventDate ? r.eventDate.toLocaleDateString("pt-BR") : "",
                                    String(r.overdueDays || 0),
                                    '"' + (r.statusLabel || r.status || "").replace(/"/g,'""') + '"'
                                ].join(";"));
                            });
                            var csvContent = "\uFEFF" + csvRows.join("\r\n");
                            var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement("a");
                            a.href = url;
                            a.download = "financeiro_sisweb_" + new Date().toISOString().slice(0,10) + ".csv";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            notifyAdmin("CSV exportado com sucesso!", "success");
                        } catch(err) {
                            notifyAdmin("Erro ao exportar CSV: " + (err.message || err), "error");
                        }
                    });
                }
            }
            async function runFinancialEventAction(row, eventType, detailsBuilder) {
                try {
                    if (!row || !row.requestId || !row.uid) {
                        showActionMessage("Linha financeira sem requestId/uid válido.", "error");
                        return;
                    }
                    if (!window.firebaseService || typeof window.firebaseService.updateSubscriptionFinancialEvent !== "function") {
                        showActionMessage("Serviço financeiro transacional indisponível.", "error");
                        return;
                    }
                    var details = typeof detailsBuilder === "function" ? detailsBuilder() : {};
                    if (details === null) return;
                    var result = await window.firebaseService.updateSubscriptionFinancialEvent({
                        uid: row.uid,
                        requestId: row.requestId,
                        eventType: eventType,
                        details: details || {}
                    });
                    if (!result || result.success === false) {
                        showActionMessage((result && result.error) || "Falha na atualização financeira.", "error");
                        return;
                    }
                    showActionMessage("Evento financeiro registrado com sucesso.", "success");
                    await loadUsersAndDashboard();
                    applyFinancialFilter();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao registrar evento financeiro.", "error");
                }
            }
            function renderFinancialAudit(entries) {
                var tbody = document.getElementById("financialAuditBody");
                var meta = document.getElementById("financialAuditMeta");
                if (!tbody) return;
                tbody.innerHTML = "";
                if (meta) meta.textContent = String(entries.length) + " eventos";
                if (!entries.length) {
                    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Sem eventos de auditoria para os filtros atuais.</td></tr>';
                    return;
                }
                entries.slice(0, 120).forEach(function(evt) {
                    var tr = document.createElement("tr");
                    var tdWhen = document.createElement("td");
                    tdWhen.textContent = evt.at ? evt.at.toLocaleString("pt-BR") : "-";
                    var tdUser = document.createElement("td");
                    tdUser.textContent = evt.userName || "-";
                    var tdEvent = document.createElement("td");
                    tdEvent.textContent = financialEventLabel(evt.eventType);
                    var tdDetails = document.createElement("td");
                    var detailsText = Object.keys(evt.details || {}).map(function(k){ return k + ": " + String(evt.details[k]); }).join(" • ");
                    tdDetails.textContent = detailsText || "-";
                    tdDetails.style.whiteSpace = "normal";
                    var tdActor = document.createElement("td");
                    tdActor.textContent = evt.actorUid || "-";
                    tr.appendChild(tdWhen);
                    tr.appendChild(tdUser);
                    tr.appendChild(tdEvent);
                    tr.appendChild(tdDetails);
                    tr.appendChild(tdActor);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            function renderFinancialTable(rows) {
                var tbody = document.getElementById("financialTableBody");
                var meta = document.getElementById("financialMeta");
                if (!tbody) return;
                tbody.innerHTML = "";
                if (meta) meta.textContent = String(rows.length) + " lançamentos";
                if (!rows.length) {
                    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhum lançamento financeiro para os filtros aplicados.</td></tr>';
                    return;
                }
                rows.forEach(function(row) {
                    var tr = document.createElement("tr");
                    tr.className = "hoverable";
                    var tdClient = document.createElement("td");
                    tdClient.textContent = row.userName || "-";
                    var tdCompany = document.createElement("td");
                    tdCompany.textContent = row.companyName + " / " + row.cnpj;
                    var tdPlan = document.createElement("td");
                    tdPlan.textContent = row.plan || "-";
                    var tdMethod = document.createElement("td");
                    tdMethod.textContent = row.method || "-";
                    var tdAmount = document.createElement("td");
                    tdAmount.textContent = formatCurrencyBRL(row.amount || 0);
                    var tdStart = document.createElement("td");
                    tdStart.textContent = row.startDate ? new Date(row.startDate).toLocaleDateString("pt-BR") : "-";
                    var tdEvent = document.createElement("td");
                    tdEvent.textContent = row.eventDate ? row.eventDate.toLocaleDateString("pt-BR") : "-";
                    var tdOverdue = document.createElement("td");
                    tdOverdue.textContent = row.overdueDays > 0 ? String(row.overdueDays) + " dia(s)" : "-";
                    var tdProof = document.createElement("td");
                    if (row.proofUrl) {
                        var a = document.createElement("a");
                        a.href = row.proofUrl;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        a.className = "link";
                        a.textContent = "Ver anexo";
                        tdProof.appendChild(a);
                    } else {
                        tdProof.textContent = "-";
                    }
                    var tdStatus = document.createElement("td");
                    var statusPill = document.createElement("span");
                    var statusKey = row.status === "approved" ? "active" : (row.status === "pending" ? "pending" : (row.status === "rejected" ? "blocked" : "expired"));
                    if (row.status === "pending" && row.overdueDays > 0) statusKey = "expired";
                    statusPill.className = "status-pill " + statusClassForKey(statusKey);
                    statusPill.textContent = row.status === "pending" && row.overdueDays > 0 ? "Em atraso" : row.statusLabel;
                    tdStatus.appendChild(statusPill);
                    var tdActions = document.createElement("td");
                    tdActions.style.whiteSpace = "normal";
                    var isAutoPix = row.sourceType === "pix_auto";
                    var canUseRequestTimeline = !isAutoPix && !!(row.requestId && row.uid);
                    if (!canMutateSensitiveData()) {
                        tdActions.textContent = "Somente visualização";
                        tdActions.title = "Ações financeiras transacionais disponíveis apenas para super-admin.";
                    }
                    var currentUser = allUsers.find(function(u) { return String((u && u.uid) || "") === String(row.uid || ""); }) || { uid: row.uid, email: row.email, username: row.userName };
                    var mkButton = function(label, className, tooltip, onClick) {
                        var b = document.createElement("button");
                        b.type = "button";
                        b.className = "btn small " + className;
                        b.style.marginRight = "4px";
                        b.style.marginBottom = "4px";
                        b.textContent = label;
                        b.title = tooltip || label;
                        b.addEventListener("click", onClick);
                        return b;
                    };
                    if (canMutateSensitiveData() && canUseRequestTimeline && row.method === "Boleto" && row.status === "pending") {
                        tdActions.appendChild(mkButton("Emitir boleto", "", "Registra emissão do boleto e dados de cobrança.", function() {
                            runFinancialEventAction(row, "BOLETO_ISSUED", function() {
                                var dueDate = prompt("Vencimento do boleto (YYYY-MM-DD):", "");
                                if (dueDate === null) return null;
                                var line = prompt("Linha digitável:", "") || "";
                                var ourNumber = prompt("Nosso número:", "") || "";
                                return { dueDate: dueDate || "", boletoLine: line, ourNumber: ourNumber };
                            });
                        }));
                        tdActions.appendChild(mkButton("Marcar pago", "primary", "Marca boleto como pago aguardando conciliação.", function() {
                            runFinancialEventAction(row, "BOLETO_PAID_MARKED", function() {
                                var txid = prompt("TXID/NSU da baixa:", "") || "";
                                return { txid: txid };
                            });
                        }));
                    }
                    if (canMutateSensitiveData() && canUseRequestTimeline && row.status === "pending") {
                        tdActions.appendChild(mkButton("Aprovar", "primary", "Aprova o pagamento e ativa assinatura do usuário.", function() {
                            approvePendingPayment(currentUser);
                        }));
                        tdActions.appendChild(mkButton("Rejeitar", "danger", "Rejeita o pagamento pendente com justificativa.", function() {
                            rejectPendingPayment(currentUser);
                        }));
                    }
                    if (canMutateSensitiveData() && canUseRequestTimeline && (row.status === "pending" || row.status === "approved")) {
                        tdActions.appendChild(mkButton("Conciliar", "", "Registra conciliação financeira com referência contábil.", function() {
                            runFinancialEventAction(row, "PAYMENT_RECONCILED", function() {
                                var ref = prompt("Referência de conciliação:", "") || "";
                                return { reconciliationRef: ref, amount: row.amount || 0 };
                            });
                        }));
                    }
                    if (canMutateSensitiveData() && canUseRequestTimeline && row.status !== "rejected") {
                        tdActions.appendChild(mkButton("Observação", "", "Adiciona observação financeira auditável para o pagamento.", function() {
                            runFinancialEventAction(row, "PAYMENT_NOTE", function() {
                                var note = prompt("Observação financeira:", "");
                                if (note === null) return null;
                                return { note: note };
                            });
                        }));
                    }
                    if (canMutateSensitiveData() && canUseRequestTimeline && row.status === "approved") {
                        tdActions.appendChild(mkButton("Chargeback", "danger", "Registra chargeback/estorno para auditoria financeira.", function() {
                            runFinancialEventAction(row, "PAYMENT_CHARGEBACK", function() {
                                var note = prompt("Motivo do chargeback:", "");
                                if (note === null) return null;
                                return { note: note };
                            });
                        }));
                    }
                    if (canMutateSensitiveData() && canUseRequestTimeline) {
                        tdActions.appendChild(mkButton("Excluir", "danger", "Exclui dados de assinatura do usuário, incluindo financeiro e auditorias.", function() {
                            deleteSubscriptionDataFlow(currentUser);
                        }));
                    }
                    if (canMutateSensitiveData() && isAutoPix) {
                        tdActions.appendChild(mkButton("Revalidar PIX", "primary", "Consulta o status mais recente do PIX no provedor.", function() {
                            revalidateAutoPixPaymentRow(row);
                        }));
                    }
                    if (canMutateSensitiveData() && !canUseRequestTimeline && !isAutoPix) {
                        tdActions.textContent = "Sem request transacional";
                    }
                    tr.appendChild(tdClient);
                    tr.appendChild(tdCompany);
                    tr.appendChild(tdPlan);
                    tr.appendChild(tdMethod);
                    tr.appendChild(tdAmount);
                    tr.appendChild(tdStart);
                    tr.appendChild(tdEvent);
                    tr.appendChild(tdOverdue);
                    tr.appendChild(tdProof);
                    tr.appendChild(tdStatus);
                    tr.appendChild(tdActions);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            function applyFinancialFilter() {
                buildFinancialRows();
                var methodEl = document.getElementById("financialMethodFilter");
                var statusEl = document.getElementById("financialStatusFilter");
                var searchEl = document.getElementById("financialSearch");
                var method = methodEl ? String(methodEl.value || "all") : "all";
                var status = statusEl ? String(statusEl.value || "all") : "all";
                var term = searchEl ? String(searchEl.value || "").toLowerCase().trim() : "";
                var filtered = financialRows.filter(function(row) {
                    if (method !== "all") {
                        if (method === "card" && row.method !== "Cartão") return false;
                        if (method === "pix" && String(row.methodKey || "").indexOf("pix") < 0) return false;
                        if (method === "boleto" && row.method !== "Boleto") return false;
                        if (method === "transfer" && row.method !== "Transferência") return false;
                        if (method === "other" && (String(row.methodKey || "").indexOf("pix") >= 0 || ["Cartão","Boleto","Transferência"].indexOf(row.method) >= 0)) return false;
                    }
                    if (status !== "all") {
                        if (status === "overdue") {
                            if (!(row.status === "pending" && row.overdueDays > 0)) return false;
                        } else if (row.status !== status) {
                            return false;
                        }
                    }
                    if (term) {
                        if (row.searchBlob.indexOf(term) < 0) return false;
                    }
                    return true;
                });
                renderFinancialTable(filtered);
                var filteredKeySet = new Set(filtered.map(function(r) { return String(r.uid || "") + "|" + String(r.requestId || ""); }));
                var filteredAudit = financialAuditEntries.filter(function(evt) {
                    var key = String(evt.uid || "") + "|" + String(evt.requestId || "");
                    return filteredKeySet.has(key);
                });
                renderFinancialAudit(filteredAudit);
            }
            function buildAdminDeniedAuditRows() {
                var rows = [];
                allUsers.forEach(function(user) {
                    var uid = String((user && (user.uid || user.id || user.userId)) || "").trim();
                    var email = String((user && user.email) || "").trim();
                    var username = getUserDisplayName(user, uid);
                    var auditMap = user && user.securityAudit && user.securityAudit.adminAccessDenied && typeof user.securityAudit.adminAccessDenied === "object"
                        ? user.securityAudit.adminAccessDenied
                        : {};
                    Object.keys(auditMap || {}).forEach(function(key) {
                        var item = auditMap[key] || {};
                        rows.push({
                            at: item.at || "",
                            user: item.username || username || "",
                            email: item.email || email || "",
                            uid: item.uid || uid || "",
                            reason: item.reason || "",
                            path: item.path || "",
                            source: "firebase"
                        });
                    });
                });
                try {
                    var localRows = JSON.parse(localStorage.getItem("adminAccessDeniedAudit") || "[]");
                    if (Array.isArray(localRows)) {
                        localRows.forEach(function(item) {
                            if (!item || typeof item !== "object") return;
                            rows.push({
                                at: item.at || "",
                                user: item.username || "",
                                email: item.email || "",
                                uid: item.uid || "",
                                reason: item.reason || "",
                                path: item.path || "",
                                source: "local"
                            });
                        });
                    }
                } catch (_) {}
                var seen = new Set();
                adminDeniedAuditRows = rows.filter(function(r) {
                    var k = [String(r.at),String(r.uid),String(r.reason),String(r.path)].join("|");
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                }).sort(function(a,b) {
                    var atA = new Date(a.at || 0).getTime() || 0;
                    var atB = new Date(b.at || 0).getTime() || 0;
                    return atB - atA;
                });
            }
            function applyAdminAccessAuditFilter() {
                buildAdminDeniedAuditRows();
                var periodEl = document.getElementById("adminAccessPeriodFilter");
                var userEl = document.getElementById("adminAccessUserFilter");
                var riskEl = document.getElementById("secRiskFilter");
                var metaEl = document.getElementById("adminAccessAuditMeta");
                var body = document.getElementById("adminAccessAuditBody");
                if (!body) return;
                var period = periodEl ? String(periodEl.value || "30d") : "30d";
                var term = userEl ? String(userEl.value || "").toLowerCase().trim() : "";
                var riskFilter = riskEl ? String(riskEl.value || "all") : "all";
                var now = Date.now();
                var cutoff = 0;
                if (period === "24h") cutoff = now - (24 * 60 * 60 * 1000);
                else if (period === "7d") cutoff = now - (7 * 24 * 60 * 60 * 1000);
                else if (period === "30d") cutoff = now - (30 * 24 * 60 * 60 * 1000);

                // ── Contar ocorrências por UID/email para Risk Score ──
                var attackCountByKey = {};
                adminDeniedAuditRows.forEach(function(row) {
                    var k = row.uid || row.email || row.user || "unknown";
                    attackCountByKey[k] = (attackCountByKey[k] || 0) + 1;
                });

                function getRiskScore(row) {
                    var k = row.uid || row.email || row.user || "unknown";
                    return attackCountByKey[k] || 1;
                }
                function getRiskLevel(score) {
                    if (score >= 3) return "high";
                    if (score === 2) return "medium";
                    return "low";
                }

                var filtered = adminDeniedAuditRows.filter(function(row) {
                    var ts = new Date(row.at || 0).getTime() || 0;
                    if (cutoff && ts && ts < cutoff) return false;
                    if (term) {
                        var blob = [row.user, row.email, row.uid, row.reason, row.path, row.source,
                                    row.userAgent || ""].join(" ").toLowerCase();
                        if (blob.indexOf(term) < 0) return false;
                    }
                    if (riskFilter !== "all") {
                        var score = getRiskScore(row);
                        var level = getRiskLevel(score);
                        if (riskFilter === "high" && level !== "high") return false;
                        if (riskFilter === "medium" && level !== "medium") return false;
                        if (riskFilter === "low" && level !== "low") return false;
                    }
                    return true;
                });

                // ── KPIs ────────────────────────────────────────────
                var todayCutoff = now - (24 * 60 * 60 * 1000);
                var todayCount = filtered.filter(function(r) {
                    return new Date(r.at || 0).getTime() >= todayCutoff;
                }).length;
                var uniqueUids = new Set(filtered.map(function(r){ return r.uid || r.email || r.user || ""; }));
                uniqueUids.delete("");
                var highRiskKeys = Object.keys(attackCountByKey).filter(function(k){ return attackCountByKey[k] >= 3; });

                var totEl = document.getElementById("secTotalEvents");
                var uniqEl = document.getElementById("secUniqueUsers");
                var hrEl = document.getElementById("secHighRisk");
                var todayEl = document.getElementById("secTodayEvents");
                var rankMetaEl = document.getElementById("secRankMeta");
                var hrListEl = document.getElementById("secHighRiskList");

                if (totEl) totEl.textContent = String(filtered.length);
                if (uniqEl) uniqEl.textContent = String(uniqueUids.size);
                if (hrEl) {
                    hrEl.textContent = String(highRiskKeys.length);
                    hrEl.style.color = highRiskKeys.length > 0 ? "#dc2626" : "#16a34a";
                }
                if (todayEl) {
                    todayEl.textContent = String(todayCount);
                    todayEl.style.color = todayCount > 0 ? "#d97706" : "#16a34a";
                }

                // ── Ranking de alto risco ────────────────────────────
                if (rankMetaEl) rankMetaEl.textContent = highRiskKeys.length + " identificados";
                if (hrListEl) {
                    hrListEl.innerHTML = "";
                    if (!highRiskKeys.length) {
                        hrListEl.innerHTML = '<span style="font-size:0.8rem;color:#16a34a;"><i class="fas fa-check-circle"></i> Nenhum usuário de alto risco identificado.</span>';
                    } else {
                        // Mostrar top 10 ordenados por qtd de tentativas
                        var sortedKeys = highRiskKeys.sort(function(a,b){ return (attackCountByKey[b]||0) - (attackCountByKey[a]||0); });
                        sortedKeys.slice(0, 10).forEach(function(k) {
                            var count = attackCountByKey[k] || 0;
                            var sample = adminDeniedAuditRows.find(function(r){ return (r.uid||r.email||r.user||"") === k; }) || {};
                            var displayName = sample.user || sample.email || k.slice(0, 14) + "…";
                            var chip = document.createElement("div");
                            chip.className = "sec-user-chip";
                            chip.innerHTML = '<i class="fas fa-exclamation-triangle" style="font-size:0.8rem;"></i>' +
                                '<span>' + displayName + '</span>' +
                                '<span class="chip-count">' + count + 'x</span>';
                            chip.title = "UID/Email: " + k + " | " + count + " tentativas negadas";
                            hrListEl.appendChild(chip);
                        });
                    }
                }

                // ── Metadados ─────────────────────────────────────────
                if (metaEl) metaEl.textContent = String(filtered.length) + " eventos";

                // ── Tabela enriquecida ────────────────────────────────
                body.innerHTML = "";
                if (!filtered.length) {
                    body.innerHTML = '<tr><td colspan="9" class="empty-state">Sem eventos para os filtros selecionados.</td></tr>';
                    return;
                }

                function parseDevice(ua) {
                    if (!ua || typeof ua !== "string") return "-";
                    ua = ua.toLowerCase();
                    var browser = "Desconhecido";
                    var os = "";
                    if (ua.indexOf("edg/") >= 0 || ua.indexOf("edge/") >= 0) browser = "Edge";
                    else if (ua.indexOf("chrome") >= 0 && ua.indexOf("chromium") < 0) browser = "Chrome";
                    else if (ua.indexOf("firefox") >= 0) browser = "Firefox";
                    else if (ua.indexOf("safari") >= 0 && ua.indexOf("chrome") < 0) browser = "Safari";
                    else if (ua.indexOf("opr") >= 0 || ua.indexOf("opera") >= 0) browser = "Opera";
                    if (ua.indexOf("windows") >= 0) os = "Win";
                    else if (ua.indexOf("mac") >= 0) os = "Mac";
                    else if (ua.indexOf("android") >= 0) os = "Android";
                    else if (ua.indexOf("iphone") >= 0 || ua.indexOf("ipad") >= 0) os = "iOS";
                    else if (ua.indexOf("linux") >= 0) os = "Linux";
                    return browser + (os ? " / " + os : "");
                }

                filtered.slice(0, 300).forEach(function(row) {
                    var score = getRiskScore(row);
                    var level = getRiskLevel(score);
                    var tr = document.createElement("tr");
                    tr.className = level === "high" ? "risk-row-high" : (level === "medium" ? "risk-row-medium" : "");

                    // Col: Risk badge
                    var tdRisk = document.createElement("td");
                    var badge = document.createElement("span");
                    badge.className = "risk-badge risk-" + level;
                    badge.textContent = level === "high" ? "⚠ Alto" : (level === "medium" ? "◑ Médio" : "○ Baixo");
                    badge.title = score + " tentativa(s) registradas";
                    tdRisk.appendChild(badge);

                    var tdAt = document.createElement("td");
                    tdAt.textContent = row.at ? new Date(row.at).toLocaleString("pt-BR") : "-";
                    var tdUser = document.createElement("td");
                    tdUser.textContent = row.user || "-";
                    var tdEmail = document.createElement("td");
                    tdEmail.textContent = row.email || "-";
                    var tdUid = document.createElement("td");
                    tdUid.textContent = row.uid ? String(row.uid).slice(0, 12) : "-";
                    tdUid.title = row.uid || "";
                    var tdReason = document.createElement("td");
                    tdReason.textContent = row.reason || "-";
                    var tdPath = document.createElement("td");
                    tdPath.textContent = row.path || "-";
                    tdPath.style.whiteSpace = "normal";
                    var tdDevice = document.createElement("td");
                    tdDevice.textContent = parseDevice(row.userAgent);
                    tdDevice.title = row.userAgent || "";
                    var tdSource = document.createElement("td");
                    tdSource.textContent = row.source === "firebase" ? "🔥 Firebase" : "💻 Local";

                    tr.appendChild(tdRisk);
                    tr.appendChild(tdAt);
                    tr.appendChild(tdUser);
                    tr.appendChild(tdEmail);
                    tr.appendChild(tdUid);
                    tr.appendChild(tdReason);
                    tr.appendChild(tdPath);
                    tr.appendChild(tdDevice);
                    tr.appendChild(tdSource);
                    body.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();

                // ── Exportar CSV ──────────────────────────────────────
                var secExportBtn = document.getElementById("secExportCsvBtn");
                if (secExportBtn && !secExportBtn._csvBound) {
                    secExportBtn._csvBound = true;
                    secExportBtn.addEventListener("click", function() {
                        try {
                            var headers = ["Risco","Quando","Usuário","Email","UID","Motivo","Rota","Dispositivo","Origem"];
                            var csvRows = [headers.join(";")];
                            filtered.forEach(function(row) {
                                var score = getRiskScore(row);
                                var level = getRiskLevel(score);
                                csvRows.push([
                                    level === "high" ? "Alto" : (level === "medium" ? "Médio" : "Baixo"),
                                    row.at ? new Date(row.at).toLocaleString("pt-BR") : "",
                                    '"' + (row.user || "").replace(/"/g,'""') + '"',
                                    '"' + (row.email || "").replace(/"/g,'""') + '"',
                                    row.uid || "",
                                    '"' + (row.reason || "").replace(/"/g,'""') + '"',
                                    '"' + (row.path || "").replace(/"/g,'""') + '"',
                                    parseDevice(row.userAgent),
                                    row.source || ""
                                ].join(";"));
                            });
                            var blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], {type:"text/csv;charset=utf-8;"});
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement("a");
                            a.href = url;
                            a.download = "auditoria_seguranca_" + new Date().toISOString().slice(0,10) + ".csv";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            notifyAdmin("Log de segurança exportado!", "success");
                        } catch(err) {
                            notifyAdmin("Erro ao exportar: " + (err.message || err), "error");
                        }
                    });
                }
            }
            function openUserDetails(user) {
                if (window.AdminUI && typeof window.AdminUI.modal === "function") {
                    var statusKey = computeStatusKey(user);
                    var companyId = user.companyId || "";
                    var profile = getCompanyProfileForUser(user);
                    var cnpj = getCompanyCnpjForUser(user) || "Não informado";
                    
                    var nome = user.username || user.displayName || user.nome || profile.responsibleName || profile.responsavel || profile.owner || profile.nomeResponsavel || "Não informado";
                    var email = user.email || profile.email || "Não informado";
                    var telefone = user.phone || user.telefone || profile.phone || profile.telefone || profile.whatsapp || "Não informado";
                    var companyLabel = getCompanyLabel(user) || profile.name || profile.nome || profile.razaoSocial || "Não informado";
                    var dateInfo = resolveAdminSubscriptionDates(user);
                    var registeredAt = formatAdminDateValue(dateInfo.registrationDate, "Não informado");
                    var startDate = formatAdminDateValue(dateInfo.startDate, "Não informado");
                    var endDate = dateInfo.endDate ? formatAdminDueDateLabel(dateInfo) : "Não aplicável";
                    var lastEventDate = formatAdminDateValue(dateInfo.lastEventDate, "Não informado");
                        
                    var planLabel = planLabelForUser(user) || "-";

                    var contentHtml = `
                        <div style="font-size: 14px; line-height: 1.6; color: #334155; text-align: left;">
                            <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Dados do Usuário</h4>
                            <p style="margin: 4px 0;"><strong>Nome:</strong> ${escapeHtml(nome)}</p>
                            <p style="margin: 4px 0;"><strong>E-mail:</strong> ${escapeHtml(email)}</p>
                            <p style="margin: 4px 0;"><strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
                            <p style="margin: 4px 0;"><strong>UID:</strong> ${escapeHtml(user.uid || "")}</p>
                            <p style="margin: 4px 0;"><strong>Cadastro:</strong> ${escapeHtml(registeredAt)}</p>
                            
                            <h4 style="margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Dados da Empresa</h4>
                            <p style="margin: 4px 0;"><strong>Empresa:</strong> ${escapeHtml(companyLabel)}</p>
                            <p style="margin: 4px 0;"><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</p>
                            
                            <h4 style="margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Assinatura & Status</h4>
                            <p style="margin: 4px 0;"><strong>Plano Atual:</strong> ${escapeHtml(planLabel)}</p>
                            <p style="margin: 4px 0;"><strong>Status Geral:</strong> ${escapeHtml(statusLabelForKey(statusKey))}</p>
                            <p style="margin: 4px 0;"><strong>Início:</strong> ${escapeHtml(startDate)}</p>
                            <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${escapeHtml(endDate)}</p>
                            <p style="margin: 4px 0;"><strong>Último evento:</strong> ${escapeHtml(lastEventDate)}</p>
                    `;

                    if (user.pendingPayment) {
                        contentHtml += `
                            <h4 style="margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Pagamento Pendente</h4>
                            <p style="margin: 4px 0;"><strong>Valor:</strong> ${escapeHtml(formatCurrencyBRL(user.pendingPayment.amount || 0))}</p>
                            <p style="margin: 4px 0;"><strong>Método:</strong> ${escapeHtml(user.pendingPayment.method || "Não informado")}</p>
                            <p style="margin: 4px 0;"><strong>Referência:</strong> ${escapeHtml(user.pendingPayment.reference || "Não informado")}</p>
                        `;
                    }
                    contentHtml += `</div>`;
                    
                    window.AdminUI.modal({
                        title: "Detalhes Completos do Cliente",
                        body: contentHtml,
                        width: "450px",
                        actions: [{ label: "Fechar", className: "btn secondary", action: "close" }]
                    });
                } else {
                    var lines = [];
                    var statusKey = computeStatusKey(user);
                    lines.push("UID: " + (user.uid || ""));
                    lines.push("Email: " + (user.email || ""));
                    lines.push("Nome: " + (user.username || user.displayName || ""));
                    lines.push("Empresa: " + getCompanyLabel(user));
                    lines.push("Status: " + statusLabelForKey(statusKey));
                    lines.push("Plano: " + planLabelForUser(user));
                    lines.push("Estado da Request: " + requestStateLabel(user));
                    if (user.pendingPayment) {
                        lines.push("Pagamento pendente: " + formatCurrencyBRL(user.pendingPayment.amount || 0));
                    }
                    showActionMessage(lines.join(" | "), "info");
                }
            }
            async function deleteSubscriptionDataFlow(user) {
                try {
                    if (!canMutateSensitiveData()) {
                        showActionMessage("Permissão insuficiente: somente super-admin pode excluir dados de assinatura.", "error");
                        return;
                    }
                    if (!window.firebaseService || typeof window.firebaseService.deleteSubscriptionManagedData !== "function") {
                        showActionMessage("Serviço de exclusão de assinatura indisponível.", "error");
                        return;
                    }
                    var uid = String((user && (user.uid || user.id || user.userId)) || "");
                    if (!uid) {
                        showActionMessage("Usuário sem UID válido.", "error");
                        return;
                    }
                    var display = getUserDisplayName(user, uid);
                    var warning =
                        "ATENÇÃO: Exclusão administrativa de assinatura\n\n" +
                        "Esta ação vai remover requests, auditorias e dados financeiros de assinatura do usuário: " + display + ".\n\n" +
                        "Consequências:\n" +
                        "- O usuário pode perder acesso imediato\n" +
                        "- Pagamentos/situações pendentes podem ser descartados\n" +
                        "- Será necessário reenviar solicitação/pagamento para voltar ao ativo\n\n" +
                        "Deseja continuar?";
                    var ok = confirm(warning);
                    if (!ok) return;
                    var phrase = prompt("Confirmação sensível: digite EXCLUIR para confirmar.");
                    if (String(phrase || "").trim().toUpperCase() !== "EXCLUIR") {
                        showActionMessage("Exclusão cancelada: confirmação inválida.", "error");
                        return;
                    }
                    var note = prompt("Motivo da exclusão (obrigatório para auditoria):", "") || "";
                    if (!String(note).trim()) {
                        showActionMessage("Informe o motivo da exclusão para trilha de auditoria.", "error");
                        return;
                    }
                    var result = await window.firebaseService.deleteSubscriptionManagedData({
                        targetUid: uid,
                        reviewNote: note
                    });
                    if (!result || result.success === false) {
                        showActionMessage((result && result.error) || "Falha ao excluir dados de assinatura.", "error");
                        return;
                    }
                    showActionMessage("Dados de assinatura removidos com sucesso.", "success");
                    await loadUsersAndDashboard();
                    try { applySubscriptionsFilter(); } catch (_) {}
                    if (activeTab === "finance") applyFinancialFilter();
                    try { await loadOpenExtensionRequests(); } catch (_) {}
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao excluir dados de assinatura.", "error");
                }
            }
            function buildAccessLabel(access) {
                var role = access.isSuperAdmin ? "Super Admin" : "Admin";
                var lanes = [];
                if (access.canDashboard || access.isSuperAdmin) lanes.push("Dashboard");
                if (access.canSubscriptions || access.isSuperAdmin) lanes.push("Assinaturas");
                if (access.canSettings || access.isSuperAdmin) lanes.push("Configurações/Status/Campanhas/Financeiro");
                if (access.isSuperAdmin) lanes.push("Suporte");
                return role + " • " + lanes.join(" / ");
            }
            function campaignSummaryText(campaign) {
                var c = campaign && typeof campaign === "object" ? campaign : {};
                var lines = [];
                lines.push("Ativa: " + (c.enabled === true ? "Sim" : "Não"));
                if (c.title) lines.push("Título: " + String(c.title));
                if (c.referral && typeof c.referral === "object") {
                    lines.push("Indicação: " + (c.referral.enabled ? "Ativa" : "Inativa"));
                    lines.push("Comissão: " + String(c.referral.commissionPercentForReferrer || 0) + "%");
                    lines.push("Desconto novo cliente: " + String(c.referral.discountPercentForNewClient || 0) + "%");
                }
                if (c.newClientGoal && typeof c.newClientGoal === "object") {
                    lines.push("Meta mensal: " + String(c.newClientGoal.monthlyTarget || 0));
                    lines.push("Bônus meta: " + String(c.newClientGoal.bonusPercent || 0) + "%");
                }
                if (c.specieBalance && typeof c.specieBalance === "object") {
                    lines.push("Espécie: " + (c.specieBalance.enabled ? "Ativa" : "Inativa"));
                    lines.push("Conversão espécie: " + String(c.specieBalance.conversionPercent || 0) + "%");
                    lines.push("Saque mínimo: R$ " + String(c.specieBalance.minCashout || 0));
                }
                return lines.join(" • ");
            }


            async function loadCampaignPanel() {
                var meta = document.getElementById("campaignMeta");
                if (meta) meta.textContent = "Carregando...";
                setDebugStatus("getCampaignExecutiveSummary", "loading", "Iniciando");
                setDebugStatus("getCampaignConfigAudit", "loading", "Iniciando");
                try {
                    if (!window.firebaseService) {
                        if (meta) meta.textContent = "Serviços indisponíveis";
                        return;
                    }
                    if (typeof window.firebaseService.getCampaignExecutiveSummary === "function") {
                        try {
                            var execRes = await window.firebaseService.getCampaignExecutiveSummary();
                            var summary = execRes && execRes.success && execRes.data && execRes.data.summary ? execRes.data.summary : null;
                            summary = summary || {};
                            var paidEl = document.getElementById("campPaidMonth");
                            var pendingEl = document.getElementById("campPending");
                            var dueEl = document.getElementById("campDue7");
                            var newClientsEl = document.getElementById("campNewClients");
                            if (paidEl) paidEl.textContent = formatCurrencyBRL(summary.totalPaidThisMonth || 0);
                            if (pendingEl) pendingEl.textContent = String(summary.pendingPaymentsCount || 0);
                            if (dueEl) dueEl.textContent = String(summary.dueInSevenDays || 0);
                            if (newClientsEl) newClientsEl.textContent = String(summary.newClientsMonth || 0);
                            setDebugStatus("getCampaignExecutiveSummary", "ok", "Resumo carregado");

                            // ── Funil de Conversão ─────────────────────────────────
                            (function updateFunnel() {
                                var total = allUsers.length;
                                var trialCount = allUsers.filter(function(u) {
                                    var k = computeStatusKey(u);
                                    return k === "trial_active" || k === "trial_expired";
                                }).length;
                                var pendCount = allUsers.filter(function(u) {
                                    return computeStatusKey(u) === "pending";
                                }).length;
                                var activeCount = allUsers.filter(function(u) {
                                    return computeStatusKey(u) === "active";
                                }).length;

                                var maxVal = Math.max(1, total);
                                function setBar(barId, countId, val, max) {
                                    var bar = document.getElementById(barId);
                                    var cnt = document.getElementById(countId);
                                    if (bar) {
                                        setTimeout(function() { bar.style.width = Math.min(100, (val / max) * 100) + "%"; }, 100);
                                    }
                                    if (cnt) cnt.textContent = String(val);
                                }
                                setBar("funnelBarTotal", "funnelCountTotal", total, maxVal);
                                setBar("funnelBarTrial", "funnelCountTrial", trialCount, maxVal);
                                setBar("funnelBarPending", "funnelCountPending", pendCount, maxVal);
                                setBar("funnelBarActive", "funnelCountActive", activeCount, maxVal);

                                var convPct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
                                var funnelMeta = document.getElementById("campFunnelMeta");
                                if (funnelMeta) funnelMeta.textContent = convPct + "% de convers\u00e3o global";
                            })();
                        } catch (_) {}
                    }
                    var auditBody = document.getElementById("campaignAuditBody");
                    if (auditBody && typeof window.firebaseService.getCampaignConfigAudit === "function") {
                        try {
                            var auditRes = await window.firebaseService.getCampaignConfigAudit();
                            var items = auditRes && auditRes.success && auditRes.data && Array.isArray(auditRes.data.items) ? auditRes.data.items : [];
                            auditBody.innerHTML = "";
                            if (!items.length) {
                                var trEmpty = document.createElement("tr");
                                var tdEmpty = document.createElement("td");
                                tdEmpty.colSpan = 4;
                                tdEmpty.className = "empty-state";
                                tdEmpty.textContent = "Nenhuma alteração de campanha registrada.";
                                trEmpty.appendChild(tdEmpty);
                                auditBody.appendChild(trEmpty);
                            } else {
                                items.forEach(function(item) {
                                    var tr = document.createElement("tr");
                                    var at = item.at ? new Date(item.at) : null;
                                    var whenText = at && !Number.isNaN(at.getTime()) ? at.toLocaleString("pt-BR") : "-";
                                    var who = item.updatedBy || item.uid || "";
                                    var beforeCampaign = item.before && item.before.campaign ? item.before.campaign : {};
                                    var afterCampaign = item.after && item.after.campaign ? item.after.campaign : {};
                                    var before = campaignSummaryText(beforeCampaign);
                                    var after = campaignSummaryText(afterCampaign);
                                    var tdWhen = document.createElement("td");
                                    tdWhen.textContent = whenText;
                                    var tdWho = document.createElement("td");
                                    tdWho.textContent = who;
                                    var tdBefore = document.createElement("td");
                                    tdBefore.textContent = before;
                                    tdBefore.style.whiteSpace = "normal";
                                    var tdAfter = document.createElement("td");
                                    tdAfter.textContent = after;
                                    tdAfter.style.whiteSpace = "normal";
                                    tr.appendChild(tdWhen);
                                    tr.appendChild(tdWho);
                                    tr.appendChild(tdBefore);
                                    tr.appendChild(tdAfter);
                                    auditBody.appendChild(tr);
                                });
                            }
                            setDebugStatus("getCampaignConfigAudit", "ok", "Histórico carregado");
                        } catch (_) {
                            auditBody.innerHTML = '<tr><td colspan="4" class="empty-state">Erro ao carregar histórico.</td></tr>';
                            setDebugStatus("getCampaignConfigAudit", "error", "Falha no histórico");
                        }
                    } else {
                        setDebugStatus("getCampaignConfigAudit", "error", "Serviço indisponível");
                    }
                    await loadCampaignEditor();
                    await loadPromoCodes();
                    if (meta) meta.textContent = "Campanhas carregadas";
                } catch (_) {
                    if (meta) meta.textContent = "Erro ao carregar campanhas";
                    notifyAdmin("Falha ao carregar painel de campanhas.", "error");
                    setDebugStatus("getCampaignExecutiveSummary", "error", "Exceção geral");
                }
            }
            async function loadCampaignEditor() {
                var editMeta = document.getElementById("campaignEditMeta");
                if (editMeta) editMeta.textContent = "Carregando dados da campanha...";
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getSubscriptionSettings !== "function") {
                        if (editMeta) editMeta.textContent = "Serviço indisponível";
                        return;
                    }
                    var res = await window.firebaseService.getSubscriptionSettings();
                    var settings = null;
                    if (res && res.success && res.data && res.data.settings) settings = res.data.settings;
                    else if (res && res.success && res.settings) settings = res.settings;
                    else if (res && res.settings) settings = res.settings;
                    var campaign = settings && settings.campaign ? settings.campaign : {};
                    var goal = campaign.newClientGoal || {};
                    var referral = campaign.referral || {};
                    var enabledEl = document.getElementById("campaignEnabledEdit");
                    var titleEl = document.getElementById("campaignTitleEdit");
                    var goalEl = document.getElementById("campaignMonthlyTargetEdit");
                    var bonusEl = document.getElementById("campaignBonusPercentEdit");
                    var refEnabledEl = document.getElementById("campaignReferralEnabledEdit");
                    var refCommissionEl = document.getElementById("campaignReferralCommissionEdit");
                    var refDiscountEl = document.getElementById("campaignReferralDiscountEdit");
                    if (enabledEl) enabledEl.checked = campaign.enabled === true;
                    if (titleEl) titleEl.value = String(campaign.title || "");
                    if (goalEl) goalEl.value = String(goal.monthlyTarget || 0);
                    if (bonusEl) bonusEl.value = String(goal.bonusPercent || 0);
                    if (refEnabledEl) refEnabledEl.checked = referral.enabled === true;
                    if (refCommissionEl) refCommissionEl.value = String(referral.commissionPercentForReferrer || 0);
                    if (refDiscountEl) refDiscountEl.value = String(referral.discountPercentForNewClient || 0);
                    if (editMeta) editMeta.textContent = "Campanha pronta para edição";

                    // ── Atualizar badge de status da campanha ───────────
                    var statusBadge = document.getElementById("campStatusBadge");
                    if (statusBadge) {
                        if (campaign.enabled === true) {
                            statusBadge.textContent = "\u2b24 Ativa";
                            statusBadge.className = "status-pill status-active";
                            statusBadge.style.cssText = "font-size:0.72rem;padding:3px 10px;";
                        } else {
                            statusBadge.textContent = "\u2b24 Inativa";
                            statusBadge.className = "status-pill status-expired";
                            statusBadge.style.cssText = "font-size:0.72rem;padding:3px 10px;";
                        }
                    }
                } catch (err) {
                    if (editMeta) editMeta.textContent = "Erro ao carregar campanha";
                    showActionMessage((err && err.message) || "Erro ao carregar campanha.", "error");
                }
            }
            async function saveCampaignEditor() {
                var editMeta = document.getElementById("campaignEditMeta");
                if (editMeta) editMeta.textContent = "Salvando campanha...";
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getSubscriptionSettings !== "function" || typeof window.firebaseService.upsertSubscriptionSettings !== "function") {
                        throw new Error("Serviço de configuração comercial indisponível.");
                    }
                    var currentRes = await window.firebaseService.getSubscriptionSettings();
                    var currentSettings = null;
                    if (currentRes && currentRes.success && currentRes.data && currentRes.data.settings) currentSettings = currentRes.data.settings;
                    else if (currentRes && currentRes.settings) currentSettings = currentRes.settings;
                    currentSettings = currentSettings || {};
                    var currentCampaign = currentSettings.campaign || {};
                    var payload = Object.assign({}, currentSettings);
                    payload.campaign = Object.assign({}, currentCampaign, {
                        enabled: !!(document.getElementById("campaignEnabledEdit") && document.getElementById("campaignEnabledEdit").checked),
                        title: String((document.getElementById("campaignTitleEdit") && document.getElementById("campaignTitleEdit").value) || "").trim(),
                        newClientGoal: Object.assign({}, currentCampaign.newClientGoal || {}, {
                            monthlyTarget: parseInt((document.getElementById("campaignMonthlyTargetEdit") && document.getElementById("campaignMonthlyTargetEdit").value) || "0", 10) || 0,
                            bonusPercent: parseFloat((document.getElementById("campaignBonusPercentEdit") && document.getElementById("campaignBonusPercentEdit").value) || "0") || 0
                        }),
                        referral: Object.assign({}, currentCampaign.referral || {}, {
                            enabled: !!(document.getElementById("campaignReferralEnabledEdit") && document.getElementById("campaignReferralEnabledEdit").checked),
                            commissionPercentForReferrer: parseFloat((document.getElementById("campaignReferralCommissionEdit") && document.getElementById("campaignReferralCommissionEdit").value) || "0") || 0,
                            discountPercentForNewClient: parseFloat((document.getElementById("campaignReferralDiscountEdit") && document.getElementById("campaignReferralDiscountEdit").value) || "0") || 0
                        })
                    });
                    var saveRes = await window.firebaseService.upsertSubscriptionSettings(payload);
                    if (!saveRes || saveRes.success === false) {
                        throw new Error((saveRes && saveRes.error) || "Falha ao salvar campanha.");
                    }
                    if (editMeta) editMeta.textContent = "Campanha salva com sucesso";
                    showActionMessage("Campanha comercial atualizada.", "success");
                    await loadCampaignPanel();
                } catch (err) {
                    if (editMeta) editMeta.textContent = "Erro ao salvar campanha";
                    showActionMessage((err && err.message) || "Falha ao salvar campanha.", "error");
                }
            }

            function normalizeAdminPromoCode(value) {
                return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
            }

            function buildPromoPublicUrl(code, source) {
                var safeCode = normalizeAdminPromoCode(code);
                var origin = /^https?:\/\//i.test(String(window.location.origin || ""))
                    ? window.location.origin
                    : "https://sisweb-7ce82.web.app";
                var params = new URLSearchParams();
                params.set("cupom", safeCode);
                params.set("utm_source", source || "admin");
                params.set("utm_medium", source === "whatsapp" ? "social" : "share");
                params.set("utm_campaign", "madeireiro");
                return origin.replace(/\/+$/, "") + "/subscription.html?" + params.toString();
            }

            function buildPromoShareText(code) {
                var safeCode = normalizeAdminPromoCode(code);
                return [
                    "Conheça o Sisweb - sistema para gestão do segmento madeireiro.",
                    "Controle toras, desdobramentos, estoque, vendas, compras, financeiro, relatórios e operação multitenant em um só lugar.",
                    safeCode ? "Use o cupom " + safeCode + " para contratar com condição promocional." : ""
                ].filter(Boolean).join("\n");
            }

            async function copyPromoShareLink(code) {
                var url = buildPromoPublicUrl(code, "copy");
                try {
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                        await navigator.clipboard.writeText(url);
                    } else {
                        var temp = document.createElement("textarea");
                        temp.value = url;
                        temp.style.position = "fixed";
                        temp.style.left = "-9999px";
                        document.body.appendChild(temp);
                        temp.focus();
                        temp.select();
                        document.execCommand("copy");
                        temp.remove();
                    }
                    if (window.AdminUI && typeof window.AdminUI.toast === "function") window.AdminUI.toast("Link do cupom copiado.", "success");
                } catch (err) {
                    if (window.AdminUI && typeof window.AdminUI.toast === "function") window.AdminUI.toast("Não foi possível copiar o link.", "error");
                }
            }

            function openPromoWhatsappShare(code) {
                var url = buildPromoPublicUrl(code, "whatsapp");
                var message = buildPromoShareText(code) + "\n" + url;
                window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
            }

            window.copyPromoShareLink = copyPromoShareLink;
            window.openPromoWhatsappShare = openPromoWhatsappShare;

            async function loadPromoCodes() {
                var container = document.getElementById("promoCodesList");
                var emptyState = document.getElementById("emptyPromoCodes");
                if (!container || !emptyState) return;

                try {
                    if (!window.firebaseService || typeof window.firebaseService.listPromoCodesAdmin !== "function") {
                        throw new Error("Serviço administrativo de cupons indisponível.");
                    }
                    var res = await window.firebaseService.listPromoCodesAdmin({ includeArchived: false });
                    if (!res || res.success === false) {
                        throw new Error((res && res.error) || "Falha ao listar cupons.");
                    }
                    var payload = res.data || {};
                    var codes = Array.isArray(payload.items) ? payload.items : [];
                    
                    container.innerHTML = "";
                    if (!codes.length) {
                        emptyState.style.display = "block";
                        return;
                    }
                    
                    emptyState.style.display = "none";
                    var sortedCodes = codes.slice().sort(function(a, b) {
                        var tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
                        var tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
                        return tB - tA; // Decrescente
                    });
                    
                    sortedCodes.forEach(function(c) {
                        if (!c) return;
                        var safeCode = normalizeAdminPromoCode(c.code || c.id);
                        if (!safeCode) return;
                        var isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
                        var maxUses = parseInt(c.maxUses, 10) || 0;
                        var currentUses = parseInt(c.currentUses, 10) || 0;
                        var isExhausted = maxUses > 0 && currentUses >= maxUses;
                        var isActive = c.active && c.archived !== true && !isExpired && !isExhausted;
                        
                        var typeStr = c.type === 'percent' ? c.value + '%' : 'R$ ' + parseFloat(c.value).toFixed(2);
                        var statusStr = isActive ? '<span class="tag green">Ativo</span>' : '<span class="tag red">Inativo</span>';
                        if (isExpired) statusStr = '<span class="tag red">Expirado</span>';
                        else if (isExhausted) statusStr = '<span class="tag red">Esgotado</span>';

                        var expStr = "Sem validade";
                        if (c.expiresAt) {
                            var expDate = new Date(c.expiresAt);
                            expStr = expDate.toLocaleDateString("pt-BR") + " " + expDate.toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'});
                        }
                        
                        var div = document.createElement("div");
                        div.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;";
                        div.innerHTML = `
                            <div>
                                <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${escapeHtml(safeCode)} ${statusStr}</div>
                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
                                    ${escapeHtml(typeStr)} de desconto &bull; ${escapeHtml(maxUses > 0 ? currentUses + '/' + maxUses + ' usos' : currentUses + ' usos (Ilimitado)')}<br>
                                    Expira em: ${escapeHtml(expStr)}
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                                <button type="button" class="btn small" data-promo-action="edit" data-promo-code="${escapeHtml(safeCode)}" title="Editar cupom"><i class="fas fa-edit"></i></button>
                                ${isActive ? '<button type="button" class="btn small" data-promo-action="copy" data-promo-code="' + escapeHtml(safeCode) + '" title="Copiar link público"><i class="fas fa-link"></i></button>' : ''}
                                ${isActive ? '<button type="button" class="btn small primary" data-promo-action="whatsapp" data-promo-code="' + escapeHtml(safeCode) + '" title="Compartilhar no WhatsApp"><i class="fab fa-whatsapp"></i></button>' : ''}
                                <button type="button" class="btn small" data-promo-action="archive" data-promo-code="${escapeHtml(safeCode)}" title="Arquivar cupom"><i class="fas fa-archive"></i></button>
                            </div>
                        `;
                        container.appendChild(div);
                    });
                    container.querySelectorAll("[data-promo-action]").forEach(function(btn) {
                        btn.addEventListener("click", function() {
                            var action = btn.getAttribute("data-promo-action");
                            var code = btn.getAttribute("data-promo-code") || "";
                            if (action === "edit") window.editPromoCode(code);
                            if (action === "copy") copyPromoShareLink(code);
                            if (action === "whatsapp") openPromoWhatsappShare(code);
                            if (action === "archive") archivePromoCode(code);
                        });
                    });
                } catch (err) {
                    console.error("Erro ao carregar cupons:", err);
                    if (window.AdminUI && typeof window.AdminUI.toast === "function") {
                        window.AdminUI.toast((err && err.message) || "Erro ao carregar cupons.", "error");
                    }
                }
            }

            window.editPromoCode = async function(code) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getPromoCodeAdmin !== "function") {
                        throw new Error("Serviço administrativo de cupons indisponível.");
                    }
                    var res = await window.firebaseService.getPromoCodeAdmin({ code: code });
                    if (!res || res.success === false) {
                        throw new Error((res && res.error) || "Cupom não encontrado.");
                    }
                    var promo = res.data && res.data.promoCode ? res.data.promoCode : null;
                    if (promo) openPromoCodeModal(promo);
                } catch (err) {
                    window.AdminUI.toast((err && err.message) || "Erro ao carregar cupom.", "error");
                }
            };

            async function archivePromoCode(code) {
                var safeCode = normalizeAdminPromoCode(code);
                if (!safeCode) return;
                try {
                    var confirmed = true;
                    if (window.AdminUI && typeof window.AdminUI.confirm === "function") {
                        confirmed = await window.AdminUI.confirm("Arquivar o cupom " + safeCode + "? Ele deixará de aparecer para compartilhamento e não poderá ser aplicado em novas assinaturas.", "Arquivar cupom");
                    }
                    if (!confirmed) return;
                    if (!window.firebaseService || typeof window.firebaseService.archivePromoCodeAdmin !== "function") {
                        throw new Error("Serviço administrativo de cupons indisponível.");
                    }
                    var result = await window.firebaseService.archivePromoCodeAdmin({ code: safeCode });
                    if (!result || result.success === false) {
                        throw new Error((result && result.error) || "Falha ao arquivar cupom.");
                    }
                    window.AdminUI.toast("Cupom arquivado.", "success");
                    await loadPromoCodes();
                } catch (err) {
                    window.AdminUI.toast((err && err.message) || "Erro ao arquivar cupom.", "error");
                }
            }

            function openPromoCodeModal(existingPromo = null) {
                var isEdit = !!existingPromo;
                var code = isEdit ? existingPromo.code : "";
                var type = isEdit ? (existingPromo.type || "percent") : "percent";
                var value = isEdit ? (existingPromo.value || 0) : 0;
                var maxUses = isEdit ? (existingPromo.maxUses || "") : "";
                var expiresAt = isEdit && existingPromo.expiresAt ? existingPromo.expiresAt.substring(0, 16) : "";
                var active = isEdit ? existingPromo.active : true;
                var allowedPlans = Array.isArray(existingPromo && existingPromo.allowedPlans) ? existingPromo.allowedPlans : [];
                function promoPlanChecked(planKey) {
                    return !allowedPlans.length || allowedPlans.indexOf(planKey) >= 0;
                }

                var bodyHtml = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div class="modal-field">
                            <span class="modal-field-label">Código do Cupom</span>
                            <input type="text" id="promoCodeInput" class="modal-field-value" style="width: 100%; text-transform: uppercase;" value="${code}" ${isEdit ? 'disabled' : ''} placeholder="Ex: BLACKFRIDAY50">
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <div class="modal-field" style="flex: 1;">
                                <span class="modal-field-label">Tipo de Desconto</span>
                                <select id="promoTypeInput" class="modal-field-value" style="width: 100%;">
                                    <option value="percent" ${type === 'percent' ? 'selected' : ''}>Percentual (%)</option>
                                    <option value="fixed" ${type === 'fixed' ? 'selected' : ''}>Fixo (R$)</option>
                                </select>
                            </div>
                            <div class="modal-field" style="flex: 1;">
                                <span class="modal-field-label">Valor</span>
                                <input type="number" id="promoValueInput" class="modal-field-value" style="width: 100%;" value="${value}" min="0" step="0.01">
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <div class="modal-field" style="flex: 1;">
                                <span class="modal-field-label">Limite de Usos (0 = Ilimitado)</span>
                                <input type="number" id="promoMaxUsesInput" class="modal-field-value" style="width: 100%;" value="${maxUses}" min="0">
                            </div>
                            <div class="modal-field" style="flex: 1;">
                                <span class="modal-field-label">Validade (Opcional)</span>
                                <input type="datetime-local" id="promoExpiresAtInput" class="modal-field-value" style="width: 100%;" value="${expiresAt}">
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="promoActiveInput" ${active ? 'checked' : ''}>
                            <label for="promoActiveInput" style="font-size: 0.85rem; color: #334155; font-weight: 600;">Ativar cupom imediatamente</label>
                        </div>
                        <div class="modal-field">
                            <span class="modal-field-label">Planos permitidos</span>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
                                <label style="font-size:0.82rem;color:#334155;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="promoPlanInput" value="monthly" ${promoPlanChecked('monthly') ? 'checked' : ''}> Mensal</label>
                                <label style="font-size:0.82rem;color:#334155;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="promoPlanInput" value="quarterly" ${promoPlanChecked('quarterly') ? 'checked' : ''}> Trimestral</label>
                                <label style="font-size:0.82rem;color:#334155;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="promoPlanInput" value="premium" ${promoPlanChecked('premium') ? 'checked' : ''}> Premium</label>
                            </div>
                        </div>
                    </div>
                `;

                window.AdminUI.modal({
                    title: isEdit ? "Editar Cupom" : "Novo Cupom",
                    width: "500px",
                    body: bodyHtml,
                    actions: [
                        { action: "close", label: "Cancelar" },
                        { 
                            action: "save", 
                            label: "Salvar", 
                            className: "btn primary",
                            onClick: async (overlay, resolve) => {
                                var codeInput = overlay.querySelector("#promoCodeInput");
                                var typeInput = overlay.querySelector("#promoTypeInput");
                                var valueInput = overlay.querySelector("#promoValueInput");
                                var maxUsesInput = overlay.querySelector("#promoMaxUsesInput");
                                var expiresAtInput = overlay.querySelector("#promoExpiresAtInput");
                                var activeInput = overlay.querySelector("#promoActiveInput");
                                var planInputs = overlay.querySelectorAll(".promoPlanInput");

                                var codeVal = normalizeAdminPromoCode(codeInput ? codeInput.value : "");
                                if (!codeVal) {
                                    window.AdminUI.toast("O código é obrigatório.", "warning");
                                    return;
                                }
                                var allowedPlans = [];
                                planInputs.forEach(function(input) {
                                    if (input.checked) allowedPlans.push(input.value);
                                });
                                var promoData = {
                                    code: codeVal,
                                    type: typeInput ? typeInput.value : "percent",
                                    value: valueInput ? (parseFloat(valueInput.value) || 0) : 0,
                                    maxUses: maxUsesInput ? (parseInt(maxUsesInput.value) || 0) : 0,
                                    expiresAt: (expiresAtInput && expiresAtInput.value) ? new Date(expiresAtInput.value).toISOString() : null,
                                    active: activeInput ? activeInput.checked : false,
                                    allowedPlans: allowedPlans,
                                    updatedAt: new Date().toISOString()
                                };
                                if (!isEdit) {
                                    promoData.createdAt = new Date().toISOString();
                                    promoData.currentUses = 0;
                                } else if (existingPromo) {
                                    promoData.createdAt = existingPromo.createdAt;
                                    promoData.currentUses = existingPromo.currentUses || 0;
                                }

                                try {
                                    if (!window.firebaseService || typeof window.firebaseService.upsertPromoCodeAdmin !== "function") {
                                        throw new Error("Serviço administrativo de cupons indisponível.");
                                    }
                                    var saveResult = await window.firebaseService.upsertPromoCodeAdmin(promoData);
                                    if (!saveResult || saveResult.success === false) {
                                        throw new Error((saveResult && saveResult.error) || "Falha ao salvar cupom.");
                                    }
                                    window.AdminUI.toast("Cupom salvo com sucesso.", "success");
                                    await loadPromoCodes();
                                    overlay.classList.remove("active");
                                    setTimeout(() => overlay.remove(), 200);
                                    resolve("saved");
                                } catch (err) {
                                    window.AdminUI.toast((err && err.message) || "Erro ao salvar cupom.", "error");
                                }
                            }
                        }
                    ]
                });
            }

            var btnNewPromoCode = document.getElementById("btnNewPromoCode");
            if (btnNewPromoCode) {
                btnNewPromoCode.addEventListener("click", function() {
                    openPromoCodeModal();
                });
            }
            async function resolvePendingRequestId(user) {
                var existing = user && user.pendingPayment && user.pendingPayment.requestId ? String(user.pendingPayment.requestId) : "";
                if (existing) return existing;
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getAll !== "function") return "";
                    var uid = String(user && user.uid ? user.uid : "");
                    var email = String(user && user.email ? user.email : "").toLowerCase();
                    var srRes = await window.firebaseService.getAll("subscriptionRequests");
                    var srMap = srRes && srRes.success ? srRes.data : srRes;
                    if (!srMap || typeof srMap !== "object") return "";
                    var best = "";
                    var bestTs = 0;
                    Object.keys(srMap).forEach(function(uidKey) {
                        if (uid && String(uidKey) !== uid) return;
                        var perUser = srMap[uidKey] || {};
                        Object.keys(perUser).forEach(function(reqId) {
                            var req = perUser[reqId] || {};
                            var status = String(req.status || "pending").toLowerCase();
                            if (status !== "pending") return;
                            if (!uid && email && String(req.email || "").toLowerCase() !== email) return;
                            var at = req.createdAt || req.date || req.timestamp || null;
                            var ts = at ? new Date(at).getTime() : 0;
                            if (!best || ts > bestTs) {
                                best = String(reqId);
                                bestTs = ts;
                            }
                        });
                    });
                    return best;
                } catch (_) {
                    return "";
                }
            }
            async function approvePendingPayment(user) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.prepareSubscriptionApproval !== "function") {
                        await window.AdminUI.alert("Serviço de aprovação indisponível.");
                        return;
                    }
                    var uid = String(user.uid || "");
                    if (!uid) {
                        alert("Usuário sem UID válido.");
                        return;
                    }
                    var ok = confirm("Confirmar aprovação do pagamento deste usuário?");
                    if (!ok) return;
                    var requestId = await resolvePendingRequestId(user);
                    if (!requestId) {
                        showActionMessage("Solicitação pendente sem requestId válido.", "error");
                        return;
                    }
                    var prep = await window.firebaseService.prepareSubscriptionApproval({ requestId: requestId, uid: uid, action: "approve" });
                    if (!prep || prep.success === false) {
                        showActionMessage((prep && prep.error) || "Falha na preparação da aprovação.", "error");
                        return;
                    }
                    var challengeCode = (prep.data && prep.data.challengeToken) || prep.challengeToken || "";
                    if (!challengeCode) {
                        showActionMessage("Challenge de aprovação não retornado pelo backend.", "error");
                        return;
                    }
                    var note = "";
                    var confirmed = await window.firebaseService.confirmSubscriptionApproval({
                        requestId: requestId,
                        uid: uid,
                        challengeToken: challengeCode,
                        decision: "approve",
                        reviewNote: note
                    });
                    if (!confirmed || confirmed.success === false) {
                        showActionMessage((confirmed && confirmed.error) || "Falha ao concluir aprovação.", "error");
                        return;
                    }
                    showActionMessage("Pagamento aprovado com sucesso.", "success");
                    await loadUsersAndDashboard();
                    if (activeTab === "subscriptions") applySubscriptionsFilter();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao aprovar pagamento.", "error");
                }
            }
            async function rejectPendingPayment(user) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.reviewSubscriptionExtensionRequest !== "function") {
                        await window.AdminUI.alert("Serviço de rejeição indisponível.");
                        return;
                    }
                    var uid = String(user.uid || "");
                    if (!uid) {
                        await window.AdminUI.alert("Usuário sem UID válido.");
                        return;
                    }
                    var reason = await window.AdminUI.prompt("Motivo da rejeição:", "") || "";
                    if (reason === null) return; // User cancelled prompt
                    var ok = await window.AdminUI.confirm("Confirmar rejeição do pagamento deste usuário?");
                    if (!ok) return;
                    var requestId = await resolvePendingRequestId(user);
                    if (!requestId) {
                        showActionMessage("Solicitação pendente sem requestId válido.", "error");
                        return;
                    }
                    var prep = await window.firebaseService.prepareSubscriptionApproval({ requestId: requestId, uid: uid, action: "reject" });
                    if (!prep || prep.success === false) {
                        showActionMessage((prep && prep.error) || "Falha na preparação da rejeição.", "error");
                        return;
                    }
                    var challengeCode = (prep.data && prep.data.challengeToken) || prep.challengeToken || "";
                    if (!challengeCode) {
                        showActionMessage("Challenge de rejeição não retornado pelo backend.", "error");
                        return;
                    }
                    var confirmed = await window.firebaseService.confirmSubscriptionApproval({
                        requestId: requestId,
                        uid: uid,
                        challengeToken: challengeCode,
                        decision: "reject",
                        reviewNote: reason
                    });
                    if (!confirmed || confirmed.success === false) {
                        showActionMessage((confirmed && confirmed.error) || "Falha ao concluir rejeição.", "error");
                        return;
                    }
                    showActionMessage("Pagamento rejeitado com sucesso.", "success");
                    await loadUsersAndDashboard();
                    if (activeTab === "subscriptions") applySubscriptionsFilter();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao rejeitar pagamento.", "error");
                }
            }
            async function grantAdminFreeTrialDialog(user) {
                try {
                    if (!canMutateSensitiveData()) {
                        showActionMessage("Permissão insuficiente: somente super-admin pode conceder Trial 30d.", "error");
                        return;
                    }
                    if (isOperationalSuperAdminUser(user || {})) {
                        showActionMessage("Conta SuperAdmin e operacional nao participa da regua comercial de trial.", "error");
                        return;
                    }
                    var firebaseSvc = await resolveAdminFirebaseService("grantAdminFreeTrial");
                    if (!firebaseSvc || typeof firebaseSvc.grantAdminFreeTrial !== "function") {
                        showActionMessage("Serviço de concessão de trial indisponível. Publique a Function grantAdminFreeTrial.", "error");
                        return;
                    }
                    var uid = String(user && (user.uid || user.id || user.userId) || "").trim();
                    if (!uid) {
                        showActionMessage("Usuário sem UID válido.", "error");
                        return;
                    }
                    var statusKey = computeStatusKey(user);
                    if (!canGrantAdminTrialForStatus(statusKey)) {
                        showActionMessage("Trial 30d só pode ser concedido para cliente sem assinatura, expirado, bloqueado ou pendente.", "error");
                        return;
                    }
                    var display = getUserDisplayName(user, uid);
                    var email = String(user && user.email ? user.email : "").trim();
                    var pendingWarning = user && user.pendingPayment
                        ? "\n\nExiste pagamento/solicitação pendente. A concessão vai marcar pendências abertas como substituídas, preservando a auditoria."
                        : "";
                    var confirmMessage =
                        "Conceder bônus Trial 30 dias para " + display + "?\n\n" +
                        "O acesso completo será liberado agora, com vencimento real gravado no sistema. " +
                        "O cliente receberá aviso no sininho e também no e-mail cadastrado" + (email ? " (" + email + ")" : "") + "." +
                        pendingWarning;
                    var ok = window.AdminUI && typeof window.AdminUI.confirm === "function"
                        ? await window.AdminUI.confirm(confirmMessage, "Conceder Trial 30d")
                        : confirm(confirmMessage);
                    if (!ok) return;

                    var defaultNote = "Bônus comercial concedido pelo SuperAdmin para o cliente testar o Sisweb por 30 dias.";
                    var note = window.AdminUI && typeof window.AdminUI.prompt === "function"
                        ? await window.AdminUI.prompt("Observação para auditoria:", defaultNote)
                        : prompt("Observação para auditoria:", defaultNote);
                    if (note === null) return;
                    note = String(note || "").trim() || defaultNote;

                    showActionMessage("Concedendo Trial 30d para " + display + "...", "info");
                    var result = await firebaseSvc.grantAdminFreeTrial({
                        targetUid: uid,
                        days: 30,
                        reviewNote: note
                    });
                    var data = result && result.data ? result.data : result;
                    if (!result || result.success === false || (data && data.success === false)) {
                        showActionMessage((result && result.error) || (data && data.error) || "Falha ao conceder Trial 30d.", "error");
                        return;
                    }
                    var endLabel = data && data.endDate ? formatAdminDateValue(data.endDate, "-") : "-";
                    if (data && data.alreadyActive) {
                        showActionMessage("Cliente já possui trial ativo até " + endLabel + ".", "info");
                    } else if (data && data.emailSent === false) {
                        showActionMessage("Trial 30d concedido até " + endLabel + ". Sininho enviado; e-mail não enviado: " + (data.emailError || "verifique o SMTP/e-mail do cliente."), "warning");
                    } else {
                        showActionMessage("Trial 30d concedido até " + endLabel + ". Sininho e e-mail enviados ao cliente.", "success");
                    }
                    await loadUsersAndDashboard();
                    if (activeTab === "subscriptions") applySubscriptionsFilter();
                    if (activeTab === "finance") applyFinancialFilter();
                    if (activeTab === "status") await loadOpenExtensionRequests();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao conceder Trial 30d.", "error");
                }
            }
            async function extendSubscriptionDialog(user) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.extendSubscriptionAccess !== "function") {
                        await window.AdminUI.alert("Serviço de prorrogação indisponível.");
                        return;
                    }
                    var uid = String(user.uid || "");
                    if (!uid) {
                        await window.AdminUI.alert("Usuário sem UID válido.");
                        return;
                    }
                    var input = await window.AdminUI.prompt("Quantos dias de prorrogação deseja conceder?", "30");
                    if (!input) return;
                    var extraDays = parseInt(String(input),10);
                    if (!Number.isFinite(extraDays) || extraDays <= 0) {
                        await window.AdminUI.alert("Informe um número de dias válido maior que zero.");
                        return;
                    }
                    var ok = await window.AdminUI.confirm("Confirmar prorrogação de " + extraDays + " dia(s) para este usuário?");
                    if (!ok) return;
                    var result = await window.firebaseService.extendSubscriptionAccess(uid, extraDays);
                    if (!result || result.success === false) {
                        await window.AdminUI.alert((result && result.error) || "Falha ao prorrogar assinatura.");
                        return;
                    }
                    showActionMessage("Assinatura prorrogada com sucesso.", "success");
                    await loadUsersAndDashboard();
                    if (activeTab === "subscriptions") applySubscriptionsFilter();
                    if (activeTab === "status") await loadOpenExtensionRequests();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao prorrogar assinatura.", "error");
                }
            }

            window.openReviewExtensionModal = function(req) {
                document.getElementById('reviewExtUser').textContent = req.userProfile && req.userProfile.displayName ? req.userProfile.displayName + ' (' + req.email + ')' : req.email || req.uid;
                document.getElementById('reviewExtDays').textContent = String(req.requestedDays || 0) + ' dias';
                document.getElementById('reviewExtGrantedDays').value = req.requestedDays || 30;
                document.getElementById('reviewExtJustification').textContent = req.justification || 'Sem justificativa.';
                document.getElementById('reviewExtNote').value = '';
                document.getElementById('reviewExtUid').value = req.uid;
                document.getElementById('reviewExtRequestId').value = req.requestId;
                document.getElementById('reviewExtensionModal').classList.add('active');
            };

            window.closeReviewExtensionModal = function() {
                document.getElementById('reviewExtensionModal').classList.remove('active');
            };

            window.submitReviewExtension = async function(approve) {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.reviewSubscriptionExtensionRequest !== 'function') {
                        showActionMessage("Serviço indisponível.", "error");
                        return;
                    }
                    var uid = document.getElementById('reviewExtUid').value;
                    var requestId = document.getElementById('reviewExtRequestId').value;
                    var grantedDays = document.getElementById('reviewExtGrantedDays').value;
                    var reviewNote = document.getElementById('reviewExtNote').value;
                    
                    if (!uid || !requestId) return;
                    
                    var payload = {
                        uid: uid,
                        requestId: requestId,
                        approve: approve,
                        grantedDays: grantedDays ? parseInt(grantedDays, 10) : 0,
                        reviewNote: reviewNote
                    };
                    
                    var result = await window.firebaseService.reviewSubscriptionExtensionRequest(payload);
                    if (!result || result.success === false) {
                        showActionMessage((result && result.error) || "Falha ao processar solicitação.", "error");
                        return;
                    }
                    
                    showActionMessage(approve ? "Prorrogação aprovada com sucesso." : "Prorrogação rejeitada.", "success");
                    closeReviewExtensionModal();
                    await loadUsersAndDashboard();
                    if (activeTab === "subscriptions") applySubscriptionsFilter();
                    if (activeTab === "status") await loadOpenExtensionRequests();
                } catch (err) {
                    showActionMessage((err && err.message) || "Erro ao revisar solicitação.", "error");
                }
            };

            async function loadUsersAndDashboard() {
                if (!window.firebaseService || typeof window.firebaseService.getAll !== "function") return;
                setDebugStatus("getAll(users)", "loading", "Buscando usuários");
                var now = Date.now();
                if (lastLoadedAt && now - lastLoadedAt < 3000 && allUsers.length) {
                    applyDataToUi();
                    applyAdminAccessAuditFilter();
                    setDebugStatus("getAll(users)", "ok", "Cache local recente");
                    return;
                }
                lastLoadedAt = now;
                var res = await window.firebaseService.getAll("users");
                var map = res && res.success ? res.data : res;
                allUsers = normalizeUsersFromMap(map);
                setDebugStatus("getAll(users)", "ok", "Total: " + String(allUsers.length));
                try {
                    setDebugStatus("getAll(companies)", "loading", "Carregando empresas");
                    var companiesRes = await window.firebaseService.getAll("companies");
                    var companiesMap = companiesRes && companiesRes.success ? companiesRes.data : companiesRes;
                    companyNameById = {};
                    companyCnpjById = {};
                    companyProfilesById = {};
                    companyDataByUserUid = {};
                    if (companiesMap && typeof companiesMap === "object") {
                        Object.keys(companiesMap).forEach(function(companyId) {
                            var company = companiesMap[companyId] || {};
                            var rootProfile = company.profile && typeof company.profile === "object" ? company.profile : {};
                            var nestedLegacyRaw = company.companies;
                            var nestedLegacy = Array.isArray(nestedLegacyRaw)
                                ? (nestedLegacyRaw.find(function(item){return item && typeof item === "object";}) || {})
                                : (nestedLegacyRaw && typeof nestedLegacyRaw === "object" ? nestedLegacyRaw : {});
                            var mergedCompany = {};
                            Object.assign(mergedCompany, company || {}, nestedLegacy || {}, rootProfile || {});
                            mergedCompany.id = String(companyId || mergedCompany.id || mergedCompany.companyId || "").trim();
                            mergedCompany.companyId = mergedCompany.id;
                            var cName = normalizeCompanyName(mergedCompany);
                            var cnpj = String(
                                mergedCompany.cnpj
                                || mergedCompany.cnpjCpf
                                || mergedCompany.cpfCnpj
                                || mergedCompany.documento
                                || mergedCompany.document
                                || ""
                            ).trim();
                            if (companyId) companyNameById[String(companyId)] = cName || String(companyId);
                            if (companyId) companyCnpjById[String(companyId)] = cnpj || "-";
                            if (companyId) companyProfilesById[String(companyId)] = mergedCompany;
                            var companyUsers = company.users && typeof company.users === "object" ? company.users : {};
                            Object.keys(companyUsers).forEach(function(uidKey) {
                                var cUser = companyUsers[uidKey] || {};
                                companyDataByUserUid[String(uidKey)] = {
                                    companyId: String(companyId),
                                    companyName: cName || String(companyId),
                                    email: cUser.email || "",
                                    username: cUser.username || cUser.displayName || ""
                                };
                            });
                        });
                    }
                    allUsers = allUsers.map(function(user) {
                        var uid = String(user && user.uid ? user.uid : "");
                        var mirror = uid ? companyDataByUserUid[uid] : null;
                        var next = Object.assign({}, user);
                        if (mirror) {
                            if (!next.email && mirror.email) next.email = mirror.email;
                            if (!next.username && mirror.username) next.username = mirror.username;
                            if (!next.companyId && mirror.companyId) next.companyId = mirror.companyId;
                            if (!next.companyName && mirror.companyName) next.companyName = mirror.companyName;
                        }
                        if (next.companyId && !next.companyName && companyNameById[next.companyId]) next.companyName = companyNameById[next.companyId];
                        return next;
                    });
                    setDebugStatus("getAll(companies)", "ok", "Empresas mapeadas");
                } catch (companiesErr) {
                    setDebugStatus("getAll(companies)", "error", companiesErr && companiesErr.message ? companiesErr.message : "Falha");
                }
                try {
                    setDebugStatus("getAll(subscriptionRequests)", "loading", "Mesclando pendências");
                    var srRes = await window.firebaseService.getAll("subscriptionRequests");
                    var srMap = srRes && srRes.success ? srRes.data : srRes;
                    latestRequestsByUid = {};
                    subscriptionRequestsHistory = [];
                    if (srMap && typeof srMap === "object") {
                        Object.keys(srMap).forEach(function(uidKey) {
                            var perUser = srMap[uidKey] || {};
                            var latest = null;
                            var latestAt = 0;
                            Object.keys(perUser || {}).forEach(function(reqId) {
                                var req = perUser[reqId] || {};
                                subscriptionRequestsHistory.push({ uid: String(uidKey), requestId: String(reqId), request: Object.assign({}, req) });
                                var at = req.createdAt || req.date || req.timestamp || null;
                                var ts = at ? new Date(at).getTime() : 0;
                                if (!latest || ts > latestAt) {
                                    latestAt = ts;
                                    latest = Object.assign({}, req, { requestId: reqId });
                                }
                            });
                            if (!latest) return;
                            latestRequestsByUid[String(uidKey)] = latest;
                            var idx = allUsers.findIndex(function(u) {
                                var uid = String(u.uid || u.id || u.userId || "");
                                return uid && uid === String(uidKey);
                            });
                            var user = idx >= 0 ? allUsers[idx] : { uid: String(uidKey) };
                            if (!user.email && latest.email) user.email = latest.email;
                            if (!user.username && latest.username) user.username = latest.username;
                            if (!user.companyId && latest.companyId) user.companyId = latest.companyId;
                            if (!user.companyName && user.companyId && companyNameById[user.companyId]) user.companyName = companyNameById[user.companyId];
                            user.latestRequestId = latest.requestId || "";
                            user.latestRequestStatus = String(latest.status || "").toLowerCase();
                            user.approvalState = String(latest.approvalState || "").toLowerCase();
                            user.requestState = user.latestRequestStatus || user.approvalState || "";
                            var pending = {
                                status: "pending",
                                plan: latest.plan || "monthly",
                                amount: Number(latest.amount || 0),
                                method: String(latest.method || "pix").toUpperCase(),
                                date: latest.date || latest.createdAt || new Date().toISOString(),
                                reference: latest.reference || latest.requestId || "",
                                requestId: latest.requestId || "",
                                proofUrl: latest.proofUrl || "",
                                proofStoragePath: latest.proofStoragePath || "",
                                proofFileName: latest.proofFileName || "",
                                proofMimeType: latest.proofMimeType || "",
                                proofHash: latest.proofHash || ""
                            };
                            if (String(latest.status || "pending").toLowerCase() === "pending" && (!user.pendingPayment || String(user.pendingPayment.status || "").toLowerCase() !== "pending")) {
                                user.pendingPayment = pending;
                            }
                            if (String(latest.status || "").toLowerCase() === "pending" && (!user.subscriptionStatus || user.subscriptionStatus === "expired")) {
                                user.subscriptionStatus = "pending";
                            }
                            if (String(latest.status || "").toLowerCase() === "pending" && !user.accountStatus) user.accountStatus = "pending";
                            if (String(latest.status || "").toLowerCase() === "pending" && !user.statusReason) user.statusReason = "Aguardando validação administrativa do comprovante.";
                            if (idx >= 0) allUsers[idx] = user; else allUsers.push(user);
                        });
                    }
                    setDebugStatus("getAll(subscriptionRequests)", "ok", "Pendências mescladas");
                } catch (mergeErr) {}
                try {
                    setDebugStatus("getAll(subscriptionPayments)", "loading", "Mesclando PIX automático");
                    var pixRes = await window.firebaseService.getAll("subscriptionPayments");
                    var pixMap = pixRes && pixRes.success ? pixRes.data : pixRes;
                    subscriptionPixPaymentsHistory = [];
                    if (pixMap && typeof pixMap === "object") {
                        Object.keys(pixMap).forEach(function(paymentId) {
                            var payment = pixMap[paymentId] || {};
                            if (!payment || typeof payment !== "object") return;
                            var normalized = Object.assign({}, payment);
                            normalized.paymentId = normalized.paymentId || paymentId;
                            subscriptionPixPaymentsHistory.push({
                                paymentId: String(paymentId),
                                uid: String(normalized.uid || ""),
                                payment: normalized
                            });
                            var uidFromPayment = String(normalized.uid || "");
                            if (!uidFromPayment) return;
                            var idx = allUsers.findIndex(function(u) {
                                return String((u && (u.uid || u.id || u.userId)) || "") === uidFromPayment;
                            });
                            if (idx < 0) return;
                            var user = allUsers[idx] || {};
                            var paymentStatus = normalizeAutoPixStatus(normalized.status || normalized.providerStatus);
                            if (paymentStatus === "pending") {
                                if (!user.pendingPayment || String(user.pendingPayment.status || "").toLowerCase() !== "pending") {
                                    user.pendingPayment = {
                                        status: "pending",
                                        plan: normalized.plan || "monthly",
                                        amount: Number(normalized.amount || normalized.paidAmount || 0),
                                        method: "PIX",
                                        date: normalized.createdAt || normalized.updatedAt || new Date().toISOString(),
                                        reference: normalized.paymentId || normalized.providerPaymentId || "",
                                        requestId: ""
                                    };
                                }
                                if (!user.subscriptionStatus || user.subscriptionStatus === "expired") user.subscriptionStatus = "pending";
                            }
                            allUsers[idx] = user;
                        });
                    }
                    setDebugStatus("getAll(subscriptionPayments)", "ok", "PIX automático mesclado");
                } catch (pixErr) {
                    subscriptionPixPaymentsHistory = [];
                    setDebugStatus("getAll(subscriptionPayments)", "error", pixErr && pixErr.message ? pixErr.message : "Falha");
                }
                applyDataToUi();
                applyFinancialFilter();
                applyAdminAccessAuditFilter();
                if (activeTab === "subscriptions") {
                    applySubscriptionsFilter();
                } else if (activeTab === "finance") {
                    applyFinancialFilter();
                } else if (activeTab === "security") {
                    applyAdminAccessAuditFilter();
                }
            }
            async function loadExecutiveSummary() {
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getCampaignExecutiveSummary !== "function") {
                        setExecutiveSummary(null);
                        return;
                    }
                    var result = await window.firebaseService.getCampaignExecutiveSummary();
                    if (result && result.success && result.data && result.data.summary) {
                        setExecutiveSummary(result.data.summary);
                        setDebugStatus("getCampaignExecutiveSummary(dashboard)", "ok", "Resumo carregado");
                    } else {
                        setExecutiveSummary(null);
                        setDebugStatus("getCampaignExecutiveSummary(dashboard)", "error", "Sem dados");
                    }
                } catch (_) {
                    setExecutiveSummary(null);
                    setDebugStatus("getCampaignExecutiveSummary(dashboard)", "error", "Falha na chamada");
                }
            }
            async function loadSubscriptionSettings() {
                var meta = document.getElementById("settingsMeta");
                if (meta) meta.textContent = "Carregando configuração...";
                setDebugStatus("getSubscriptionSettings", "loading", "Iniciando");
                try {
                    if (!window.firebaseService || typeof window.firebaseService.getSubscriptionSettings !== "function") {
                        if (meta) meta.textContent = "Serviço indisponível";
                        return;
                    }
                    var result = await window.firebaseService.getSubscriptionSettings();
                    var settings = null;
                    if (result && result.success && result.data && result.data.settings) {
                        settings = result.data.settings;
                    } else if (result && result.success && result.data) {
                        settings = result.data.settings || result.data;
                    } else if (result && result.settings) {
                        settings = result.settings;
                    }
                    if (!settings) {
                        if (meta) meta.textContent = "Nenhuma configuração aplicada";
                        setDebugStatus("getSubscriptionSettings", "error", "Sem configuração");
                        return;
                    }
                    var freeTrial = settings.freeTrialDays || (settings.trial && settings.trial.days);
                    var late = settings.lateGraceDays || (settings.paymentMeta && settings.paymentMeta.lateGraceDays);
                    var monthly = settings.plans && settings.plans.monthly && settings.plans.monthly.amount;
                    var annual = settings.plans && settings.plans.annual && settings.plans.annual.amount;
                    var premium = settings.plans && settings.plans.premium && settings.plans.premium.amount;
                    var paymentMeta = settings.paymentMeta && typeof settings.paymentMeta === "object" ? settings.paymentMeta : {};
                    var paymentMethods = settings.paymentMethods && typeof settings.paymentMethods === "object" ? settings.paymentMethods : {};
                    var freeEl = document.getElementById("settingsFreeTrialDays");
                    var lateEl = document.getElementById("settingsLateGraceDays");
                    var mEl = document.getElementById("settingsPlanMonthly");
                    var aEl = document.getElementById("settingsPlanAnnual");
                    var pEl = document.getElementById("settingsPlanPremium");
                    var pixKeyEl = document.getElementById("settingsPixKey");
                    var beneficiaryEl = document.getElementById("settingsPaymentBeneficiary");
                    var supportEmailEl = document.getElementById("settingsPaymentSupportEmail");
                    var methodPixEl = document.getElementById("settingsMethodPix");
                    var methodBoletoEl = document.getElementById("settingsMethodBoleto");
                    var methodCardEl = document.getElementById("settingsMethodCard");
                    var methodTransferEl = document.getElementById("settingsMethodTransfer");
                    if (freeEl && typeof freeTrial !== "undefined") freeEl.value = String(freeTrial);
                    if (lateEl && typeof late !== "undefined") lateEl.value = String(late);
                    if (mEl && typeof monthly !== "undefined") mEl.value = String(monthly);
                    if (aEl && typeof annual !== "undefined") aEl.value = String(annual);
                    if (pEl && typeof premium !== "undefined") pEl.value = String(premium);
                    if (pixKeyEl) pixKeyEl.value = String(paymentMeta.pixKey || "");
                    if (beneficiaryEl) beneficiaryEl.value = String(paymentMeta.beneficiary || "");
                    if (supportEmailEl) supportEmailEl.value = String(paymentMeta.supportEmail || "");
                    if (methodPixEl) methodPixEl.checked = paymentMethods.pix !== false;
                    if (methodBoletoEl) methodBoletoEl.checked = paymentMethods.boleto === true;
                    if (methodCardEl) methodCardEl.checked = paymentMethods.card === true;
                    if (methodTransferEl) methodTransferEl.checked = paymentMethods.transfer === true;
                    updatePaymentModalPreview();
                    if (meta) meta.textContent = "Configuração carregada";
                    setDebugStatus("getSubscriptionSettings", "ok", "Configuração aplicada");
                } catch (err) {
                    if (meta) meta.textContent = "Erro ao carregar";
                    notifyAdmin("Falha ao carregar configuração comercial.", "error");
                    setDebugStatus("getSubscriptionSettings", "error", err && err.message ? err.message : "Falha");
                }
            }
            async function saveSubscriptionSettings() {
                var meta = document.getElementById("settingsMeta");
                var freeEl = document.getElementById("settingsFreeTrialDays");
                var lateEl = document.getElementById("settingsLateGraceDays");
                var mEl = document.getElementById("settingsPlanMonthly");
                var aEl = document.getElementById("settingsPlanAnnual");
                var pEl = document.getElementById("settingsPlanPremium");
                var pixKeyEl = document.getElementById("settingsPixKey");
                var beneficiaryEl = document.getElementById("settingsPaymentBeneficiary");
                var supportEmailEl = document.getElementById("settingsPaymentSupportEmail");
                var methodPixEl = document.getElementById("settingsMethodPix");
                var methodBoletoEl = document.getElementById("settingsMethodBoleto");
                var methodCardEl = document.getElementById("settingsMethodCard");
                var methodTransferEl = document.getElementById("settingsMethodTransfer");
                var payload = {};
                var free = parseInt(freeEl && freeEl.value ? freeEl.value : "0",10);
                var late = parseInt(lateEl && lateEl.value ? lateEl.value : "0",10);
                var monthly = parseFloat(mEl && mEl.value ? mEl.value : "0");
                var annual = parseFloat(aEl && aEl.value ? aEl.value : "0");
                var premium = parseFloat(pEl && pEl.value ? pEl.value : "0");
                if (Number.isFinite(free)) payload.freeTrialDays = free;
                if (Number.isFinite(late)) payload.lateGraceDays = late;
                payload.plans = {monthly:{amount:monthly},annual:{amount:annual},premium:{amount:premium}};
                payload.paymentMeta = {
                    pixKey: String((pixKeyEl && pixKeyEl.value) || "").trim(),
                    beneficiary: String((beneficiaryEl && beneficiaryEl.value) || "").trim(),
                    supportEmail: String((supportEmailEl && supportEmailEl.value) || "").trim()
                };
                payload.paymentMethods = {
                    pix: !!(methodPixEl && methodPixEl.checked),
                    boleto: !!(methodBoletoEl && methodBoletoEl.checked),
                    card: !!(methodCardEl && methodCardEl.checked),
                    transfer: !!(methodTransferEl && methodTransferEl.checked)
                };
                if (!payload.paymentMethods.pix && !payload.paymentMethods.boleto && !payload.paymentMethods.card && !payload.paymentMethods.transfer) {
                    alert("Habilite pelo menos um método de pagamento.");
                    if (meta) meta.textContent = "Métodos de pagamento inválidos";
                    return;
                }
                if (!window.firebaseService || typeof window.firebaseService.upsertSubscriptionSettings !== "function") {
                    alert("Serviço de configuração indisponível.");
                    return;
                }
                try {
                    if (meta) meta.textContent = "Salvando...";
                    var result = await window.firebaseService.upsertSubscriptionSettings(payload);
                    if (!result || result.success === false) {
                        alert((result && result.error) || "Falha ao salvar configuração.");
                        if (meta) meta.textContent = "Erro ao salvar";
                        return;
                    }
                    alert("Configuração salva com sucesso.");
                    if (meta) meta.textContent = "Configuração salva";
                } catch (err) {
                    alert((err && err.message) || "Erro ao salvar configuração.");
                    if (meta) meta.textContent = "Erro ao salvar";
                    notifyAdmin("Falha ao salvar configuração comercial.", "error");
                }
            }
            async function loadOpenExtensionRequests() {
                var tbody = document.getElementById("extensionRequestsBody");
                var meta = document.getElementById("statusMeta");
                if (!tbody) return;
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando solicitações...</td></tr>';
                if (!window.firebaseService || typeof window.firebaseService.getOpenExtensionRequests !== "function") {
                    if (meta) meta.textContent = "Serviço indisponível";
                    setDebugStatus("getOpenExtensionRequests", "error", "Serviço indisponível");
                    return;
                }
                try {
                    setDebugStatus("getOpenExtensionRequests", "loading", "Buscando solicitações");
                    var result = await window.firebaseService.getOpenExtensionRequests();
                    var items = result && result.success && result.data && Array.isArray(result.data.requests) ? result.data.requests : [];
                    if (!items.length) {
                        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma solicitação de prorrogação aberta.</td></tr>';
                        if (meta) meta.textContent = "Sem solicitações abertas";
                        setDebugStatus("getOpenExtensionRequests", "ok", "Sem solicitações");
                        return;
                    }
                    tbody.innerHTML = "";

                    function normalizeIp(req) {
                        var ip = req && (req.requestIp || req.ip || req.ipAddress || req.ip_address || req.remoteIp || req.remote_ip || (req.userSnapshot && req.userSnapshot.ip));
                        return String(ip || "-").trim() || "-";
                    }
                    function normalizeDate(req) {
                        var raw = req && (req.createdAt || req.created_at || req.requestedAt || req.requested_at || req.timestamp || req.ts || req.date);
                        try {
                            if (!raw) return "-";
                            var d = raw instanceof Date ? raw : new Date(raw);
                            if (String(d) === 'Invalid Date') return "-";
                            return d.toLocaleString('pt-BR');
                        } catch (_) {
                            return "-";
                        }
                    }
                    function getRemainingDays(req) {
                        try {
                            var profile = req && req.userProfile && typeof req.userProfile === 'object' ? req.userProfile : {};
                            var fromProfile = Number(profile.remainingDays);
                            if (Number.isFinite(fromProfile) && fromProfile >= 0) return Math.floor(fromProfile);
                            var endRaw = String(profile.subscriptionEndDate || req.subscriptionEndDate || '').trim();
                            if (!endRaw) return 0;
                            var endDate = new Date(endRaw);
                            if (String(endDate) === 'Invalid Date') return 0;
                            var diff = endDate.getTime() - Date.now();
                            if (diff <= 0) return 0;
                            return Math.ceil(diff / (1000 * 60 * 60 * 24));
                        } catch (_) {
                            return 0;
                        }
                    }
                    function remainingDaysClass(days) {
                        var value = Number(days || 0);
                        if (value >= 15) return "remaining-days-green";
                        if (value >= 6) return "remaining-days-yellow";
                        return "remaining-days-red";
                    }
                    function statusPt(req) {
                        var raw = String((req && (req.status || req.state)) || 'open').toLowerCase();
                        if (raw === 'status') raw = 'pending';
                        if (raw === 'open' || raw === 'pending' || raw === 'requested') return 'Aberto';
                        if (raw === 'approved' || raw === 'granted' || raw === 'done') return 'Aprovado';
                        if (raw === 'rejected' || raw === 'denied') return 'Rejeitado';
                        if (raw === 'closed' || raw === 'resolved') return 'Fechado';
                        return raw;
                    }
                    function statusClass(req) {
                        var raw = String((req && (req.status || req.state)) || 'open').toLowerCase();
                        if (raw === 'status') raw = 'pending';
                        if (raw === 'approved' || raw === 'granted' || raw === 'done') return 'status-active';
                        if (raw === 'rejected' || raw === 'denied') return 'status-blocked';
                        if (raw === 'closed' || raw === 'resolved') return 'status-expired';
                        return 'status-pending';
                    }
                    async function deleteFromStatusFlow(req) {
                        var uid = String((req && req.uid) || '').trim();
                        var email = String((req && req.email) || '').trim();
                        if (!uid) {
                            await window.AdminUI.alert('Solicitação sem UID válido.');
                            return;
                        }
                        await deleteSubscriptionDataFlow({ uid: uid, email: email, username: req && req.username, displayName: req && req.displayName });
                        try { applySubscriptionsFilter(); } catch (_) {}
                        try { await loadOpenExtensionRequests(); } catch (_) {}
                    }

                    items.forEach(function(req) {
                        var tr = document.createElement("tr");
                        var profile = req && req.userProfile && typeof req.userProfile === 'object' ? req.userProfile : {};
                        var snap = req && req.userSnapshot && typeof req.userSnapshot === 'object' ? req.userSnapshot : {};
                        var realName = String(profile.realName || snap.realName || req.realName || req.nome || req.displayName || req.username || '').trim();
                        var emailValue = String(profile.email || snap.email || req.email || '').trim();
                        var phoneValue = String(profile.phone || snap.phone || req.phone || req.telefone || '').trim();
                        var planValue = String(profile.plan || snap.plan || req.plan || '').trim();
                        var remainingDaysValue = getRemainingDays(req);
                        var tdUser = document.createElement("td");
                        var userLabel = getUserDisplayName({ username: req.username, displayName: realName || req.displayName, email: emailValue || req.email, uid: req.uid });
                        tdUser.innerHTML = '<strong>' + userLabel + '</strong>' + (phoneValue ? '<br><span style="font-size:11px;color:#64748b;">Telefone: ' + phoneValue + '</span>' : '');
                        var tdEmail = document.createElement("td");
                        tdEmail.textContent = emailValue || req.email || "";
                        var tdStatus = document.createElement("td");
                        tdStatus.innerHTML = '<span class="status-pill ' + statusClass(req) + '">' + statusPt(req) + '</span>';
                        var tdPlan = document.createElement("td");
                        tdPlan.textContent = planValue || "-";
                        var tdDays = document.createElement("td");
                        tdDays.innerHTML = '<span class="remaining-days-pill ' + remainingDaysClass(remainingDaysValue) + '">' + String(remainingDaysValue) + '</span>';
                        var tdIp = document.createElement('td');
                        tdIp.textContent = normalizeIp(req);
                        var uaValue = String(req.requestUserAgent || req.userAgent || req.ua || '').trim();
                        if (uaValue) tdIp.title = 'User-Agent: ' + uaValue;
                        var tdDate = document.createElement('td');
                        tdDate.textContent = normalizeDate(req);
                        var tdActions = document.createElement('td');
                        tdActions.style.whiteSpace = 'nowrap';

                        var btnReview = document.createElement('button');
                        btnReview.type = 'button';
                        btnReview.className = 'btn primary small';
                        btnReview.innerHTML = '<i class="fas fa-search"></i><span>Analisar</span>';
                        btnReview.addEventListener('click', function() {
                            window.openReviewExtensionModal(req);
                        });
                        var btnDelete = document.createElement('button');
                        btnDelete.type = 'button';
                        btnDelete.className = 'btn danger small';
                        btnDelete.innerHTML = '<i class="fas fa-trash"></i><span>Excluir</span>';
                        btnDelete.addEventListener('click', function() {
                            deleteFromStatusFlow(req);
                        });

                        tdActions.appendChild(btnReview);
                        tdActions.appendChild(btnDelete);
                        tr.appendChild(tdUser);
                        tr.appendChild(tdEmail);
                        tr.appendChild(tdStatus);
                        tr.appendChild(tdPlan);
                        tr.appendChild(tdDays);
                        tr.appendChild(tdIp);
                        tr.appendChild(tdDate);
                        tr.appendChild(tdActions);
                        tbody.appendChild(tr);
                    });
                    scheduleResponsiveTablesHydration();
                    if (meta) meta.textContent = String(items.length) + " solicitações abertas";
                    setDebugStatus("getOpenExtensionRequests", "ok", "Total: " + String(items.length));
                } catch (err) {
                    console.error("[loadOpenExtensionRequests] CRITICAL ERROR:", err);
                    tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="color:red; text-align:left;">Erro: ' + (err && err.stack ? err.stack : String(err)) + '</td></tr>';
                    if (meta) meta.textContent = "Erro ao carregar";
                    notifyAdmin("Falha ao carregar solicitações de prorrogação.", "error");
                    setDebugStatus("getOpenExtensionRequests", "error", err && err.message ? err.message : "Falha");
                }
            }
            function applyDataToUi() {
                setDashboardStats(allUsers);
                setRecentSubscriptions(allUsers);
                scheduleResponsiveTablesHydration();
            }
            function applySubscriptionsFilter() {
                var filterEl = document.getElementById("subscriptionsFilter");
                var requestFilterEl = document.getElementById("requestStateFilter");
                var searchEl = document.getElementById("subscriptionsSearch");
                var filter = filterEl ? filterEl.value : "all";
                var requestFilter = requestFilterEl ? requestFilterEl.value : "all";
                var search = searchEl ? searchEl.value : "";
                var filtered = filterUsersForSubscriptions(allUsers,filter,requestFilter,search);
                renderSubscriptionsTable(filtered);
            }
            function listCompanyProfilesForManagement(searchTerm) {
                var term = String(searchTerm || "").toLowerCase().trim();
                var rows = Object.keys(companyProfilesById || {}).map(function(companyId) {
                    var company = companyProfilesById[companyId] || {};
                    var name = getCompanyProfileValueByKey(company, "name");
                    var cnpj = getCompanyProfileValueByKey(company, "cnpj");
                    var cnpjDigits = cnpj.replace(/\D+/g, "");
                    var city = getCompanyProfileValueByKey(company, "city");
                    var state = getCompanyProfileValueByKey(company, "state");
                    var phone = getCompanyProfileValueByKey(company, "phone");
                    var email = getCompanyProfileValueByKey(company, "email");
                    var responsible = getCompanyProfileValueByKey(company, "responsibleName");
                    var missing = getCompanyProfileMissingFields(company);
                    return {
                        companyId: String(companyId || "").trim(),
                        name: name,
                        cnpj: cnpj,
                        cnpjDigits: cnpjDigits,
                        city: city,
                        state: state,
                        phone: phone,
                        email: email,
                        responsible: responsible,
                        missing: missing,
                        raw: company,
                        blob: [companyId, name, cnpj, city, state, phone, email, responsible, missing.join(" ")].join(" ").toLowerCase()
                    };
                });
                rows.sort(function(a,b) {
                    return a.companyId.localeCompare(b.companyId);
                });
                if (!term) return rows;
                return rows.filter(function(row) { return row.blob.indexOf(term) >= 0; });
            }
            function renderCompanyManagementTable() {
                var tbody = document.getElementById("companiesTableBody");
                var meta = document.getElementById("companiesMeta");
                var searchEl = document.getElementById("companiesSearch");
                if (!tbody) return;
                var rows = listCompanyProfilesForManagement(searchEl ? searchEl.value : "");
                var cnpjCountMap = {};
                rows.forEach(function(row) {
                    var key = String(row && row.cnpjDigits || "").trim();
                    if (!key || key.length < 11) return;
                    cnpjCountMap[key] = Number(cnpjCountMap[key] || 0) + 1;
                });
                if (meta) meta.textContent = String(rows.length) + " empresas";
                tbody.innerHTML = "";
                if (!rows.length) {
                    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma empresa encontrada para o filtro atual.</td></tr>';
                    return;
                }
                rows.forEach(function(row) {
                    var tr = document.createElement("tr");
                    tr.className = "hoverable";
                    var tdId = document.createElement("td");
                    tdId.textContent = row.companyId || "-";
                    var tdName = document.createElement("td");
                    tdName.textContent = row.name || "-";
                    var tdCnpj = document.createElement("td");
                    var duplicateCount = Number(cnpjCountMap[row.cnpjDigits] || 0);
                    var duplicateTag = duplicateCount > 1 ? '<span class="cnpj-duplicate-badge">Duplicado</span>' : '';
                    tdCnpj.innerHTML = (row.cnpj || "-") + duplicateTag;
                    var tdCity = document.createElement("td");
                    tdCity.textContent = (row.city || "-") + "/" + (row.state || "-");
                    var tdPhone = document.createElement("td");
                    tdPhone.textContent = row.phone || "-";
                    var tdContact = document.createElement("td");
                    tdContact.innerHTML = (row.email ? escapeHtml(row.email) : "-") + (row.responsible ? '<br><span style="font-size:11px;color:#64748b;">' + escapeHtml(row.responsible) + '</span>' : "");
                    var tdMissing = document.createElement("td");
                    if (row.missing && row.missing.length) {
                        tdMissing.innerHTML = '<span class="status-pill status-pending">' + String(row.missing.length) + ' pend.</span><br><span style="font-size:11px;color:#64748b;">' + escapeHtml(row.missing.slice(0, 4).join(", ")) + (row.missing.length > 4 ? "..." : "") + '</span>';
                    } else {
                        tdMissing.innerHTML = '<span class="status-pill status-active">Completo</span>';
                    }
                    var tdAction = document.createElement("td");
                    var btnEdit = document.createElement("button");
                    btnEdit.type = "button";
                    btnEdit.className = "btn small";
                    btnEdit.textContent = "Editar";
                    btnEdit.addEventListener("click", function() {
                        selectCompanyProfileForEdit(row.companyId);
                    });
                    tdAction.appendChild(btnEdit);
                    tr.appendChild(tdId);
                    tr.appendChild(tdName);
                    tr.appendChild(tdCnpj);
                    tr.appendChild(tdCity);
                    tr.appendChild(tdPhone);
                    tr.appendChild(tdContact);
                    tr.appendChild(tdMissing);
                    tr.appendChild(tdAction);
                    tbody.appendChild(tr);
                });
                scheduleResponsiveTablesHydration();
            }
            function setCompanyLogoPreview(logoValue, fileName) {
                var previewEl = document.getElementById("companyEditLogoPreview");
                var fileNameEl = document.getElementById("companyEditLogoFileName");
                var logo = String(logoValue || "").trim();
                if (fileNameEl) fileNameEl.textContent = fileName || (logo ? "Logo carregada." : "Nenhuma imagem selecionada.");
                if (!previewEl) return;
                if (logo) {
                    previewEl.src = logo;
                    previewEl.style.display = "block";
                } else {
                    previewEl.removeAttribute("src");
                    previewEl.style.display = "none";
                }
            }
            function revokeCompanyLogoPreviewObjectUrl() {
                if (companyManagementLogoPreviewObjectUrl && window.URL && typeof window.URL.revokeObjectURL === "function") {
                    try { window.URL.revokeObjectURL(companyManagementLogoPreviewObjectUrl); } catch (_) {}
                }
                companyManagementLogoPreviewObjectUrl = "";
            }
            function isLegacyBase64LogoValue(value) {
                var raw = String(value || "").trim();
                return raw.indexOf("data:image/") === 0 || (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 1000);
            }
            function buildStoredLogoPayload(source) {
                var current = source && typeof source === "object" ? source : {};
                var logoUrl = String(current.logoUrl || current.logoURL || current.logoDownloadURL || "").trim();
                var logoStoragePath = String(current.logoStoragePath || current.logoPath || current.storagePath || "").trim();
                var logo = String(current.logo || "").trim();
                if (isLegacyBase64LogoValue(logo)) logo = "";
                return {
                    logo: logoUrl || logoStoragePath || logo,
                    logoUrl: logoUrl,
                    logoStoragePath: logoStoragePath,
                    logoPath: logoStoragePath,
                    logoFileName: String(current.logoFileName || current.logoName || current.name || "").trim(),
                    logoContentType: String(current.logoContentType || current.logoMimeType || current.contentType || "").trim(),
                    logoSize: Number(current.logoSize || current.size || 0) || null,
                    logoUpdatedAt: String(current.logoUpdatedAt || current.updatedAt || "").trim()
                };
            }
            async function handleCompanyLogoFileChange() {
                var logoInputEl = document.getElementById("companyEditLogoFile");
                var selectedLogoFile = logoInputEl && logoInputEl.files && logoInputEl.files[0] ? logoInputEl.files[0] : null;
                if (!selectedLogoFile) {
                    return;
                }
                if (!String(selectedLogoFile.type || "").startsWith("image/")) {
                    notifyAdmin("A logo precisa ser uma imagem.", "warning");
                    return;
                }
                revokeCompanyLogoPreviewObjectUrl();
                if (window.URL && typeof window.URL.createObjectURL === "function") {
                    companyManagementLogoPreviewObjectUrl = window.URL.createObjectURL(selectedLogoFile);
                    setCompanyLogoPreview(companyManagementLogoPreviewObjectUrl, "Nova logo selecionada: " + String(selectedLogoFile.name || "arquivo"));
                } else {
                    setCompanyLogoPreview("", "Nova logo selecionada: " + String(selectedLogoFile.name || "arquivo"));
                }
            }
            function clearCompanyProfileEditor() {
                companyManagementCurrentId = "";
                revokeCompanyLogoPreviewObjectUrl();
                var idEl = document.getElementById("companyEditId");
                var logoInputEl = document.getElementById("companyEditLogoFile");
                var editMeta = document.getElementById("companiesEditMeta");
                if (idEl) idEl.value = "";
                clearCompanyProfileFormFields();
                if (logoInputEl) logoInputEl.value = "";
                setCompanyLogoPreview("", "Nenhuma imagem selecionada.");
                if (editMeta) editMeta.textContent = "Nenhuma empresa selecionada";
            }
            function selectCompanyProfileForEdit(companyId) {
                var id = String(companyId || "").trim();
                if (!id) return;
                var company = companyProfilesById[id] || {};
                companyManagementCurrentId = id;
                var idEl = document.getElementById("companyEditId");
                var logoInputEl = document.getElementById("companyEditLogoFile");
                var editMeta = document.getElementById("companiesEditMeta");
                if (idEl) idEl.value = id;
                setCompanyProfileFormFields(company);
                if (logoInputEl) logoInputEl.value = "";
                revokeCompanyLogoPreviewObjectUrl();
                var currentLogo = String(company.logoUrl || company.logoURL || company.logoDownloadURL || company.logo || company.logoBase64 || "").trim();
                setCompanyLogoPreview(currentLogo, "Logo atual carregada.");
                if (editMeta) {
                    var missing = getCompanyProfileMissingFields(company);
                    editMeta.textContent = missing.length ? ("Editando " + id + " • faltam " + missing.length + " dados") : ("Editando " + id + " • completo");
                }
            }
            async function saveCompanyProfileFromAdmin() {
                if (!canMutateSensitiveData()) {
                    notifyAdmin("Somente super-admin pode alterar perfil de empresas.", "error");
                    return;
                }
                var idEl = document.getElementById("companyEditId");
                var logoInputEl = document.getElementById("companyEditLogoFile");
                var companyId = String((idEl && idEl.value) || companyManagementCurrentId || "").trim();
                if (!companyId) {
                    notifyAdmin("Selecione uma empresa antes de salvar.", "error");
                    return;
                }
                if (!window.firebaseService || typeof window.firebaseService.upsertCompanyProfile !== "function") {
                    notifyAdmin("Função administrativa de empresa indisponível no serviço Firebase.", "error");
                    return;
                }
                var logoPayload = {};
                var selectedLogoFile = logoInputEl && logoInputEl.files && logoInputEl.files[0] ? logoInputEl.files[0] : null;
                if (selectedLogoFile) {
                    if (!window.firebaseService || typeof window.firebaseService.uploadCompanyLogo !== "function") {
                        notifyAdmin("Upload de logo para Storage indisponível no serviço Firebase.", "error");
                        return;
                    }
                    try {
                        notifyAdmin("Enviando logo da empresa para o Storage...", "info");
                        var currentLogoPayload = buildStoredLogoPayload(current);
                        var uploadResult = await window.firebaseService.uploadCompanyLogo(selectedLogoFile, companyId, {
                            previousStoragePath: currentLogoPayload.logoStoragePath || currentLogoPayload.logoPath || currentLogoPayload.logo || currentLogoPayload.logoUrl || ""
                        });
                        if (!uploadResult || uploadResult.success === false) {
                            notifyAdmin((uploadResult && uploadResult.error) || "Falha no upload da logo.", "error");
                            return;
                        }
                        var uploadData = (uploadResult && uploadResult.data) || uploadResult || {};
                        logoPayload = {
                            logo: String(uploadData.url || uploadData.downloadURL || uploadData.storagePath || uploadData.path || "").trim(),
                            logoUrl: String(uploadData.url || uploadData.downloadURL || "").trim(),
                            logoStoragePath: String(uploadData.storagePath || uploadData.path || "").trim(),
                            logoPath: String(uploadData.storagePath || uploadData.path || "").trim(),
                            logoFileName: String(uploadData.name || selectedLogoFile.name || "").trim(),
                            logoContentType: String(uploadData.contentType || selectedLogoFile.type || "").trim(),
                            logoSize: Number(uploadData.size || selectedLogoFile.size || 0) || null,
                            logoUpdatedAt: String(uploadData.updatedAt || new Date().toISOString()).trim()
                        };
                    } catch (logoErr) {
                        notifyAdmin((logoErr && logoErr.message) || "Erro ao enviar logo da empresa.", "error");
                        return;
                    }
                } else {
                    var current = companyProfilesById[companyId] || {};
                    logoPayload = buildStoredLogoPayload(current);
                }
                var payload = { companyId: companyId, ...readCompanyProfileFormPayload(), ...logoPayload };
                var candidateDigits = String(payload.cnpj || "").replace(/\D+/g, "").trim();
                if (candidateDigits && candidateDigits.length >= 11) {
                    var duplicatedCompanyId = Object.keys(companyProfilesById || {}).find(function(otherId) {
                        if (String(otherId || "").trim() === companyId) return false;
                        var other = companyProfilesById[otherId] || {};
                        var otherDigits = String(other.cnpj || other.cnpjCpf || other.cpfCnpj || other.documento || "").replace(/\D+/g, "").trim();
                        return !!otherDigits && otherDigits === candidateDigits;
                    });
                    if (duplicatedCompanyId) {
                        notifyAdmin("CNPJ já está vinculado à empresa " + duplicatedCompanyId + ". Não é permitido duplicar CNPJ.", "error");
                        return;
                    }
                }
                try {
                    notifyAdmin("Salvando perfil da empresa...", "info");
                    var result = await window.firebaseService.upsertCompanyProfile(payload);
                    if (!result || result.success === false) {
                        notifyAdmin((result && result.error) || "Falha ao salvar perfil da empresa.", "error");
                        return;
                    }
                    var profile = result && result.data && result.data.profile ? result.data.profile : (result && result.profile ? result.profile : payload);
                    companyProfilesById[companyId] = { ...(companyProfilesById[companyId] || {}), ...profile, id: companyId, companyId: companyId };
                    companyNameById[companyId] = String(profile.name || profile.nome || companyNameById[companyId] || companyId).trim() || companyId;
                    companyCnpjById[companyId] = String(profile.cnpj || profile.cnpjCpf || profile.cpfCnpj || profile.documento || companyCnpjById[companyId] || "-").trim() || "-";
                    notifyAdmin("Perfil da empresa salvo com sucesso.", "success");
                    renderCompanyManagementTable();
                    selectCompanyProfileForEdit(companyId);
                } catch (err) {
                    notifyAdmin((err && err.message) || "Erro ao salvar perfil da empresa.", "error");
                }
            }
            async function loadCompanyProfiles(forceReload) {
                try {
                    var mustReload = !!forceReload || !companyProfilesById || !Object.keys(companyProfilesById).length;
                    if (mustReload) {
                        await loadUsersAndDashboard();
                    } else {
                        renderCompanyManagementTable();
                    }
                } catch (err) {
                    notifyAdmin((err && err.message) || "Falha ao carregar empresas para gestão.", "error");
                }
            }
            async function getAccessModel() {
                var isSuperAdmin = window.isSuperAdminSession ? await window.isSuperAdminSession() : false;
                var canDashboard = window.hasAdminPageAccess ? await window.hasAdminPageAccess("dashboard") : false;
                var canSubscriptions = window.hasAdminPageAccess ? await window.hasAdminPageAccess("subscriptions") : false;
                var canSettings = window.hasAdminPageAccess ? await window.hasAdminPageAccess("settings") : false;
                return {isSuperAdmin:isSuperAdmin,canDashboard:canDashboard,canSubscriptions:canSubscriptions,canSettings:canSettings};
            }
            async function bootstrap() {
                var guard = document.getElementById("guardMessage");
                var metaEl = document.getElementById("adminMeta");
                try {
                    bindAdminPwaViewportListeners();
                    setAppContentVisible(false);
                    setDebugVisible(false);
                    renderDebugPanel();
                    setDebugStatus("authReady", "loading", "Aguardando sessão");
                    var readyAuth = await waitForAuthReady(5500, 250);
                    if (!readyAuth) {
                        await logUnauthorizedAdminAttempt("auth_not_ready", { stage: "bootstrap" });
                        if (guard) guard.style.display = "block";
                        setDebugStatus("authReady", "error", "Sessão não disponível");
                        setTimeout(function() {window.location.href = "login.html?redirect=" + encodeURIComponent("admin.html?tab=dashboard");},1100);
                        return;
                    }
                    setDebugStatus("authReady", "ok", "Sessão disponível");
                    var access = await getAccessModel();
                    currentAccessModel = access;
                    if (!access.isSuperAdmin && !access.canDashboard && !access.canSubscriptions && !access.canSettings && window.firebaseService && typeof window.firebaseService.syncMyAdminClaims === "function") {
                        try { await window.firebaseService.syncMyAdminClaims(); } catch (_) {}
                        await new Promise(function(resolve) { setTimeout(resolve, 600); });
                        access = await getAccessModel();
                        currentAccessModel = access;
                    }
                    if (!access.isSuperAdmin && !access.canDashboard && !access.canSubscriptions && !access.canSettings) {
                        await logUnauthorizedAdminAttempt("admin_permission_denied", access);
                        if (guard) guard.style.display = "block";
                        setDebugStatus("accessModel", "error", "Sem permissões admin");
                        setTimeout(function() {window.location.href = "index.html";},1100);
                        return;
                    }
                    setAppContentVisible(true);
                    setDebugStatus("accessModel", "ok", "Permissões carregadas");
                    allowedTabs = [];
                    if (access.canDashboard || access.isSuperAdmin) allowedTabs.push("dashboard");
                    if (access.canSubscriptions || access.isSuperAdmin) {
                        allowedTabs.push("subscriptions");
                        allowedTabs.push("status");
                    }
                    if (access.canSettings || access.isSuperAdmin) {
                        allowedTabs.push("settings");
                        allowedTabs.push("companies");
                        allowedTabs.push("campaign");
                        allowedTabs.push("finance");
                        allowedTabs.push("security");
                    }
                    if (access.isSuperAdmin) {
                        allowedTabs.push("support");
                    }
                    var requestedTab = "";
                    try { requestedTab = new URLSearchParams(window.location.search || "").get("tab") || ""; } catch (_) {}
                    activeTab = requestedTab && allowedTabs.includes(requestedTab)
                        ? requestedTab
                        : (allowedTabs.indexOf("dashboard") >= 0 ? "dashboard" : allowedTabs[0]);
                    renderAllowedTabs();
                    await switchTab(activeTab);
                    if (metaEl) metaEl.textContent = buildAccessLabel(access);
                    var refreshBtn = document.getElementById("refreshDataBtn");
                    if (refreshBtn) {
                        refreshBtn.addEventListener("click",function() {
                            switchTab(activeTab);
                        });
                    }
                    var filterEl = document.getElementById("subscriptionsFilter");
                    var requestFilterEl = document.getElementById("requestStateFilter");
                    var searchEl = document.getElementById("subscriptionsSearch");
                    var reloadBtn = document.getElementById("subscriptionsReload");
                    var financialMethodEl = document.getElementById("financialMethodFilter");
                    var financialStatusEl = document.getElementById("financialStatusFilter");
                    var financialSearchEl = document.getElementById("financialSearch");
                    var financialReloadBtn = document.getElementById("financialReload");
                    var adminAccessPeriodEl = document.getElementById("adminAccessPeriodFilter");
                    var adminAccessUserEl = document.getElementById("adminAccessUserFilter");
                    var adminAccessReloadEl = document.getElementById("adminAccessReload");
                    var companiesSearchEl = document.getElementById("companiesSearch");
                    var companiesReloadEl = document.getElementById("companiesReload");
                    var companiesSaveEl = document.getElementById("companiesSave");
                    var companiesClearEl = document.getElementById("companiesClear");
                    var companySelectLogoBtn = document.getElementById("companyEditSelectLogo");
                    var companyLogoInputEl = document.getElementById("companyEditLogoFile");
                    var supportStatusEl = document.getElementById("supportStatusFilter");
                    var supportPriorityEl = document.getElementById("supportPriorityFilter");
                    var supportModuleEl = document.getElementById("supportModuleFilter");
                    var supportSearchEl = document.getElementById("supportSearch");
                    var supportReloadEl = document.getElementById("supportReload");
                    if (filterEl) filterEl.addEventListener("change",applySubscriptionsFilter);
                    if (requestFilterEl) requestFilterEl.addEventListener("change",applySubscriptionsFilter);
                    if (searchEl) searchEl.addEventListener("input",function() {applySubscriptionsFilter();});
                    if (reloadBtn) reloadBtn.addEventListener("click",function() {loadUsersAndDashboard();});
                    if (financialMethodEl) financialMethodEl.addEventListener("change",applyFinancialFilter);
                    if (financialStatusEl) financialStatusEl.addEventListener("change",applyFinancialFilter);
                    if (financialSearchEl) financialSearchEl.addEventListener("input",applyFinancialFilter);
                    if (financialReloadBtn) financialReloadBtn.addEventListener("click",function() {loadUsersAndDashboard();});
                    if (adminAccessPeriodEl) adminAccessPeriodEl.addEventListener("change", applyAdminAccessAuditFilter);
                    if (adminAccessUserEl) adminAccessUserEl.addEventListener("input", applyAdminAccessAuditFilter);
                    if (adminAccessReloadEl) adminAccessReloadEl.addEventListener("click", function() { loadUsersAndDashboard(); });
                    var secRiskFilterEl = document.getElementById("secRiskFilter");
                    if (secRiskFilterEl) secRiskFilterEl.addEventListener("change", applyAdminAccessAuditFilter);
                    if (companiesSearchEl) companiesSearchEl.addEventListener("input",renderCompanyManagementTable);
                    if (companiesReloadEl) companiesReloadEl.addEventListener("click",function() {loadCompanyProfiles(true);});
                    if (companiesSaveEl) companiesSaveEl.addEventListener("click",function() {saveCompanyProfileFromAdmin();});
                    if (companiesSaveEl && !canMutateSensitiveData()) {
                        companiesSaveEl.disabled = true;
                        companiesSaveEl.title = "Somente super-admin pode salvar perfil de empresa.";
                    }
                    if (companiesClearEl) companiesClearEl.addEventListener("click",clearCompanyProfileEditor);
                    if (companySelectLogoBtn && companyLogoInputEl) {
                        companySelectLogoBtn.addEventListener("click", function() { companyLogoInputEl.click(); });
                    }
                    if (companyLogoInputEl) {
                        companyLogoInputEl.addEventListener("change", function() { handleCompanyLogoFileChange(); });
                    }
                    if (supportStatusEl) supportStatusEl.addEventListener("change", loadSupportTicketsPanel);
                    if (supportPriorityEl) supportPriorityEl.addEventListener("change", loadSupportTicketsPanel);
                    if (supportModuleEl) supportModuleEl.addEventListener("input", function() {
                        clearTimeout(window.__supportModuleFilterTimer);
                        window.__supportModuleFilterTimer = setTimeout(loadSupportTicketsPanel, 350);
                    });
                    if (supportSearchEl) supportSearchEl.addEventListener("input", applySupportFilter);
                    if (supportReloadEl) supportReloadEl.addEventListener("click", loadSupportTicketsPanel);
                    var settingsReloadBtn = document.getElementById("settingsReload");
                    if (settingsReloadBtn) settingsReloadBtn.addEventListener("click",function() {loadSubscriptionSettings();});
                    var settingsSaveBtn = document.getElementById("settingsSave");
                    if (settingsSaveBtn) settingsSaveBtn.addEventListener("click",function() {saveSubscriptionSettings();});
                    if (settingsSaveBtn && !canMutateSensitiveData()) {
                        settingsSaveBtn.disabled = true;
                        settingsSaveBtn.title = "Somente super-admin pode alterar configurações comerciais e de pagamento.";
                    }
                    bindSettingsPreviewListeners();
                    var debugRefresh = document.getElementById("debugRefreshBtn");
                    if (debugRefresh) {
                        debugRefresh.addEventListener("click", function() { switchTab(activeTab); });
                    }
                    var campaignSaveBtn = document.getElementById("campaignSaveBtn");
                    if (campaignSaveBtn) campaignSaveBtn.addEventListener("click", function() { saveCampaignEditor(); });
                    var campaignLoadBtn = document.getElementById("campaignLoadBtn");
                    if (campaignLoadBtn) campaignLoadBtn.addEventListener("click", function() { loadCampaignEditor(); });
                    var btnNewPromoCode = document.getElementById("btnNewPromoCode");
                    if (btnNewPromoCode) btnNewPromoCode.addEventListener("click", function() { openPromoCodeModal(); });
                    document.addEventListener("keydown", function(e) {
                        if (!e) return;
                        var key = String(e.key || "").toLowerCase();
                        if (e.ctrlKey && e.shiftKey && key === "d") {
                            e.preventDefault();
                            toggleDebugVisible();
                        }
                    });
                    var openSubsShortcut = document.getElementById("openSubscriptionsShortcut");
                    if (openSubsShortcut) {
                        openSubsShortcut.addEventListener("click",function(e) {
                            e.preventDefault();
                            if (allowedTabs.includes("subscriptions")) {
                                switchTab("subscriptions");
                                applySubscriptionsFilter();
                            }
                        });
                    }
                    var campaignReload = document.getElementById("campaignReload");
                    if (campaignReload) {
                        campaignReload.addEventListener("click",function(e) {
                            e.preventDefault();
                            loadCampaignPanel();
                        });
                    }
                    var gcpBillingSyncBigQuery = document.getElementById("gcpBillingSyncBigQuery");
                    if (gcpBillingSyncBigQuery) {
                        gcpBillingSyncBigQuery.addEventListener("click", function(e) {
                            e.preventDefault();
                            syncGoogleCloudBillingCostExportFromAdmin();
                        });
                    }
                    var gcpBillingSyncCompanyUsageCosts = document.getElementById("gcpBillingSyncCompanyUsageCosts");
                    if (gcpBillingSyncCompanyUsageCosts) {
                        gcpBillingSyncCompanyUsageCosts.addEventListener("click", function(e) {
                            e.preventDefault();
                            syncGoogleCloudBillingCompanyUsageCostsFromAdmin();
                        });
                    }
                    var openSettingsShortcut = document.getElementById("openSettingsShortcut");
                    if (openSettingsShortcut) {
                        openSettingsShortcut.addEventListener("click",function(e) {
                            e.preventDefault();
                            if (allowedTabs.includes("settings")) {
                                switchTab("settings");
                                loadSubscriptionSettings();
                            }
                        });
                    }
                    await loadUsersAndDashboard();
                    await loadExecutiveSummary();
                    await loadGoogleCloudBillingSummary();
                    if (allowedTabs.includes("settings")) {
                        await loadSubscriptionSettings();
                    }
                    if (allowedTabs.includes("companies")) {
                        await loadCompanyProfiles(false);
                    }
                    if (allowedTabs.includes("status")) {
                        await loadOpenExtensionRequests();
                    }
                    if (allowedTabs.includes("campaign")) {
                        await loadCampaignPanel();
                    }
                } catch (err) {
                    if (console && console.error) console.error(err);
                    if (guard) guard.style.display = "block";
                    setTimeout(function() {window.location.href = "login.html";},900);
                }
            }
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded",bootstrap);
            } else {
                bootstrap();
            }
        })();
