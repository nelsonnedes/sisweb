/**
 * // [BH] UI e Modais do Banco de Horas
 * - Mantém padrão visual (cores, modais, botões) do sistema
 */

(function(){
	const UI = {
		init() {
			this.ensureContainers();
			this.bindGlobalButtons();
			this.exposeGlobals();
			console.log('// [BH] UI inicializada');
		},
			ensureContainers() {
			// Injeta contêineres de modais se não existirem
				const modals = [
					'bh-modalLancamento','bh-modalCompensar','bh-modalConfig','bh-modalAssinatura','bh-modalGerenciar'
				];
			modals.forEach(id => {
				if (!document.getElementById(id)) {
					const div = document.createElement('div');
					div.id = id;
					div.className = 'modal';
					div.innerHTML = this.modalTemplate(id);
					document.body.appendChild(div);
				}
			});
		},
		applyTextNormalization() {
			try {
				const sels = [
					'#bh-modalLancamento input[type="text"]',
					'#bh-modalLancamento textarea',
					'#bh-modalCompensar input[type="text"]',
					'#bh-modalConfig input[type="text"]',
					'#bh-modalGerenciar input[type="text"]',
					'#bh-modalGerenciar textarea'
				];
				const nodes = document.querySelectorAll(sels.join(', '));
				nodes.forEach(el => {
					el.addEventListener('blur', function(){
						const v = String(this.value || '').trim();
						if (!v) return;
						if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) {
							this.value = window.toTitleCasePt(v);
						}
					});
				});
			} catch (e) {}
		},
		modalTemplate(id) {
			const header = (title) => `
				<div class="modal-header">
					<h3 class="modal-title">${title}</h3>
					<span class="close-modal" onclick="(function(){ const el=document.getElementById('${id}'); if(el){ el.style.display='none'; if('${id}'==='bh-modalLancamento'){ try{ _modalOpen=false; }catch(e){} } } })()">&times;</span>
				</div>`;
			if (id === 'bh-modalLancamento') {
				return `
				<div class="modal-content">
					${header('Lançamento de Banco de Horas')}
					<div class="modal-body">
						<form id="bh-formLancamento">
							<div class="form-group">
								<label for="bh-funcionario-nome">Funcionário</label>
								<div class="autocomplete-container">
								<input type="text" id="bh-funcionario-nome" class="autocomplete-input" placeholder="Selecione um funcionário..."/>
									<div class="autocomplete-icons-container">
                                    <span class="autocomplete-icon" title="Listar Funcionários" onclick="(function(){ try { if (window.folhaFuncionarios) { window.folhaFuncionarios.targetField = 'bh-funcionario-nome'; } } catch(e){} openFuncionariosListModal(); })()">
											<i class="fas fa-list"></i>
										</span>
									</div>
								</div>
							<!-- datalist removido para evitar UI antiga e conflitos -->
								<input type="hidden" id="bh-funcionario-id" />
							</div>
							<div class="campos-grid">
								<div class="form-group">
									<label for="bh-data">Data</label>
									<input type="date" id="bh-data" required/>
								</div>
							<div class="form-group">
								<label for="bh-data-fim">Data fim (opcional)</label>
								<input type="date" id="bh-data-fim"/>
							</div>
							<div class="form-group">
								<label for="bh-minutos">Horas (+/-)</label>
								<input type="text" id="bh-minutos" placeholder="hh:mm (ex: 8:30 ou -1:15)"/>
							</div>
								<div class="form-group" style="grid-column: 1 / -1;">
									<div id="bh-saldosInfo" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
										<div class="bh-chip" id="bh-saldo-global" style="background:#f6f7fb;border:1px solid #cdd6e1;border-radius:6px;padding:6px 10px;color:#1b4670;">Saldo atual: --:-- hs</div>
										<div class="bh-chip" id="bh-saldo-periodo" style="background:#f6f7fb;border:1px solid #cdd6e1;border-radius:6px;padding:6px 10px;color:#1b4670;">No período: --:-- hs</div>
										<div class="bh-chip" id="bh-saldo-preview" style="background:#eefbf2;border:1px solid #bde5c6;border-radius:6px;padding:6px 10px;color:#1b7a3a;">Após este lançamento: --:-- hs</div>
									</div>
								</div>
								<div class="form-group">
									<label for="bh-venceEm">Vence em (opcional)</label>
									<input type="date" id="bh-venceEm"/>
								</div>
							</div>
							<div class="form-group">
								<label for="bh-observacao">Observação</label>
								<textarea id="bh-observacao" rows="2"></textarea>
							<div id="bh-observacao-preview" style="margin-top:6px; font-size:12px; color:#555;"></div>
							</div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="back-button close-modal-btn" onclick="document.getElementById('bh-modalLancamento').style.display='none'">Cancelar</button>
						<button type="submit" class="btn-save" form="bh-formLancamento">Salvar</button>
					</div>
				</div>`;
			}
			if (id === 'bh-modalCompensar') {
				return `
				<div class="modal-content">
					${header('Compensar Banco de Horas')}
					<div class="modal-body">
						<form id="bh-formCompensar">
							<div class="form-group">
								<label for="bh-funcionario-comp">Funcionário</label>
								<select id="bh-funcionario-comp"></select>
							</div>
							<div class="campos-grid">
							<div class="form-group">
								<label for="bh-minCompensar">Horas a compensar</label>
								<input type="text" id="bh-minCompensar" placeholder="hh:mm (ex: 2:00)"/>
							</div>
								<div class="form-group">
									<label for="bh-estrategia">Estrategia</label>
									<select id="bh-estrategia">
										<option value="quinzena">Quinzena corrente</option>
										<option value="fechamento">Fechamento do mês</option>
									</select>
								</div>
							</div>
							<div style="font-size:12px; color:#555; margin:6px 0 8px 0;">
								Use este modal para consumir saldo positivo (créditos). Para abater dívida de horas, registre um lançamento positivo no Banco de Horas.
							</div>
							<div id="bh-fifoPreview" style="max-height:160px; overflow:auto; border:1px solid #ddd; padding:8px; font-family:'Courier New';"></div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="back-button close-modal-btn" onclick="document.getElementById('bh-modalCompensar').style.display='none'">Cancelar</button>
						<button type="submit" class="btn-save" form="bh-formCompensar">Compensar</button>
					</div>
				</div>`;
			}
			if (id === 'bh-modalConfig') {
				return `
				<div class="modal-content">
					${header('Configuração do Banco de Horas')}
					<div class="modal-body">
						<form id="bh-formConfig">
							<div class="campos-grid">
								<div class="form-group"><label>Jornada semanal (h)</label><input type="number" id="bh-cfg-jornada" step="1" min="1"/></div>
								<div class="form-group"><label>Horas mensais contrato</label><input type="number" id="bh-cfg-horasMes" step="1" min="1"/></div>
								<div class="form-group"><label>Máx HE/dia</label><input type="number" id="bh-cfg-maxHE" step="0.5" min="0"/></div>
								<div class="form-group"><label>Tolerância (min)</label><input type="number" id="bh-cfg-tolerancia" step="1" min="0"/></div>
								<div class="form-group"><label>Janela compensação (meses)</label><input type="number" id="bh-cfg-janela" step="1" min="1"/></div>
								<div class="form-group"><label>Adicional dia útil (%)</label><input type="number" id="bh-cfg-addDia" step="1" min="0" max="200"/></div>
								<div class="form-group"><label>Adicional dom/fer (%)</label><input type="number" id="bh-cfg-addFer" step="1" min="0" max="300"/></div>
							</div>
							<div class="campos-grid">
								<div class="form-group"><label><input type="checkbox" id="bh-cfg-considerarQuinzena"/> Considerar quinzena</label></div>
								<div class="form-group"><label><input type="checkbox" id="bh-cfg-compensarAntes"/> Compensar antes de pagar</label></div>
							</div>
							<div class="form-group"><label>Art. 59</label><input type="text" id="bh-cfg-art59"/></div>
							<div class="form-group"><label>Art. 59-A</label><input type="text" id="bh-cfg-art59A"/></div>
							<div class="form-group"><label>Art. 59-B</label><input type="text" id="bh-cfg-art59B"/></div>
							<div class="form-group"><label>CCT (vigência)</label><input type="text" id="bh-cfg-cctVig"/></div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="back-button close-modal-btn" onclick="document.getElementById('bh-modalConfig').style.display='none'">Cancelar</button>
						<button type="submit" class="btn-save" form="bh-formConfig">Salvar</button>
					</div>
				</div>`;
			}
			if (id === 'bh-modalAssinatura') {
				return `
				<div class="modal-content">
					${header('Assinatura Digital - Acordo Banco de Horas')}
					<div class="modal-body">
						<canvas id="bh-signCanvas" style="border:1px solid #ccc; width:100%; height:180px; background:#fff;"></canvas>
						<div class="form-buttons" style="margin-top:10px;">
							<button type="button" class="btn-editar" id="bh-btnClearSign">Limpar</button>
							<button type="button" class="btn-save" id="bh-btnSaveSign">Salvar Assinatura</button>
						</div>
						<div style="margin-top:10px; font-size:12px; color:#666;">A assinatura será salva com timestamp e hash (base64) no documento do funcionário.</div>
					</div>
					<div class="modal-footer">
						<button type="button" class="back-button close-modal-btn" onclick="document.getElementById('bh-modalAssinatura').style.display='none'">Fechar</button>
					</div>
				</div>`;
			}
			if (id === 'bh-modalGerenciar') {
				return `
				<div class="modal-content" style="width: 960px;">
					${header('Gerenciar Banco de Horas')}
					<div class="modal-body">
						<form id="bh-formGerenciar" onsubmit="return false;">
							<div class="campos-grid">
								<div class="form-group">
									<label for="bh-ger-func-nome">Funcionário</label>
									<div class="autocomplete-container">
										<input type="text" id="bh-ger-func-nome" class="autocomplete-input" placeholder="Selecione um funcionário..."/>
										<div class="autocomplete-icons-container">
											<span class="autocomplete-icon" title="Listar Funcionários" onclick="(function(){ try { if (window.folhaFuncionarios) { window.folhaFuncionarios.targetField = 'bh-ger-func-nome'; } } catch(e){} openFuncionariosListModal(); })()">
												<i class="fas fa-list"></i>
											</span>
										</div>
									</div>
									<input type="hidden" id="bh-ger-func-id" />
								</div>
								<div class="form-group">
									<label for="bh-ger-inicio">Início</label>
									<input type="date" id="bh-ger-inicio"/>
								</div>
								<div class="form-group">
									<label for="bh-ger-fim">Fim</label>
									<input type="date" id="bh-ger-fim"/>
								</div>
								<div class="form-group" style="align-self:end;">
									<button type="button" class="btn-save" id="bh-ger-buscar">Buscar</button>
								</div>
							</div>
							<div class="table-responsive mobile-cards" style="margin-top:10px;">
								<table class="table">
								<thead>
										<tr>
											<th>Data</th>
										<th>Horas</th>
											<th>Vence</th>
											<th>Observação</th>
											<th class="actions-col" style="width:160px; text-align:center;">Ações</th>
										</tr>
									</thead>
									<tbody id="bh-ger-tbody"></tbody>
								</table>
							</div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="back-button close-modal-btn" onclick="document.getElementById('bh-modalGerenciar').style.display='none'">Fechar</button>
					</div>
				</div>`;
			}
			return '';
		},
		bindGlobalButtons() {
			// atalhos globais (se houver botões em folha.html adicionados no futuro)
			const bhHelpers = () => (window.BHHelpers || {});
            document.addEventListener('keydown', (e) => {
                const modalLanc = document.getElementById('bh-modalLancamento');
                if (e.key === 'Enter' && modalLanc && modalLanc.style && modalLanc.style.display === 'block') {
                    const next = document.querySelector('#bh-modalLancamento input, #bh-modalLancamento textarea');
                    next && next.focus();
                }
            });
                const formLanc = document.getElementById('bh-formLancamento');
            if (formLanc) formLanc.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const dataEl = document.getElementById('bh-data');
                const data = ((dataEl && dataEl.value) || new Date().toISOString().slice(0,10));
					// Parse hh:mm para minutos (aceita sinal)
                    const minEl = document.getElementById('bh-minutos');
                    const hhmmRaw = String(((minEl && minEl.value) || '')).trim();
					const minutos = (function parseHHMMToMinutes(v){
						if (v === '' || v === null || v === undefined) return 0;
						if (/^-?\d+$/.test(v)) return Number(v); // suporte legado em minutos puros
						const m = String(v).match(/^\s*([+-])?\s*(\d{1,3})\s*[:h]\s*(\d{1,2})\s*$/i);
						if (!m) return Number(v)||0;
						const sign = m[1] === '-' ? -1 : 1;
						const h = Number(m[2]||0);
						const mm = Math.min(59, Number(m[3]||0));
						return sign * (h*60 + mm);
					})(hhmmRaw);
                const observacaoEl = document.getElementById('bh-observacao');
                const observacao = ((observacaoEl && observacaoEl.value) || '');
                const venceEl = document.getElementById('bh-venceEm');
                const venceEm = ((venceEl && venceEl.value) || null);
                const funcIdEl = document.getElementById('bh-funcionario-id');
                const funcId = ((funcIdEl && funcIdEl.value) || null);
                const funcData = (bhHelpers().findFuncionarioByKey ? bhHelpers().findFuncionarioByKey(funcId) : null);
				if (!funcData) { console.warn('// [BH] Funcionário não selecionado'); return; }
                const valorHora = (((window.BHService && window.BHService.bhValorHora && window.BHService.bhValorHora(funcData.salarioBase, ((window.BHConfig && window.BHConfig.horasMensaisContrato) || 220))) || 0));
				const dataIni = String(data || '').slice(0,7) ? `${String(data).slice(0,7)}-01` : null;
				const dataFim = dataIni ? new Date(new Date(dataIni).getFullYear(), new Date(dataIni).getMonth()+1, 0).toISOString().slice(0,10) : null;
				const bhKey = (bhHelpers().resolveBHKeyForFuncionario ? await bhHelpers().resolveBHKeyForFuncionario(funcData, { inicioISO: dataIni || undefined, fimISO: dataFim || undefined }) : funcId);
				const lanc = await window.BHFirebase.bhAddLancamento(bhKey, { data, minutos, observacao, venceEm, origem: 'manual', salarioBaseSnapshot: funcData.salarioBase, cargoSnapshot: funcData.cargo || funcData.cargoId || null, valorHoraSnapshot: valorHora });
				console.log('// [BH] Lançamento salvo', lanc);
				if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
					window.FolhaUtils.showToast('Lançamento salvo com sucesso!', 'success');
				}
				document.getElementById('bh-minutos').value = '';
				await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
                setTimeout(() => { const el = document.getElementById('bh-minutos'); if (el) el.focus(); }, 50);
            });

                const formComp = document.getElementById('bh-formCompensar');
            if (formComp) formComp.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const funcSelect = document.getElementById('bh-funcionario-comp');
                const funcId = ((funcSelect && funcSelect.value) || null);
                const func = (bhHelpers().findFuncionarioByKey ? bhHelpers().findFuncionarioByKey(funcId) : null);
                if (!func) return;
                    // Parse hh:mm
                    const rawEl = document.getElementById('bh-minCompensar');
                    const raw = String(((rawEl && rawEl.value) || '')).trim();
					const minutos = (function parseHHMMToMinutes(v){
						if (v === '' || v === null || v === undefined) return 0;
						if (/^-?\d+$/.test(v)) return Number(v);
						const m = String(v).match(/^\s*([+-])?\s*(\d{1,3})\s*[:h]\s*(\d{1,2})\s*$/i);
						if (!m) return Number(v)||0;
						const sign = m[1] === '-' ? -1 : 1;
						const h = Number(m[2]||0);
						const mm = Math.min(59, Number(m[3]||0));
						return sign * (h*60 + mm);
					})(raw);
				// Buscar lançamentos frescos para evitar cache e calcular plano com minutos positivos
                const bhKey = (bhHelpers().resolveBHKeyForFuncionario ? await bhHelpers().resolveBHKeyForFuncionario(func, {}) : funcId);
                const lista = await window.BHFirebase.bhListLancamentos(bhKey, { fresh: true });
                const plan = window.BHService.bhDistribuirCompensacaoFIFO(lista, Math.max(0, minutos));
                document.getElementById('bh-fifoPreview').innerHTML = plan.distribuicao.map(d => `${d.data} -> -${d.consumir}min`).join('<br/>') || 'Sem créditos para compensar';
                console.log('// [BH] Plano FIFO', plan);

                // ✅ Aplicar compensação: atualizar campo 'compensado' de cada lançamento e recalcular saldo
                try {
                    if ((((plan && plan.distribuicao) || []).length) === 0) {
						if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
							window.FolhaUtils.showToast('Sem créditos suficientes para compensar.', 'warning');
						}
						return;
					}
                    for (const dist of (plan && plan.distribuicao ? plan.distribuicao : [])) {
                        const curr = lista.find(x => String(x.id) === String(dist.id));
                        const atual = Number(((curr && curr.compensado) || 0));
                        const entry = { data: new Date().toISOString(), minutos: Number(dist.consumir||0), origem: 'compensacao_fifo' };
                        const historico = Array.isArray((curr && curr.compensadoHistorico)) ? [...curr.compensadoHistorico, entry] : [entry];
                        await window.BHFirebase.bhUpdateLancamento(bhKey, dist.id, { compensado: atual + Number(dist.consumir||0), compensadoHistorico: historico });
                    }
					// Atualizar preview de saldo e limpar campo
					await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
					document.getElementById('bh-minCompensar').value = '';
					if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                        const consumidos = Math.max(0, Math.round((Math.max(0, minutos) - (((plan && plan.restante) || 0)))));
						const hh = Math.floor(consumidos/60), mm = String(consumidos%60).padStart(2,'0');
						window.FolhaUtils.showToast(`Compensados ${hh}:${mm} do banco de horas.`, 'success');
					}
                } catch (err) {
                    console.error('// [BH] Erro ao aplicar compensação FIFO', err);
                    alert('Erro ao aplicar compensação. Tente novamente.');
                }
            });

			// Gerenciar BH - bindings
			window.bhOpenGerenciar = () => {
				const modal = document.getElementById('bh-modalGerenciar');
				if (!modal) return;
				modal.style.display = 'block';
				UI.applyTextNormalization && UI.applyTextNormalization();
				// limpar campo e preparar autocomplete
				const nome = document.getElementById('bh-ger-func-nome');
				const hid = document.getElementById('bh-ger-func-id');
				if (nome) {
					const filtroEl = document.getElementById('funcionarioFiltro');
					if (!nome.value) {
						let v = ((filtroEl && filtroEl.value) || '');
						if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) v = window.toTitleCasePt(v);
						nome.value = v;
					}
					nome.oninput = () => {
						const val = (nome.value||'').trim().toLowerCase();
                        const funcs = (((window.folhaSystem && window.folhaSystem.funcionarios)||[]).filter(f=>f && f.nome && f.ativo!==false));
						const match = funcs.find(f => String(f.nome).toLowerCase() === val) || funcs.find(f => String(f.nome).toLowerCase().includes(val));
						if (match && hid) hid.value = (bhHelpers().getFuncionarioPrimaryKey ? bhHelpers().getFuncionarioPrimaryKey(match) : match.id);
					};
				}
				const hoje = new Date();
				document.getElementById('bh-ger-inicio').value = document.getElementById('bh-ger-inicio').value || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
				document.getElementById('bh-ger-fim').value = document.getElementById('bh-ger-fim').value || new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
                const b = document.getElementById('bh-ger-buscar');
                if (b) requestAnimationFrame(() => b.focus());
			};

                const btnBuscar = document.getElementById('bh-ger-buscar');
            if (btnBuscar) btnBuscar.addEventListener('click', async ()=>{
                    const funcIdEl = document.getElementById('bh-ger-func-id');
                    let funcId = ((funcIdEl && funcIdEl.value));
                    const nomeEl = document.getElementById('bh-ger-func-nome');
                    const nome = ((nomeEl && nomeEl.value) ? nomeEl.value.trim() : '');
					// Se hidden ainda não foi resolvido, tentar resolver por nome exato
					if (!funcId && nome) {
                        const funcs = (((window.folhaSystem && window.folhaSystem.funcionarios)||[]).filter(f=>f && f.nome && f.ativo!==false));
						const match = funcs.find(f => String(f.nome).toLowerCase() === String(nome).toLowerCase());
						if (match) funcId = (bhHelpers().getFuncionarioPrimaryKey ? bhHelpers().getFuncionarioPrimaryKey(match) : match.id);
					}
                const inicioEl = document.getElementById('bh-ger-inicio');
                const fimEl = document.getElementById('bh-ger-fim');
                const inicioISO = ((inicioEl && inicioEl.value));
                const fimISO = ((fimEl && fimEl.value));
				if (!funcId || !inicioISO || !fimISO) return;
				const funcData = (bhHelpers().findFuncionarioByKey ? bhHelpers().findFuncionarioByKey(funcId) : null);
				const bhKey = funcData ? await bhHelpers().resolveBHKeyForFuncionario(funcData, { inicioISO, fimISO }) : String(funcId);
				if (funcIdEl && bhKey) funcIdEl.value = bhKey;
				const lista = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO, fimISO, fresh: true });
				const tbody = document.getElementById('bh-ger-tbody');
				const toHHMM = (m)=>{const s=Number(m||0); const sign=s<0?'-':''; const abs=Math.abs(s); return `${sign}${Math.floor(abs/60)}:${String(abs%60).padStart(2,'0')} hs`;};
				const fmtHHMM = (m)=>{const s=Number(m||0); const sign=s<0?'-':''; const abs=Math.abs(s); return `${sign}${Math.floor(abs/60)}:${String(abs%60).padStart(2,'0')}`;};
				const esc = (v)=>String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
				tbody.innerHTML = (lista||[]).sort((a,b)=>String(a.data).localeCompare(String(b.data))).map(l=>`
					<tr>
						<td data-label="Data"><input type="date" value="${esc((l.data||'').slice(0,10))}" data-id="${esc(l.id)}" class="bh-ger-data"/></td>
						<td data-label="Horas"><input type="text" value="${esc(fmtHHMM(l.minutos||0))}" placeholder="hh:mm" data-id="${esc(l.id)}" class="bh-ger-min" style="width:120px;"/></td>
						<td data-label="Vence"><input type="date" value="${esc((l.venceEm||'').slice(0,10))}" data-id="${esc(l.id)}" class="bh-ger-vence"/></td>
						<td data-label="Observação"><input type="text" value="${esc(l.observacao||'')}" data-id="${esc(l.id)}" class="bh-ger-obs"/></td>
						<td data-label="Ações" class="actions-cell" style="text-align:center;">
							<button type="button" class="action-button edit-button bh-ger-salvar" data-id="${esc(l.id)}" title="Salvar">
								<i class="fas fa-save"></i>
							</button>
							<button type="button" class="action-button delete-button bh-ger-excluir" data-id="${esc(l.id)}" title="Excluir">
								<i class="fas fa-trash"></i>
							</button>
						</td>
					</tr>
				`).join('') || '<tr><td colspan="5" style="text-align:center; color:#666; padding:10px;">Sem lançamentos no período</td></tr>';

				// Bind actions salvar/excluir (usar evento delegado para evitar duplicação)
				// Remove listeners anteriores para evitar duplicação
				if (tbody._bhHandlerSaved) {
					tbody.removeEventListener('click', tbody._bhHandlerSaved);
				}
				
                tbody._bhHandlerSaved = async (e) => {
					const btnSalvar = e.target.closest('.bh-ger-salvar');
					const btnExcluir = e.target.closest('.bh-ger-excluir');
					
					if (btnSalvar) {
						e.preventDefault();
						e.stopPropagation();
                        const id = btnSalvar.getAttribute('data-id');
                        // Garantir funcId no momento do clique (evitar depender apenas do closure)
                        const funcIdAtualEl = document.getElementById('bh-ger-func-id');
                        let funcIdAtual = (((funcIdAtualEl && funcIdAtualEl.value) || bhKey || funcId));
                        if (!funcIdAtual) {
                            const nomeSelEl = document.getElementById('bh-ger-func-nome');
                            const nomeSel = ((nomeSelEl && nomeSelEl.value) ? nomeSelEl.value.trim() : '');
                            if (nomeSel) {
                                const funcs = (((window.folhaSystem && window.folhaSystem.funcionarios)||[]).filter(f=>f && f.nome && f.ativo!==false));
                                const match = funcs.find(f => String(f.nome).toLowerCase() === String(nomeSel).toLowerCase());
                                if (match) funcIdAtual = getFuncionarioPrimaryKey(match);
                            }
                        }
                        if (!funcIdAtual) {
                            console.warn('// [BH] funcId não resolvido no salvar');
                            alert('Selecione um funcionário e clique em Buscar antes de salvar.');
                            return;
                        }
                        const dataEl = tbody.querySelector(`.bh-ger-data[data-id="${id}"]`);
                        const data = ((dataEl && dataEl.value) || null);
                        const horasEl = tbody.querySelector(`.bh-ger-min[data-id="${id}"]`);
                        const horasStr = String(((horasEl && horasEl.value) || '')).trim();
						const minutos = (function parseHHMMToMinutes(v){
							if (v === '' || v === null || v === undefined) return 0;
							if (/^-?\d+$/.test(v)) return Number(v);
							const m = String(v).match(/^\s*([+-])?\s*(\d{1,3})\s*[:h]\s*(\d{1,2})\s*$/i);
							if (!m) return Number(v)||0;
							const sign = m[1] === '-' ? -1 : 1;
							const h = Number(m[2]||0);
							const mm = Math.min(59, Number(m[3]||0));
							return sign * (h*60 + mm);
						})(horasStr);
                        const venceElT = tbody.querySelector(`.bh-ger-vence[data-id="${id}"]`);
                        const venceEm = ((venceElT && venceElT.value) || null);
                        const obsElT = tbody.querySelector(`.bh-ger-obs[data-id="${id}"]`);
                        const observacao = ((obsElT && obsElT.value) || '');
                        try {
                            console.log('// [BH] Salvando lançamento', { funcId: funcIdAtual, id, data, minutos, venceEm, observacao });
                            await window.BHFirebase.bhUpdateLancamento(funcIdAtual, id, { data: (data||null)||null, minutos, venceEm: (venceEm||null)||null, observacao });
                            // ✅ Sucesso: notificar visualmente (toast verdinho)
                            if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                                window.FolhaUtils.showToast('Lançamento salvo com sucesso!', 'success');
                            }
                            // Refresh imediato após salvar (carregar sem cache)
                            btnBuscar.click();
                        } catch (error) {
							console.error('Erro ao salvar lançamento:', error);
							alert('Erro ao salvar o lançamento. Tente novamente.');
						}
					} else if (btnExcluir) {
						e.preventDefault();
						e.stopPropagation();
						const id = btnExcluir.getAttribute('data-id');
						const ok = confirm('Excluir este lançamento?');
						if (!ok) return;
                        try {
                            const funcIdAtualEl = document.getElementById('bh-ger-func-id');
                            const funcIdAtual = ((funcIdAtualEl && funcIdAtualEl.value) || bhKey || funcId);
                            await window.BHFirebase.bhDeleteLancamento(funcIdAtual, id);
                            // ✅ Sucesso: notificar visualmente (toast verdinho)
                            if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                                window.FolhaUtils.showToast('Lançamento excluído com sucesso!', 'success');
                            }
                            // Refresh imediato após excluir
                            btnBuscar.click();
                        } catch (error) {
							console.error('Erro ao excluir lançamento:', error);
							alert('Erro ao excluir o lançamento. Tente novamente.');
						}
					}
				};
				
				tbody.addEventListener('click', tbody._bhHandlerSaved);

				// Integração com seleção da lista de funcionários (targetField já ajustado no ícone)
				if (window.folhaFuncionarios) {
					const nome = document.getElementById('bh-ger-func-nome');
					const hid = document.getElementById('bh-ger-func-id');
					if (nome && hid) {
						// Se o módulo preencher o nome via targetField, garantimos coesão do hidden e filtro
						nome.addEventListener('change', ()=>{
							// se dataset.funcionarioId estiver presente, refletir
							if (nome.dataset && nome.dataset.funcionarioId) {
								hid.value = nome.dataset.funcionarioId;
							}
						});
					}
				}
			});

			// Helpers de loading com barra de progresso
			if (!window.bhLoadingShow) {
				window.bhLoadingShow = (title = 'Carregando...', total = 100) => {
					let overlay = document.getElementById('bh-loading-overlay');
					if (!overlay) {
						overlay = document.createElement('div');
						overlay.id = 'bh-loading-overlay';
						overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(13,35,57,0.12);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(1px)';
						overlay.innerHTML = '<div id="bh-loading-box" style="width:420px;max-width:90%;background:#fff;border:1px solid #cdd6e1;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08);padding:16px 18px;font-family:Arial;">\
							<div id="bh-loading-title" style="font-weight:600;color:#0d2339;margin-bottom:10px">Carregando...</div>\
							<div style="height:10px;border-radius:6px;background:#eef2f7;overflow:hidden"><div id="bh-progress-bar" style="height:100%;width:0%;background:#1b4670;transition:width .2s ease"></div></div>\
							<div id="bh-loading-desc" style="margin-top:8px;font-size:12px;color:#4b5563">Iniciando...</div>\
							<div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">\
								<button id="bh-loading-cancel" type="button" style="padding:6px 10px;border:1px solid #cdd6e1;border-radius:6px;background:#f6f7fb;color:#1b4670;cursor:pointer;">Cancelar</button>\
							</div>\
						</div>';
						document.body.appendChild(overlay);
					}
					overlay.style.display = 'flex';
					const box = document.getElementById('bh-loading-box');
					const t = document.getElementById('bh-loading-title');
					const bar = document.getElementById('bh-progress-bar');
					const desc = document.getElementById('bh-loading-desc');
					const btnCancel = document.getElementById('bh-loading-cancel');
					t.textContent = title;
					bar.style.width = '0%';
					desc.textContent = 'Iniciando...';
					let current = 0; let max = Math.max(1, Number(total)||1);
					let cancelled = false;
					if (btnCancel) {
						btnCancel.onclick = () => { cancelled = true; desc.textContent = 'Cancelando...'; overlay.style.display='none'; };
					}
					return {
						update(stepInc = 1, message = '') {
							current += stepInc; if (current > max) current = max;
							bar.style.width = Math.round(current*100/max) + '%';
							if (message) desc.textContent = message;
						},
						finish(message = 'Concluído') {
							bar.style.width = '100%'; desc.textContent = message; setTimeout(()=>{ overlay.style.display='none'; }, 50);
						},
						isCancelled() { return cancelled; },
						cancel() { cancelled = true; overlay.style.display = 'none'; }
					};
				};
				window.bhLoadingHide = () => {
					const overlay = document.getElementById('bh-loading-overlay');
					if (overlay) overlay.style.display = 'none';
				};
			}

			// Bind botões da barra de ações se existirem em folha.html
			const bindIfExists = (id, handler) => {
				const el = document.getElementById(id);
				// Evitar dupla chamada quando já existe atributo inline onclick no HTML
				if (el && !el._bhBound && !el.getAttribute('onclick')) { el.addEventListener('click', handler); el._bhBound = true; }
			};
			bindIfExists('btnBHExtrato', () => window.bhRelExtrato && window.bhRelExtrato());
			bindIfExists('btnBHEspelho', () => window.bhRelEspelho && window.bhRelEspelho());
			bindIfExists('btnBHVencimentos', () => window.bhRelVencimentos && window.bhRelVencimentos());
			bindIfExists('btnBHContrato', () => window.bhRelContrato && window.bhRelContrato());
		}
		,
			exposeGlobals() {
				// manter últimos valores enquanto o modal estiver aberto
				let _lastObs = '';
				let _lastVence = '';
				let _modalOpen = false;
				const persistInputsIfOpen = () => {
					if (!_modalOpen) return;
					const obs = document.getElementById('bh-observacao');
					const ven = document.getElementById('bh-venceEm');
					if (obs) _lastObs = obs.value;
					if (ven) _lastVence = ven.value;
				};
				const restoreInputsIfOpen = () => {
					if (!_modalOpen) return;
					if (document.getElementById('bh-observacao') && _lastObs) document.getElementById('bh-observacao').value = _lastObs;
					if (document.getElementById('bh-venceEm') && _lastVence) document.getElementById('bh-venceEm').value = _lastVence;
				};
				const fmtDateBR = (iso) => {
					if (!iso) return '-';
					const s = String(iso).slice(0,10);
					const [y,m,d] = s.split('-');
					return (y && m && d) ? `${d}/${m}/${y}` : s;
				};
				const getAllFuncionarios = () => {
					const a = (window.folhaSystem && window.folhaSystem.funcionarios) || [];
					const b = (window.folhaFuncionarios && window.folhaFuncionarios.funcionarios) || [];
					const c = (window.folhaRelatorios && window.folhaRelatorios.funcionarios) || [];
					const merged = [...a, ...b, ...c];
					const toKey = (f) => {
						if (!f) return '';
						const cpf = (f.cpf ? String(f.cpf).replace(/\D/g, '') : '');
						const key = f.id || f.funcionarioId || f.key || f.$key || (cpf || '') || f.matricula || f.codigo || '';
						return key ? String(key) : '';
					};
					const seen = new Set();
					const out = [];
					for (const f of merged) {
						const k = toKey(f);
						if (!k) continue;
						if (!seen.has(k)) { seen.add(k); out.push(f); }
					}
					return out.length ? out : merged; // fallback se sem ids
				};
				const getFuncionarioKeys = (f) => {
					if (!f) return [];
					const keys = [];
					const cpf = (f.cpf ? String(f.cpf).replace(/\D/g, '') : '');
					[f.id, f.funcionarioId, f.key, f.$key, cpf, f.matricula, f.codigo].forEach(v => {
						const s = String(v || '').trim();
						if (s) keys.push(s);
					});
					return Array.from(new Set(keys));
				};
				const getFuncionarioPrimaryKey = (f) => {
					const keys = getFuncionarioKeys(f);
					return keys[0] || '';
				};
				const bhKeyCache = new Map();
				const findFuncionarioByKey = (key) => {
					if (!key) return null;
					const k = String(key);
					const funcionarios = getAllFuncionarios();
					return funcionarios.find(f => getFuncionarioKeys(f).includes(k)) || null;
				};
				const resolveBHKeyForFuncionario = async (f, { inicioISO, fimISO } = {}) => {
					const keys = getFuncionarioKeys(f);
					if (!keys.length) return '';
					const primary = String(keys[0]);
					if (bhKeyCache.has(primary)) return bhKeyCache.get(primary);
					if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentosBatch === 'function') {
						try {
							const batch = await window.BHFirebase.bhListLancamentosBatch(keys, { inicioISO, fimISO, fresh: false });
							for (const k of keys) {
								const lista = (batch && batch[String(k)]) || [];
								if (Array.isArray(lista) && lista.length > 0) {
									const resolved = String(k);
									bhKeyCache.set(primary, resolved);
									return resolved;
								}
							}
						} catch {}
					}
					bhKeyCache.set(primary, String(keys[0]));
					return String(keys[0]);
				};
				window.BHHelpers = { getAllFuncionarios, getFuncionarioKeys, getFuncionarioPrimaryKey, findFuncionarioByKey, resolveBHKeyForFuncionario };
				const toHHMM = (min) => {
					const m = Number(min||0);
					const sign = m < 0 ? '-' : '';
					const abs = Math.abs(m);
					const hh = Math.floor(abs/60);
					const mm = String(abs%60).padStart(2,'0');
					return `${sign}${hh}:${mm} hs`;
				};
				const parseLocalDate = (iso) => {
					if (!iso) return null;
					const s = String(iso).slice(0,10);
					const [y,m,d] = s.split('-').map(Number);
					if (!y || !m || !d) return null;
					return new Date(y, m-1, d, 0, 0, 0, 0);
				};
				const parseAnyDate = (value) => {
					if (!value) return null;
					if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
					const s = String(value).trim();
					const num = Number(s);
					if (Number.isFinite(num) && /^\d+$/.test(s)) {
						const ms = s.length <= 10 ? num * 1000 : num;
						const d = new Date(ms);
						if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
					}
					const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
					if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 0, 0, 0, 0);
					const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
					if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 0, 0, 0, 0);
					return null;
				};
				const calcMinutosUteisPeriodo = (iniISO, fimISO, func = null) => {
					if (window.BHService && typeof window.BHService.bhCalcularMinutosUteisPeriodo === 'function') {
						return window.BHService.bhCalcularMinutosUteisPeriodo(iniISO, fimISO, { func, cfg: window.BHConfig });
					}
					const di = parseLocalDate(iniISO);
					let df = parseLocalDate(fimISO);
					if (!di) return null;
					if (!df || df < di) df = di;
					let diasUteis = 0;
					for (let d = new Date(di.getTime()); d <= df; d.setDate(d.getDate()+1)) {
						const wd = d.getDay();
						if (wd !== 0 && wd !== 6) diasUteis += 1;
					}
					const jornadaSemanal = (window.BHConfig && Number(window.BHConfig.jornadaSemanalHoras)) || 44;
					const minutosDia = Math.round((jornadaSemanal * 60) / 5);
					return diasUteis * minutosDia;
				};
				// Exibir apenas dias úteis salvos na observação (linhas sem [FDS])
                const bhFormatObsDiasUteisForDisplay = (obs) => {
                    let raw = String(obs||'').trim();
                    if (!raw) return '';
                    if (/^\s*he\s+dia\s+útil/i.test(raw) || /^\s*he\s+dia\s+util/i.test(raw)) {
                        raw = raw.replace(/^\s*he\s+dia\s+útil/i, 'É dia útil').replace(/^\s*he\s+dia\s+util/i, 'É dia útil');
                    }
                    if (/^\s*É\s+dia\s+útil/i.test(raw)) {
                        const mUteis = raw.match(/dias\s+úteis:\s*(\d+)/i);
                        const mFds = raw.match(/fins?\s+de\s+semana:\s*(\d+)/i);
                        const mFer = raw.match(/feriados:\s*(\d+)/i);
                        const partes = [];
                        if (mUteis) partes.push(`Dias úteis: ${mUteis[1]}`);
                        if (mFds) partes.push(`Fins de semana: ${mFds[1]}`);
                        if (mFer) partes.push(`Feriados: ${mFer[1]}`);
                        return partes.length ? partes.join(' · ') : '';
                    }
                    const parts = raw.split(/\r?\n|,|;/).map(s=>s.trim()).filter(Boolean);
                    const uteis = parts.filter(p => !/\[\s*FDS\s*\]/i.test(p));
                    const joined = (uteis.length ? uteis.join(' · ') : raw);
                    return joined.length > 80 ? '' : joined;
                };
				const getFuncionarioMatchFromFiltro = () => {
					const funcionarios = getAllFuncionarios().filter(f => f.ativo !== false);
                    const filtroNomeEl = document.getElementById('funcionarioFiltro');
                    const filtroNome = (((filtroNomeEl && filtroNomeEl.value) ? filtroNomeEl.value.trim() : '') || '');
					if (!filtroNome) return null;
					const listaMatch = funcionarios.filter(f => String(f.nome).toLowerCase().includes(filtroNome.toLowerCase()));
					if (listaMatch.length === 1) return listaMatch[0];
					const exact = listaMatch.find(f => String(f.nome).toLowerCase() === filtroNome.toLowerCase());
					return exact || null;
				};

				const findFuncionariosComBH = async (ini, fim, { fresh } = {}) => {
					const funcionarios = getAllFuncionarios().filter(f => f.ativo !== false);
					const keyMap = new Map();
					const allKeys = new Set();
					for (const f of funcionarios) {
						const keys = getFuncionarioKeys(f);
						keyMap.set(f, keys);
						keys.forEach(k => allKeys.add(String(k)));
					}
					const ids = Array.from(allKeys);
					let batch = null;
					if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentosBatch === 'function') {
						try {
							batch = await window.BHFirebase.bhListLancamentosBatch(ids, { inicioISO: ini, fimISO: fim, fresh: !!fresh });
						} catch {}
					}
					if (!batch) {
						batch = {};
						const tasks = ids.map(async (id) => {
							try {
								const lista = await window.BHFirebase.bhListLancamentos(id, { inicioISO: ini, fimISO: fim, fresh: !!fresh });
								batch[String(id)] = lista || [];
							} catch {
								batch[String(id)] = [];
							}
						});
						await Promise.allSettled(tasks);
					}
					const comBH = [];
					for (const f of funcionarios) {
						const keys = keyMap.get(f) || [];
						let lista = [];
						let bhKey = '';
						for (const k of keys) {
							const l = (batch && batch[String(k)]) || [];
							if (Array.isArray(l) && l.length > 0) {
								lista = l;
								bhKey = String(k);
								break;
							}
						}
						if (Array.isArray(lista) && lista.length > 0) comBH.push({ funcionario: f, lancamentos: lista, bhKey });
					}
					return comBH.sort((a,b)=>String(a.funcionario.nome).localeCompare(String(b.funcionario.nome)));
				};
				const computePeriodoFromLista = (lista = []) => {
					let min = null;
					let max = null;
					for (const item of lista) {
						const lancs = (item && item.lancamentos) || [];
						for (const l of lancs) {
							const d = parseAnyDate(l.data || l.createdAt);
							if (!d) continue;
							if (!min || d < min) min = d;
							if (!max || d > max) max = d;
						}
					}
					if (!min || !max) return null;
					const ini = new Date(min.getFullYear(), min.getMonth(), min.getDate(), 0, 0, 0, 0).toISOString().slice(0,10);
					const fim = new Date(max.getFullYear(), max.getMonth(), max.getDate(), 0, 0, 0, 0).toISOString().slice(0,10);
					return { ini, fim };
				};
				const resolveRelatorioLista = async (ini, fim, { fresh } = {}) => {
					let lista = await findFuncionariosComBH(ini, fim, { fresh });
					if (lista.length > 0) return { lista, ini, fim, fallback: false };
					const all = await findFuncionariosComBH(undefined, undefined, { fresh });
					if (!all.length) return { lista: [], ini, fim, fallback: false };
					const periodo = computePeriodoFromLista(all);
					if (!periodo) return { lista: [], ini, fim, fallback: false };
					return { lista: all, ini: periodo.ini, fim: periodo.fim, fallback: true };
				};
				const getMesPeriodo = () => {
                    const mesEl = document.getElementById('mesAno');
                    const mesSel = (((mesEl && mesEl.value) || new Date().toISOString().slice(0,7)));
					const [ano, mes] = mesSel.split('-').map(n=>Number(n));
					const ini = new Date(ano, mes-1, 1).toISOString().slice(0,10);
					const fim = new Date(ano, mes, 0).toISOString().slice(0,10);
					return { ini, fim };
				};

				const resolveFuncionarioSelecionadoParaBH = async () => {
					const funcionarios = getAllFuncionarios().filter(f => f.ativo !== false);
					// 1) Tentar pelo filtro da tela
                    const filtroNomeEl2 = document.getElementById('funcionarioFiltro');
                    const filtroNome = (((filtroNomeEl2 && filtroNomeEl2.value) ? filtroNomeEl2.value.trim() : '') || '');
					if (filtroNome) {
						const listaMatch = funcionarios.filter(f => String(f.nome).toLowerCase().includes(filtroNome.toLowerCase()));
						if (listaMatch.length === 1) return listaMatch[0];
						if (listaMatch.length > 1) {
							// Preferir match exato
							const exact = listaMatch.find(f => String(f.nome).toLowerCase() === filtroNome.toLowerCase());
							if (exact) return exact;
							return listaMatch[0];
						}
					}
					// 2) Encontrar primeiro com dados de BH no período
					const { ini, fim } = getMesPeriodo();
					const keyMap = new Map();
					const allKeys = new Set();
					for (const f of funcionarios) {
						const keys = getFuncionarioKeys(f);
						keyMap.set(f, keys);
						keys.forEach(k => allKeys.add(String(k)));
					}
					const ids = Array.from(allKeys);
					if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentosBatch === 'function') {
						try {
							const batch = await window.BHFirebase.bhListLancamentosBatch(ids, { inicioISO: ini, fimISO: fim, fresh: false });
							for (const f of funcionarios) {
								const keys = keyMap.get(f) || [];
								for (const k of keys) {
									const lista = (batch && batch[String(k)]) || [];
									if (Array.isArray(lista) && lista.length > 0) return f;
								}
							}
						} catch {}
					} else {
						const keyList = Array.from(allKeys);
						const results = await Promise.allSettled(keyList.map(k => window.BHFirebase.bhListLancamentos(k, { inicioISO: ini, fimISO: fim })));
						for (let i = 0; i < results.length; i++) {
							const r = results[i];
							if (r && r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 0) {
								const hitKey = keyList[i];
								const hit = funcionarios.find(f => getFuncionarioKeys(f).includes(String(hitKey)));
								if (hit) return hit;
							}
						}
					}
					return null;
				};

			// Abertura rápida de modais
			window._bhUpdateSaldoPreview = async () => {
				try {
                    const idHidden = document.getElementById('bh-funcionario-id');
                    const funcId = (idHidden && idHidden.value);
					if (!funcId) return;
					const funcData = findFuncionarioByKey(funcId);
					const bhKey = funcData ? await resolveBHKeyForFuncionario(funcData, {}) : String(funcId);
					const efetivo = (l) => {
						const min = Number((l && l.minutos) || 0);
						const comp = Math.max(0, Number((l && l.compensado) || 0));
						return min >= 0 ? Math.max(0, min - comp) : min;
					};
					// Período do mês com base na data do lançamento selecionada
                    const dEl = document.getElementById('bh-data');
                    const dSel = (((dEl && dEl.value) || new Date().toISOString().slice(0,10)));
					const [y,m] = String(dSel).slice(0,10).split('-').map(Number);
					const ini = new Date(y, m-1, 1).toISOString().slice(0,10);
					const fim = new Date(y, m, 0).toISOString().slice(0,10);
					// saldo global: usar salvo; se vier 0 e houver lançamentos, recalcular por histórico
					let saldoGlobal = 0;
					try {
						const s = await window.BHFirebase.bhGetSaldo(bhKey, { fresh: true });
						saldoGlobal = (s && typeof s.saldoMinutos==='number') ? s.saldoMinutos : 0;
					} catch {}
					// Fallback: se saldo salvo vier zero, tentar calcular pelo histórico
					try {
						const historico = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: '1970-01-01', fimISO: fim, fresh: true });
						if (historico && historico.length) {
							const soma = (historico||[]).reduce((acc,l)=>acc + efetivo(l), 0);
							saldoGlobal = soma;
						}
					} catch {}
					let saldoPeriodo = 0;
					try {
						const lista = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: ini, fimISO: fim, fresh: true });
						saldoPeriodo = (lista||[]).reduce((acc,l)=>acc + efetivo(l), 0);
					} catch {}
					const fimEl = document.getElementById('bh-data-fim');
					const fimSel = ((fimEl && fimEl.value) || '');
					const minutosUteis = (fimSel ? calcMinutosUteisPeriodo(dSel, fimSel, funcData) : null);
					// preview
                    const hhmmEl = document.getElementById('bh-minutos');
                    const hhmmVal = String(((hhmmEl && hhmmEl.value) || '')).trim();
					const minutosLanc = (function parseHHMMToMinutes(v){
						if (v === '' || v === null || v === undefined) return 0;
						if (/^-?\d+$/.test(v)) return Number(v);
						const m = String(v).match(/^\s*([+-])?\s*(\d{1,3})\s*[:h]\s*(\d{1,2})\s*$/i);
						if (!m) return Number(v)||0;
						const sign = m[1] === '-' ? -1 : 1;
						const h = Number(m[2]||0);
						const mm = Math.min(59, Number(m[3]||0));
						return sign * (h*60 + mm);
					})(hhmmVal);
					const toHHMM = (min)=>{const m=Number(min||0);const sign=m<0?'-':'';const abs=Math.abs(m);return `${sign}${Math.floor(abs/60)}:${String(abs%60).padStart(2,'0')} hs`;};
					const periodoExibido = (typeof minutosUteis === 'number' && !Number.isNaN(minutosUteis)) ? minutosUteis : saldoPeriodo;
					document.getElementById('bh-saldo-global').textContent = `Saldo atual: ${toHHMM(saldoGlobal)}`;
					document.getElementById('bh-saldo-periodo').textContent = `No período: ${toHHMM(periodoExibido)}`;
					document.getElementById('bh-saldo-preview').textContent = `Após este lançamento: ${toHHMM(saldoGlobal + minutosLanc)}`;
				} catch {}
			};
			const populateFuncionarioSelect = (selectId) => {
				const sel = document.getElementById(selectId);
				if (!sel) return;
				sel.innerHTML = '';
					const funcs = getAllFuncionarios().filter(f => f.ativo !== false);
				funcs.forEach(f => {
					const opt = document.createElement('option');
					opt.value = getFuncionarioPrimaryKey(f);
					let nome = String(f.nome||'');
					let cargo = String(f.cargo||'');
					if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) nome = window.toTitleCasePt(nome);
					if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(cargo)) cargo = window.toTitleCasePt(cargo);
					opt.textContent = `${nome}${cargo ? ' - '+cargo : ''}`;
					sel.appendChild(opt);
				});
			};

			window.bhOpenLancamento = (sign = 1) => {
				const modal = document.getElementById('bh-modalLancamento');
				if (!modal) return;
				modal.style.display = 'block';
				UI.applyTextNormalization && UI.applyTextNormalization();
				_modalOpen = true;
				const today = new Date();
				document.getElementById('bh-data').value = document.getElementById('bh-data').value || today.toISOString().slice(0,10);
				if (!document.getElementById('bh-minutos').value) document.getElementById('bh-minutos').value = sign >= 0 ? '1:00' : '-0:30';
				if (!document.getElementById('bh-observacao').value) {
                    const obsEl = document.getElementById('bh-observacao');
                    if (obsEl) {
                        obsEl.value = sign >= 0 ? 'É dia útil' : 'Débito (ajuste)';
                        if (sign >= 0) obsEl.dataset.autofilled = 'true';
                    }
                }
				const nomeInput = document.getElementById('bh-funcionario-nome');
				const idHidden = document.getElementById('bh-funcionario-id');
				if (nomeInput && idHidden) {
					// preservar nome/id se já preenchidos
					if (!nomeInput.value || !idHidden.value) {
                        const filtroEl3 = document.getElementById('funcionarioFiltro');
                        const filtroNome = ((filtroEl3 && filtroEl3.value) ? filtroEl3.value.trim() : '');
						if (filtroNome && !nomeInput.value) {
							const v = filtroNome;
							nomeInput.value = (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(v)) ? window.toTitleCasePt(v) : v;
						}
					}
					// lista rápida removida (datalist) para evitar UI antiga
					// Sugestão básica: se já existe filtro global preenchido, usar como default
					nomeInput.oninput = async () => {
						const val = nomeInput.value.trim().toLowerCase();
                        const funcs = (((window.folhaSystem && window.folhaSystem.funcionarios)||[]).filter(f=>f.ativo!==false));
						const match = funcs.find(f => String(f.nome).toLowerCase() === val) || funcs.find(f => String(f.nome).toLowerCase().includes(val));
						if (match) {
							const { ini, fim } = getMesPeriodo();
							idHidden.value = await resolveBHKeyForFuncionario(match, { inicioISO: ini, fimISO: fim });
							await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
						}
					};
				}
					// Auto gerar observação com dias do período (marcando FDS em vermelho na prévia)
					const buildPeriodoDias = (iniISO, fimISO) => {
						const parseLocal = (iso) => { if(!iso) return null; const s=String(iso).slice(0,10); const [y,m,d]=s.split('-').map(Number); if(!y||!m||!d) return null; return new Date(y, m-1, d, 0, 0, 0, 0); };
						const fmtBR = (d) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${dd}/${m}/${y}`; };
						const dias = [];
						if (!iniISO) return dias;
						const di = parseLocal(iniISO);
						let df = fimISO ? parseLocal(fimISO) : di;
						if (!di) return dias;
						if (!df || df < di) df = di;
						for (let d = new Date(di.getTime()); d <= df; d.setDate(d.getDate()+1)) {
							const wd = d.getDay(); // 0 dom, 6 sáb
							const isFds = (wd === 0 || wd === 6);
							const iso = (window.BHService && window.BHService.bhFormatLocalISO) ? window.BHService.bhFormatLocalISO(d) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
							dias.push({ data: new Date(d.getTime()), isFds, iso });
						}
						return dias.map(x => ({ label: fmtBR(x.data), isFds: x.isFds, iso: x.iso }));
					};
                    const getFeriadosNacionais = (ano) => {
                        const lista = [];
                        const pad = (n) => String(n).padStart(2, '0');
                        const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                        const addFixed = (m, d, descricao) => {
                            const date = new Date(ano, m - 1, d, 0, 0, 0, 0);
                            lista.push({ iso: toIso(date), descricao });
                        };
                        const easter = (y) => {
                            const a = y % 19;
                            const b = Math.floor(y / 100);
                            const c = y % 100;
                            const d = Math.floor(b / 4);
                            const e = b % 4;
                            const f = Math.floor((b + 8) / 25);
                            const g = Math.floor((b - f + 1) / 3);
                            const h = (19 * a + b - d - g + 15) % 30;
                            const i = Math.floor(c / 4);
                            const k = c % 4;
                            const l = (32 + 2 * e + 2 * i - h - k) % 7;
                            const m = Math.floor((a + 11 * h + 22 * l) / 451);
                            const month = Math.floor((h + l - 7 * m + 114) / 31);
                            const day = ((h + l - 7 * m + 114) % 31) + 1;
                            return new Date(y, month - 1, day, 0, 0, 0, 0);
                        };
                        addFixed(1, 1, 'Confraternização Universal');
                        addFixed(4, 21, 'Tiradentes');
                        addFixed(5, 1, 'Dia do Trabalhador');
                        addFixed(9, 7, 'Independência do Brasil');
                        addFixed(10, 12, 'Nossa Senhora Aparecida');
                        addFixed(11, 20, 'Consciência Negra');
                        addFixed(11, 2, 'Finados');
                        addFixed(11, 15, 'Proclamação da República');
                        addFixed(12, 25, 'Natal');
                        const pascoa = easter(ano);
                        const carnaval = new Date(pascoa.getTime());
                        carnaval.setDate(carnaval.getDate() - 47);
                        lista.push({ iso: toIso(carnaval), descricao: 'Carnaval' });
                        const sextaSanta = new Date(pascoa.getTime());
                        sextaSanta.setDate(sextaSanta.getDate() - 2);
                        lista.push({ iso: toIso(sextaSanta), descricao: 'Paixão de Cristo' });
                        const corpus = new Date(pascoa.getTime());
                        corpus.setDate(corpus.getDate() + 60);
                        lista.push({ iso: toIso(corpus), descricao: 'Corpus Christi' });
                        return lista;
                    };
                    const getFeriadosLocaisFixos = (cfg, ano) => {
                        const lista = [];
                        const pad = (n) => String(n).padStart(2, '0');
                        const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                        const addFixed = (m, d, descricao) => {
                            const date = new Date(ano, m - 1, d, 0, 0, 0, 0);
                            lista.push({ iso: toIso(date), descricao });
                        };
                        const sindicato = String(((cfg && cfg.referenciasSindicais && cfg.referenciasSindicais.sindicato) || '')).toUpperCase();
                        const ufMatch = sindicato.match(/\/([A-Z]{2})\b/);
                        const uf = ufMatch ? ufMatch[1] : '';
                        if (uf === 'PA') {
                            addFixed(8, 15, 'Adesão do Grão-Pará');
                        }
                        return lista;
                    };
                    const updateObservacaoPeriodo = () => {
                        const bhDataEl3 = document.getElementById('bh-data');
                        const bhDataFimEl3 = document.getElementById('bh-data-fim');
                        const ini = (((bhDataEl3 && bhDataEl3.value) || ''));
                        const fim = (((bhDataFimEl3 && bhDataFimEl3.value) || ''));
						const dias = buildPeriodoDias(ini, fim);
						const obs = document.getElementById('bh-observacao');
						const prev = document.getElementById('bh-observacao-preview');
						if (!obs || !prev) return;
                        const funcId = (document.getElementById('bh-funcionario-id') && document.getElementById('bh-funcionario-id').value) || null;
                        const func = funcId ? findFuncionarioByKey(funcId) : null;
                        const cfg = window.BHConfig || {};
                        const anosPeriodo = new Set(dias.map(d => (d.iso || '').slice(0,4)).filter(Boolean));
                        const feriadosNacionais = [];
                        const feriadosLocaisFixos = [];
                        anosPeriodo.forEach((y) => {
                            const ano = Number(y);
                            if (Number.isFinite(ano)) {
                                feriadosNacionais.push(...getFeriadosNacionais(ano));
                                feriadosLocaisFixos.push(...getFeriadosLocaisFixos(cfg, ano));
                            }
                        });
                        const feriadosRaw = []
                            .concat((cfg.feriados || cfg.feriadosLista || cfg.feriadosNacionais) || [])
                            .concat((cfg.feriadosLocaisFixos || cfg.feriadosMunicipaisFixos || cfg.feriadosEstaduaisFixos) || [])
                            .concat((func && (func.feriados || func.feriadosLista)) || [])
                            .concat(feriadosNacionais || [])
                            .concat(feriadosLocaisFixos || []);
                        const normalizeFeriado = (entry) => {
                            if (!entry) return null;
                            if (typeof entry === 'string') {
                                const raw = entry.trim();
                                const mIso = raw.match(/\d{4}-\d{2}-\d{2}/);
                                const mBr = raw.match(/\d{2}\/\d{2}\/\d{4}/);
                                const iso = mIso ? mIso[0] : (mBr ? (window.BHService && window.BHService.bhNormalizeISODate ? window.BHService.bhNormalizeISODate(mBr[0]) : '') : '');
                                if (!iso) return null;
                                const desc = raw.replace(mIso || mBr || '', '').replace(/^[\s\-–—|:]+/, '').trim();
                                return { iso, descricao: desc || '' };
                            }
                            if (typeof entry === 'object') {
                                const rawDate = entry.data || entry.date || entry.iso || entry.dia || entry.d;
                                const iso = window.BHService && window.BHService.bhNormalizeISODate ? window.BHService.bhNormalizeISODate(rawDate) : String(rawDate || '');
                                if (!iso) return null;
                                const desc = entry.descricao || entry.nome || entry.titulo || entry.title || '';
                                return { iso, descricao: desc || '' };
                            }
                            return null;
                        };
                        const feriadosMap = new Map();
                        feriadosRaw.map(normalizeFeriado).filter(Boolean).forEach(f => {
                            if (!feriadosMap.has(f.iso)) feriadosMap.set(f.iso, f.descricao || '');
                        });
                        const feriadosSet = new Set(feriadosMap.keys());
                        let diasUteis = 0;
                        let finsSemana = 0;
                        let feriados = 0;
                        const feriadosPeriodo = [];
                        dias.forEach(d => {
                            if (d.isFds) finsSemana += 1;
                            if (d.iso && feriadosSet.has(d.iso)) {
                                feriados += 1;
                                feriadosPeriodo.push({ label: d.label, descricao: feriadosMap.get(d.iso) || '' });
                            }
                            if (window.BHService && typeof window.BHService.bhIsDiaUtil === 'function') {
                                const dateObj = window.BHService.bhParseLocalDate ? window.BHService.bhParseLocalDate(d.iso) : null;
                                if (dateObj && window.BHService.bhIsDiaUtil(dateObj, window.BHService.bhGetDiasUteisSemana(func, cfg), feriadosSet)) diasUteis += 1;
                            } else if (!d.isFds && !(d.iso && feriadosSet.has(d.iso))) {
                                diasUteis += 1;
                            }
                        });
                        const feriadosTexto = feriadosPeriodo.length
                            ? feriadosPeriodo.map(f => `${f.label}${f.descricao ? ` - ${f.descricao}` : ''}`).join(' | ')
                            : 'Nenhum';
                        const linhas = [
                            'É dia útil',
                            `Quantidade de dias úteis: ${diasUteis}`,
                            `Quantidade de fins de semana: ${finsSemana}`,
                            `Quantidade de feriados: ${feriados}`,
                            `Descrição de cada feriado: ${feriadosTexto}`
                        ];
                        const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                        prev.innerHTML = dias.length ? `<div>É dia útil</div><div>Quantidade de dias úteis: ${diasUteis} · Fins de semana: ${finsSemana} · Feriados: ${feriados}</div><div>Descrição de cada feriado: ${esc(feriadosTexto)}</div>` : '';
                        const canAutofill = (!obs.value || obs.dataset.autofilled === 'true' || /^\s*É\s+dia\s+útil/i.test(obs.value));
                        if (canAutofill && dias.length) {
                            obs.value = linhas.join('\n');
                            obs.dataset.autofilled = 'true';
                        }
					};
					// Bind changes nas datas para atualizar observação
                    const bhDataEl = document.getElementById('bh-data');
                    const bhDataFimEl = document.getElementById('bh-data-fim');
                    if (bhDataEl) bhDataEl.addEventListener('change', updateObservacaoPeriodo);
                    if (bhDataFimEl) bhDataFimEl.addEventListener('change', updateObservacaoPeriodo);
					// carregar saldos ao digitar horas/minutos (hh:mm)
                    const minInput = document.getElementById('bh-minutos');
                    if (minInput) minInput.addEventListener('input', async ()=>{
                        await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
                    });
				// Recalcular quando a data do lançamento mudar
                const bhDataEl2 = document.getElementById('bh-data');
                if (bhDataEl2) bhDataEl2.addEventListener('change', async ()=>{
                    await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
                });
				const bhDataFimEl2 = document.getElementById('bh-data-fim');
				if (bhDataFimEl2) bhDataFimEl2.addEventListener('change', async ()=>{
					await (window._bhUpdateSaldoPreview && window._bhUpdateSaldoPreview());
				});
				// Dispara preenchimento inicial de observação na abertura
                requestAnimationFrame(() => {
                    const ev = new Event('change'); 
                    const el = document.getElementById('bh-data'); 
                    if (el) el.dispatchEvent(ev);
                    
                    const minInput = document.getElementById('bh-minutos');
                    if (minInput) minInput.focus();
                });
			};

			window.bhOpenCompensar = () => {
				const modal = document.getElementById('bh-modalCompensar');
				if (!modal) return;
				modal.style.display = 'block';
				populateFuncionarioSelect('bh-funcionario-comp');
                const el = document.getElementById('bh-minCompensar');
                if (el) requestAnimationFrame(() => el.focus());
			};

			// Relatórios rápidos (mantidos apenas atalhos via IDs em folha.html)

				window.bhRelExtrato = async () => {
					const earlyLoader = window.bhLoadingShow ? window.bhLoadingShow('Preparando Extrato de Banco de Horas...', 100) : null;
					let { ini, fim } = getMesPeriodo();
					const efetivo = (l) => {
						const min = Number((l && l.minutos) || 0);
						const comp = Math.max(0, Number((l && l.compensado) || 0));
						return min >= 0 ? Math.max(0, min - comp) : min;
					};
					const unico = getFuncionarioMatchFromFiltro();
					let listaFuncs = [];
					if (unico) {
						const bhKey = await resolveBHKeyForFuncionario(unico, { inicioISO: ini, fimISO: fim });
						let lancs = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: ini, fimISO: fim, fresh: true });
                        if (!lancs || lancs.length === 0) {
							const all = await window.BHFirebase.bhListLancamentos(bhKey, { fresh: true });
							const periodo = computePeriodoFromLista([{ lancamentos: all }]);
							if (periodo && all && all.length) {
								ini = periodo.ini;
								fim = periodo.fim;
								lancs = all;
							} else {
								console.warn('// [BH] Funcionário filtrado sem lançamentos no período');
								if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Funcionário filtrado sem lançamentos no período.', 'warning');
								if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados');
								return;
							}
						}
						listaFuncs = [{ funcionario: unico, lancamentos: lancs, bhKey }];
					} else {
						const res = await resolveRelatorioLista(ini, fim, { fresh: true });
						listaFuncs = res.lista;
						ini = res.ini;
						fim = res.fim;
                        if (listaFuncs.length === 0) { console.warn('// [BH] Nenhum funcionário com BH no período'); if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Nenhum funcionário com Banco de Horas no período.', 'info'); if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados'); return; }
					}
					const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
					const headerCSS = window.BHReports.bhGetHeaderCSS();
					const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
					const loaderExtr = earlyLoader;
					// Blocos contínuos com cabeçalho repetido em cada página (table-header-group)
					const blocos = await Promise.all(listaFuncs.map(async ({funcionario, lancamentos, bhKey}, idx) => {
						loaderExtr && loaderExtr.update(0, `Processando ${funcionario.nome} (${idx+1}/${listaFuncs.length})`);
						const key = bhKey || await resolveBHKeyForFuncionario(funcionario, { inicioISO: ini, fimISO: fim });
						// saldo inicial (até o dia anterior ao início do período)
						let saldoInicial = 0;
                        try {
                            const di = new Date(ini); di.setDate(di.getDate()-1);
                            const fimAnt = di.toISOString().slice(0,10);
                            const prevLancs = await window.BHFirebase.bhListLancamentos(key, { inicioISO: '1970-01-01', fimISO: fimAnt });
                            saldoInicial = (prevLancs || []).reduce((acc,l)=>acc + efetivo(l), 0);
                        } catch {}
						// saldo atual (global) com fallback por histórico
						let saldoAtualMin = null;
						try {
							const s = await window.BHFirebase.bhGetSaldo(key);
							if (s && typeof s.saldoMinutos === 'number') saldoAtualMin = s.saldoMinutos;
						} catch {}
                        if (saldoAtualMin === null) {
                            try {
                                const hoje = new Date().toISOString().slice(0,10);
                                const hist = await window.BHFirebase.bhListLancamentos(key, { inicioISO: '1970-01-01', fimISO: hoje });
                                // ✅ Saldo atual por fallback também deduz compensado
                                saldoAtualMin = (hist || []).reduce((acc,l)=>acc + Math.max(0, Number(l.minutos||0) - Math.max(0, Number(l.compensado||0))), 0);
                            } catch { saldoAtualMin = 0; }
                        }
						// tabela do período com saldo acumulado linha a linha
                        const ord = [...(lancamentos||[])].sort((a,b)=>String(a.data).localeCompare(String(b.data)));
                        let saldo = saldoInicial;
                        const linhas = ord.map(l => {
                            const movimento = efetivo(l);
                            saldo += movimento;
                            const mov = toHHMM(movimento);
                            const obsFmt = bhFormatObsDiasUteisForDisplay(l.observacao);
                            return `<tr style=\"border-bottom:1px solid #eee;\"><td style=\"padding:6px;\">${fmtDateBR(l.data)}</td><td style=\"padding:6px; font-family:'Courier New'; text-align:right;\">${mov}</td><td style=\"padding:6px;\">${l.venceEm?fmtDateBR(l.venceEm):'-'}</td><td style=\"padding:6px;\">${obsFmt}</td><td style=\"padding:6px; font-family:'Courier New'; text-align:right;\">${toHHMM(saldo)}</td></tr>`;
                        }).join('');
                        const creditosPeriodo = (lancamentos||[]).reduce((acc,l)=> {
                            const min = Number((l && l.minutos) || 0);
                            return acc + (min > 0 ? min : 0);
                        }, 0);
                        const debitosPeriodo = (lancamentos||[]).reduce((acc,l)=> {
                            const min = Number((l && l.minutos) || 0);
                            return acc + (min < 0 ? Math.abs(min) : 0);
                        }, 0);
                        const movimentoPeriodo = creditosPeriodo - debitosPeriodo;
                        // ✅ Horas já compensadas no período (via histórico de compensação)
                        // Compensado no período: preferir histórico; se inexistente, usar campo 'compensado' como aproximação
                        const compensadoHist = (lancamentos||[]).reduce((acc,l)=>{
                            const hist = Array.isArray(l.compensadoHistorico) ? l.compensadoHistorico : [];
                            const dentro = hist.filter(h => {
                                const d = String(h.data||'').slice(0,10);
                                return d >= ini && d <= fim;
                            }).reduce((s,h)=> s + Math.max(0, Number(h.minutos||0)), 0);
                            return acc + dentro;
                        }, 0);
                        const compensadoAprox = (lancamentos||[]).reduce((acc,l)=> acc + Math.max(0, Number(l.compensado||0)), 0);
                        const compensadoPeriodo = compensadoHist || compensadoAprox;
                        const saldoFinalPeriodo = saldoInicial + movimentoPeriodo - Math.max(0, compensadoPeriodo);
                        const debitosDetalhes = (lancamentos||[])
                            .filter(l => Number((l && l.minutos) || 0) < 0)
                            .map(l => ({
                                data: l.data,
                                minutos: Math.abs(Number(l.minutos||0)),
                                observacao: l.observacao || ''
                            }))
                            .sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
                        const debitosRows = debitosDetalhes.map(it => `<tr><td style=\"padding:6px;\">${fmtDateBR(it.data)}</td><td style=\"padding:6px; text-align:right; font-family:'Courier New';\">-${toHHMM(it.minutos).replace(/^-/, '')}</td><td style=\"padding:6px;\">${bhFormatObsDiasUteisForDisplay(it.observacao)}</td></tr>`).join('');
                        const debitosTable = debitosPeriodo > 0 ? `
                                <div style=\"margin-top:10px;\"><strong>Débitos do período</strong></div>
                                <div style=\"font-family:'Courier New'; font-size:12px; color:#333; margin-top:4px;\">Total de horas negativas lançadas: ${toHHMM(debitosPeriodo)} · Itens: ${debitosDetalhes.length}</div>
                                ${debitosRows ? `<table class=\"table\" style=\"width:100%; border-collapse:collapse; margin-top:6px;\"><thead style=\"background:#f1f3f5; color:#333;\"><tr><th style=\"text-align:left; padding:6px;\">Data</th><th style=\"padding:6px; text-align:right;\">Horas</th><th style=\"text-align:left; padding:6px;\">Obs</th></tr></thead><tbody>${debitosRows}</tbody></table>` : ''}` : '';
                        // 🧾 Detalhes de compensações no período (auditoria)
                        const compensDetalhes = [];
                        (lancamentos||[]).forEach(l => {
                            const hist = Array.isArray(l.compensadoHistorico) ? l.compensadoHistorico : [];
                            hist.forEach(h => {
                                const d = String(h.data||'').slice(0,10);
                                if (d >= ini && d <= fim) {
                                    compensDetalhes.push({ data: d, minutos: Math.max(0, Number(h.minutos||0)) });
                                }
                            });
                        });
                        const compTable = compensDetalhes.length ? `
                                <div style=\"margin-top:10px;\"><strong>Compensações no período</strong></div>
                                <table class=\"table\" style=\"width:100%; border-collapse:collapse; margin-top:6px;\">
                                    <thead style=\"background:#f1f3f5; color:#333;\"><tr><th style=\"text-align:left; padding:6px;\">Data</th><th style=\"padding:6px; text-align:right;\">Minutos</th></tr></thead>
                                    <tbody>
                                        ${compensDetalhes.map(it => `<tr><td style=\"padding:6px;\">${fmtDateBR(it.data)}</td><td style=\"padding:6px; text-align:right; font-family:'Courier New';\">${toHHMM(it.minutos)}</td></tr>`).join('')}
                                    </tbody>
                                </table>` : '';
						loaderExtr && loaderExtr.update(1);
						return `
							<section class=\"bh-func-blk\">
								<h3 style=\"color:#1b4670;\">Funcionário: ${funcionario.nome}</h3>
								<div style=\"font-size:12px; color:#555;\">Período: ${fmtDateBR(ini)} a ${fmtDateBR(fim)}</div>
								<table class=\"table\" style=\"width:100%; border-collapse:collapse; margin-top:10px;\">
									<thead style=\"background:#0d2339; color:#fff;\"><tr><th style=\"text-align:left; padding:6px;\">Data</th><th style=\"padding:6px; text-align:right;\">Movimento</th><th style=\"padding:6px;\">Vence</th><th style=\"text-align:left; padding:6px;\">Obs</th><th style=\"padding:6px; text-align:right;\">Saldo</th></tr></thead>
									<tbody>${linhas}</tbody>
								</table>
								<div style=\"margin-top:8px;\">
                                    <div>Saldo inicial do período (+ créditos / - débitos): <strong>${toHHMM(saldoInicial)}</strong></div>
                                    <div>Débitos lançados no período: <strong>-${toHHMM(debitosPeriodo).replace(/^-/, '')}</strong></div>
                                    <div>Créditos lançados no período: <strong>+${toHHMM(creditosPeriodo).replace(/^-/, '')}</strong></div>
                                    <div>Movimento no período (+ créditos / - débitos): <strong>${toHHMM(movimentoPeriodo)}</strong></div>
                                    <div>Compensações aplicadas no período: <strong>${toHHMM(compensadoPeriodo)}</strong></div>
                                    <div>Saldo ao final do período: <strong>${toHHMM(saldoFinalPeriodo)}</strong></div>
                                    <div style=\"margin-top:6px; font-size:12px; color:#333;\">Conforme ${(((window.BHConfig && window.BHConfig.artigosCLT && window.BHConfig.artigosCLT.art59))||'Art. 59 da CLT')}; ${(((window.BHConfig && window.BHConfig.artigosCLT && window.BHConfig.artigosCLT.art59B))||'Art. 59-B da CLT')}; ${(((window.BHConfig && window.BHConfig.referenciasSindicais && window.BHConfig.referenciasSindicais.sindicato))||'')} – ${(((window.BHConfig && window.BHConfig.referenciasSindicais && window.BHConfig.referenciasSindicais.cctVigencia))||'')}.</div>
                                </div>
                                ${debitosTable}
                                ${compTable}
                            </section>`;
					}));
					const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><title>Extrato de Banco de Horas</title><style>${headerCSS}\n@media print { .bh-print-container{display:table;width:100%;} .bh-print-header{display:table-header-group;} } .bh-func-blk{page-break-inside:avoid;margin-bottom:18px;} </style></head><body><div class=\"bh-print-container\"><div class=\"bh-print-header\">${headerHTML}<div class=\"title\">Extrato de Banco de Horas</div></div>${blocos.join('')}</div></body></html>`;
					if (earlyLoader && earlyLoader.isCancelled && earlyLoader.isCancelled()) { return; }
					const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
					loaderExtr && loaderExtr.finish('Relatório pronto');
				};

				window.bhRelEspelho = async () => {
					const earlyLoader = window.bhLoadingShow ? window.bhLoadingShow('Preparando Espelho Diário (BH)...', 100) : null;
					let { ini, fim } = getMesPeriodo();
					const unico = getFuncionarioMatchFromFiltro();
					let listaFuncs = [];
					if (unico) {
						const bhKey = await resolveBHKeyForFuncionario(unico, { inicioISO: ini, fimISO: fim });
						let lista = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: ini, fimISO: fim });
                        if (!lista || lista.length === 0) {
							const all = await window.BHFirebase.bhListLancamentos(bhKey, {});
							const periodo = computePeriodoFromLista([{ lancamentos: all }]);
							if (periodo && all && all.length) {
								ini = periodo.ini;
								fim = periodo.fim;
								lista = all;
							} else {
								console.warn('// [BH] Funcionário filtrado sem lançamentos no período');
								if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Funcionário filtrado sem lançamentos no período.', 'warning');
								if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados');
								return;
							}
						}
						listaFuncs = [{ funcionario: unico, lancamentos: lista, bhKey }];
					} else {
						const res = await resolveRelatorioLista(ini, fim);
						listaFuncs = res.lista;
						ini = res.ini;
						fim = res.fim;
                        if (listaFuncs.length === 0) { console.warn('// [BH] Nenhum funcionário com BH no período'); if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Nenhum funcionário com Banco de Horas no período.', 'info'); if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados'); return; }
					}
					const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
					const headerCSS = window.BHReports.bhGetHeaderCSS();
					const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
					const loader = earlyLoader;
					const blocos = listaFuncs.map(({funcionario}, idx) => {
						loader && loader.update(0, `Processando ${funcionario.nome} (${idx+1}/${listaFuncs.length})`);
						return `<section class=\"bh-func-blk\"><h3 style=\"color:#1b4670;\">Funcionário: ${funcionario.nome}</h3><div style=\"font-size:12px; color:#555;\">Período: ${fmtDateBR(ini)} a ${fmtDateBR(fim)}</div><div style=\"font-family:Arial; font-size:13px; color:#333; margin-top:8px;\">(Espelho detalhado será integrado aos registros de ponto quando disponíveis.)</div></section>`;
					});
					const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><title>Espelho Diário (Banco de Horas)</title><style>${headerCSS}\n@media print { .bh-print-container{display:table;width:100%;} .bh-print-header{display:table-header-group;} } .bh-func-blk{page-break-inside:avoid;margin-bottom:18px;} </style></head><body><div class=\"bh-print-container\"><div class=\"bh-print-header\">${headerHTML}<div class=\"title\">Espelho Diário (Banco de Horas)</div></div>${blocos.join('')}</div></body></html>`;
					if (earlyLoader && earlyLoader.isCancelled && earlyLoader.isCancelled()) { return; }
					const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
					loader && loader.finish('Relatório pronto');
				};

				window.bhRelVencimentos = async () => {
					const earlyLoader = window.bhLoadingShow ? window.bhLoadingShow('Preparando Vencimentos (BH)...', 100) : null;
					let { ini, fim } = getMesPeriodo();
					const efetivo = (l) => {
						const min = Number((l && l.minutos) || 0);
						const comp = Math.max(0, Number((l && l.compensado) || 0));
						return min >= 0 ? Math.max(0, min - comp) : min;
					};
					const unico = getFuncionarioMatchFromFiltro();
					let listaFuncs = [];
					if (unico) {
						const bhKey = await resolveBHKeyForFuncionario(unico, { inicioISO: ini, fimISO: fim });
						let lista = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: ini, fimISO: fim });
						if (!lista || lista.length === 0) {
							const all = await window.BHFirebase.bhListLancamentos(bhKey, {});
							const periodo = computePeriodoFromLista([{ lancamentos: all }]);
							if (periodo && all && all.length) {
								ini = periodo.ini;
								fim = periodo.fim;
								lista = all;
							} else {
								console.warn('// [BH] Funcionário filtrado sem lançamentos no período');
								if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados');
								return;
							}
						}
						listaFuncs = [{ funcionario: unico, lancamentos: lista, bhKey }];
					} else {
						const res = await resolveRelatorioLista(ini, fim);
						listaFuncs = res.lista;
						ini = res.ini;
						fim = res.fim;
						if (listaFuncs.length === 0) { console.warn('// [BH] Nenhum funcionário com BH no período'); if (earlyLoader && earlyLoader.finish) earlyLoader.finish('Sem dados'); return; }
					}
					const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
					const headerCSS = window.BHReports.bhGetHeaderCSS();
					const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
					const loader = earlyLoader;
					const linhas = [];
					for (let i = 0; i < listaFuncs.length; i++) {
						const funcionario = listaFuncs[i].funcionario;
						const expirando = window.BHService.bhDetectarExpiracoes(listaFuncs[i].lancamentos, fim) || [];
						loader && loader.update(0, `Processando ${funcionario.nome} (${i+1}/${listaFuncs.length})`);
						for (const l of expirando) {
							const movEfetivo = efetivo(l);
							if (movEfetivo <= 0) continue;
							const obsFmt = bhFormatObsDiasUteisForDisplay(l.observacao);
							linhas.push(`<tr><td style=\"text-align:left; padding:6px;\">${funcionario.nome}</td><td style=\"padding:6px;\">${fmtDateBR(l.data)}</td><td style=\"padding:6px;\">${fmtDateBR(l.venceEm)}</td><td style=\"padding:6px; text-align:right; font-family:'Courier New';\">${toHHMM(movEfetivo)}</td><td style=\"padding:6px; text-align:left;\">${obsFmt}</td></tr>`);
						}
						loader && loader.update(1);
					}
					const tabela = `
						<table class=\"table\" style=\"width:100%; border-collapse:collapse; margin-top:10px;\">\n\t\t\t\t\t\t\t<thead style=\"background:#0d2339; color:#fff;\"><tr><th style=\"text-align:left; padding:6px;\">Funcionário</th><th style=\"padding:6px;\">Data</th><th style=\"padding:6px;\">Vence</th><th style=\"padding:6px; text-align:right;\">Movimento</th><th style=\"text-align:left; padding:6px;\">Obs</th></tr></thead>
							<tbody>${linhas.join('') || '<tr><td colspan=\"5\" style=\"padding:8px; text-align:center; color:#666;\">Sem itens vencendo no período</td></tr>'}</tbody>
						</table>`;
					const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><title>Vencimentos do Banco de Horas</title><style>${headerCSS}\n@media print { .bh-print-container{display:table;width:100%;} .bh-print-header{display:table-header-group;} } </style></head><body><div class=\"bh-print-container\"><div class=\"bh-print-header\">${headerHTML}<div class=\"title\">Vencimentos do Banco de Horas</div><div style=\"font-size:12px; color:#555; margin-top:6px;\">Período: ${fmtDateBR(ini)} a ${fmtDateBR(fim)}</div></div>${tabela}</div></body></html>`;
					if (earlyLoader && earlyLoader.isCancelled && earlyLoader.isCancelled()) { return; }
					const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
					loader && loader.finish('Relatório pronto');
				};

				// Acordo: página por funcionário do período ou único filtrado
				window.bhRelContrato = async () => {
					if (window._bhContratoRunning) { return; }
					window._bhContratoRunning = true;
					let { ini, fim } = getMesPeriodo();
					const unico = getFuncionarioMatchFromFiltro();
					const loader = window.bhLoadingShow ? window.bhLoadingShow('Gerando Acordos de Banco de Horas...', 100) : null;
					// Só abre a janela depois do processamento se não houver cancelamento
					let listaFuncs = [];
					try {
						if (unico) {
							const bhKey = await resolveBHKeyForFuncionario(unico, { inicioISO: ini, fimISO: fim });
							const lista = await window.BHFirebase.bhListLancamentos(bhKey, { inicioISO: ini, fimISO: fim });
                        if (!lista || lista.length === 0) {
								const all = await window.BHFirebase.bhListLancamentos(bhKey, {});
								const periodo = computePeriodoFromLista([{ lancamentos: all }]);
								if (periodo && all && all.length) {
									ini = periodo.ini;
									fim = periodo.fim;
								} else {
									console.warn('// [BH] Funcionário filtrado sem lançamentos no período');
									if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Funcionário filtrado sem lançamentos no período selecionado.', 'warning');
									return;
								}
							}
							listaFuncs = [unico];
						} else {
							const res = await resolveRelatorioLista(ini, fim);
							listaFuncs = res.lista.map(e => e.funcionario);
							ini = res.ini;
							fim = res.fim;
                        if (listaFuncs.length === 0) { console.warn('// [BH] Nenhum funcionário com BH no período'); if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Nenhum funcionário com Banco de Horas no período selecionado.', 'info'); return; }
						}
						const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
						const headerCSS = window.BHReports.bhGetHeaderCSS();
						const secoes = [];
						for (let i = 0; i < listaFuncs.length; i++) {
							const func = listaFuncs[i];
							loader && loader.update(0, `Processando ${func.nome} (${i+1}/${listaFuncs.length})`);
						const acordo = await window.BHReports.bhGerarContratoAdesao(func, {});
						let bodyHtml = '';
						const raw = String(acordo && acordo.html ? acordo.html : '');
						if (raw) {
							try {
								if (typeof DOMParser !== 'undefined') {
									const parsed = new DOMParser().parseFromString(raw, 'text/html');
									bodyHtml = parsed && parsed.body ? parsed.body.innerHTML : '';
								}
							} catch {}
							if (!bodyHtml) {
								const m = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
								bodyHtml = m && m[1] ? m[1] : raw;
							}
						}
						if (!bodyHtml.trim()) {
							console.warn('// [BH] Acordo retornou vazio para', func);
							bodyHtml = '<div style="color:#c00;">Não foi possível montar o acordo deste funcionário.</div>';
						}
							const pageBreak = i > 0 ? 'page-break-before: always;' : '';
							secoes.push(`<section class=\"bh-func-blk\" style=\"${pageBreak}\">${bodyHtml}</section>`);
							loader && loader.update(1);
						}
						if (loader && loader.isCancelled && loader.isCancelled()) { return; }
						const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><title>Acordos de Banco de Horas</title><style>${headerCSS}\n@media print { .bh-func-blk{page-break-inside:avoid;} *{-webkit-print-color-adjust:exact; print-color-adjust:exact;} } </style></head><body>${secoes.join('')}</body></html>`;
						const w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(), 300); }
						loader && loader.finish('Relatório pronto');
					} catch (err) {
                    console.error('// [BH] Erro ao gerar acordo', err);
                    if (window.FolhaUtils && window.FolhaUtils.showToast) window.FolhaUtils.showToast('Não foi possível gerar o acordo agora. Verifique permissões e dados.', 'error');
					} finally {
						window.bhLoadingHide && window.bhLoadingHide();
						window._bhContratoRunning = false;
					}
				};

			// Config modal helpers
			window.bhOpenConfig = async () => {
				const modal = document.getElementById('bh-modalConfig');
				if (!modal) return;
				modal.style.display = 'block';
				const cfg = (await (window.bhLoadConfig? window.bhLoadConfig():null)) || (window.BHConfig||{});
				document.getElementById('bh-cfg-jornada').value = cfg.jornadaSemanalHoras||44;
				document.getElementById('bh-cfg-horasMes').value = cfg.horasMensaisContrato||220;
				document.getElementById('bh-cfg-maxHE').value = cfg.maxHEPorDia||2;
				document.getElementById('bh-cfg-tolerancia').value = cfg.toleranciaMinutos||10;
				document.getElementById('bh-cfg-janela').value = cfg.janelaCompensacaoMeses||6;
				document.getElementById('bh-cfg-addDia').value = Math.round((cfg.adicionalDiaUtil||0)*100);
				document.getElementById('bh-cfg-addFer').value = Math.round((cfg.adicionalDomFeriado||0)*100);
				document.getElementById('bh-cfg-considerarQuinzena').checked = cfg.considerarQuinzena!==false;
				document.getElementById('bh-cfg-compensarAntes').checked = cfg.compensarAntesDePagar!==false;
				document.getElementById('bh-cfg-art59').value = (cfg.artigosCLT&&cfg.artigosCLT.art59)||'';
				document.getElementById('bh-cfg-art59A').value = (cfg.artigosCLT&&cfg.artigosCLT.art59A)||'';
				document.getElementById('bh-cfg-art59B').value = (cfg.artigosCLT&&cfg.artigosCLT.art59B)||'';
				document.getElementById('bh-cfg-cctVig').value = (cfg.referenciasSindicais&&cfg.referenciasSindicais.cctVigencia)||'';
			};

			// Canvas assinatura handlers
			const canvas = document.getElementById('bh-signCanvas');
			if (canvas) {
				const ctx = canvas.getContext('2d');
				let drawing = false, lastX = 0, lastY = 0;
				const getXY = (e) => {
					const rect = canvas.getBoundingClientRect();
					const x = (e.touches? e.touches[0].clientX: e.clientX) - rect.left;
					const y = (e.touches? e.touches[0].clientY: e.clientY) - rect.top;
					return { x, y };
				};
				const start = (e) => { drawing = true; const {x,y}=getXY(e); lastX=x; lastY=y; e.preventDefault(); };
				const move = (e) => { if(!drawing) return; const {x,y}=getXY(e); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke(); lastX=x; lastY=y; e.preventDefault(); };
				const end = () => { drawing = false; };
				canvas.addEventListener('mousedown', start);
				canvas.addEventListener('mousemove', move);
				canvas.addEventListener('mouseup', end);
				canvas.addEventListener('mouseleave', end);
				canvas.addEventListener('touchstart', start, { passive:false });
				canvas.addEventListener('touchmove', move, { passive:false });
				canvas.addEventListener('touchend', end);
                const btnClear = document.getElementById('bh-btnClearSign');
                if (btnClear) btnClear.addEventListener('click', ()=> { ctx.clearRect(0,0,canvas.width,canvas.height); canvas._lastSaved = null; });
                const btnSave = document.getElementById('bh-btnSaveSign');
                if (btnSave) btnSave.addEventListener('click', ()=> { canvas._lastSaved = canvas.toDataURL('image/png'); console.log('// [BH] Assinatura capturada'); });
			}
		}
	};

	// init imediato
	if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UI.init());
    } else {
        UI.init();
    }
})();

console.log('// [BH] banco-horas-ui.js carregado');
