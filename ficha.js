import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBkp8ZUYMCfRokbpMl2fBGTvfMxzzvgaeY",
    authDomain: "rpgo-onepiece.firebaseapp.com",
    databaseURL: "https://rpgo-onepiece-default-rtdb.firebaseio.com",
    projectId: "rpgo-onepiece",
    storageBucket: "rpgo-onepiece.firebasestorage.app",
    messagingSenderId: "726770644982",
    appId: "1:726770644982:web:7c06f46940cc5142c3f9d7",
    measurementId: "G-HSBMTMB5XK"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// SEGURANÇA
onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarFicha(user.uid);
        carregarInventario(user.uid);
        setupInventoryUI(user.uid);

        configurarEdicao('valHp', 'hpAtual', 'maxHp', user.uid);
        configurarEdicao('valPp', 'ppAtual', 'maxPp', user.uid);
        configurarEdicao('maxPeso', 'cargaMaxima', 'null', user.uid);
        
        // Inicializa a lógica da bandeja passando o user para salvar rolagem
        configurarEdicao('valNivel', 'nivel', 'null', user.uid);
        iniciarBandejaDados(user);
        configurarTema();
    } else {
        window.location.href = "index.html";
    }
});

// --- SISTEMA DE TEMA (DARK MODE) ---
function configurarTema() {
    const btnTheme = document.getElementById('btnToggleTheme');
    const body = document.body;
    
    // 1. Verifica preferência salva
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        btnTheme.className = "fas fa-sun";
    }

    // 2. Alternar Tema
    if(btnTheme) {
        btnTheme.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                btnTheme.className = "fas fa-sun";
            } else {
                localStorage.setItem('theme', 'light');
                btnTheme.className = "fas fa-moon";
            }
        });
    }
}

