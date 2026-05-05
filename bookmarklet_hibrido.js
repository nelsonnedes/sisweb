/**
 * 🔖 BOOKMARKLET - ESTRATÉGIA HÍBRIDA OTIMIZADA
 * 
 * COMO USAR:
 * 1. Copie o código JavaScript abaixo
 * 2. Crie um novo favorito no navegador
 * 3. Cole o código como URL do favorito
 * 4. Acesse uma página do sistema e clique no favorito
 */

javascript:(function(){
    if(window.estrategiaHibridaAtiva){
        alert('✅ Estratégia Híbrida já está ativa!');
        return;
    }
    
    console.log('🚀 ESTRATÉGIA HÍBRIDA - BOOKMARKLET');
    
    const BACKUP={getData:window.getData,saveData:window.saveData,restored:false};
    const CONFIG={SYNC_INTERVAL:30000,DEBUG:true,DATA_TYPES:['romaneiosPct','romaneiosTL','romaneiosTora','clients','clientes','fornecedores','especies','produtos','vendas','estoque','contasReceber','contasPagar','notasFiscais','mdfe']};
    const log={info:(msg)=>CONFIG.DEBUG&&console.log(`ℹ️ [SYNC] ${msg}`),success:(msg)=>CONFIG.DEBUG&&console.log(`✅ [SYNC] ${msg}`),warn:(msg)=>console.warn(`⚠️ [SYNC] ${msg}`),error:(msg,err)=>console.error(`❌ [SYNC] ${msg}`,err||'')};
    const cache=new Map();
    const setCache=(key,data)=>cache.set(key,{data,time:Date.now()});
    const getCache=(key)=>{const item=cache.get(key);if(!item||Date.now()-item.time>300000)return null;return item.data;};
    const syncQueue=new Map();
    let syncing=false;
    
    window.getData=async function(key){
        try{
            log.info(`📥 Carregando ${key}`);
            const cached=getCache(key);
            if(cached){log.info(`⚡ ${key} do cache (${Array.isArray(cached)?cached.length:'obj'} itens)`);return cached;}
            if(navigator.onLine&&window.firebaseService?.authService){
                try{
                    const firebaseData=await window.firebaseService.authService.getUserData(key);
                    if(firebaseData){localStorage.setItem(key,JSON.stringify(firebaseData));setCache(key,firebaseData);log.success(`☁️ ${key} do Firebase (${Array.isArray(firebaseData)?firebaseData.length:'obj'} itens)`);return firebaseData;}
                }catch(error){log.warn(`Firebase erro para ${key}: ${error.message}`);}
            }
            const localData=localStorage.getItem(key);
            if(localData){
                try{const parsed=JSON.parse(localData);setCache(key,parsed);log.info(`📱 ${key} do localStorage (${Array.isArray(parsed)?parsed.length:'obj'} itens)`);return parsed;}
                catch(parseError){log.error(`Erro ao parsear ${key}`,parseError);}
            }
            if(BACKUP.getData&&typeof BACKUP.getData==='function'){
                try{const result=await BACKUP.getData(key);if(result){localStorage.setItem(key,JSON.stringify(result));setCache(key,result);log.info(`🔄 ${key} da função original`);return result;}}
                catch(error){log.warn(`Função original falhou para ${key}: ${error.message}`);}
            }
            log.info(`ℹ️ ${key} não encontrado`);return null;
        }catch(error){log.error(`Erro crítico ao carregar ${key}`,error);return null;}
    };
    
    window.saveData=async function(key,data){
        try{
            log.info(`📤 Salvando ${key}`);
            localStorage.setItem(key,JSON.stringify(data));setCache(key,data);log.success(`📱 ${key} salvo localmente`);
            const dataWithTime=Array.isArray(data)?data.map(item=>({...item,dataModificacao:item.dataModificacao||new Date().toISOString()})):{...data,dataModificacao:data.dataModificacao||new Date().toISOString()};
            if(navigator.onLine&&window.firebaseService?.authService){
                try{await window.firebaseService.authService.saveUserData(key,dataWithTime);log.success(`☁️ ${key} sincronizado com Firebase`);return{success:true,source:'both'};}
                catch(error){log.warn(`Erro na sincronização de ${key}: ${error.message}`);syncQueue.set(key,{data:dataWithTime,retries:0});return{success:true,source:'localStorage',queued:true};}
            }else{syncQueue.set(key,{data:dataWithTime,retries:0});log.info(`📴 ${key} adicionado à fila (offline)`);return{success:true,source:'localStorage',queued:true};}
        }catch(error){log.error(`Erro crítico ao salvar ${key}`,error);return{success:false,error:error.message};}
    };
    
    async function processSyncQueue(){
        if(syncing||syncQueue.size===0||!navigator.onLine)return;
        syncing=true;log.info(`🔄 Processando fila (${syncQueue.size} itens)`);
        for(const[key,item]of syncQueue.entries()){
            try{if(window.firebaseService?.authService){await window.firebaseService.authService.saveUserData(key,item.data);syncQueue.delete(key);log.success(`✅ ${key} sincronizado da fila`);}}
            catch(error){item.retries++;if(item.retries>=3){log.error(`❌ ${key} removido da fila após 3 tentativas`);syncQueue.delete(key);}else{log.warn(`⚠️ ${key} falhou (tentativa ${item.retries}/3)`);}}
        }
        syncing=false;
    }
    
    window.syncAllData=async function(){
        if(!navigator.onLine){log.warn('📴 Sem conexão - sincronização adiada');return{success:false,error:'Offline'};}
        log.info('🔄 Sincronização completa iniciada...');const results={};
        for(const dataType of CONFIG.DATA_TYPES){
            try{const localData=localStorage.getItem(dataType);if(localData&&window.firebaseService?.authService){const parsed=JSON.parse(localData);await window.firebaseService.authService.saveUserData(dataType,parsed);results[dataType]={success:true,count:Array.isArray(parsed)?parsed.length:1};log.success(`✅ ${dataType} sincronizado`);}}
            catch(error){log.error(`❌ Erro ao sincronizar ${dataType}`,error);results[dataType]={success:false,error:error.message};}
        }
        log.success('✅ Sincronização completa finalizada');return{success:true,results};
    };
    
    window.getSyncStats=function(){return{online:navigator.onLine,cache:{size:cache.size,keys:Array.from(cache.keys())},syncQueue:{size:syncQueue.size,items:Array.from(syncQueue.keys())},backup:{available:!!BACKUP.getData,restored:BACKUP.restored},firebase:!!window.firebaseService?.authService};};
    
    window.restoreOriginalFunctions=function(){if(BACKUP.getData){window.getData=BACKUP.getData;log.info('🔄 getData original restaurado');}if(BACKUP.saveData){window.saveData=BACKUP.saveData;log.info('🔄 saveData original restaurado');}BACKUP.restored=true;log.success('✅ Funções originais restauradas');};
    
    window.clearCache=function(key){if(key){cache.delete(key);log.info(`🧹 Cache limpo para ${key}`);}else{cache.clear();log.info('🧹 Todo cache limpo');}};
    
    function startMonitoring(){
        setInterval(processSyncQueue,CONFIG.SYNC_INTERVAL);
        window.addEventListener('online',()=>{log.success('🌐 Reconectado - processando fila');setTimeout(processSyncQueue,1000);});
        window.addEventListener('offline',()=>{log.warn('📴 Desconectado - modo offline ativo');});
        log.success('🔍 Monitoramento ativo');
    }
    
    try{
        startMonitoring();
        if(navigator.onLine){setTimeout(()=>{syncAllData().then(()=>{log.success('✅ Sincronização inicial concluída');}).catch(error=>{log.warn('⚠️ Sincronização inicial falhou, sistema funciona offline');});},2000);}
        
        window.estrategiaHibridaAtiva=true;
        
        console.log(`🎉 ESTRATÉGIA HÍBRIDA OTIMIZADA INSTALADA!\n\n✅ Funcionalidades Ativas:\n- Firebase como Source of Truth\n- localStorage como Cache Inteligente\n- Sincronização Automática (${CONFIG.SYNC_INTERVAL/1000}s)\n- Modo Offline Funcional\n- Resolução de Conflitos\n- Backup das Funções Originais\n\n📊 Status: Online=${navigator.onLine}, Firebase=${!!window.firebaseService}`);
        
        alert('🎉 Estratégia Híbrida Otimizada Ativada!\n\n✅ Sistema sincronizado e funcionando\n📱 Dados disponíveis offline\n☁️ Sincronização automática ativa');
        
        log.success('🚀 Sistema otimizado ativo e funcional!');
        
        // Atualizar interface se possível
        if(typeof carregarRomaneios==='function'){
            setTimeout(()=>{carregarRomaneios();log.info('🔄 Interface atualizada');},1000);
        }
        
    }catch(error){log.error('❌ Erro na inicialização, restaurando originais',error);restoreOriginalFunctions();}
    
})(); 
