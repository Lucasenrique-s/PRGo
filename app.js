console.log("O sistema iniciou!");

const botao = document.getElementById('btnTeste');
const textoStatus = document.getElementById('status');

botao.addEventListener('click', () => {
    alert("Funcionou! O JavaScript está rodando.");
    textoStatus.innerText = "Sistema Online ✅";
    textoStatus.style.color = "green";
});