function carregarFicha(uid) {
    const fichaRef = ref(db, 'users/' + uid);

    // DADOS
    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if(!dados) return;

        const elNome = document.getElementById('displayNome');
        if(elNome) elNome.innerText = dados.nome;
        
        // NOVO: Carrega o Nível (ou 1 se não tiver salvo)
        const elNivel = document.getElementById('valNivel');
        if(elNivel) elNivel.innerText = dados.nivel || 1;
        
        // VIDA
        const elValHp = document.getElementById('valHp');
        const elMaxHp = document.getElementById('maxHp');
        const elFillHp = document.getElementById('fillHp');

        if(elValHp) elValHp.innerText = dados.hpAtual;
        if(elMaxHp) elMaxHp.innerText = dados.hpMax;
        if(elFillHp) {
            const pctHp = (dados.hpAtual / dados.hpMax) * 100;
            elFillHp.style.width = `${Math.max(0, Math.min(100, pctHp))}%`;
        }

        // PP
        const atualPP = dados.ppAtual || dados.enAtual || 0;
        const maxPP = dados.ppMax || dados.enMax || 1;
        document.getElementById('valPp').innerText = atualPP;
        document.getElementById('maxPp').innerText = maxPP;
        document.getElementById('fillPp').style.width = `${Math.max(0, Math.min(100, (atualPP / maxPP) * 100))}%`;

        // ATRIBUTOS
        if(dados.atributos) {
            const setAttr = (id, val) => {
                const el = document.getElementById(id);
                if(el) el.innerText = val || 0;
            };
            setAttr('attr-forca', dados.atributos.forca);
            setAttr('attr-destreza', dados.atributos.destreza);
            setAttr('attr-constituicao', dados.atributos.constituicao);
            setAttr('attr-sabedoria', dados.atributos.sabedoria);
            setAttr('attr-vontade', dados.atributos.vontade);
            setAttr('attr-presenca', dados.atributos.presenca);
        }
    });

    // AÇÕES (CARDS)
    const acoesRef = ref(db, 'users/' + uid + '/acoes');
    onValue(acoesRef, (snapshot) => {
        const acoes = snapshot.val();
        
        document.getElementById('lista-padrao').innerHTML = "";
        document.getElementById('lista-bonus').innerHTML = "";
        document.getElementById('lista-power').innerHTML = "";
        document.getElementById('lista-react').innerHTML = "";

        if (acoes) {
            Object.entries(acoes).forEach(([id, acao]) => {
                const cardHTML = `
                    <div class="action-card type-${acao.tipo}">
                        <div>
                            <div class="card-title">${acao.nome}</div>
                            <div class="card-desc">${acao.descricao}</div>
                        </div>
                        <div class="card-tags">
                            ${acao.tag ? `<span class="tag tag-damage">${acao.tag}</span>` : ''}
                        </div>
                        <i class="fas fa-trash btn-delete" data-id="${id}" style="position: absolute; top: 15px; right: 15px; color: #ddd; cursor: pointer;"></i>
                    </div>
                `;
                const container = document.getElementById(`lista-${acao.tipo}`);
                if(container) container.innerHTML += cardHTML;
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(confirm("Tem certeza que quer apagar essa técnica?")) {
                        const idParaDeletar = e.target.getAttribute('data-id');
                        remove(ref(db, 'users/' + uid + '/acoes/' + idParaDeletar));
                    }
                });
            });
        }
    });

    // NOVA AÇÃO
    const btnSalvarAcao = document.getElementById('btnSalvarAcao');
    const novoBtnSalvar = btnSalvarAcao.cloneNode(true);
    btnSalvarAcao.parentNode.replaceChild(novoBtnSalvar, btnSalvarAcao);

    novoBtnSalvar.onclick = () => {
        const nome = document.getElementById('newActionName').value;
        const desc = document.getElementById('newActionDesc').value;
        const tipo = document.getElementById('newActionType').value;
        const tag = document.getElementById('newActionTag').value;

        if(nome) {
            push(acoesRef, {
                nome: nome, descricao: desc, tipo: tipo, tag: tag
            });
            document.getElementById('newActionName').value = "";
            document.getElementById('newActionDesc').value = "";
            document.getElementById('newActionTag').value = "";
            document.getElementById('modalAcao').style.display = 'none';
        } else {
            alert("Dê um nome para sua ação!");
        }
    };

    // EDITAR FICHA
    const modalFicha = document.getElementById('modalFicha');
    const btnEditar = document.getElementById('btnEditarFicha');
    const btnFecharFicha = document.getElementById('btnFecharFicha');
    const btnSalvarFicha = document.getElementById('btnSalvarFicha');

    if(btnEditar) btnEditar.onclick = () => {
        document.getElementById('editHpMax').value = document.getElementById('maxHp').innerText;
        document.getElementById('editPpMax').value = document.getElementById('maxPp').innerText;
        document.getElementById('editFor').value = document.getElementById('attr-forca').innerText;
        document.getElementById('editDes').value = document.getElementById('attr-destreza').innerText;
        document.getElementById('editCon').value = document.getElementById('attr-constituicao').innerText;
        document.getElementById('editSab').value = document.getElementById('attr-sabedoria').innerText;
        document.getElementById('editVon').value = document.getElementById('attr-vontade').innerText;
        document.getElementById('editPre').value = document.getElementById('attr-presenca').innerText;
        modalFicha.style.display = 'flex';
    };

    if(btnFecharFicha) btnFecharFicha.onclick = () => { modalFicha.style.display = 'none'; };

    if(btnSalvarFicha) btnSalvarFicha.onclick = () => {
        const atualizacao = {
            hpMax: Number(document.getElementById('editHpMax').value),
            ppMax: Number(document.getElementById('editPpMax').value),
            atributos: {
                forca: Number(document.getElementById('editFor').value),
                destreza: Number(document.getElementById('editDes').value),
                constituicao: Number(document.getElementById('editCon').value),
                sabedoria: Number(document.getElementById('editSab').value),
                vontade: Number(document.getElementById('editVon').value),
                presenca: Number(document.getElementById('editPre').value)
            }
        };
        update(fichaRef, atualizacao).then(() => {
            alert("Ficha atualizada!");
            modalFicha.style.display = 'none';
        });
    };
}

// MODAIS
const modal = document.getElementById('modalAcao');
const btnNova = document.getElementById('btnNovaAcao');
const btnFechar = document.getElementById('btnFecharModal');

if(btnNova) btnNova.onclick = () => { modal.style.display = 'flex'; };
if(btnFechar) btnFechar.onclick = () => { modal.style.display = 'none'; };

document.getElementById('btnSair').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
});

