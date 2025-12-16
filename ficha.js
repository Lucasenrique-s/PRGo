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
        configurarEdicao('valHp', 'hpAtual', 'maxHp', user.uid);
        configurarEdicao('valPp', 'ppAtual', 'maxPp', user.uid);
        
        // Inicializa a lógica da bandeja passando o user para salvar rolagem
        configurarEdicao('valNivel', 'nivel', 'null', user.uid);
        iniciarBandejaDados(user);
        configurarTema(); // <--- INICIA O TEMA
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
        dragStartTime = Date.now(); // Marca o tempo de início
        startX = e.clientX;
        startY = e.clientY;
        
        // Captura posição inicial mas NÃO altera estilos ainda
        // Isso evita que um clique simples quebre a ancoragem (right: 0)
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
                // SE ERA BOLINHA: Mantém bolinha e centraliza no mouse
                tray.style.transition = 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease';
                icon.className = "fas fa-dice-d20"; 

                // Centraliza no mouse (25, 25)
                initialLeft = startX - 25;
                initialTop = startY - 25;
            } else {
                // SE ESTAVA ABERTO: Mantém aberto e segue o mouse com o offset original
                tray.style.transition = 'none'; 
                // Não centraliza, usa o ponto onde clicou no header
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

    // --- SOLTAR (MOUSEUP) - AQUI ACONTECE A MÁGICA DO GRUDE ---
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
        
        // IMPORTANTE: Remove 'collapsed' para abrir ao soltar
        // tray.classList.remove('collapsed'); // REMOVIDO: Agora controlamos isso por caso

        if (distBottom < snapThreshold) {
            // GRUDA EM BAIXO (Modo Barra)
            tray.classList.add('dock-bottom');
            tray.classList.add('collapsed'); // FECHA AO GRUDAR EM BAIXO
            
            // ANIMAÇÃO DE DESCIDA
            const collapsedHeight = 45; 
            const targetTop = windowHeight - collapsedHeight;
            
            // Define posição inicial da animação (onde ele vai cair)
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
            // GRUDA NA ESQUERDA
            tray.classList.add('dock-side');
            tray.classList.add('collapsed'); // VIRA BOLINHA NA ESQUERDA
            
            tray.style.right = 'auto';
            tray.style.left = '0'; 
            tray.style.bottom = 'auto';
            
            // Ajusta Top para ficar visível
            let targetTop = Math.max(safeMargin, Math.min(rect.top, windowHeight - 100));
            tray.style.top = `${targetTop}px`;

            icon.className = "fas fa-dice-d20";

        } else if (distRight < snapThreshold) {
            // GRUDA NA DIREITA
            tray.classList.add('dock-side');
            tray.classList.add('collapsed'); // VIRA BOLINHA NA DIREITA
            
            tray.style.left = 'auto';
            tray.style.right = '0'; 
            tray.style.bottom = 'auto';
            
            let targetTop = Math.max(safeMargin, Math.min(rect.top, windowHeight - 100));
            tray.style.top = `${targetTop}px`;

            icon.className = "fas fa-dice-d20";

        } else {
            // FLUTUANDO (Sem dock)
            // Mantém o estado anterior (se estava fechado, continua. Se aberto, continua).
            
            // 1. Ajusta Horizontal (Left)
            let finalLeft = rect.left;
            if (finalLeft + 300 > windowWidth) {
                finalLeft = windowWidth - 300 - safeMargin;
            }
            tray.style.left = `${Math.max(safeMargin, finalLeft)}px`;
            tray.style.right = 'auto';

            // 2. Ajusta Vertical (Top/Bottom)
            // Se estiver muito em baixo, expande pra CIMA
            if (rect.top + estimatedHeight > windowHeight) {
                // Expande pra cima: Fixa Bottom
                const bottomPos = windowHeight - rect.bottom;
                tray.style.bottom = `${Math.max(safeMargin, bottomPos)}px`;
                tray.style.top = 'auto';
            } else {
                // Expande pra baixo: Fixa Top
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

    // --- CLIQUE NO HEADER (ABRIR/FECHAR) ---
    header.addEventListener('click', () => {
        // Só abre/fecha se NÃO moveu E se foi um clique rápido (< 200ms)
        const clickDuration = Date.now() - dragStartTime;
        
        if (!hasMoved && clickDuration < 200) {
            const willOpen = tray.classList.contains('collapsed');
            const isFloating = !tray.classList.contains('dock-bottom') && !tray.classList.contains('dock-side');
            const trayBody = tray.querySelector('.tray-body');

            if (willOpen) {
                // --- ABRINDO (Animação FLIP) ---
                const rect = tray.getBoundingClientRect();
                const startHeight = tray.offsetHeight;
                const startWidth = tray.offsetWidth;
                
                // Prepara para medir o tamanho final (sem animação)
                tray.style.transition = 'none';
                tray.classList.remove('collapsed');
                tray.style.height = 'auto';
                tray.style.width = '300px';
                tray.style.overflow = 'hidden';
                if(trayBody) trayBody.style.overflow = 'hidden';
                
                const targetHeight = tray.scrollHeight;
                
                // LÓGICA DE POSICIONAMENTO (Smart Expansion)
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                
                const spaceBelow = windowHeight - rect.top;
                const spaceAbove = rect.bottom; 
                
                // Se tiver pouco espaço em baixo (< 350px) e mais espaço em cima, expande pra CIMA
                if (spaceBelow < 350 && spaceAbove > spaceBelow) {
                    const bottomPos = windowHeight - rect.bottom;
                    tray.style.bottom = `${bottomPos}px`;
                    tray.style.top = 'auto';
                } else {
                    tray.style.top = `${rect.top}px`;
                    tray.style.bottom = 'auto';
                }

                // CORREÇÃO HORIZONTAL
                if (isFloating) {
                    const expandedWidth = 300;
                    if (rect.left + expandedWidth > windowWidth) {
                        const newLeft = windowWidth - expandedWidth - 10;
                        tray.style.left = `${Math.max(0, newLeft)}px`;
                    }
                }

                // Volta pro estado inicial para começar a animar
                tray.style.height = `${startHeight}px`;
                tray.style.width = `${startWidth}px`;
                
                tray.offsetHeight; // Força reflow
                
                // Ativa transição e vai pro final
                tray.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                tray.style.height = `${targetHeight}px`;
                tray.style.width = '300px';

                // Limpa estilo inline após animação
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
                
                // Define tamanho final
                if (tray.classList.contains('dock-side')) {
                    tray.style.height = '50px';
                    tray.style.width = '50px';
                } else {
                    tray.style.height = '45px';
                    tray.style.width = '300px';
                }

                // Limpa estilo inline
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
    // LÓGICA DE ROLAGEM (IGUAL À ANTERIOR)
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