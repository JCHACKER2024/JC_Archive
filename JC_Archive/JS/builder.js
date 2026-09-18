let tempCounter = 0;

function initBuilder(category) {
    const pool = document.getElementById('game-pool');
    const builderSection = document.getElementById('builder-section');
    const inputTitle = document.getElementById('tier-custom-title');
    const searchInput = document.getElementById('pool-search-input');
    
    if (!pool || !builderSection) {
        console.error("Erro crítico: Elementos 'game-pool' ou 'builder-section' não encontrados no HTML do index.");
        return;
    }

    // Limpar barra de pesquisa ao iniciar nova categoria
    if (searchInput) searchInput.value = '';
    
    pool.innerHTML = '';
    
    // Limpar tiers anteriores
    document.querySelectorAll('.tier-items').forEach(el => el.innerHTML = '');

    let rawItems = [];
    let titleText = "My Custom Tier List";

    if (category === 'jogos') {
        rawItems = (typeof dadosJogos !== 'undefined') ? dadosJogos : (typeof jogosData !== 'undefined' ? jogosData : (typeof fallbackJogos !== 'undefined' ? fallbackJogos : []));
        titleText = "Games Custom Tier List";
        if (rawItems.length === 0) console.warn("Aviso: 'dadosJogos' não foi encontrado ou está vazio!");
    } else if (category === 'filmes') {
        rawItems = (typeof dadosFilmes !== 'undefined') ? dadosFilmes : (typeof filmesData !== 'undefined' ? filmesData : (typeof fallbackFilmes !== 'undefined' ? fallbackFilmes : []));
        titleText = "Movies Custom Tier List";
    } else if (category === 'series') {
        rawItems = (typeof dadosSeries !== 'undefined') ? dadosSeries : (typeof seriesData !== 'undefined' ? seriesData : (typeof fallbackSeries !== 'undefined' ? fallbackSeries : []));
        titleText = "Series Custom Tier List";
    } else if (category === 'animes') {
        rawItems = (typeof dadosAnimes !== 'undefined') ? dadosAnimes : (typeof animesData !== 'undefined' ? animesData : (typeof fallbackAnimes !== 'undefined' ? fallbackAnimes : []));
        titleText = "Animes Custom Tier List";
    } else if (category === 'mix') {
        const j = (typeof dadosJogos !== 'undefined') ? dadosJogos : [];
        const f = (typeof dadosFilmes !== 'undefined') ? dadosFilmes : [];
        const s = (typeof dadosSeries !== 'undefined') ? dadosSeries : [];
        const a = (typeof dadosAnimes !== 'undefined') ? dadosAnimes : [];
        rawItems = [...j, ...f, ...s, ...a];
        titleText = "Custom Mix Tier List (All Media)";
    }

    // Atualizar o input do título com a sugestão automática
    if (inputTitle) {
        inputTitle.value = titleText;
    }

    builderSection.style.display = 'block';

    // Remover duplicados por título (séries/animes têm uma entrada por season)
    const titulosVistos = new Set();
    const itemsUnicos = rawItems.filter(objItem => {
        const nome = extrairNome(objItem);
        const chave = nome.toLowerCase();
        if (titulosVistos.has(chave)) return false;
        titulosVistos.add(chave);
        return true;
    });

    // Preencher o pool com os elementos arrastáveis gerados dinamicamente
    if (itemsUnicos.length > 0) {
        itemsUnicos.forEach((objItem, index) => {
            criarElementoArrastavel(objItem, 'item-' + category + '-' + index, pool);
        });
    } else {
        pool.innerHTML = '<p style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 20px;">Nenhum item encontrado para esta categoria. Verifica se o ficheiro de dados foi carregado.</p>';
    }

    // Scroll automático suave para a tier list
    builderSection.scrollIntoView({ behavior: 'smooth' });
}

// Extrai o nome/título de um item, seja objeto ou string manual
function extrairNome(dadosItem) {
    if (typeof dadosItem === 'object' && dadosItem !== null) {
        return dadosItem.jogo || dadosItem.titulo || dadosItem.nome || dadosItem.name || '';
    }
    return String(dadosItem);
}

// Função auxiliar para criar elementos arrastáveis — mostra apenas o título, igual em todas as categorias
function criarElementoArrastavel(dadosItem, idUnico, containerDestino) {
    const item = document.createElement('div');
    item.className = 'draggable-item';
    item.draggable = true;
    item.id = idUnico;

    const nome = extrairNome(dadosItem);
    item.innerHTML = `<strong>${nome}</strong>`;
    
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', e.target.id);
    });
    
    containerDestino.appendChild(item);
}

// Filtrar itens no pool em tempo real à medida que se escreve
function filtrarOuAdicionarItem(event) {
    const termo = event.target.value.toLowerCase().trim();
    const pool = document.getElementById('game-pool');
    if (!pool) return;
    const items = pool.querySelectorAll('.draggable-item');

    items.forEach(item => {
        const textoItem = item.innerText.toLowerCase();
        if (textoItem.includes(termo)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Detetar tecla Enter para adicionar instantaneamente o texto escrito
function verificarEnterAdicao(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        adicionarItemManual();
    }
}

// Função para adicionar manualmente o que estiver escrito na barra de pesquisa ao pool
function adicionarItemManual() {
    const searchInput = document.getElementById('pool-search-input');
    if (!searchInput) return;
    const valor = searchInput.value.trim();

    if (!valor) return;

    const pool = document.getElementById('game-pool');
    const todosItens = document.querySelectorAll('.draggable-item');
    let jaExiste = false;

    todosItens.forEach(el => {
        if (el.innerText.toLowerCase().includes(valor.toLowerCase())) {
            jaExiste = true;
            el.style.display = 'flex';
        }
    });

    if (!jaExiste) {
        tempCounter++;
        const novoId = 'item-custom-temp-' + tempCounter;
        criarElementoArrastavel(valor, novoId, pool);
    }

    // Limpar o input de pesquisa e restaurar a visibilidade de todos
    searchInput.value = '';
    todosItens.forEach(el => el.style.display = 'flex');
}

function allowDrop(ev) {
    ev.preventDefault();
}

function dropToTier(ev, tierName) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    const element = document.getElementById(id);
    const targetContainer = ev.currentTarget.querySelector('.tier-items');
    if (element && targetContainer) {
        targetContainer.appendChild(element);
    }
}

function dropToPool(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    const element = document.getElementById(id);
    const pool = document.getElementById('game-pool');
    if (element && pool) {
        pool.appendChild(element);
    }
}