// EDIÇÃO OTIMISTA
function configurarEdicao(elementoId, campoBanco, elementoMaxId, uid) {
    const spanValor = document.getElementById(elementoId);
    if(!spanValor) return; 
    
    spanValor.addEventListener('click', function() {
        const valorAtualTexto = spanValor.innerText;
        const input = document.createElement('input');
        input.type = 'text'; input.value = ""; input.placeholder = valorAtualTexto;
        input.className = 'input-edit-stat';
        spanValor.parentNode.replaceChild(input, spanValor);
        input.focus();

        const salvar = () => {
            let entrada = input.value.trim();
            const elMax = document.getElementById(elementoMaxId);
            const valorMax = elMax ? Number(elMax.innerText) : 9999;
            const valorAtual = Number(valorAtualTexto);
            let novoValor = valorAtual;

            if (entrada === "") {
                if (input.parentNode) input.parentNode.replaceChild(spanValor, input);
                return;
            }
            if (entrada.startsWith('+') || entrada.startsWith('-')) {
                novoValor = valorAtual + Number(entrada);
            } else {
                novoValor = Number(entrada);
            }
            if (novoValor > valorMax) novoValor = valorMax;
            spanValor.innerText = novoValor;
            if (input.parentNode) input.parentNode.replaceChild(spanValor, input);

            update(ref(db, 'users/' + uid), { [campoBanco]: novoValor });
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { salvar(); input.blur(); } });
        input.addEventListener('blur', salvar, { once: true });
    });
}

