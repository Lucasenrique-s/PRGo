// 1. IMPORTAÇÕES LIMPAS
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

// 2. SEGURANÇA: Verifica se está logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarFicha(user.uid);
        
        // Configura edição de vida/mana (clique no número)
        configurarEdicao('valHp', 'hpAtual', 'maxHp', user.uid);
        configurarEdicao('valPp', 'ppAtual', 'maxPp', user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// 3. FUNÇÃO PRINCIPAL
function carregarFicha(uid) {
    // Essa variável 'fichaRef' é vital!
    const fichaRef = ref(db, 'users/' + uid);

    // --- CARREGA DADOS DO PERSONAGEM ---
    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if(!dados) return;

        // SIDEBAR
        const elNome = document.getElementById('displayNome');
        if(elNome) elNome.innerText = dados.nome;
        
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

        // ENERGIA / PP
        const atualPP = dados.ppAtual || dados.enAtual || 0;
        const maxPP = dados.ppMax || dados.enMax || 1;

        const elValPp = document.getElementById('valPp');
        const elMaxPp = document.getElementById('maxPp');
        const elFillPp = document.getElementById('fillPp');

        if(elValPp) elValPp.innerText = atualPP;
        if(elMaxPp) elMaxPp.innerText = maxPP;
        
        if(elFillPp) {
            const pctPp = (atualPP / maxPP) * 100;
            elFillPp.style.width = `${Math.max(0, Math.min(100, pctPp))}%`;
        }

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

    // --- CARDS DE AÇÃO ---
    const acoesRef = ref(db, 'users/' + uid + '/acoes');

    onValue(acoesRef, (snapshot) => {
        const acoes = snapshot.val();
        
        // Limpa gavetas
        document.getElementById('lista-padrao').innerHTML = "";
        document.getElementById('lista-bonus').innerHTML = "";
        document.getElementById('lista-power').innerHTML = "";
        const listaReact = document.getElementById('lista-react');
        if(listaReact) listaReact.innerHTML = "";

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

            // Re-ativar botões deletar
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

    // --- LÓGICA DE NOVA AÇÃO (MODAL 1) ---
    const btnSalvarAcao = document.getElementById('btnSalvarAcao');
    const novoBtnSalvar = btnSalvarAcao.cloneNode(true); // Limpa eventos antigos
    btnSalvarAcao.parentNode.replaceChild(novoBtnSalvar, btnSalvarAcao);

    novoBtnSalvar.onclick = () => {
        const nome = document.getElementById('newActionName').value;
        const desc = document.getElementById('newActionDesc').value;
        const tipo = document.getElementById('newActionType').value;
        const tag = document.getElementById('newActionTag').value;

        if(nome) {
            push(acoesRef, {
                nome: nome,
                descricao: desc,
                tipo: tipo,
                tag: tag
            });
            // Limpa e fecha
            document.getElementById('newActionName').value = "";
            document.getElementById('newActionDesc').value = "";
            document.getElementById('newActionTag').value = "";
            document.getElementById('modalAcao').style.display = 'none';
        } else {
            alert("Dê um nome para sua ação!");
        }
    };

    // =========================================================
    // LÓGICA DA ENGRENAGEM / EDITAR FICHA (AGORA DENTRO DO ESCOPO!)
    // =========================================================
    const modalFicha = document.getElementById('modalFicha');
    const btnEditar = document.getElementById('btnEditarFicha');
    const btnFecharFicha = document.getElementById('btnFecharFicha');
    const btnSalvarFicha = document.getElementById('btnSalvarFicha');

    // 1. ABRIR: Preenche os inputs com valores atuais
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

    // 2. FECHAR
    if(btnFecharFicha) btnFecharFicha.onclick = () => {
        modalFicha.style.display = 'none';
    };

    // 3. SALVAR: Agora 'fichaRef' existe aqui!
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
            alert("Ficha atualizada com sucesso!");
            modalFicha.style.display = 'none';
        }).catch(erro => {
            alert("Erro ao atualizar: " + erro.message);
        });
    };

} // <--- FIM DA FUNÇÃO carregarFicha (IMPORTANTE!)


// 4. OUTROS EVENTOS GLOBAIS
const modal = document.getElementById('modalAcao');
const btnNova = document.getElementById('btnNovaAcao');
const btnFechar = document.getElementById('btnFecharModal');

// Abrir Modal Ação
if(btnNova) btnNova.onclick = () => { modal.style.display = 'flex'; };

// Fechar Modal Ação
if(btnFechar) btnFechar.onclick = () => { modal.style.display = 'none'; };

// Botão Sair
document.getElementById('btnSair').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// Lógica de Edição de Vida (Otimista)
function configurarEdicao(elementoId, campoBanco, elementoMaxId, uid) {
    const spanValor = document.getElementById(elementoId);
    if(!spanValor) return; 
    
    spanValor.addEventListener('click', function() {
        const valorAtualTexto = spanValor.innerText;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = ""; 
        input.placeholder = valorAtualTexto;
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
                voltarAoTexto(spanValor, input);
                return;
            }

            if (entrada.startsWith('+') || entrada.startsWith('-')) {
                novoValor = valorAtual + Number(entrada);
            } else {
                novoValor = Number(entrada);
            }

            if (novoValor > valorMax) novoValor = valorMax;

            // UI Otimista
            spanValor.innerText = novoValor;
            voltarAoTexto(spanValor, input);

            update(ref(db, 'users/' + uid), {
                [campoBanco]: novoValor
            });
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                salvar();
                input.blur(); 
            }
        });

        input.addEventListener('blur', salvar, { once: true });
    });
}

function voltarAoTexto(spanOriginal, inputElement) {
    if (inputElement.parentNode) {
        inputElement.parentNode.replaceChild(spanOriginal, inputElement);
    }
}