// =========================================================
// 🎲 LÓGICA DA BANDEJA (SMART DOCKING)
// =========================================================
function iniciarBandejaDados(user) {
    let dadosSelecionados = [];
    let modoNegativo = false;
    
    // ELEMENTOS
    const tray = document.getElementById('diceTray');
    const header = document.getElementById('diceTrayHeader');
    const icon = document.getElementById('trayIcon'); // Ícone da setinha
    
    // VARIÁVEIS DE ARRASTO
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let hasMoved = false;
    let dragStartTime = 0;

    // Estado Inicial: Grudado em baixo
    tray.classList.add('dock-bottom', 'collapsed');

    // --- LÓGICA DE ARRASTAR (MOUSEDOWN) ---
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasMoved = false;
        dragStartTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = tray.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        header.style.cursor = 'grabbing';
    });

    // --- MOVIMENTO (MOUSEMOVE) ---
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Só considera movimento se passar de 5px
        if (!hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            hasMoved = true;
            
            // Verifica estado atual
            const isCollapsed = tray.classList.contains('collapsed');
            
            // Remove classes de dock
            tray.classList.remove('dock-bottom', 'dock-side');
            
            if (isCollapsed) {
                tray.style.transition = 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease';
                icon.className = "fas fa-dice-d20"; 
            } else {
                tray.style.transition = 'none'; 
            }

            // Aplica posição inicial corrigida
            tray.style.left = `${initialLeft}px`;
            tray.style.top = `${initialTop}px`;
            tray.style.bottom = 'auto';
            tray.style.right = 'auto';
        }

        if (hasMoved) {
            // Calcula nova posição
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            // REGRA 1: NÃO SAIR DA TELA
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Usa o tamanho atual da bandeja (seja bolinha ou aberta)
            const currentWidth = tray.offsetWidth;
            const currentHeight = tray.offsetHeight;

            // Clampa (limita) os valores dentro da janela
            newLeft = Math.max(0, Math.min(newLeft, windowWidth - currentWidth));
            newTop = Math.max(0, Math.min(newTop, windowHeight - currentHeight));

            // Aplica posição
            tray.style.left = `${newLeft}px`;
            tray.style.top = `${newTop}px`;
            
            // Remove ancoragens antigas
            tray.style.bottom = 'auto';
            tray.style.right = 'auto';
        }
    });

    // --- SOLTAR (MOUSEUP) ---
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        header.style.cursor = 'grab';
        
        // Restaura a transição suave para o efeito de "snap"
        tray.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';

        if (hasMoved) {
            snapToNearestEdge();
        }
    });

    // --- FUNÇÃO: GRUDAR NA BORDA MAIS PRÓXIMA ---
    function snapToNearestEdge() {
        const rect = tray.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Distâncias para as bordas
        const distLeft = rect.left;
        const distRight = windowWidth - (rect.left + rect.width);
        const distBottom = windowHeight - (rect.top + rect.height);
        
        const snapThreshold = 80; 
        const safeMargin = 20;
        const estimatedHeight = 400; // Altura estimada da bandeja aberta

        // Limpa classes antigas
        tray.classList.remove('dock-bottom', 'dock-side');
        
        if (distBottom < snapThreshold) {
            // GRUDA EM BAIXO
            tray.classList.add('dock-bottom');
            tray.classList.add('collapsed');
            
            const collapsedHeight = 45; 
            const targetTop = windowHeight - collapsedHeight;
            
            tray.style.bottom = 'auto'; 
            tray.style.top = `${targetTop}px`;
            tray.style.left = `${Math.max(0, Math.min(rect.left, windowWidth - 300))}px`;
            tray.style.right = 'auto';
            
            icon.className = "fas fa-chevron-up"; 

            // Depois da animação, fixa no bottom para responsividade
            setTimeout(() => {
                if (tray.classList.contains('dock-bottom') && !isDragging) {
                    tray.style.top = 'auto';
                    tray.style.bottom = '0';
                }
            }, 300);

        } else if (distLeft < snapThreshold) {
            // GRUDA ESQUERDA
            tray.classList.add('dock-side');
            tray.classList.add('collapsed');
            
            tray.style.right = 'auto';
            tray.style.left = '0'; 
            tray.style.bottom = 'auto';
            
            // Ajusta Top para ficar visível
            let targetTop = Math.max(safeMargin, Math.min(rect.top, windowHeight - 100));
            tray.style.top = `${targetTop}px`;

            icon.className = "fas fa-dice-d20";

        } else if (distRight < snapThreshold) {
            // GRUDA DIREITA
            tray.classList.add('dock-side');
            tray.classList.add('collapsed');
            
            tray.style.left = 'auto';
            tray.style.right = '0'; 
            tray.style.bottom = 'auto';
            
            let targetTop = Math.max(safeMargin, Math.min(rect.top, windowHeight - 100));
            tray.style.top = `${targetTop}px`;

            icon.className = "fas fa-dice-d20";

        } else {
            // FLUTUANDO
            
            // Ajusta Horizontal
            let finalLeft = rect.left;
            if (finalLeft + 300 > windowWidth) {
                finalLeft = windowWidth - 300 - safeMargin;
            }
            tray.style.left = `${Math.max(safeMargin, finalLeft)}px`;
            tray.style.right = 'auto';

            // Ajusta Vertical
            // Expande pra CIMA se necessário
            if (rect.top + estimatedHeight > windowHeight) {
                const bottomPos = windowHeight - rect.bottom;
                tray.style.bottom = `${Math.max(safeMargin, bottomPos)}px`;
                tray.style.top = 'auto';
            } else {
                tray.style.top = `${rect.top}px`;
                tray.style.bottom = 'auto';
            }
            
            // Ajusta ícone conforme estado
            if (tray.classList.contains('collapsed')) {
                icon.className = "fas fa-dice-d20";
            } else {
                icon.className = "fas fa-times";
            }
        }
    }

    // --- CLIQUE (ABRIR/FECHAR) ---
    header.addEventListener('click', () => {
        // Clique rápido sem arrastar
        const clickDuration = Date.now() - dragStartTime;
        
        if (!hasMoved && clickDuration < 200) {
            const willOpen = tray.classList.contains('collapsed');
            const isFloating = !tray.classList.contains('dock-bottom') && !tray.classList.contains('dock-side');
            const trayBody = tray.querySelector('.tray-body');

            if (willOpen) {
                // --- ABRINDO ---
                const rect = tray.getBoundingClientRect();
                const startHeight = tray.offsetHeight;
                const startWidth = tray.offsetWidth;
                
                // Mede tamanho final
                tray.style.transition = 'none';
                tray.classList.remove('collapsed');
                tray.style.height = 'auto';
                tray.style.width = '300px';
                tray.style.overflow = 'hidden';
                if(trayBody) trayBody.style.overflow = 'hidden';
                
                const targetHeight = tray.scrollHeight;
                
                // Posicionamento Inteligente
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                
                const spaceBelow = windowHeight - rect.top;
                const spaceAbove = rect.bottom; 
                
                // Expande para cima se pouco espaço
                if (spaceBelow < 350 && spaceAbove > spaceBelow) {
                    const bottomPos = windowHeight - rect.bottom;
                    tray.style.bottom = `${bottomPos}px`;
                    tray.style.top = 'auto';
                } else {
                    tray.style.top = `${rect.top}px`;
                    tray.style.bottom = 'auto';
                }

                // Correção Horizontal
                if (isFloating) {
                    const expandedWidth = 300;
                    if (rect.left + expandedWidth > windowWidth) {
                        const newLeft = windowWidth - expandedWidth - 10;
                        tray.style.left = `${Math.max(0, newLeft)}px`;
                    }
                }

                // Inicia animação
                tray.style.height = `${startHeight}px`;
                tray.style.width = `${startWidth}px`;
                
                tray.offsetHeight; // Força reflow
                
                tray.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                tray.style.height = `${targetHeight}px`;
                tray.style.width = '300px';

                // Limpa estilos
                setTimeout(() => {
                    if (!tray.classList.contains('collapsed')) {
                        tray.style.height = 'auto';
                        tray.style.width = '';
                        tray.style.overflow = '';
                        if(trayBody) trayBody.style.overflow = '';
                    }
                }, 300);

            } else {
                // --- FECHANDO ---
                tray.style.height = `${tray.offsetHeight}px`;
                tray.style.width = `${tray.offsetWidth}px`;
                tray.style.overflow = 'hidden';
                if(trayBody) trayBody.style.overflow = 'hidden';
                
                tray.offsetHeight; // Força reflow

                tray.classList.add('collapsed');
                tray.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                
                if (tray.classList.contains('dock-side')) {
                    tray.style.height = '50px';
                    tray.style.width = '50px';
                } else {
                    tray.style.height = '45px';
                    tray.style.width = '300px';
                }

                // Limpa estilos
                setTimeout(() => {
                    if (tray.classList.contains('collapsed')) {
                        tray.style.height = '';
                        tray.style.width = '';
                        tray.style.overflow = '';
                        if(trayBody) trayBody.style.overflow = '';
                    }
                }, 300);
            }
            
            // Atualiza ícone
            const isCollapsed = tray.classList.contains('collapsed');
            const isBottom = tray.classList.contains('dock-bottom');

            if (!isBottom) {
                icon.className = isCollapsed ? "fas fa-dice-d20" : "fas fa-times";
            } else {
                if (isCollapsed) {
                    const rect = tray.getBoundingClientRect();
                    if (rect.top < window.innerHeight / 2) icon.className = "fas fa-chevron-down";
                    else icon.className = "fas fa-chevron-up";
                } else {
                    icon.className = "fas fa-chevron-up"; 
                }
            }
        }
    });

    // =========================================================
    // LÓGICA DE ROLAGEM
    // =========================================================
    const diceContainer = document.getElementById('diceContainer');
    const btnToggleSign = document.getElementById('btnToggleSign');
    const txtTotal = document.getElementById('txtTotal');
    const txtDetalhes = document.getElementById('txtDetalhes');
    const inputMod = document.getElementById('inputModificador');

    function atualizarPreview() {
        if(dadosSelecionados.length === 0 && Number(inputMod.value) === 0) {
            txtDetalhes.innerText = "Selecione dados...";
            txtTotal.innerText = "--";
            return;
        }
        let formula = "";
        dadosSelecionados.forEach((d, index) => {
            const nomeDado = `1d${d.faces}`;
            let operador = "";
            if (index === 0) {
                if (d.sinal === -1) operador = "- ";
            } else {
                operador = d.sinal === 1 ? " + " : " - ";
            }
            formula += `${operador}${nomeDado}`;
        });
        const mod = Number(inputMod.value);
        if(mod !== 0) {
            if(dadosSelecionados.length > 0) formula += mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`;
            else formula += `${mod}`;
        }
        txtDetalhes.innerText = formula;
        txtTotal.innerText = "??";
    }

    btnToggleSign.addEventListener('click', () => {
        modoNegativo = !modoNegativo;
        if(modoNegativo) {
            diceContainer.classList.add('negative-mode');
            btnToggleSign.innerText = "-";
        } else {
            diceContainer.classList.remove('negative-mode');
            btnToggleSign.innerText = "+";
        }
    });

    document.querySelectorAll('.dice-btn[data-faces]').forEach(btn => {
        btn.addEventListener('click', () => {
            const faces = Number(btn.getAttribute('data-faces'));
            const sinal = modoNegativo ? -1 : 1;
            dadosSelecionados.push({ faces, sinal });
            if(modoNegativo) {
                modoNegativo = false;
                diceContainer.classList.remove('negative-mode');
                btnToggleSign.innerText = "+";
            }
            atualizarPreview();
        });
    });

    inputMod.addEventListener('input', atualizarPreview);

    document.getElementById('btnLimparTray').addEventListener('click', () => {
        dadosSelecionados = [];
        inputMod.value = 0;
        txtTotal.innerText = "--";
        txtDetalhes.innerText = "Bandeja limpa";
        modoNegativo = false;
        diceContainer.classList.remove('negative-mode');
        btnToggleSign.innerText = "+";
    });

    document.getElementById('btnRolarTray').addEventListener('click', () => {
        if(dadosSelecionados.length === 0 && Number(inputMod.value) === 0) return;

        let total = 0;
        let partesTexto = [];

        dadosSelecionados.forEach(d => {
            const resultado = Math.floor(Math.random() * d.faces) + 1;
            total += (resultado * d.sinal);
            let resFormatado = resultado;
            if (resultado === 1) resFormatado = `<span class="crit-fail">${resultado}</span>`;
            else if (resultado === d.faces) resFormatado = `<span class="crit-success">${resultado}</span>`;
            partesTexto.push({ texto: `(${resFormatado}) 1d${d.faces}`, sinal: d.sinal });
        });

        const mod = Number(inputMod.value);
        total += mod;

        let stringFinal = "";
        partesTexto.forEach((parte, index) => {
            let operador = "";
            if (index === 0) {
                if (parte.sinal === -1) operador = "- ";
            } else {
                operador = parte.sinal === 1 ? " + " : " - ";
            }
            stringFinal += `${operador}${parte.texto}`;
        });

        if (mod !== 0) stringFinal += ` ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)}`;

        txtTotal.innerText = total;
        txtDetalhes.innerHTML = `[${total}] = ${stringFinal}`;

        const textoLimpo = `[${total}] = ${stringFinal.replace(/<[^>]*>?/gm, '')}`;
        if(user) update(ref(db, 'users/' + user.uid), { ultimaRolagem: textoLimpo });
        
        dadosSelecionados = [];
    });
}

// =========================================================
// 🎒 SISTEMA DE INVENTÁRIO
// =========================================================

function setupInventoryUI(uid) {
    // ABAS
    const tabs = document.querySelectorAll('.tab');
    const views = {
        0: 'view-combate',
        2: 'view-inventario'
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            Object.values(views).forEach(id => {
                const el = document.getElementById(id);
                if(el) el.style.display = 'none';
            });

            const viewId = views[index];
            if(viewId) {
                const el = document.getElementById(viewId);
                if(el) el.style.display = 'block';
            }
        });
    });

    // MODAL ITEM
    const btnNovoItem = document.getElementById('btnNovoItem');
    const modalItem = document.getElementById('modalItem');
    const btnFecharItem = document.getElementById('btnFecharModalItem');
    const btnSalvarItem = document.getElementById('btnSalvarItem');
    const selectType = document.getElementById('newItemType');
    const weaponFields = document.getElementById('weaponFields');
    const modalTitle = modalItem.querySelector('h2');

    // Controle de edição
    let editingItemId = null;

    if(selectType) {
        selectType.addEventListener('change', () => {
            if(selectType.value === 'arma') {
                weaponFields.style.display = 'grid';
            } else {
                weaponFields.style.display = 'none';
            }
        });
    }

    // Abrir Modal
    window.abrirModalItem = (item = null, id = null) => {
        modalItem.style.display = 'flex';
        if(item) {
            // Edição
            editingItemId = id;
            modalTitle.innerText = "Editar Item";
            document.getElementById('newItemName').value = item.nome;
            document.getElementById('newItemWeight').value = item.peso;
            document.getElementById('newItemType').value = item.tipo;
            document.getElementById('newItemTags').value = item.tags || "";
            document.getElementById('newItemDesc').value = item.descricao || "";
            
            if(item.tipo === 'arma') {
                weaponFields.style.display = 'grid';
                document.getElementById('newItemDamage').value = item.dano || "";
                document.getElementById('newItemMod').value = item.modificador || "";
            } else {
                weaponFields.style.display = 'none';
            }
        } else {
            // Novo
            editingItemId = null;
            modalTitle.innerText = "Novo Item";
            document.getElementById('newItemName').value = "";
            document.getElementById('newItemTags').value = "";
            document.getElementById('newItemDesc').value = "";
            document.getElementById('newItemWeight').value = "1.0";
            document.getElementById('newItemDamage').value = "";
            document.getElementById('newItemMod').value = "";
            weaponFields.style.display = 'none';
            selectType.value = 'comum';
        }
    };

    if(btnNovoItem) btnNovoItem.onclick = () => { window.abrirModalItem(); };
    if(btnFecharItem) btnFecharItem.onclick = () => { modalItem.style.display = 'none'; };

    if(btnSalvarItem) {
        // Evita duplicação de listeners
        const novoBtn = btnSalvarItem.cloneNode(true);
        btnSalvarItem.parentNode.replaceChild(novoBtn, btnSalvarItem);
        
        novoBtn.onclick = () => {
            const nome = document.getElementById('newItemName').value;
            const peso = document.getElementById('newItemWeight').value;
            const tipo = document.getElementById('newItemType').value;
            const tags = document.getElementById('newItemTags').value;
            const desc = document.getElementById('newItemDesc').value;
            const dano = document.getElementById('newItemDamage').value;
            const mod = document.getElementById('newItemMod').value;
            
            if(nome) {
                const itemData = {
                    nome, 
                    peso: Number(peso), 
                    tipo, 
                    tags, 
                    descricao: desc, 
                    dano: tipo === 'arma' ? dano : '',
                    modificador: tipo === 'arma' ? Number(mod) : 0,
                    // Mantém estado equipado
                    equipado: editingItemId ? undefined : false 
                };

                // Remove undefined keys
                Object.keys(itemData).forEach(key => itemData[key] === undefined && delete itemData[key]);

                if(editingItemId) {
                    update(ref(db, 'users/' + uid + '/inventario/' + editingItemId), itemData);
                } else {
                    push(ref(db, 'users/' + uid + '/inventario'), itemData);
                }

                modalItem.style.display = 'none';
            } else {
                alert("Nome é obrigatório!");
            }
        };
    }
}

function carregarInventario(uid) {
    const invRef = ref(db, 'users/' + uid + '/inventario');
    const cargaRef = ref(db, 'users/' + uid + '/cargaMaxima');

    // Carrega Carga Máxima
    onValue(cargaRef, (snapshot) => {
        const max = snapshot.val() || 20;
        const elMax = document.getElementById('maxPeso');
        if(elMax) elMax.innerText = max;
    });
    
    onValue(invRef, (snapshot) => {
        const itens = snapshot.val();
        const lista = document.getElementById('lista-inventario');
        const slotArma = document.getElementById('slot-arma').querySelector('.slot-content');
        const slotArmadura = document.getElementById('slot-armadura').querySelector('.slot-content');
        
        if(!lista) return;

        lista.innerHTML = "";
        slotArma.innerHTML = "";
        slotArmadura.innerHTML = "";
        
        let pesoTotal = 0;

        if(itens) {
            Object.entries(itens).forEach(([id, item]) => {
                pesoTotal += Number(item.peso) || 0;
                
                const itemHTML = `
                    <div class="action-card type-comum collapsed expandable-card" data-id="${id}" style="border-left: 4px solid ${item.equipado ? 'var(--primary)' : '#ccc'}; position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="card-title" style="margin-bottom: 0;">${item.nome} ${item.equipado ? '<i class="fas fa-check-circle" style="color: var(--primary); margin-left: 5px;"></i>' : ''}</div>
                            <div style="font-size: 0.8rem; color: var(--text-sec); font-weight: bold;">${item.peso} PC</div>
                        </div>
                        ${item.tipo === 'arma' && item.dano ? `<div style="font-size: 0.85rem; color: var(--color-power); font-weight: bold; margin-top: 2px;">⚔️ ${item.dano} ${item.modificador ? (item.modificador > 0 ? `+${item.modificador}` : item.modificador) : ''}</div>` : ''}
                        <div class="card-desc" style="margin-top: 5px;">${item.descricao}</div>
                        <div class="card-tags" style="margin-top: 5px;">
                            ${item.tags ? item.tags.split(',').map(t => `<span class="tag tag-damage">${t.trim()}</span>`).join('') : ''}
                        </div>
                        <div class="card-actions" style="margin-top: 10px; display: flex; gap: 5px; justify-content: flex-end; align-items: center;">
                            ${(item.tipo === 'arma' || item.tipo === 'armadura') ? 
                                `<button class="btn-equip" data-id="${id}" data-tipo="${item.tipo}" data-equipado="${item.equipado}" style="background: var(--bg-button); color: var(--text-button); border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">${item.equipado ? 'Desequipar' : 'Equipar'}</button>` 
                                : ''}
                            <i class="fas fa-edit btn-edit-item" data-id="${id}" style="color: var(--text-sec); cursor: pointer; margin-left: 5px;"></i>
                            <i class="fas fa-trash btn-delete-item" data-id="${id}" style="color: #ff6b6b; cursor: pointer; margin-left: 10px;"></i>
                        </div>
                    </div>
                `;

                if(item.equipado) {
                    // Renderiza no Slot
                    const slotHTML = `
                        <div style="width: 100%; padding: 10px;">
                            <div style="font-weight: bold; color: var(--primary); font-size: 1.1rem;">${item.nome}</div>
                            ${item.tipo === 'arma' && item.dano ? `<div style="font-size: 0.9rem; color: var(--color-power); font-weight: bold; margin: 5px 0;">⚔️ ${item.dano} ${item.modificador ? (item.modificador > 0 ? `+${item.modificador}` : item.modificador) : ''}</div>` : ''}
                            <div style="font-size: 0.8rem; color: var(--text-sec); margin-bottom: 5px;">${item.tags || ''}</div>
                            <div style="font-size: 0.8rem; font-weight: bold; color: var(--text-main);">${item.peso} PC</div>
                            <button class="btn-equip" data-id="${id}" data-tipo="${item.tipo}" data-equipado="true" style="margin-top: 8px; font-size: 0.8rem; padding: 4px 12px; background: var(--bg-button); color: var(--text-button); border: none; border-radius: 4px; cursor: pointer;">Desequipar</button>
                        </div>
                    `;
                    if(item.tipo === 'arma') slotArma.innerHTML = slotHTML;
                    if(item.tipo === 'armadura') slotArmadura.innerHTML = slotHTML;
                } else {
                    // Renderiza na Mochila
                    lista.innerHTML += itemHTML;
                }
            });
        }
        
        atualizarPeso(pesoTotal);
        
        // Listeners
        document.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(confirm("Apagar este item?")) {
                    remove(ref(db, 'users/' + uid + '/inventario/' + e.target.getAttribute('data-id')));
                }
            });
        });

        document.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.getAttribute('data-id');
                const item = itens[id];
                window.abrirModalItem(item, id);
            });
        });

        document.querySelectorAll('.btn-equip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.getAttribute('data-id');
                const tipo = e.target.getAttribute('data-tipo');
                const estaEquipado = e.target.getAttribute('data-equipado') === 'true';
                
                // Desequipa outros do mesmo tipo
                if(!estaEquipado) {
                    Object.entries(itens || {}).forEach(([k, v]) => {
                        if(v.tipo === tipo && v.equipado) {
                            update(ref(db, 'users/' + uid + '/inventario/' + k), { equipado: false });
                        }
                    });
                }

                update(ref(db, 'users/' + uid + '/inventario/' + id), { equipado: !estaEquipado });
            });
        });

        // Expandir/Recolher
        document.querySelectorAll('.expandable-card').forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('collapsed');
                card.classList.toggle('expanded');
            });
        });
    });
}

function atualizarPeso(pesoTotal) {
    const elValPeso = document.getElementById('valPeso');
    const elMaxPeso = document.getElementById('maxPeso');
    const elFillPeso = document.getElementById('fillPeso');
    const msgSobrecarga = document.getElementById('msgSobrecarga');
    
    const maxPeso = Number(elMaxPeso.innerText) || 20;
    elValPeso.innerText = pesoTotal.toFixed(1);
    
    const pct = (pesoTotal / maxPeso) * 100;
    elFillPeso.style.width = `${Math.min(100, pct)}%`;
    
    // Cores Progressivas
    if (pct >= 100) {
        elFillPeso.style.background = '#ff4444';
        msgSobrecarga.style.display = 'block';
        msgSobrecarga.innerHTML = '<i class="fas fa-exclamation-triangle"></i> LIMITE ATINGIDO!';
    } else if (pct > 50) {
        // Sobrecarga
        if (pct >= 90) elFillPeso.style.background = '#ff4444';
        else if (pct >= 75) elFillPeso.style.background = 'orangered';
        else elFillPeso.style.background = 'var(--color-power)';
        
        msgSobrecarga.style.display = 'block';
        // TODO: Implementar penalidades mecânicas de sobrecarga futuramente
        msgSobrecarga.innerHTML = '<i class="fas fa-weight-hanging"></i> SOBRECARGA';
    } else if (pct >= 25) {
        elFillPeso.style.background = 'var(--color-bonus)'; // Amarelo
        msgSobrecarga.style.display = 'none';
    } else {
        elFillPeso.style.background = 'var(--color-react)'; // Verde
        msgSobrecarga.style.display = 'none';
    }
}